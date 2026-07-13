# Backend Package: Auth Module

## Task ID: BE-06
## Prerequisites: BE-00 (Setup)
## Estimated: 2 hours

---

## Mục Tiêu

Tạo JWT authentication utilities với:
- Token creation và verification
- FastAPI dependencies
- Configurable expiry và claims

---

## Implementation

### File: `packages/backend-common/topvnsport_common/auth.py`

```python
"""JWT authentication utilities for FastAPI applications."""

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError, ExpiredSignatureError
from pydantic import BaseModel

from .exceptions import UnauthorizedError


# Security scheme
security = HTTPBearer(auto_error=False)


class TokenPayload(BaseModel):
    """JWT token payload model."""
    sub: str
    exp: datetime
    iat: datetime
    jti: Optional[str] = None
    
    # Custom claims
    extra: dict[str, Any] = {}


class TokenConfig:
    """Configuration for JWT tokens."""
    
    def __init__(
        self,
        secret_key: Optional[str] = None,
        algorithm: str = "HS256",
        access_token_expire_minutes: int = 30,
        refresh_token_expire_days: int = 7,
    ):
        self.secret_key = secret_key or os.getenv("JWT_SECRET_KEY")
        if not self.secret_key:
            raise ValueError(
                "JWT_SECRET_KEY not set. Provide secret_key argument "
                "or set JWT_SECRET_KEY environment variable."
            )
        self.algorithm = algorithm
        self.access_token_expire_minutes = access_token_expire_minutes
        self.refresh_token_expire_days = refresh_token_expire_days


def create_access_token(
    subject: str,
    config: TokenConfig,
    expires_delta: Optional[timedelta] = None,
    extra_claims: Optional[dict[str, Any]] = None,
) -> str:
    """
    Create JWT access token.
    
    Args:
        subject: Token subject (usually user ID)
        config: Token configuration
        expires_delta: Custom expiry time (defaults to config)
        extra_claims: Additional claims to include
    
    Returns:
        Encoded JWT token
    
    Example:
        config = TokenConfig(secret_key="my-secret")
        token = create_access_token("user-123", config, extra_claims={"role": "admin"})
    """
    now = datetime.now(timezone.utc)
    
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=config.access_token_expire_minutes)
    
    payload = {
        "sub": str(subject),
        "exp": expire,
        "iat": now,
        "type": "access",
    }
    
    if extra_claims:
        payload.update(extra_claims)
    
    return jwt.encode(payload, config.secret_key, algorithm=config.algorithm)


def create_refresh_token(
    subject: str,
    config: TokenConfig,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create JWT refresh token.
    
    Args:
        subject: Token subject (usually user ID)
        config: Token configuration
        expires_delta: Custom expiry time (defaults to config)
    
    Returns:
        Encoded JWT refresh token
    """
    now = datetime.now(timezone.utc)
    
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(days=config.refresh_token_expire_days)
    
    payload = {
        "sub": str(subject),
        "exp": expire,
        "iat": now,
        "type": "refresh",
    }
    
    return jwt.encode(payload, config.secret_key, algorithm=config.algorithm)


def verify_token(
    token: str,
    config: TokenConfig,
    token_type: Optional[str] = None,
) -> dict[str, Any]:
    """
    Verify and decode JWT token.
    
    Args:
        token: JWT token string
        config: Token configuration
        token_type: Expected token type ("access" or "refresh")
    
    Returns:
        Decoded token payload
    
    Raises:
        UnauthorizedError: If token is invalid or expired
    """
    try:
        payload = jwt.decode(
            token,
            config.secret_key,
            algorithms=[config.algorithm],
        )
        
        # Verify token type if specified
        if token_type and payload.get("type") != token_type:
            raise UnauthorizedError(f"Invalid token type. Expected {token_type}")
        
        return payload
    except ExpiredSignatureError:
        raise UnauthorizedError("Token has expired")
    except JWTError as e:
        raise UnauthorizedError(f"Invalid token: {str(e)}")


def get_current_user_dependency(config: TokenConfig):
    """
    Create FastAPI dependency for getting current user from token.
    
    Args:
        config: Token configuration
    
    Returns:
        Dependency function
    
    Example:
        config = TokenConfig(secret_key="my-secret")
        get_current_user = get_current_user_dependency(config)
        
        @app.get("/me")
        def me(user_id: str = Depends(get_current_user)):
            return {"user_id": user_id}
    """
    async def get_current_user(
        credentials: HTTPAuthorizationCredentials = Depends(security),
    ) -> str:
        if not credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        token = credentials.credentials
        payload = verify_token(token, config, token_type="access")
        
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        return user_id
    
    return get_current_user


def get_optional_user_dependency(config: TokenConfig):
    """
    Create FastAPI dependency for optionally getting current user.
    
    Returns None if no token provided, user_id if valid token.
    
    Args:
        config: Token configuration
    
    Returns:
        Dependency function
    """
    async def get_optional_user(
        credentials: HTTPAuthorizationCredentials = Depends(security),
    ) -> Optional[str]:
        if not credentials:
            return None
        
        try:
            token = credentials.credentials
            payload = verify_token(token, config, token_type="access")
            return payload.get("sub")
        except UnauthorizedError:
            return None
    
    return get_optional_user


def get_token_payload_dependency(config: TokenConfig):
    """
    Create FastAPI dependency for getting full token payload.
    
    Args:
        config: Token configuration
    
    Returns:
        Dependency function that returns full payload dict
    """
    async def get_token_payload(
        credentials: HTTPAuthorizationCredentials = Depends(security),
    ) -> dict[str, Any]:
        if not credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        token = credentials.credentials
        return verify_token(token, config, token_type="access")
    
    return get_token_payload
```

---

## Test Cases

### File: `packages/backend-common/tests/unit/test_auth.py`

```python
"""Tests for auth module."""

import pytest
from datetime import timedelta, datetime, timezone
from unittest.mock import patch
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient
from jose import jwt

from topvnsport_common.auth import (
    TokenConfig,
    create_access_token,
    create_refresh_token,
    verify_token,
    get_current_user_dependency,
    get_optional_user_dependency,
    get_token_payload_dependency,
)
from topvnsport_common.exceptions import UnauthorizedError


@pytest.fixture
def config():
    """Create test token config."""
    return TokenConfig(
        secret_key="test-secret-key-for-testing",
        algorithm="HS256",
        access_token_expire_minutes=30,
        refresh_token_expire_days=7,
    )


class TestTokenConfig:
    """Tests for TokenConfig."""

    def test_creates_with_explicit_key(self):
        """Should create config with explicit secret key."""
        config = TokenConfig(secret_key="my-secret")
        assert config.secret_key == "my-secret"
        assert config.algorithm == "HS256"

    def test_reads_key_from_env(self):
        """Should read secret key from environment."""
        with patch.dict("os.environ", {"JWT_SECRET_KEY": "env-secret"}):
            config = TokenConfig()
            assert config.secret_key == "env-secret"

    def test_raises_without_key(self):
        """Should raise if no secret key provided."""
        with patch.dict("os.environ", {}, clear=True):
            import os
            os.environ.pop("JWT_SECRET_KEY", None)
            
            with pytest.raises(ValueError) as exc_info:
                TokenConfig()
            
            assert "JWT_SECRET_KEY not set" in str(exc_info.value)

    def test_custom_expiry_times(self):
        """Should accept custom expiry times."""
        config = TokenConfig(
            secret_key="key",
            access_token_expire_minutes=60,
            refresh_token_expire_days=30,
        )
        assert config.access_token_expire_minutes == 60
        assert config.refresh_token_expire_days == 30


class TestCreateAccessToken:
    """Tests for create_access_token()."""

    def test_creates_valid_jwt(self, config):
        """Should create valid JWT token."""
        # When
        token = create_access_token("user-123", config)
        
        # Then
        assert token
        assert token.count(".") == 2  # JWT format

    def test_token_contains_subject(self, config):
        """Should include subject in payload."""
        # When
        token = create_access_token("user-123", config)
        payload = jwt.decode(token, config.secret_key, algorithms=[config.algorithm])
        
        # Then
        assert payload["sub"] == "user-123"

    def test_token_has_expiry(self, config):
        """Should include expiry time."""
        # When
        token = create_access_token("user-123", config)
        payload = jwt.decode(token, config.secret_key, algorithms=[config.algorithm])
        
        # Then
        assert "exp" in payload
        exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        now = datetime.now(timezone.utc)
        assert exp > now

    def test_token_type_is_access(self, config):
        """Should have type='access'."""
        # When
        token = create_access_token("user-123", config)
        payload = jwt.decode(token, config.secret_key, algorithms=[config.algorithm])
        
        # Then
        assert payload["type"] == "access"

    def test_custom_expiry(self, config):
        """Should use custom expiry delta."""
        # Given
        delta = timedelta(hours=2)
        
        # When
        token = create_access_token("user-123", config, expires_delta=delta)
        payload = jwt.decode(token, config.secret_key, algorithms=[config.algorithm])
        
        # Then
        exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        iat = datetime.fromtimestamp(payload["iat"], tz=timezone.utc)
        diff = exp - iat
        assert abs(diff.total_seconds() - 7200) < 5  # ~2 hours

    def test_extra_claims(self, config):
        """Should include extra claims."""
        # When
        token = create_access_token(
            "user-123",
            config,
            extra_claims={"role": "admin", "permissions": ["read", "write"]},
        )
        payload = jwt.decode(token, config.secret_key, algorithms=[config.algorithm])
        
        # Then
        assert payload["role"] == "admin"
        assert payload["permissions"] == ["read", "write"]


class TestCreateRefreshToken:
    """Tests for create_refresh_token()."""

    def test_creates_refresh_token(self, config):
        """Should create refresh token."""
        # When
        token = create_refresh_token("user-123", config)
        payload = jwt.decode(token, config.secret_key, algorithms=[config.algorithm])
        
        # Then
        assert payload["type"] == "refresh"
        assert payload["sub"] == "user-123"

    def test_longer_expiry_than_access(self, config):
        """Should have longer expiry than access token."""
        # When
        access = create_access_token("user", config)
        refresh = create_refresh_token("user", config)
        
        access_payload = jwt.decode(access, config.secret_key, algorithms=[config.algorithm])
        refresh_payload = jwt.decode(refresh, config.secret_key, algorithms=[config.algorithm])
        
        # Then
        assert refresh_payload["exp"] > access_payload["exp"]


class TestVerifyToken:
    """Tests for verify_token()."""

    def test_valid_token_returns_payload(self, config):
        """Should return payload for valid token."""
        # Given
        token = create_access_token("user-123", config)
        
        # When
        payload = verify_token(token, config)
        
        # Then
        assert payload["sub"] == "user-123"

    def test_expired_token_raises(self, config):
        """Should raise for expired token."""
        # Given
        token = create_access_token(
            "user-123",
            config,
            expires_delta=timedelta(seconds=-1),  # Already expired
        )
        
        # When/Then
        with pytest.raises(UnauthorizedError) as exc_info:
            verify_token(token, config)
        
        assert "expired" in str(exc_info.value).lower()

    def test_invalid_signature_raises(self, config):
        """Should raise for tampered token."""
        # Given
        token = create_access_token("user-123", config)
        wrong_config = TokenConfig(secret_key="different-key")
        
        # When/Then
        with pytest.raises(UnauthorizedError) as exc_info:
            verify_token(token, wrong_config)
        
        assert "Invalid token" in str(exc_info.value)

    def test_malformed_token_raises(self, config):
        """Should raise for malformed token."""
        # When/Then
        with pytest.raises(UnauthorizedError):
            verify_token("not.a.valid.jwt", config)

    def test_token_type_validation(self, config):
        """Should validate token type."""
        # Given
        access_token = create_access_token("user", config)
        refresh_token = create_refresh_token("user", config)
        
        # When/Then - access token should fail refresh validation
        with pytest.raises(UnauthorizedError) as exc_info:
            verify_token(access_token, config, token_type="refresh")
        assert "Invalid token type" in str(exc_info.value)
        
        # When/Then - refresh token should fail access validation
        with pytest.raises(UnauthorizedError) as exc_info:
            verify_token(refresh_token, config, token_type="access")
        assert "Invalid token type" in str(exc_info.value)


class TestGetCurrentUserDependency:
    """Tests for get_current_user_dependency()."""

    def test_extracts_user_from_valid_token(self, config):
        """Should extract user from Authorization header."""
        # Given
        app = FastAPI()
        get_current_user = get_current_user_dependency(config)
        token = create_access_token("user-123", config)
        
        @app.get("/me")
        async def me(user_id: str = Depends(get_current_user)):
            return {"user_id": user_id}
        
        client = TestClient(app)
        
        # When
        response = client.get("/me", headers={"Authorization": f"Bearer {token}"})
        
        # Then
        assert response.status_code == 200
        assert response.json() == {"user_id": "user-123"}

    def test_missing_header_raises_401(self, config):
        """Should raise 401 when header missing."""
        # Given
        app = FastAPI()
        get_current_user = get_current_user_dependency(config)
        
        @app.get("/me")
        async def me(user_id: str = Depends(get_current_user)):
            return {"user_id": user_id}
        
        client = TestClient(app)
        
        # When
        response = client.get("/me")
        
        # Then
        assert response.status_code == 401

    def test_invalid_token_raises_401(self, config):
        """Should raise 401 for invalid token."""
        # Given
        app = FastAPI()
        get_current_user = get_current_user_dependency(config)
        
        @app.get("/me")
        async def me(user_id: str = Depends(get_current_user)):
            return {"user_id": user_id}
        
        client = TestClient(app)
        
        # When
        response = client.get("/me", headers={"Authorization": "Bearer invalid-token"})
        
        # Then
        assert response.status_code == 401


class TestGetOptionalUserDependency:
    """Tests for get_optional_user_dependency()."""

    def test_returns_user_with_valid_token(self, config):
        """Should return user_id with valid token."""
        # Given
        app = FastAPI()
        get_optional_user = get_optional_user_dependency(config)
        token = create_access_token("user-123", config)
        
        @app.get("/test")
        async def test_route(user_id: str = Depends(get_optional_user)):
            return {"user_id": user_id}
        
        client = TestClient(app)
        
        # When
        response = client.get("/test", headers={"Authorization": f"Bearer {token}"})
        
        # Then
        assert response.status_code == 200
        assert response.json() == {"user_id": "user-123"}

    def test_returns_none_without_token(self, config):
        """Should return None when no token provided."""
        # Given
        app = FastAPI()
        get_optional_user = get_optional_user_dependency(config)
        
        @app.get("/test")
        async def test_route(user_id: str = Depends(get_optional_user)):
            return {"user_id": user_id}
        
        client = TestClient(app)
        
        # When
        response = client.get("/test")
        
        # Then
        assert response.status_code == 200
        assert response.json() == {"user_id": None}

    def test_returns_none_with_invalid_token(self, config):
        """Should return None with invalid token (not raise)."""
        # Given
        app = FastAPI()
        get_optional_user = get_optional_user_dependency(config)
        
        @app.get("/test")
        async def test_route(user_id: str = Depends(get_optional_user)):
            return {"user_id": user_id}
        
        client = TestClient(app)
        
        # When
        response = client.get("/test", headers={"Authorization": "Bearer invalid"})
        
        # Then
        assert response.status_code == 200
        assert response.json() == {"user_id": None}


class TestGetTokenPayloadDependency:
    """Tests for get_token_payload_dependency()."""

    def test_returns_full_payload(self, config):
        """Should return full token payload."""
        # Given
        app = FastAPI()
        get_payload = get_token_payload_dependency(config)
        token = create_access_token("user-123", config, extra_claims={"role": "admin"})
        
        @app.get("/test")
        async def test_route(payload: dict = Depends(get_payload)):
            return payload
        
        client = TestClient(app)
        
        # When
        response = client.get("/test", headers={"Authorization": f"Bearer {token}"})
        
        # Then
        assert response.status_code == 200
        data = response.json()
        assert data["sub"] == "user-123"
        assert data["role"] == "admin"
        assert data["type"] == "access"
```

---

## Verification

```bash
cd packages/backend-common

# Run auth tests
pytest tests/unit/test_auth.py -v

# Run with coverage
pytest tests/unit/test_auth.py --cov=topvnsport_common.auth --cov-report=term-missing

# Expected coverage: 100%
```

---

## Checklist

- [ ] auth.py implemented
- [ ] TokenConfig with env var support
- [ ] create_access_token() with extra claims
- [ ] create_refresh_token()
- [ ] verify_token() with type validation
- [ ] get_current_user_dependency()
- [ ] get_optional_user_dependency()
- [ ] get_token_payload_dependency()
- [ ] All 26 test cases pass
- [ ] 100% code coverage
- [ ] Works with FastAPI Depends()
