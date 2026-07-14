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

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
security_bearer = HTTPBearer(auto_error=False)


async def get_current_identity(
    request: Request,
    api_key: Optional[str] = Security(api_key_header),
    token: Optional[HTTPAuthorizationCredentials] = Security(security_bearer),
    db: Session = Depends(get_db)
):
    """
    Authenticate requests via:
    1. X-API-Key (service-to-service from OMS/WMS)
    2. X-User-* headers (gateway-injected after auth_request)
    3. JWT Bearer fallback (direct API access, legacy)
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

    # 2. Gateway-injected X-User-* headers (primary method)
    x_user_id = request.headers.get("X-User-Id")
    x_user_username = request.headers.get("X-User-Username")

    if x_user_id and x_user_username:
        x_user_role = request.headers.get("X-User-Role", "")
        x_user_permissions = request.headers.get("X-User-Permissions", "")

        actor_username_var.set(x_user_username)
        actor_type_var.set("USER")
        actor_id_var.set(x_user_id)

        return {
            "actor_type": "USER",
            "actor_username": x_user_username,
            "actor_id": x_user_id,
            "role": x_user_role,
            "permissions": x_user_permissions.split(",") if x_user_permissions else [],
        }

    # 3. JWT Bearer fallback (direct API access without gateway)
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

        role = payload.get("role")
        user_id = str(payload.get("staff_id") or "")
        if not user_id:
            user_id = None

        actor_username_var.set(username)
        actor_type_var.set("USER")
        actor_id_var.set(user_id)

        identity = {
            "actor_type": "USER",
            "actor_username": username,
            "actor_id": user_id,
            "role": role
        }
        return identity

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication credentials are required"
    )
