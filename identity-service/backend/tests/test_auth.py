import pytest
from models import StaffSession
from services.auth_service import hash_refresh_token

class TestLogin:
    def test_login_success(self, client, seed_admin_user):
        """AUTH-001: Login với credentials hợp lệ"""
        response = client.post("/auth/login", json={
            "username": "admin",
            "password": "Admin@123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["expires_in"] > 0

    def test_login_wrong_password(self, client, seed_admin_user):
        """AUTH-002: Login với password sai"""
        response = client.post("/auth/login", json={
            "username": "admin",
            "password": "wrong_password"
        })
        assert response.status_code == 401
        assert "mật khẩu không chính xác" in response.json()["detail"].lower()

    def test_login_user_not_found(self, client):
        """AUTH-003: Login với user không tồn tại"""
        response = client.post("/auth/login", json={
            "username": "nonexistent",
            "password": "any"
        })
        assert response.status_code == 401
        assert "mật khẩu không chính xác" in response.json()["detail"].lower()

    def test_login_inactive_user(self, client, seed_inactive_user):
        """AUTH-004: Login với user bị deactivate"""
        response = client.post("/auth/login", json={
            "username": "inactive",
            "password": "password"
        })
        assert response.status_code == 403
        assert "bị khóa" in response.json()["detail"].lower()


class TestVerify:
    def test_verify_valid_token(self, client, auth_token, seed_admin_user):
        """AUTH-008: Verify với token hợp lệ"""
        response = client.get(
            "/auth/verify",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        assert response.headers.get("X-User-Id") == str(seed_admin_user.id)
        assert response.headers.get("X-User-Username") == seed_admin_user.username
        assert response.headers.get("X-User-Role") == "admin"
        assert response.headers.get("X-User-Permissions") == "*"

    def test_verify_invalid_token(self, client):
        """AUTH-009: Verify với token không hợp lệ"""
        response = client.get(
            "/auth/verify",
            headers={"Authorization": "Bearer invalid_token"}
        )
        assert response.status_code == 401

    def test_verify_no_token(self, client):
        """AUTH-010: Verify không có token"""
        response = client.get("/auth/verify")
        assert response.status_code == 401


class TestRefreshToken:
    def test_refresh_success(self, client, auth_tokens, mocker):
        """AUTH-005: Refresh token thành công"""
        import utils.jwt
        import datetime
        mock_now = datetime.datetime.utcnow() + datetime.timedelta(seconds=2)
        mocker.patch("utils.jwt.datetime.datetime", mocker.Mock(utcnow=mocker.Mock(return_value=mock_now)))

        response = client.post("/auth/refresh", json={
            "refresh_token": auth_tokens["refresh_token"]
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["access_token"] != auth_tokens["access_token"]

    def test_refresh_expired_token(self, client, expired_refresh_token):
        """AUTH-006: Refresh với token hết hạn"""
        response = client.post("/auth/refresh", json={
            "refresh_token": expired_refresh_token
        })
        assert response.status_code == 401
        assert "hết hạn" in response.json()["detail"].lower()

    def test_refresh_revoked_token(self, client, revoked_refresh_token):
        """AUTH-007: Refresh với token đã revoke"""
        response = client.post("/auth/refresh", json={
            "refresh_token": revoked_refresh_token
        })
        assert response.status_code == 401


class TestLogoutAndChangePassword:
    def test_logout_success(self, client, db_session, auth_tokens):
        """AUTH-011: Logout thành công"""
        rf_token = auth_tokens["refresh_token"]
        response = client.post("/auth/logout", json={
            "refresh_token": rf_token
        })
        assert response.status_code == 200
        assert "message" in response.json()
        
        # Verify in DB that it is revoked
        rf_hash = hash_refresh_token(rf_token)
        session = db_session.query(StaffSession).filter(StaffSession.refresh_token_hash == rf_hash).first()
        assert session is not None
        assert session.revoked_at is not None

    def test_change_password_success(self, client, db_session, admin_auth_header):
        """AUTH-012: Change password thành công"""
        response = client.post("/auth/change-password", headers=admin_auth_header, json={
            "current_password": "Admin@123",
            "new_password": "NewAdminPassword@123"
        })
        assert response.status_code == 200
        assert "message" in response.json()

        # Check login with new password
        login_resp = client.post("/auth/login", json={
            "username": "admin",
            "password": "NewAdminPassword@123"
        })
        assert login_resp.status_code == 200

    def test_change_password_wrong_current(self, client, admin_auth_header):
        """AUTH-013: Change password - wrong current"""
        response = client.post("/auth/change-password", headers=admin_auth_header, json={
            "current_password": "WrongPassword",
            "new_password": "NewAdminPassword@123"
        })
        assert response.status_code == 400
        assert "không chính xác" in response.json()["detail"].lower()

    def test_get_current_user_me(self, client, admin_auth_header, seed_admin_user):
        """Lấy thông tin tài khoản hiện tại"""
        response = client.get("/auth/me", headers=admin_auth_header)
        assert response.status_code == 200
        assert response.json()["username"] == seed_admin_user.username

    def test_verify_inactive_user_token(self, client, seed_inactive_user):
        """Verify token của tài khoản bị khóa"""
        from utils.jwt import create_access_token
        token = create_access_token(
            staff_id=seed_inactive_user.id,
            username=seed_inactive_user.username,
            role="viewer"
        )
        response = client.get("/auth/verify", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 401

    def test_verify_token_missing_staff_id(self, client):
        """Verify token bị thiếu thông tin staff_id"""
        from jose import jwt
        from utils.jwt import JWT_SECRET_KEY, JWT_ALGORITHM
        import datetime
        expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=15)
        to_encode = {
            "sub": "some_user",
            "username": "some_user",
            "role": "viewer",
            "exp": expire
        }
        token = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
        response = client.get("/auth/verify", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 401

    def test_me_inactive_user_token(self, client, seed_inactive_user):
        """Truy cập /auth/me với token của tài khoản bị khóa"""
        from utils.jwt import create_access_token
        token = create_access_token(
            staff_id=seed_inactive_user.id,
            username=seed_inactive_user.username,
            role="viewer"
        )
        response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 401

    def test_me_token_missing_staff_id(self, client):
        """Truy cập /auth/me với token thiếu staff_id"""
        from jose import jwt
        from utils.jwt import JWT_SECRET_KEY, JWT_ALGORITHM
        import datetime
        expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=15)
        to_encode = {
            "sub": "some_user",
            "username": "some_user",
            "role": "viewer",
            "exp": expire
        }
        token = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
        response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 401

