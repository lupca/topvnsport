import pytest
from fastapi import status
from utils.auth import create_access_token, decode_access_token, INTERNAL_SERVICE_TOKEN
from jose import jwt

def test_jwt_operations():
    payload = {"sub": "test_user", "role": "admin"}
    token = create_access_token(payload)
    assert token is not None
    decoded = decode_access_token(token)
    assert decoded["sub"] == "test_user"
    assert decoded["role"] == "admin"
    assert "exp" in decoded

def test_get_me_service_auth(client_no_auth_override):
    # Get /me with service API key
    headers = {"X-API-Key": INTERNAL_SERVICE_TOKEN}
    response = client_no_auth_override.get("/api/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["actor_type"] == "SERVICE"
    assert data["actor_username"] == "OMS"
    assert "user" not in data

    # Get /me with service API key and custom service name
    headers = {"X-API-Key": INTERNAL_SERVICE_TOKEN, "X-Service-Name": "WMS"}
    response = client_no_auth_override.get("/api/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["actor_type"] == "SERVICE"
    assert data["actor_username"] == "WMS"
    assert "user" not in data

    # Get /me with invalid service key
    bad_headers = {"X-API-Key": "invalid_key"}
    response = client_no_auth_override.get("/api/auth/me", headers=bad_headers)
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid Service API Key"

def test_request_context_middleware(client):
    # Test that correlation ID is generated and returned in headers
    response = client.get("/api/auth/context")
    assert response.status_code == 200
    assert "X-Correlation-ID" in response.headers
    corr_id = response.headers["X-Correlation-ID"]
    data = response.json()
    assert data["correlation_id"] == corr_id
    assert data["actor_type"] == "GUEST"
    assert data["actor_username"] == "guest"

    # Test correlation ID is preserved if passed in request headers
    custom_corr_id = "test-correlation-12345"
    headers = {"X-Correlation-ID": custom_corr_id}
    response = client.get("/api/auth/context", headers=headers)
    assert response.status_code == 200
    assert response.headers["X-Correlation-ID"] == custom_corr_id
    assert response.json()["correlation_id"] == custom_corr_id

def test_contextvars_isolation(client_no_auth_override):
    token1 = create_access_token({"sub": "user1"})
    token2 = create_access_token({"sub": "user2"})

    # Check request 1
    resp1 = client_no_auth_override.get("/api/auth/me_context", headers={"Authorization": f"Bearer {token1}"})
    assert resp1.status_code == 200
    assert resp1.json()["actor_username"] == "user1"
    assert resp1.json()["actor_type"] == "USER"

    # Check request 2
    resp2 = client_no_auth_override.get("/api/auth/me_context", headers={"Authorization": f"Bearer {token2}"})
    assert resp2.status_code == 200
    assert resp2.json()["actor_username"] == "user2"
    assert resp2.json()["actor_type"] == "USER"

    # Check service auth contextvars
    resp_service = client_no_auth_override.get("/api/auth/me_context", headers={"X-API-Key": INTERNAL_SERVICE_TOKEN})
    assert resp_service.status_code == 200
    assert resp_service.json()["actor_username"] == "OMS"
    assert resp_service.json()["actor_type"] == "SERVICE"

    # Check service auth contextvars with custom X-Service-Name
    resp_service2 = client_no_auth_override.get("/api/auth/me_context", headers={"X-API-Key": INTERNAL_SERVICE_TOKEN, "X-Service-Name": "WMS"})
    assert resp_service2.status_code == 200
    assert resp_service2.json()["actor_username"] == "WMS"
    assert resp_service2.json()["actor_type"] == "SERVICE"

def test_x_forwarded_for_robustness(client):
    # Case A: Valid X-Forwarded-For IP address
    headers_valid = {"X-Forwarded-For": "192.168.1.100"}
    response = client.get("/api/auth/context", headers=headers_valid)
    assert response.status_code == 200
    assert response.json()["ip_address"] == "192.168.1.100"

    # Case B: Leading commas or empty spaces before valid IP
    headers_leading_commas = {"X-Forwarded-For": ", , 12.34.56.78"}
    response = client.get("/api/auth/context", headers=headers_leading_commas)
    assert response.status_code == 200
    assert response.json()["ip_address"] == "12.34.56.78"

    # Case C: Empty/falsy X-Forwarded-For values should fall back to client host
    headers_empty = {"X-Forwarded-For": ""}
    response = client.get("/api/auth/context", headers=headers_empty)
    assert response.status_code == 200
    assert response.json()["ip_address"] == "testclient"

    # Case D: Malformed commas only X-Forwarded-For should fall back to client host
    headers_commas_only = {"X-Forwarded-For": ", , "}
    response = client.get("/api/auth/context", headers=headers_commas_only)
    assert response.status_code == 200
    assert response.json()["ip_address"] == "testclient"

def test_unicode_api_key_unauthorized(client_no_auth_override):
    # Verify that passing non-ASCII Unicode characters in the X-API-Key header
    # does not crash the server and returns a 401 Unauthorized response.
    headers = {"X-API-Key": "unicode_key_测试_123".encode("utf-8")}
    response = client_no_auth_override.get("/api/auth/me", headers=headers)
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid Service API Key"

def test_get_me_jwt_only_user(client_no_auth_override):
    # User does NOT exist in db, but token is valid
    token = create_access_token({"sub": "jwt_only_tester", "role": "admin", "staff_id": 9876})
    
    headers = {"Authorization": f"Bearer {token}"}
    response = client_no_auth_override.get("/api/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["actor_type"] == "USER"
    assert data["actor_username"] == "jwt_only_tester"
    assert data["user"]["id"] == "9876"
    assert data["user"]["username"] == "jwt_only_tester"
    assert data["user"]["role"] == "admin"
    assert data["user"]["is_active"] is True
    assert data["user"]["email"] is None



