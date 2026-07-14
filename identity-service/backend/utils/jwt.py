import os
import datetime
import secrets
from typing import Optional
from jose import jwt, JWTError

# JWT Configurations loaded from environment variables
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super_secret_key_change_me_in_production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

def create_access_token(staff_id: int, username: str, role: str) -> str:
    """
    Create a JWT access token containing staff_id, username, and role.
    """
    expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {
        "sub": username,
        "staff_id": staff_id,
        "username": username,
        "role": role,
        "exp": expire
    }
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def create_refresh_token(staff_id: int) -> tuple[str, datetime.datetime]:
    """
    Create a secure random refresh token and its expiration datetime.
    """
    token = secrets.token_hex(32)
    expires_at = datetime.datetime.utcnow() + datetime.timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    return token, expires_at

def decode_access_token(token: str) -> Optional[dict]:
    """
    Decode and validate a JWT access token.
    Returns the payload dictionary if valid, otherwise None.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None
