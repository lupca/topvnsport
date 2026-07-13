import uuid
import ipaddress
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from utils.context import correlation_id_var, ip_address_var, actor_username_var, actor_type_var, actor_id_var

def get_client_ip(request: Request) -> str:
    # Get direct connection client host
    client_host = request.client.host if request.client else "unknown"
    
    # Check X-Forwarded-For
    x_forwarded_for = request.headers.get("X-Forwarded-For")
    if not x_forwarded_for:
        return client_host
        
    # Split the X-Forwarded-For header into list of IPs
    ips = [ip.strip() for ip in x_forwarded_for.split(",") if ip.strip()]
    if not ips:
        return client_host
        
    def is_private_ip(ip: str) -> bool:
        try:
            return ipaddress.ip_address(ip).is_private
        except ValueError:
            return True # Treat invalid IP as private/untrusted
            
    if is_private_ip(client_host):
        # Trust the rightmost IP in the X-Forwarded-For chain
        return ips[-1]
    
    return client_host

class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Determine Correlation ID
        corr_id = request.headers.get("X-Correlation-ID")
        if not corr_id:
            corr_id = str(uuid.uuid4())
            
        # Determine Client IP securely
        ip_addr = get_client_ip(request)

        # Default Actor Identity to guest/GUEST in middleware
        # (Authentication dependency will populate validated user/service state)
        actor_name = "guest"
        actor_type = "GUEST"
        actor_id = None

        # Apply variables to thread/async context
        token_corr = correlation_id_var.set(corr_id)
        token_ip = ip_address_var.set(ip_addr)
        token_actor = actor_username_var.set(actor_name)
        token_type = actor_type_var.set(actor_type)
        token_actor_id = actor_id_var.set(actor_id)

        try:
            response = await call_next(request)
            # Inject Correlation ID into response headers
            response.headers["X-Correlation-ID"] = corr_id
            return response
        finally:
            # Clean up/reset context variables to prevent memory leaks or context crossover
            correlation_id_var.reset(token_corr)
            ip_address_var.reset(token_ip)
            actor_username_var.reset(token_actor)
            actor_type_var.reset(token_type)
            actor_id_var.reset(token_actor_id)
