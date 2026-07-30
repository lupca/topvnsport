import contextvars
import uuid
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Iterator
from typing import Optional

# Define context variables with default fallback values
actor_id_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("actor_id", default=None)
actor_username_var: contextvars.ContextVar[str] = contextvars.ContextVar("actor_username", default="guest")
actor_type_var: contextvars.ContextVar[str] = contextvars.ContextVar("actor_type", default="GUEST")  # 'USER', 'SERVICE', or 'GUEST'
ip_address_var: contextvars.ContextVar[str] = contextvars.ContextVar("ip_address", default="unknown")
correlation_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("correlation_id", default="")
audit_logged_var: contextvars.ContextVar[bool] = contextvars.ContextVar("audit_logged", default=False)
tenant_id_var: contextvars.ContextVar[Optional[uuid.UUID]] = contextvars.ContextVar("tenant_id", default=None)
seller_id_var: contextvars.ContextVar[Optional[uuid.UUID]] = contextvars.ContextVar("seller_id", default=None)
tenant_context_active_var: contextvars.ContextVar[bool] = contextvars.ContextVar(
    "tenant_context_active", default=False
)


class TenantContextError(RuntimeError):
    """Raised when a tenant-aware data path has no complete ownership context."""


@dataclass(frozen=True)
class TenantContext:
    tenant_id: uuid.UUID
    seller_id: uuid.UUID


# Getters
def get_actor_id() -> Optional[str]:
    return actor_id_var.get()

def get_actor_username() -> str:
    return actor_username_var.get()

def get_actor_type() -> str:
    return actor_type_var.get()

def get_ip_address() -> str:
    return ip_address_var.get()

def get_correlation_id() -> str:
    return correlation_id_var.get()

def get_tenant_id() -> Optional[uuid.UUID]:
    return tenant_id_var.get()

def get_seller_id() -> Optional[uuid.UUID]:
    return seller_id_var.get()

def require_tenant_context() -> TenantContext:
    tenant_id = tenant_id_var.get()
    seller_id = seller_id_var.get()
    if not tenant_context_active_var.get() or tenant_id is None or seller_id is None:
        raise TenantContextError("Tenant and seller context is required")
    return TenantContext(tenant_id=tenant_id, seller_id=seller_id)

# Setters / Helper functions
def set_actor(username: str, actor_type: str, actor_id: Optional[str] = None):
    actor_username_var.set(username)
    actor_type_var.set(actor_type)
    actor_id_var.set(actor_id)

def set_ip(ip: str):
    ip_address_var.set(ip)

def set_correlation_id(corr_id: str):
    correlation_id_var.set(corr_id)

def set_tenant_context(tenant_id: uuid.UUID | str, seller_id: uuid.UUID | str) -> TenantContext:
    context = TenantContext(tenant_id=uuid.UUID(str(tenant_id)), seller_id=uuid.UUID(str(seller_id)))
    tenant_id_var.set(context.tenant_id)
    seller_id_var.set(context.seller_id)
    tenant_context_active_var.set(True)
    return context

@contextmanager
def tenant_context(tenant_id: uuid.UUID | str, seller_id: uuid.UUID | str) -> Iterator[TenantContext]:
    context = TenantContext(tenant_id=uuid.UUID(str(tenant_id)), seller_id=uuid.UUID(str(seller_id)))
    tenant_token = tenant_id_var.set(context.tenant_id)
    seller_token = seller_id_var.set(context.seller_id)
    active_token = tenant_context_active_var.set(True)
    try:
        yield context
    finally:
        tenant_context_active_var.reset(active_token)
        seller_id_var.reset(seller_token)
        tenant_id_var.reset(tenant_token)
