import os
from contextlib import contextmanager
from contextvars import ContextVar, Token
from dataclasses import dataclass
from typing import Iterator, Optional
from uuid import UUID

from fastapi import HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


@dataclass(frozen=True)
class TenantContext:
    tenant_id: UUID
    seller_id: UUID


_tenant_context: ContextVar[Optional[TenantContext]] = ContextVar(
    "oms_tenant_context",
    default=None,
)
_maintenance_bypass: ContextVar[bool] = ContextVar(
    "oms_tenant_maintenance_bypass",
    default=False,
)


def parse_uuid(value: Optional[str], header_name: str) -> UUID:
    if not value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{header_name} is required",
        )
    try:
        return UUID(value)
    except (TypeError, ValueError, AttributeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{header_name} must be a valid UUID",
        ) from exc


def set_tenant_context(tenant_id: UUID | str, seller_id: UUID | str) -> Token:
    tenant_uuid = (
        tenant_id if isinstance(tenant_id, UUID) else parse_uuid(tenant_id, "tenant_id")
    )
    seller_uuid = (
        seller_id if isinstance(seller_id, UUID) else parse_uuid(seller_id, "seller_id")
    )
    return _tenant_context.set(TenantContext(tenant_uuid, seller_uuid))


def reset_tenant_context(token: Token) -> None:
    _tenant_context.reset(token)


def get_tenant_context() -> Optional[TenantContext]:
    return _tenant_context.get()


def require_tenant_context() -> TenantContext:
    context = get_tenant_context()
    if context is None and not _maintenance_bypass.get():
        raise RuntimeError("Tenant/seller context is required for OMS business data")
    return context


def is_maintenance_bypass() -> bool:
    return _maintenance_bypass.get()


@contextmanager
def tenant_context(tenant_id: UUID | str, seller_id: UUID | str) -> Iterator[TenantContext]:
    token = set_tenant_context(tenant_id, seller_id)
    try:
        yield require_tenant_context()
    finally:
        reset_tenant_context(token)


@contextmanager
def maintenance_bypass() -> Iterator[None]:
    """Explicit process-local bypass for migrations and controlled maintenance."""
    token = _maintenance_bypass.set(True)
    try:
        yield
    finally:
        _maintenance_bypass.reset(token)


SCOPED_PATH_PREFIXES = (
    "/orders",
    "/customers",
    "/channels",
    "/dashboard",
    "/products",
    "/api/payments",
    "/api/reconciliation",
    "/api/invoices",
    "/webhooks",
)
PUBLIC_CONTEXT_PATHS = (
    ("POST", "/orders"),
    ("POST", "/customers"),
    ("GET", "/channels"),
    ("POST", "/api/payments/checkout"),
    ("POST", "/webhooks/sepay"),
    ("POST", "/webhooks/vnpay"),
    ("POST", "/webhooks/shopee"),
    ("POST", "/webhooks/tiktok"),
    ("POST", "/webhooks/lazada"),
)


def _is_scoped_request(request: Request) -> bool:
    return request.method != "OPTIONS" and request.url.path.startswith(
        SCOPED_PATH_PREFIXES
    )


def _allows_configured_public_context(request: Request) -> bool:
    path = request.url.path.rstrip("/") or "/"
    return (request.method, path) in PUBLIC_CONTEXT_PATHS


class TenantContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not _is_scoped_request(request):
            return await call_next(request)

        from utils.auth import resolve_request_context

        try:
            user, context = resolve_request_context(
                request,
                allow_public=_allows_configured_public_context(request),
            )
        except HTTPException as exc:
            return JSONResponse(
                status_code=exc.status_code,
                content={"detail": exc.detail},
                headers=exc.headers,
            )

        token = set_tenant_context(context.tenant_id, context.seller_id)
        request.state.current_user = user
        try:
            return await call_next(request)
        finally:
            reset_tenant_context(token)


def configured_public_context() -> Optional[TenantContext]:
    tenant_id = os.getenv("OMS_PUBLIC_TENANT_ID")
    seller_id = os.getenv("OMS_PUBLIC_SELLER_ID")
    if not tenant_id and not seller_id:
        return None
    return TenantContext(
        parse_uuid(tenant_id, "OMS_PUBLIC_TENANT_ID"),
        parse_uuid(seller_id, "OMS_PUBLIC_SELLER_ID"),
    )
