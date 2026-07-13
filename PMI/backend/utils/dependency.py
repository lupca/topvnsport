import logging
from typing import Optional
from fastapi import Depends, HTTPException, status, Security, Request
from fastapi.security import APIKeyHeader, HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db
import models
from utils.auth import decode_access_token, verify_service_token
from utils.context import actor_username_var, actor_type_var, actor_id_var

logger = logging.getLogger(__name__)

# Security schemes definition
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
security_bearer = HTTPBearer(auto_error=False)

async def get_current_identity(
    request: Request,
    api_key: Optional[str] = Security(api_key_header),
    token: Optional[HTTPAuthorizationCredentials] = Security(security_bearer),
    db: Session = Depends(get_db)
):
    """
    Dependency to authenticate incoming requests via Service Key or JWT Token.
    Binds actor type and identity to request context variables.
    """
    # 1. API Key Auth (Services - OMS/WMS)
    if api_key:
        if verify_service_token(api_key):
            service_header = request.headers.get("X-Service-Name")
            service_name = service_header if service_header else "OMS"
            actor_username_var.set(service_name)
            actor_type_var.set("SERVICE")
            actor_id_var.set(service_name)
            return {"actor_type": "SERVICE", "actor_username": service_name, "actor_id": service_name}
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Service API Key"
        )

    # 2. JWT Bearer Auth (Human Users)
    logger.debug(f"DEBUG_BE_GET_IDENTITY: token={token.credentials if token else None}")
    if token:
        payload = decode_access_token(token.credentials)
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired JWT token"
            )
        
        username = payload.get("sub")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token payload is missing subject claim"
            )
            
        user = db.query(models.User).filter(models.User.username == username).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account not found"
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is deactivated"
            )
            
        # Bind actor context
        actor_username_var.set(user.username)
        actor_type_var.set("USER")
        user_id = getattr(user, "id", None)
        actor_id_var.set(str(user_id) if user_id is not None else None)
        return {"actor_type": "USER", "actor_username": user.username, "actor_id": str(user_id) if user_id is not None else None, "user": user}

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication credentials are required"
    )
