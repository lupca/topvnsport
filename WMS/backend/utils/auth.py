from typing import Optional
from fastapi import Request, HTTPException, status
import os
from jose import JWTError, jwt

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "identity_jwt_secret_key_2026_change_me_in_prod")
JWT_ALGORITHM = "HS256"


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
                }
        except JWTError:
            pass

    # Method 3: X-API-Key fallback for internal service calls
    x_api_key = request.headers.get("X-API-Key")
    internal_token = os.getenv("INTERNAL_SERVICE_TOKEN", "oms_wms_internal_api_key_secret_2026")
    if x_api_key and x_api_key == internal_token:
        return {
            "user_id": "service",
            "username": "internal_service",
            "role": "service",
            "permissions": [],
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
