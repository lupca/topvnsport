from typing import Optional
from fastapi import Request, HTTPException, status


def get_current_user(request: Request) -> dict:
    """
    Extract user info from gateway-injected X-User-* headers.
    Returns dict with user info or raises 401 if not authenticated.
    """
    x_user_id = request.headers.get("X-User-Id")
    x_user_username = request.headers.get("X-User-Username")

    if not x_user_id or not x_user_username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    return {
        "user_id": x_user_id,
        "username": x_user_username,
        "role": request.headers.get("X-User-Role", ""),
        "permissions": request.headers.get("X-User-Permissions", "").split(",") if request.headers.get("X-User-Permissions") else [],
    }


def get_optional_user(request: Request) -> Optional[dict]:
    """
    Extract user info from headers if present, otherwise return None.
    Use for endpoints that work both authenticated and unauthenticated.
    """
    x_user_id = request.headers.get("X-User-Id")
    x_user_username = request.headers.get("X-User-Username")

    if not x_user_id or not x_user_username:
        return None

    return {
        "user_id": x_user_id,
        "username": x_user_username,
        "role": request.headers.get("X-User-Role", ""),
        "permissions": request.headers.get("X-User-Permissions", "").split(",") if request.headers.get("X-User-Permissions") else [],
    }
