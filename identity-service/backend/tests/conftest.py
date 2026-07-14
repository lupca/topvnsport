import sys
import os
import pytest
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

# Adjust path to import from backend/
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Base, get_db
from models import Role, StaffAccount, StaffSession
from main import app
from utils.password import hash_password
from utils.jwt import create_access_token
from services.auth_service import hash_refresh_token

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(name="db_session")
def fixture_db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(name="client")
def fixture_client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()

@pytest.fixture
def seed_admin_user(db_session):
    role = Role(code="admin", name="Admin", permissions=["*"])
    db_session.add(role)
    db_session.commit()
    db_session.refresh(role)
    
    user = StaffAccount(
        username="admin",
        email="admin@test.com",
        hashed_password=hash_password("Admin@123"),
        role_id=role.id,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def seed_inactive_user(db_session):
    role = Role(code="viewer", name="Viewer", permissions=["pmi:read"])
    db_session.add(role)
    db_session.commit()
    db_session.refresh(role)
    
    user = StaffAccount(
        username="inactive",
        email="inactive@test.com",
        hashed_password=hash_password("password"),
        role_id=role.id,
        is_active=False
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def auth_tokens(client, seed_admin_user):
    # Log in and return tokens
    response = client.post("/auth/login", json={
        "username": "admin",
        "password": "Admin@123"
    })
    return response.json()

@pytest.fixture
def auth_token(auth_tokens):
    return auth_tokens["access_token"]

@pytest.fixture
def admin_auth_header(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}

@pytest.fixture
def test_role(db_session):
    role = Role(code="test_role", name="Test Role", permissions=["test:read"])
    db_session.add(role)
    db_session.commit()
    db_session.refresh(role)
    return role

@pytest.fixture
def existing_staff(db_session, test_role):
    staff = StaffAccount(
        username="existing_staff",
        email="existing@example.com",
        hashed_password=hash_password("Password@123"),
        role_id=test_role.id,
        is_active=True
    )
    db_session.add(staff)
    db_session.commit()
    db_session.refresh(staff)
    return staff

@pytest.fixture
def expired_refresh_token(db_session, seed_admin_user):
    token = "expired_token_123"
    rf_hash = hash_refresh_token(token)
    session = StaffSession(
        staff_id=seed_admin_user.id,
        refresh_token_hash=rf_hash,
        expires_at=datetime.datetime.utcnow() - datetime.timedelta(days=1),
        revoked_at=None
    )
    db_session.add(session)
    db_session.commit()
    return token

@pytest.fixture
def revoked_refresh_token(db_session, seed_admin_user):
    token = "revoked_token_123"
    rf_hash = hash_refresh_token(token)
    session = StaffSession(
        staff_id=seed_admin_user.id,
        refresh_token_hash=rf_hash,
        expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        revoked_at=datetime.datetime.utcnow() - datetime.timedelta(hours=1)
    )
    db_session.add(session)
    db_session.commit()
    return token
