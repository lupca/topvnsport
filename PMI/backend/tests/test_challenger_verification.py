import pytest
import datetime
from datetime import timedelta
from fastapi import status
from fastapi.testclient import TestClient
from jose import jwt

import models
from utils.auth import JWT_SECRET_KEY, JWT_ALGORITHM, create_access_token, get_password_hash

def test_seeded_admin_login(client):
    """Verify that the seeded default accounts (admin/password) can log in successfully."""
    login_payload = {"username": "admin", "password": "password123"}
    response = client.post("/api/auth/login", json=login_payload)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_invalid_credentials_rejected(client):
    """Verify incorrect credentials get rejected with 401."""
    # 1. Invalid password for admin
    login_payload = {"username": "admin", "password": "wrongpassword"}
    response = client.post("/api/auth/login", json=login_payload)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json()["detail"] == "Incorrect username or password"

    # 2. Non-existent user login
    login_payload = {"username": "non_existent_user_123", "password": "some_password"}
    response = client.post("/api/auth/login", json=login_payload)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json()["detail"] == "Incorrect username or password"

def test_jwt_token_rejections(client_no_auth_override, db_session):
    """Verify invalid and malformed JWT tokens are correctly rejected with 401."""
    # Setup test user for valid lookup if needed
    u = db_session.query(models.User).filter(models.User.username == "jwt_verifier").first()
    if not u:
        u = models.User(
            username="jwt_verifier",
            email="jwt_verifier@example.com",
            hashed_password=get_password_hash("password"),
            role="admin",
            is_active=True
        )
        db_session.add(u)
        db_session.commit()

    # Case A: Invalid Signature
    invalid_sig_token = jwt.encode({"sub": "jwt_verifier"}, "different_secret_key", algorithm=JWT_ALGORITHM)
    response = client_no_auth_override.get("/api/auth/me", headers={"Authorization": f"Bearer {invalid_sig_token}"})
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json()["detail"] == "Invalid or expired JWT token"

    # Case B: Expired Token
    expired_token = create_access_token({"sub": "jwt_verifier"}, expires_delta=timedelta(minutes=-30))
    response = client_no_auth_override.get("/api/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json()["detail"] == "Invalid or expired JWT token"

    # Case C: Missing Claim ('sub')
    missing_sub_token = jwt.encode(
        {"role": "admin", "exp": datetime.datetime.utcnow() + timedelta(minutes=10)},
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM
    )
    response = client_no_auth_override.get("/api/auth/me", headers={"Authorization": f"Bearer {missing_sub_token}"})
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json()["detail"] == "Token payload is missing subject claim"

    # Case D: Malformed Token
    response = client_no_auth_override.get("/api/auth/me", headers={"Authorization": "Bearer not.a.valid.token"})
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json()["detail"] == "Invalid or expired JWT token"

def test_unicode_api_key_server_error(app_module):
    """
    Verify the boundary behavior of X-API-Key containing Unicode.
    Uses raise_server_exceptions=False to assert that the server returns a 401 Unauthorized response
    due to compare_digest TypeError handling, preventing a 500 server crash.
    """
    client_no_raise = TestClient(app_module.app, raise_server_exceptions=False)
    
    # We pass Latin-1 bytes to simulate a non-ASCII raw header input
    response = client_no_raise.get("/api/auth/me", headers={"X-API-Key": "üñîçødé".encode("latin-1")})
    
    # Assert that this returns a proper 401 instead of crashing with 500
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
