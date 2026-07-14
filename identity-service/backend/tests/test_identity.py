import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sys
import os

# Adjust path to import from backend/
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Base
from models import Role, StaffAccount, StaffSession
from schemas.auth import LoginRequest, LoginResponse, RefreshTokenRequest, VerifyResponse, ChangePasswordRequest
from schemas.role import RoleBase, RoleUpdate, RoleOut
from schemas.staff import StaffBase, StaffCreate, StaffUpdate, StaffOut
from services.auth_service import change_staff_password
from services.staff_service import reset_staff_password
from utils.password import hash_password
from utils.jwt import create_access_token
from fastapi.testclient import TestClient
from main import app
import datetime


def test_role_staff_relationship_and_cascade(db_session):
    # 1. Create a Role
    role = Role(
        code="test_role",
        name="Test Role",
        description="A role for testing",
        permissions=["test:read"]
    )
    db_session.add(role)
    db_session.commit()
    db_session.refresh(role)

    # 2. Create a StaffAccount linked to the Role
    staff = StaffAccount(
        username="testuser",
        email="test@topvnsport.com",
        hashed_password="hashed_password_string",
        full_name="Test User",
        role_id=role.id,
        is_active=True
    )
    db_session.add(staff)
    db_session.commit()
    db_session.refresh(staff)

    # Verify that the properties work correctly
    assert staff.role_code == "test_role"
    assert staff.role_name == "Test Role"

    # Verify that delete-orphan is NOT on Role.staff_accounts
    db_session.delete(role)
    try:
        db_session.commit()
    except Exception:
        db_session.rollback()

    # Re-fetch staff from DB to see if it remains (cascade delete was not triggered)
    db_session.rollback()
    fetched_staff = db_session.query(StaffAccount).filter(StaffAccount.id == staff.id).first()
    assert fetched_staff is not None
    assert fetched_staff.username == "testuser"

def test_role_schema_validation():
    # Valid code: lowercase alphanumeric/underscore, min length 2
    role_base = RoleBase(code="admin_role", name="Admin", permissions=["*"])
    assert role_base.code == "admin_role"

    # Invalid code: too short
    with pytest.raises(ValidationError):
        RoleBase(code="a", name="Admin", permissions=["*"])

    # Invalid code: uppercase
    with pytest.raises(ValidationError):
        RoleBase(code="ADMIN", name="Admin", permissions=["*"])

    # Invalid code: special characters
    with pytest.raises(ValidationError):
        RoleBase(code="admin-role", name="Admin", permissions=["*"])

    # RoleUpdate doesn't contain code
    role_update = RoleUpdate(name="New Name", description="New Desc")
    assert not hasattr(role_update, "code")

def test_staff_schema_validation():
    # StaffBase contains role_id, full_name, email, username
    staff_base = StaffBase(
        username="usr",
        email="test@topvnsport.com",
        full_name="User Name",
        role_id=1
    )
    assert staff_base.username == "usr"
    assert staff_base.role_id == 1

    # StaffBase username min_length=3
    with pytest.raises(ValidationError):
        StaffBase(username="us", email="test@topvnsport.com", role_id=1)

    # StaffCreate contains password min_length=8
    with pytest.raises(ValidationError):
        StaffCreate(
            username="user1",
            email="test@topvnsport.com",
            role_id=1,
            password="short"
        )

    # StaffUpdate contains optional fields, no username/password
    staff_update = StaffUpdate(email="new@test.com", full_name="New Name", is_active=False)
    assert staff_update.email == "new@test.com"
    assert not hasattr(staff_update, "username")
    assert not hasattr(staff_update, "password")

    # StaffOut inherits StaffBase and includes role properties
    import datetime
    staff_out = StaffOut(
        username="tester",
        email="tester@test.com",
        role_id=2,
        id=123,
        is_active=True,
        created_at=datetime.datetime.now(),
        role_code="pmi_staff",
        role_name="PMI Staff"
    )
    assert staff_out.role_code == "pmi_staff"
    assert staff_out.role_name == "PMI Staff"
    assert staff_out.id == 123

def test_auth_schemas():
    # LoginRequest
    req = LoginRequest(username="test", password="pwd")
    assert req.username == "test"

    # LoginResponse
    resp = LoginResponse(access_token="acc", refresh_token="ref", expires_in=3600)
    assert resp.token_type == "bearer"
    assert resp.expires_in == 3600

    # RefreshTokenRequest
    ref_req = RefreshTokenRequest(refresh_token="ref")
    assert ref_req.refresh_token == "ref"

    # VerifyResponse
    verify_resp = VerifyResponse(
        valid=True,
        user_id=1,
        username="test",
        role="admin",
        permissions=["*"]
    )
    assert verify_resp.valid is True

    # ChangePasswordRequest
    cp_req = ChangePasswordRequest(current_password="old", new_password="new_password")
    assert cp_req.new_password == "new_password"


def test_verify_response_optional_defaults():
    # VerifyResponse with only valid=False, other fields defaulting to None
    resp = VerifyResponse(valid=False)
    assert resp.valid is False
    assert resp.user_id is None
    assert resp.username is None
    assert resp.role is None
    assert resp.permissions is None


def test_change_password_request_validation():
    # ChangePasswordRequest with valid new_password (min_length=8)
    req = ChangePasswordRequest(current_password="old_password", new_password="newpassword123")
    assert req.new_password == "newpassword123"

    # Less than 8 characters raises ValidationError
    with pytest.raises(ValidationError):
        ChangePasswordRequest(current_password="old_password", new_password="short")


def test_staff_base_username_validation():
    # StaffBase with valid username characters
    staff_base = StaffBase(
        username="valid-user_123",
        email="test@topvnsport.com",
        full_name="User Name",
        role_id=1
    )
    assert staff_base.username == "valid-user_123"

    # Username contains spaces (invalid)
    with pytest.raises(ValidationError):
        StaffBase(
            username="invalid user",
            email="test@topvnsport.com",
            role_id=1
        )

    # Username contains special characters like @ (invalid)
    with pytest.raises(ValidationError):
        StaffBase(
            username="user@name",
            email="test@topvnsport.com",
            role_id=1
        )


def test_change_staff_password_revokes_sessions(db_session):
    role = Role(code="test_role", name="Test Role", permissions=["test:read"])
    db_session.add(role)
    db_session.commit()
    db_session.refresh(role)

    hashed = hash_password("old_password")
    staff = StaffAccount(
        username="test_pwd_user",
        email="test_pwd@topvnsport.com",
        hashed_password=hashed,
        role_id=role.id,
        is_active=True
    )
    db_session.add(staff)
    db_session.commit()
    db_session.refresh(staff)

    now = datetime.datetime.utcnow()
    active_sess = StaffSession(
        staff_id=staff.id,
        refresh_token_hash="active_hash",
        expires_at=now + datetime.timedelta(days=1),
        revoked_at=None
    )
    revoked_sess = StaffSession(
        staff_id=staff.id,
        refresh_token_hash="revoked_hash",
        expires_at=now + datetime.timedelta(days=1),
        revoked_at=now - datetime.timedelta(hours=1)
    )
    expired_sess = StaffSession(
        staff_id=staff.id,
        refresh_token_hash="expired_hash",
        expires_at=now - datetime.timedelta(days=1),
        revoked_at=None
    )
    db_session.add_all([active_sess, revoked_sess, expired_sess])
    db_session.commit()

    change_staff_password(db_session, staff.id, "old_password", "new_password_123")

    db_session.refresh(active_sess)
    assert active_sess.revoked_at is not None

    db_session.refresh(revoked_sess)
    db_session.refresh(expired_sess)
    assert revoked_sess.revoked_at is not None
    assert expired_sess.revoked_at is None


def test_reset_staff_password_revokes_sessions(db_session):
    role = Role(code="test_role", name="Test Role", permissions=["test:read"])
    db_session.add(role)
    db_session.commit()
    db_session.refresh(role)

    hashed = hash_password("old_password")
    staff = StaffAccount(
        username="test_reset_user",
        email="test_reset@topvnsport.com",
        hashed_password=hashed,
        role_id=role.id,
        is_active=True
    )
    db_session.add(staff)
    db_session.commit()
    db_session.refresh(staff)

    now = datetime.datetime.utcnow()
    active_sess = StaffSession(
        staff_id=staff.id,
        refresh_token_hash="active_hash_2",
        expires_at=now + datetime.timedelta(days=1),
        revoked_at=None
    )
    db_session.add(active_sess)
    db_session.commit()

    reset_staff_password(db_session, staff.id, "reset_password_123")

    db_session.refresh(active_sess)
    assert active_sess.revoked_at is not None



def test_get_current_active_staff_token_missing_message(client):
    response = client.get("/auth/me")
    assert response.status_code == 401
    assert response.json()["detail"] == "Authentication token missing"


def test_verify_endpoint_token_missing_message(client):
    response = client.get("/auth/verify")
    assert response.status_code == 401
    assert response.json()["detail"] == "Authentication token missing"


def test_verify_endpoint_database_role(client, db_session):
    role_admin = Role(code="admin", name="Administrator", permissions=["*"])
    db_session.add(role_admin)
    db_session.commit()
    db_session.refresh(role_admin)

    staff = StaffAccount(
        username="admin_user",
        email="admin@topvnsport.com",
        hashed_password=hash_password("admin_password"),
        role_id=role_admin.id,
        is_active=True
    )
    db_session.add(staff)
    db_session.commit()
    db_session.refresh(staff)

    token = create_access_token(
        staff_id=staff.id,
        username=staff.username,
        role="viewer"
    )

    response = client.get("/auth/verify", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    
    assert response.headers.get("X-User-Role") == "admin"
    assert response.headers.get("X-User-Id") == str(staff.id)
    assert response.headers.get("X-User-Username") == "admin_user"
    
    body = response.json()
    assert body["role"] == "admin"
    assert body["user_id"] == staff.id
    assert body["username"] == "admin_user"

