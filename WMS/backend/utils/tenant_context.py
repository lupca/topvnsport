from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import event
from sqlalchemy.orm import Session, with_loader_criteria

from database import get_db
from utils.auth import get_current_user


@dataclass(frozen=True)
class TenantContext:
    tenant_id: UUID
    seller_id: UUID


def _parse_uuid(value: object, header_name: str) -> UUID:
    try:
        return UUID(str(value))
    except (TypeError, ValueError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{header_name} must be a valid UUID",
        )


def require_tenant_context(
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> TenantContext:
    """Resolve and bind one explicit tenant/seller pair to the DB session."""
    bound_context = db.info.get("tenant_context")
    tenant_value = (
        current_user.get("tenant_id")
        or request.headers.get("X-Tenant-Id")
        or (bound_context.tenant_id if bound_context else None)
    )
    seller_value = (
        current_user.get("seller_id")
        or request.headers.get("X-Seller-Id")
        or (bound_context.seller_id if bound_context else None)
    )
    if not tenant_value or not seller_value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Tenant-Id and X-Seller-Id context is required",
        )

    tenant_id = _parse_uuid(tenant_value, "X-Tenant-Id")
    seller_id = _parse_uuid(seller_value, "X-Seller-Id")

    header_tenant = request.headers.get("X-Tenant-Id")
    header_seller = request.headers.get("X-Seller-Id")
    if header_tenant and current_user.get("tenant_id"):
        if _parse_uuid(header_tenant, "X-Tenant-Id") != tenant_id:
            raise HTTPException(status_code=403, detail="Tenant context mismatch")
    if header_seller and current_user.get("seller_id"):
        if _parse_uuid(header_seller, "X-Seller-Id") != seller_id:
            raise HTTPException(status_code=403, detail="Seller context mismatch")

    context = TenantContext(tenant_id=tenant_id, seller_id=seller_id)
    db.info["tenant_context"] = context
    return context


def require_public_tenant_context(
    request: Request,
    db: Session = Depends(get_db),
) -> TenantContext:
    """Bind public reads without requiring a user, but never without ownership."""
    tenant_value = request.headers.get("X-Tenant-Id")
    seller_value = request.headers.get("X-Seller-Id")
    if not tenant_value or not seller_value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Tenant-Id and X-Seller-Id context is required",
        )
    context = TenantContext(
        tenant_id=_parse_uuid(tenant_value, "X-Tenant-Id"),
        seller_id=_parse_uuid(seller_value, "X-Seller-Id"),
    )
    db.info["tenant_context"] = context
    return context


@event.listens_for(Session, "do_orm_execute")
def _scope_owned_selects(execute_state):
    if not execute_state.is_select:
        return
    context = execute_state.session.info.get("tenant_context")
    if context is None:
        return

    # Import lazily to avoid the database -> models -> database import cycle.
    from models import TenantOwned

    tenant_id = context.tenant_id
    seller_id = context.seller_id
    execute_state.statement = execute_state.statement.options(
        with_loader_criteria(
            TenantOwned,
            lambda cls: (cls.tenant_id == tenant_id) & (cls.seller_id == seller_id),
            include_aliases=True,
        )
    )


@event.listens_for(Session, "before_flush")
def _stamp_owned_writes(session, _flush_context, _instances):
    context = session.info.get("tenant_context")
    if context is None:
        return

    from models import TenantOwned

    for obj in session.new:
        if isinstance(obj, TenantOwned):
            if obj.tenant_id is None:
                obj.tenant_id = context.tenant_id
            if obj.seller_id is None:
                obj.seller_id = context.seller_id
            if obj.tenant_id != context.tenant_id or obj.seller_id != context.seller_id:
                raise ValueError("Cross-seller write rejected")
