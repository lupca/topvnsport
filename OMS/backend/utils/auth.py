from typing import Optional
from fastapi import Request, HTTPException, status
import os
from jose import JWTError, jwt
from utils.tenant_context import (
    TenantContext,
    configured_public_context,
    parse_uuid,
)

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not JWT_SECRET_KEY:
    if os.getenv("ENV") == "production":
        raise RuntimeError("JWT_SECRET_KEY environment variable is required in production mode!")
    JWT_SECRET_KEY = "oms-dev-only-jwt-key-not-for-production"
JWT_ALGORITHM = "HS256"


def _gateway_user(request: Request) -> Optional[tuple[dict, str]]:
    x_user_id = request.headers.get("X-User-Id")
    x_user_username = request.headers.get("X-User-Username")
    if x_user_id and x_user_username:
        tenant_id = request.headers.get("X-Tenant-Id")
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Trusted gateway tenant context is missing",
            )
        return (
            {
                "user_id": x_user_id,
                "username": x_user_username,
                "role": request.headers.get("X-User-Role", ""),
                "permissions": request.headers.get(
                    "X-User-Permissions", ""
                ).split(",")
                if request.headers.get("X-User-Permissions")
                else [],
                "tenant_id": tenant_id,
                "tenant_code": request.headers.get("X-Tenant-Code", ""),
            },
            tenant_id,
        )
    return None


def _jwt_user(request: Request) -> Optional[tuple[dict, str]]:
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]
        try:
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
            username = payload.get("sub")
            tenant_id = payload.get("tenant_id")
            if not username or not tenant_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="JWT is missing tenant identity",
                )
            return (
                {
                    "user_id": str(payload.get("staff_id", "")),
                    "username": username,
                    "role": payload.get("role", ""),
                    "permissions": payload.get("permissions", []),
                    "tenant_id": tenant_id,
                    "tenant_code": payload.get("tenant_code", ""),
                },
                tenant_id,
            )
        except JWTError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired JWT token",
            ) from exc
    return None


def _service_user(request: Request) -> Optional[tuple[dict, str]]:
    x_api_key = request.headers.get("X-API-Key")
    internal_token = os.getenv("INTERNAL_SERVICE_TOKEN", "oms_wms_internal_api_key_secret_2026")
    if x_api_key and x_api_key == internal_token:
        tenant_id = request.headers.get("X-Tenant-Id")
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Internal service calls require X-Tenant-Id",
            )
        return (
            {
                "user_id": "service",
                "username": "internal_service",
                "role": "service",
                "permissions": [],
                "tenant_id": tenant_id,
            },
            tenant_id,
        )
    if x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal service credentials",
        )
    return None


def resolve_request_context(
    request: Request,
    *,
    allow_public: bool = False,
) -> tuple[Optional[dict], TenantContext]:
    """Resolve one immutable tenant/seller pair for all supported auth modes."""
    jwt_identity = _jwt_user(request)
    gateway_identity = _gateway_user(request)
    service_identity = _service_user(request)

    supplied = [
        identity
        for identity in (jwt_identity, gateway_identity, service_identity)
        if identity is not None
    ]
    if len(supplied) > 1:
        tenant_ids = {identity[1] for identity in supplied}
        if len(tenant_ids) != 1:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Conflicting authenticated tenant contexts",
            )

    if supplied:
        # Prefer locally verified JWT claims, then trusted gateway, then service auth.
        identity = jwt_identity or gateway_identity or service_identity
        user, tenant_id = identity
        seller_id = request.headers.get("X-Seller-Id")
        return user, TenantContext(
            parse_uuid(tenant_id, "tenant_id"),
            parse_uuid(seller_id, "X-Seller-Id"),
        )

    if allow_public:
        context = configured_public_context()
        if context is not None:
            return None, context

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required"
    )


def get_current_user(request: Request) -> dict:
    user = getattr(request.state, "current_user", None)
    if user is not None:
        return user
    user, _context = resolve_request_context(request)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    return user


def get_optional_user(request: Request) -> Optional[dict]:
    """
    Same as get_current_user but returns None instead of raising.
    Use for endpoints that work both authenticated and unauthenticated.
    """
    return getattr(request.state, "current_user", None)
