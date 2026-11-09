from typing import Optional
from fastapi import Request, HTTPException, status
import os
import secrets
from jose import JWTError, jwt

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not JWT_SECRET_KEY:
    if os.getenv("ENV") == "production":
        raise RuntimeError("JWT_SECRET_KEY environment variable is required in production mode!")
    JWT_SECRET_KEY = "wms-dev-only-jwt-key-not-for-production"
JWT_ALGORITHM = "HS256"

# External seller API keys (``vk_…``) are verified by Identity at the gateway
# and stripped before reaching backends; the internal token must never share
# that namespace so the two credential types cannot be confused.
EXTERNAL_API_KEY_PREFIX = "vk_"


def _load_internal_service_token() -> str:
    token = os.getenv("INTERNAL_SERVICE_TOKEN", "").strip()
    if not token:
        raise RuntimeError(
            "INTERNAL_SERVICE_TOKEN environment variable is required "
            "(shared secret for OMS/WMS/PMI service-to-service calls)"
        )
    if token.startswith(EXTERNAL_API_KEY_PREFIX):
        raise RuntimeError(
            "INTERNAL_SERVICE_TOKEN must not start with 'vk_' "
            "(prefix reserved for external seller API keys)"
        )
    return token


INTERNAL_SERVICE_TOKEN = _load_internal_service_token()


def is_internal_service_token(value: Optional[str]) -> bool:
    if not value or value.startswith(EXTERNAL_API_KEY_PREFIX):
        return False
    return secrets.compare_digest(
        value.encode("utf-8"), INTERNAL_SERVICE_TOKEN.encode("utf-8")
    )


def get_current_user(request: Request) -> dict:
    """
    Authenticate user via:
    1. Gateway-injected X-User-* headers (primary)
    2. JWT Bearer token fallback (direct API access)
    """
    # Method 1: Gateway headers
    x_user_id = request.headers.get("X-User-Id")
    x_user_username = request.headers.get("X-User-Username")

    if x_user_id and x_user_username:
        return {
            "user_id": x_user_id,
            "username": x_user_username,
            "role": request.headers.get("X-User-Role", ""),
            "permissions": request.headers.get("X-User-Permissions", "").split(",") 
                          if request.headers.get("X-User-Permissions") else [],
            "tenant_id": request.headers.get("X-Tenant-Id"),
            "seller_id": request.headers.get("X-Seller-Id"),
        }

    # Method 2: JWT Bearer fallback
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]
        try:
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
            username = payload.get("sub")
            if username:
                return {
                    "user_id": str(payload.get("staff_id", "")),
                    "username": username,
                    "role": payload.get("role", ""),
                    "permissions": [],
                    "tenant_id": payload.get("tenant_id"),
                    "seller_id": payload.get("seller_id"),
                }
        except JWTError:
            pass

    # Method 3: X-API-Key fallback for internal service calls
    x_api_key = request.headers.get("X-API-Key")
    if x_api_key and x_api_key.startswith(EXTERNAL_API_KEY_PREFIX):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="External API keys are only accepted through the gateway",
        )
    if is_internal_service_token(x_api_key):
        return {
            "user_id": "service",
            "username": "internal_service",
            "role": "service",
            "permissions": [],
            "tenant_id": request.headers.get("X-Tenant-Id"),
            "seller_id": request.headers.get("X-Seller-Id"),
        }

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required"
    )


def get_optional_user(request: Request) -> Optional[dict]:
    """
    Same as get_current_user but returns None instead of raising.
    Use for endpoints that work both authenticated and unauthenticated.
    """
    try:
        return get_current_user(request)
    except HTTPException:
        return None
