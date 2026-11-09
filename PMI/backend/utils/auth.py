import os
import secrets
import datetime
from datetime import timedelta
from typing import Optional
from jose import JWTError, jwt
# Configuration constants loaded from environment
JWT_SECRET_KEY = os.environ["JWT_SECRET_KEY"]
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24 hours default

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

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Generate a JWT bearer token signed with the secret key."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.datetime.now(datetime.timezone.utc) + expires_delta
    else:
        expire = datetime.datetime.now(datetime.timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None

def verify_service_token(api_key: str) -> bool:
    """Verify if the X-API-Key matches the system's service token."""
    if not api_key or api_key.startswith(EXTERNAL_API_KEY_PREFIX):
        return False
    try:
        return secrets.compare_digest(api_key, INTERNAL_SERVICE_TOKEN)
    except TypeError:
        return False
