import uuid
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Header, Security, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from database import get_db
import models
from utils.dependency import get_current_identity
from utils.auth import INTERNAL_SERVICE_TOKEN
from utils.audit import record_audit_event
from utils.context import actor_username_var, actor_type_var, correlation_id_var
from pydantic import BaseModel

logger = logging.getLogger(__name__)

import os
ALLOWED_SERVICE_KEYS = set(os.environ["ALLOWED_SERVICE_KEYS"].split(","))

router = APIRouter(prefix="/api", tags=["Audit Logs"])

class SyncStockRequest(BaseModel):
    product_id: int
    stock: int

class SecurityLogRequest(BaseModel):
    path: str

@router.get("/audit-logs")
def get_audit_logs(
    page: int = 1,
    limit: int = 50,
    module: Optional[str] = None,
    module_filter: Optional[str] = None,
    actor: Optional[str] = None,
    actor_filter: Optional[str] = None,
    action: Optional[str] = None,
    action_filter: Optional[str] = None,
    correlation_id: Optional[str] = None,
    keyword: Optional[str] = None,
    current_identity: dict = Depends(get_current_identity),
    db: Session = Depends(get_db)
):
    # Checks that user role is admin
    user = current_identity.get("user")
    role = user.role if user else current_identity.get("role")
    if not role or role.lower() not in ["admin", "administrator"]:
        # Log a security intrusion event to audit_outbox
        username = user.username if user else current_identity.get("actor_username", "guest")
        actor_username_var.set(username)
        actor_type_var.set("USER")
        record_audit_event(
            db_session=db,
            module="Security",
            action_type="SECURITY",
            entity_type="Page",
            entity_id="/settings/audit",
            path="/settings/audit"
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Admin access required"
        )

    # Validate page and limit
    if page < 1 or limit < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Page and limit parameters must be positive integers greater than or equal to 1."
        )
    if limit > 100:
        limit = 100

    query = db.query(models.AuditLog)

    # Apply filters
    if module:
        query = query.filter(models.AuditLog.module == module)
    if module_filter:
        query = query.filter(models.AuditLog.module.ilike(f"%{module_filter}%"))
    if actor:
        query = query.filter(models.AuditLog.actor_username == actor)
    if actor_filter:
        query = query.filter(models.AuditLog.actor_username.ilike(f"%{actor_filter}%"))
    if action:
        query = query.filter(models.AuditLog.action_type == action)
    if action_filter:
        query = query.filter(models.AuditLog.action_type.ilike(f"%{action_filter}%"))
    if correlation_id:
        query = query.filter(models.AuditLog.correlation_id == correlation_id)

    if keyword:
        keyword_filter = f"%{keyword}%"
        query = query.filter(
            or_(
                models.AuditLog.actor_username.ilike(keyword_filter),
                models.AuditLog.action_type.ilike(keyword_filter),
                models.AuditLog.module.ilike(keyword_filter),
                models.AuditLog.entity_type.ilike(keyword_filter),
                models.AuditLog.entity_id.ilike(keyword_filter),
                models.AuditLog.raw_details.ilike(keyword_filter),
                models.AuditLog.path.ilike(keyword_filter)
            )
        )

    # Total count
    total = query.count()

    # Pagination and ordering
    offset = (page - 1) * limit
    logs = query.order_by(models.AuditLog.created_at.desc()).offset(offset).limit(limit).all()

    # Map database columns to frontend-expected fields
    data = []
    for log in logs:
        entity_name = f"{log.entity_type} ({log.entity_id})" if (log.entity_type and log.entity_id) else (log.entity_type or "N/A")
        details = log.changes if log.changes else {"raw_details": log.raw_details}
        data.append({
            "id": str(log.id),
            "timestamp": log.created_at,
            "action": log.action_type,
            "module": log.module,
            "actor": log.actor_username,
            "entity_id": log.entity_id,
            "entity_name": entity_name,
            "details": details,
            "ip_address": log.ip_address,
            "correlation_id": str(log.correlation_id)
        })

    return {
        "data": data,
        "total": total,
        "page": page,
        "limit": limit
    }

@router.post("/service/sync-stock")
def sync_stock(
    body: SyncStockRequest,
    x_api_key: str = Header(..., alias="X-API-Key"),
    x_correlation_id: Optional[str] = Header(None, alias="X-Correlation-ID"),
    db: Session = Depends(get_db)
):
    # Check X-API-Key
    if x_api_key not in ALLOWED_SERVICE_KEYS and x_api_key != INTERNAL_SERVICE_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API Key"
        )

    # Sets thread local context variables
    actor_username_var.set("stock_sync_service")
    actor_type_var.set("SERVICE")
    if x_correlation_id:
        correlation_id_var.set(x_correlation_id)
    else:
        correlation_id_var.set("")

    # Update variants
    product = db.query(models.Product).filter(models.Product.id == body.product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )

    old_stock = sum(v.stock for v in product.variants)
    for variant in product.variants:
        variant.stock = body.stock
    new_stock = sum(variant.stock for variant in product.variants)

    # Log update event to outbox
    record_audit_event(
        db_session=db,
        module="Product",
        action_type="UPDATE",
        entity_type="Product",
        entity_id=str(product.id),
        changes={"stock": [old_stock, new_stock]}
    )

    db.commit()
    return {"message": "Stock synchronized successfully"}

@router.post("/audit-logs/security")
def log_security_intrusion(
    body: SecurityLogRequest,
    current_identity: dict = Depends(get_current_identity),
    db: Session = Depends(get_db)
):
    user = current_identity.get("user")
    actor_type = current_identity.get("actor_type")
    role = user.role if user else current_identity.get("role")
    
    # Only allow admin users or internal services to manually log security events
    if actor_type == "SERVICE":
        pass
    elif role and role.lower() in ["admin", "administrator"]:
        pass
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only admin users or services can log security events"
        )

    username = current_identity.get("actor_username")
    
    # Sets thread local context variables
    actor_username_var.set(username)
    actor_type_var.set("USER" if actor_type != "SERVICE" else "SERVICE")
    
    actor_id = str(user.id) if user else current_identity.get("actor_id")
    if actor_id:
        from utils.context import actor_id_var
        actor_id_var.set(actor_id)

    # Writes a security event to audit_outbox
    record_audit_event(
        db_session=db,
        module="Security",
        action_type="SECURITY",
        entity_type="Page",
        entity_id=body.path,
        path=body.path
    )
    db.commit()

    return {"message": "Security intrusion event logged successfully"}