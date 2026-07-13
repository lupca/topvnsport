import pytest
import asyncio
import httpx
import importlib
from datetime import timedelta
from sqlalchemy.orm import Session
import models
from utils.auth import get_password_hash, create_access_token, INTERNAL_SERVICE_TOKEN
from utils.context import actor_username_var, actor_type_var

@pytest.mark.asyncio
async def test_concurrency_contextvars_safety(app_module, db_session):
    """
    1. Write a verification script or execute parallel tests simulating concurrent requests
    to GET /api/auth/context or GET /api/auth/me with different JWT headers to check
    if contextvars ever leak or crossover between async tasks under high concurrency load.
    """
    # Create multiple test users
    num_users = 40
    users = []
    tokens = []
    for i in range(num_users):
        username = f"concurrent_user_{i}"
        user = models.User(
            username=username,
            email=f"user_{i}@example.com",
            hashed_password=get_password_hash("password"),
            role="USER",
            is_active=True
        )
        db_session.add(user)
        users.append(username)
    db_session.commit()

    # Generate tokens for each user
    for username in users:
        token = create_access_token({"sub": username})
        tokens.append((username, token))

    # Override database dependency to yield our db_session
    def override_get_db():
        yield db_session

    database_module = importlib.import_module("database")
    app_module.app.dependency_overrides[database_module.get_db] = override_get_db

    transport = httpx.ASGITransport(app=app_module.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        
        async def make_request(username, token, index):
            headers = {
                "Authorization": f"Bearer {token}",
                "X-Correlation-ID": f"corr-id-{username}",
                "X-Forwarded-For": f"1.2.3.{index}"
            }
            # Fetch me_context (which resolves current identity)
            response = await ac.get("/api/auth/me_context", headers=headers)
            assert response.status_code == 200
            data = response.json()
            
            # Verify that identity contextvars do not crossover or leak
            assert data["actor_username"] == username
            assert data["actor_type"] == "USER"
            assert data["correlation_id"] == f"corr-id-{username}"
            assert data["ip_address"] == f"1.2.3.{index}"

            # Also verify /api/auth/me behaves correctly concurrently
            response_me = await ac.get("/api/auth/me", headers=headers)
            assert response_me.status_code == 200
            data_me = response_me.json()
            assert data_me["actor_username"] == username
            assert data_me["actor_type"] == "USER"

        # Fire off all requests concurrently
        tasks = [make_request(username, token, idx) for idx, (username, token) in enumerate(tokens)]
        await asyncio.gather(*tasks)

    app_module.app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_token_expiration(app_module, db_session):
    """
    2. Verify token expiration: check if a token with short expiry (e.g. 1 second)
    expires and correctly rejects requests after 1 second.
    """
    username = "expiring_user"
    user = models.User(
        username=username,
        email="expiring@example.com",
        hashed_password=get_password_hash("password"),
        role="USER",
        is_active=True
    )
    db_session.add(user)
    db_session.commit()

    # Generate token with 1 second expiry
    token = create_access_token({"sub": username}, expires_delta=timedelta(seconds=1))

    def override_get_db():
        yield db_session

    database_module = importlib.import_module("database")
    app_module.app.dependency_overrides[database_module.get_db] = override_get_db

    transport = httpx.ASGITransport(app=app_module.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        headers = {"Authorization": f"Bearer {token}"}
        
        # Immediate request should succeed
        resp = await ac.get("/api/auth/me", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["actor_username"] == username

        # Wait for token to expire (2.5 seconds)
        await asyncio.sleep(2.5)

        # Subsequent request should fail with 401 Unauthorized
        resp_expired = await ac.get("/api/auth/me", headers=headers)
        assert resp_expired.status_code == 401
        assert "expired" in resp_expired.json()["detail"].lower()

    app_module.app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_exceptions_and_validations_do_not_leak_contextvars(app_module, db_session):
    """
    3. Validate that standard HTTP exceptions and 422 validations do not leak contextvars.
    We verify this by making requests that trigger different errors, and checking if
    subsequent requests are clean and contextvars do not crossover or remain polluted.
    """
    username = "clean_user"
    user = models.User(
        username=username,
        email="clean@example.com",
        hashed_password=get_password_hash("password"),
        role="USER",
        is_active=True
    )
    db_session.add(user)
    db_session.commit()

    token = create_access_token({"sub": username})

    def override_get_db():
        yield db_session

    database_module = importlib.import_module("database")
    app_module.app.dependency_overrides[database_module.get_db] = override_get_db

    transport = httpx.ASGITransport(app=app_module.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        # Step A: Perform a normal authenticated request to verify it sets context
        resp = await ac.get("/api/auth/me_context", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["actor_username"] == username

        # Step B: Immediate unauthenticated request should be guest/GUEST, not polluted by Step A
        resp_guest = await ac.get("/api/auth/context")
        assert resp_guest.status_code == 200
        assert resp_guest.json()["actor_username"] == "guest"
        assert resp_guest.json()["actor_type"] == "GUEST"

        # Step C: Trigger 401 Unauthorized (Invalid JWT token)
        resp_401 = await ac.get("/api/auth/me_context", headers={"Authorization": "Bearer invalid-token"})
        assert resp_401.status_code == 401

        # Step D: Verify context is not polluted after 401
        resp_after_401 = await ac.get("/api/auth/context")
        assert resp_after_401.status_code == 200
        assert resp_after_401.json()["actor_username"] == "guest"
        assert resp_after_401.json()["actor_type"] == "GUEST"

        # Step E: Trigger 422 Validation Error (empty payload for POST login)
        resp_422 = await ac.post("/api/auth/login", json={})
        assert resp_422.status_code == 422

        # Step F: Verify context is not polluted after 422
        resp_after_422 = await ac.get("/api/auth/context")
        assert resp_after_422.status_code == 200
        assert resp_after_422.json()["actor_username"] == "guest"
        assert resp_after_422.json()["actor_type"] == "GUEST"

        # Step G: Trigger 404 Not Found
        resp_404 = await ac.get("/api/auth/non-existent-route")
        assert resp_404.status_code == 404

        # Step H: Verify context is not polluted after 404
        resp_after_404 = await ac.get("/api/auth/context")
        assert resp_after_404.status_code == 200
        assert resp_after_404.json()["actor_username"] == "guest"
        assert resp_after_404.json()["actor_type"] == "GUEST"

    app_module.app.dependency_overrides.clear()
