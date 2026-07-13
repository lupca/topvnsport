import contextvars
from typing import Optional

# Define context variables with default fallback values
actor_id_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("actor_id", default=None)
actor_username_var: contextvars.ContextVar[str] = contextvars.ContextVar("actor_username", default="guest")
actor_type_var: contextvars.ContextVar[str] = contextvars.ContextVar("actor_type", default="GUEST")  # 'USER', 'SERVICE', or 'GUEST'
ip_address_var: contextvars.ContextVar[str] = contextvars.ContextVar("ip_address", default="unknown")
correlation_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("correlation_id", default="")
audit_logged_var: contextvars.ContextVar[bool] = contextvars.ContextVar("audit_logged", default=False)


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

# Setters / Helper functions
def set_actor(username: str, actor_type: str, actor_id: Optional[str] = None):
    actor_username_var.set(username)
    actor_type_var.set(actor_type)
    actor_id_var.set(actor_id)

def set_ip(ip: str):
    ip_address_var.set(ip)

def set_correlation_id(corr_id: str):
    correlation_id_var.set(corr_id)
