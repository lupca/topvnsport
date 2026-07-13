import os
import secrets
import datetime
from datetime import timedelta
from typing import Optional, Any
from jose import JWTError, jwt
from passlib.context import CryptContext

# Crypt context for hashing passwords using bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Configuration constants loaded from environment
JWT_SECRET_KEY = os.environ["JWT_SECRET_KEY"]
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24 hours default
INTERNAL_SERVICE_TOKEN = os.environ["INTERNAL_SERVICE_TOKEN"]

def get_password_hash(password: str) -> str:
    """Hash a plaintext password using bcrypt."""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a stored bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)

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
    try:
        return secrets.compare_digest(api_key, INTERNAL_SERVICE_TOKEN)
    except TypeError:
        return False
