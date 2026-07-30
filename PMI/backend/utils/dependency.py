import json
import logging
import os
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from typing import Optional
from fastapi import Depends, HTTPException, status, Security, Request
from fastapi.security import APIKeyHeader, HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db
from utils.auth import decode_access_token, verify_service_token
from utils.context import actor_username_var, actor_type_var, actor_id_var, set_tenant_context

logger = logging.getLogger(__name__)

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
security_bearer = HTTPBearer(auto_error=False)
_membership_cache: dict[tuple[uuid.UUID, uuid.UUID], float] = {}


def _parse_uuid(value: Optional[str], label: str, status_code: int) -> uuid.UUID:
    if not value:
        raise HTTPException(status_code=status_code, detail=f"{label} is required")
    try:
        return uuid.UUID(value)
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(status_code=status_code, detail=f"{label} must be a valid UUID")


def _configured_membership(tenant_id: uuid.UUID, seller_id: uuid.UUID) -> Optional[bool]:
    """Use an explicit test mapping without creating a production auth bypass."""
    if os.getenv("TESTING", "false").lower() != "true":
        return None
    raw = os.getenv("PMI_SELLER_TENANT_MAP")
    if not raw:
        return None
    try:
        mapping = json.loads(raw)
    except json.JSONDecodeError:
        logger.error("PMI_SELLER_TENANT_MAP is not valid JSON")
        return False
    configured_tenant = mapping.get(str(seller_id))
    return configured_tenant is not None and str(configured_tenant) == str(tenant_id)


def validate_seller_membership(tenant_id: uuid.UUID, seller_id: uuid.UUID) -> None:
    """Fail closed unless Identity confirms the active seller belongs to the tenant."""
    cache_key = (tenant_id, seller_id)
    now = time.monotonic()
    if _membership_cache.get(cache_key, 0) > now:
        return

    configured = _configured_membership(tenant_id, seller_id)
    if configured is not None:
        if not configured:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Seller does not belong to the authenticated tenant",
            )
        _membership_cache[cache_key] = now + min(
            max(float(os.getenv("SELLER_MEMBERSHIP_CACHE_TTL", "30")), 0),
            300,
        )
        return

    validation_url = os.getenv("IDENTITY_SELLER_VALIDATION_URL")
    if not validation_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Seller membership validation is unavailable",
        )

    url = validation_url.format(seller_id=str(seller_id))
    separator = "&" if "?" in url else "?"
    url = f"{url}{separator}{urllib.parse.urlencode({'tenant_id': str(tenant_id)})}"
    headers = {}
    service_token = os.getenv("INTERNAL_SERVICE_TOKEN")
    if service_token:
        headers["X-API-Key"] = service_token

    try:
        with urllib.request.urlopen(
            urllib.request.Request(url, headers=headers),
            timeout=float(os.getenv("IDENTITY_VALIDATION_TIMEOUT_SECONDS", "2")),
        ) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        if exc.code in (401, 403, 404):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Seller does not belong to the authenticated tenant",
            )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Seller membership validation is unavailable",
        )
    except (OSError, ValueError, json.JSONDecodeError):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Seller membership validation is unavailable",
        )

    matches = (
        payload.get("active") is True
        and str(payload.get("tenant_id")) == str(tenant_id)
        and str(payload.get("seller_id", seller_id)) == str(seller_id)
    )
    if not matches:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seller does not belong to the authenticated tenant",
        )
    _membership_cache[cache_key] = now + min(
        max(float(os.getenv("SELLER_MEMBERSHIP_CACHE_TTL", "30")), 0),
        300,
    )


def _establish_tenant_context(tenant_value: Optional[str], seller_value: Optional[str]):
    tenant_id = _parse_uuid(tenant_value, "Tenant context", status.HTTP_401_UNAUTHORIZED)
    seller_id = _parse_uuid(seller_value, "X-Seller-Id", status.HTTP_400_BAD_REQUEST)
    validate_seller_membership(tenant_id, seller_id)
    return set_tenant_context(tenant_id, seller_id)


async def require_public_seller_context():
    """Resolve public/storefront reads to one explicitly configured seller."""
    context = _establish_tenant_context(
        os.getenv("PUBLIC_TENANT_ID"),
        os.getenv("PUBLIC_SELLER_ID"),
    )
    return {"tenant_id": str(context.tenant_id), "seller_id": str(context.seller_id)}


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
            context = _establish_tenant_context(
                request.headers.get("X-Tenant-Id"),
                request.headers.get("X-Seller-Id"),
            )
            service_header = request.headers.get("X-Service-Name")
            service_name = service_header if service_header else "OMS"
            actor_username_var.set(service_name)
            actor_type_var.set("SERVICE")
            actor_id_var.set(service_name)
            return {
                "actor_type": "SERVICE",
                "actor_username": service_name,
                "actor_id": service_name,
                "tenant_id": str(context.tenant_id),
                "seller_id": str(context.seller_id),
            }
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Service API Key"
        )

    # 2. Gateway-injected X-User-* headers (primary method)
    x_user_id = request.headers.get("X-User-Id")
    x_user_username = request.headers.get("X-User-Username")

    if x_user_id and x_user_username:
        context = _establish_tenant_context(
            request.headers.get("X-Tenant-Id"),
            request.headers.get("X-Seller-Id"),
        )
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
            "permissions": [p.strip() for p in x_user_permissions.split(",") if p.strip()] if x_user_permissions else [],
            "tenant_id": str(context.tenant_id),
            "seller_id": str(context.seller_id),
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
        context = _establish_tenant_context(
            payload.get("tenant_id"),
            request.headers.get("X-Seller-Id"),
        )
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
            "role": role,
            "tenant_id": str(context.tenant_id),
            "seller_id": str(context.seller_id),
        }
        return identity

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication credentials are required"
    )


# Re-export RBAC helpers from utils.permissions
from utils.permissions import has_permission, require_permission, require_role  # noqa: F401
