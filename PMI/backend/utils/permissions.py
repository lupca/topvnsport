import logging
from enum import Enum
from typing import Dict, List, Union, Optional
from fastapi import Depends, HTTPException, status

logger = logging.getLogger(__name__)


class Permission(str, Enum):
    # Products
    PRODUCT_READ = "product:read"
    PRODUCT_CREATE = "product:create"
    PRODUCT_UPDATE = "product:update"
    PRODUCT_DELETE = "product:delete"
    PRODUCT_IMPORT = "product:import"
    PRODUCT_WRITE = "product:write"

    # Categories
    CATEGORY_READ = "category:read"
    CATEGORY_CREATE = "category:create"
    CATEGORY_UPDATE = "category:update"
    CATEGORY_DELETE = "category:delete"
    CATEGORY_WRITE = "category:write"

    # Attributes
    ATTRIBUTE_READ = "attribute:read"
    ATTRIBUTE_CREATE = "attribute:create"
    ATTRIBUTE_UPDATE = "attribute:update"
    ATTRIBUTE_DELETE = "attribute:delete"

    # Channels
    CHANNEL_READ = "channel:read"
    CHANNEL_CREATE = "channel:create"
    CHANNEL_UPDATE = "channel:update"
    CHANNEL_DELETE = "channel:delete"

    # Upload
    UPLOAD_WRITE = "upload:write"


ROLE_PERMISSIONS: Dict[str, List[str]] = {
    "admin": ["*"],
    "product_manager": [
        "product:read", "product:create", "product:update", "product:delete", "product:import", "product:write",
        "category:read", "category:create", "category:update", "category:delete", "category:write",
        "attribute:read", "attribute:create", "attribute:update", "attribute:delete",
        "channel:read", "channel:create", "channel:update", "channel:delete",
        "upload:write",
    ],
    "inventory_staff": [
        "product:read", "product:update", "product:write",
        "category:read",
        "attribute:read",
        "channel:read",
    ],
    "viewer": [
        "product:read",
        "category:read",
        "attribute:read",
        "channel:read",
    ],
}


def _strip_pmi_prefix(permission_str: str) -> str:
    if permission_str.startswith("pmi:"):
        return permission_str[4:]
    return permission_str


def _extract_role(identity: dict) -> Optional[str]:
    role = identity.get("role")
    if not role and identity.get("user"):
        user_obj = identity.get("user")
        if hasattr(user_obj, "role"):
            role = getattr(user_obj, "role", None)
        elif isinstance(user_obj, dict):
            role = user_obj.get("role")
    return role


def has_permission(identity: dict, required_permission: str) -> bool:
    """
    Evaluates if identity possesses the required permission.
    Supports:
    1. Service actor bypass (actor_type == 'SERVICE')
    2. Admin role bypass (role == 'admin')
    3. Wildcard permissions ('*', 'pmi:*', '<domain>:*', 'pmi:<domain>:*')
    4. Exact or domain-namespaced permission matching ('product:create', 'pmi:product:create')
    5. Fallback to ROLE_PERMISSIONS mapping if permissions list is empty.
    """
    if not identity or not isinstance(identity, dict):
        return False

    # Rule 2: Service actor or Admin bypass
    if identity.get("actor_type") == "SERVICE":
        return True

    user_role = _extract_role(identity)
    if user_role == "admin":
        return True

    # Rule 3: Get permissions or fallback to role-permission mapping
    permissions = identity.get("permissions")
    if permissions is None or (isinstance(permissions, (list, tuple)) and len(permissions) == 0):
        if user_role:
            permissions = ROLE_PERMISSIONS.get(user_role, [])
        else:
            permissions = []

    if not permissions:
        return False

    # Build set of normalized permissions for matching
    norm_perms = set()
    for p in permissions:
        if isinstance(p, str) and p.strip():
            cleaned = p.strip()
            norm_perms.add(cleaned)
            norm_perms.add(_strip_pmi_prefix(cleaned))

    if "*" in norm_perms:
        return True

    req_norm = _strip_pmi_prefix(required_permission)

    if required_permission in norm_perms or req_norm in norm_perms or f"pmi:{req_norm}" in norm_perms:
        return True

    if ":" in req_norm:
        domain = req_norm.split(":")[0]
        if f"{domain}:*" in norm_perms or f"pmi:{domain}:*" in norm_perms:
            return True

    return False


def require_permission(permission: str):
    """
    FastAPI dependency enforcing a specific permission requirement.
    """
    from utils.dependency import get_current_identity

    async def permission_checker(identity: dict = Depends(get_current_identity)) -> dict:
        if not identity or not isinstance(identity, dict):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication credentials are required"
            )

        if not has_permission(identity, permission):
            logger.warning(
                f"Permission check failed for user '{identity.get('actor_username')}' "
                f"(role: '{identity.get('role')}') requesting permission '{permission}'"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Insufficient permissions"
            )

        return identity

    return permission_checker


def require_role(role: Union[str, List[str]]):
    """
    FastAPI dependency enforcing role membership.
    """
    from utils.dependency import get_current_identity

    allowed_roles = {role} if isinstance(role, str) else set(role)

    async def role_checker(identity: dict = Depends(get_current_identity)) -> dict:
        if not identity or not isinstance(identity, dict):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication credentials are required"
            )

        if identity.get("actor_type") == "SERVICE":
            return identity

        user_role = _extract_role(identity)
        if user_role == "admin" or user_role in allowed_roles:
            return identity

        logger.warning(
            f"Role check failed for user '{identity.get('actor_username')}': "
            f"role '{user_role}' not in required roles {allowed_roles}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Insufficient permissions"
        )

    return role_checker
