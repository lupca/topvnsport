import pytest
from models import StaffAccount

class TestStaffCRUD:
    def test_list_staff(self, client, admin_auth_header, seed_admin_user):
        """STAFF-001: Lấy danh sách staff"""
        response = client.get("/staff", headers=admin_auth_header)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert any(item["username"] == seed_admin_user.username for item in data)

    def test_list_staff_with_filters(self, client, admin_auth_header, seed_admin_user):
        """STAFF-002: Lấy danh sách staff với filter role_id"""
        response = client.get(f"/staff?role_id={seed_admin_user.role_id}", headers=admin_auth_header)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_get_staff_by_id(self, client, admin_auth_header, existing_staff):
        """STAFF-003: Lấy thông tin staff theo ID"""
        response = client.get(f"/staff/{existing_staff.id}", headers=admin_auth_header)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == existing_staff.id
        assert data["username"] == existing_staff.username

    def test_get_staff_not_found(self, client, admin_auth_header):
        """STAFF-004: Lấy thông tin staff không tồn tại"""
        response = client.get("/staff/9999", headers=admin_auth_header)
        assert response.status_code == 404
        assert "không tìm thấy" in response.json()["detail"].lower()

    def test_create_staff(self, client, admin_auth_header, test_role):
        """STAFF-005: Tạo staff mới"""
        response = client.post("/staff", headers=admin_auth_header, json={
            "username": "new_staff_member",
            "email": "new_member@example.com",
            "password": "Password@123",
            "role_id": test_role.id,
            "full_name": "New Staff Member"
        })
        assert response.status_code == 201
        data = response.json()
        assert data["username"] == "new_staff_member"
        assert data["is_active"] is True

    def test_create_staff_duplicate_username(self, client, admin_auth_header, existing_staff):
        """STAFF-006: Tạo staff với username đã tồn tại"""
        response = client.post("/staff", headers=admin_auth_header, json={
            "username": existing_staff.username,
            "email": "different_email@example.com",
            "password": "Password@123",
            "role_id": existing_staff.role_id
        })
        assert response.status_code == 400
        assert "đăng nhập đã tồn tại" in response.json()["detail"].lower()

    def test_create_staff_duplicate_email(self, client, admin_auth_header, existing_staff):
        """STAFF-007: Tạo staff với email đã tồn tại"""
        response = client.post("/staff", headers=admin_auth_header, json={
            "username": "different_username",
            "email": existing_staff.email,
            "password": "Password@123",
            "role_id": existing_staff.role_id
        })
        assert response.status_code == 400
        assert "email đã tồn tại" in response.json()["detail"].lower()

    def test_create_staff_invalid_role(self, client, admin_auth_header):
        """STAFF-008: Tạo staff với role_id không tồn tại"""
        response = client.post("/staff", headers=admin_auth_header, json={
            "username": "staff_invalid_role",
            "email": "invalid_role@example.com",
            "password": "Password@123",
            "role_id": 9999
        })
        assert response.status_code == 400
        assert "không tồn tại" in response.json()["detail"].lower()

    def test_update_staff(self, client, admin_auth_header, existing_staff, seed_admin_user):
        """STAFF-009: Cập nhật staff"""
        response = client.put(
            f"/staff/{existing_staff.id}",
            headers=admin_auth_header,
            json={
                "full_name": "Updated Name",
                "email": "brand_new_email@example.com",
                "role_id": seed_admin_user.role_id
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["full_name"] == "Updated Name"
        assert data["email"] == "brand_new_email@example.com"
        assert data["role_id"] == seed_admin_user.role_id

    def test_deactivate_staff(self, client, admin_auth_header, existing_staff):
        """STAFF-010: Vô hiệu hóa staff"""
        response = client.put(
            f"/staff/{existing_staff.id}",
            headers=admin_auth_header,
            json={"is_active": False}
        )
        assert response.status_code == 200
        assert response.json()["is_active"] is False

    def test_delete_staff_success(self, client, db_session, admin_auth_header, existing_staff):
        """STAFF-011: Xóa staff"""
        response = client.delete(f"/staff/{existing_staff.id}", headers=admin_auth_header)
        assert response.status_code == 200
        assert "thành công" in response.json()["message"].lower()

        # Verify not found in DB
        staff = db_session.query(StaffAccount).filter(StaffAccount.id == existing_staff.id).first()
        assert staff is None

    def test_delete_staff_self_blocked(self, client, admin_auth_header, seed_admin_user):
        """Ngăn chặn tự xóa tài khoản của chính mình"""
        response = client.delete(f"/staff/{seed_admin_user.id}", headers=admin_auth_header)
        assert response.status_code == 400
        assert "tự xóa" in response.json()["detail"].lower()

    def test_reset_password_success(self, client, admin_auth_header, existing_staff):
        """STAFF-012: Đặt lại mật khẩu"""
        response = client.post(
            f"/staff/{existing_staff.id}/reset-password",
            headers=admin_auth_header,
            json={"new_password": "NewSecretPassword@123"}
        )
        assert response.status_code == 200
        assert "thành công" in response.json()["message"].lower()

        # Verify we can login with the new password
        login_resp = client.post("/auth/login", json={
            "username": existing_staff.username,
            "password": "NewSecretPassword@123"
        })
        assert login_resp.status_code == 200

    def test_update_staff_not_found(self, client, admin_auth_header):
        """Cập nhật nhân viên không tồn tại - 404"""
        response = client.put("/staff/9999", headers=admin_auth_header, json={"full_name": "New Name"})
        assert response.status_code == 404

    def test_update_staff_duplicate_email(self, client, admin_auth_header, existing_staff, seed_admin_user):
        """Cập nhật nhân viên với email trùng lặp - 400"""
        response = client.put(f"/staff/{existing_staff.id}", headers=admin_auth_header, json={"email": seed_admin_user.email})
        assert response.status_code == 400
        assert "email đã tồn tại" in response.json()["detail"].lower()

    def test_update_staff_invalid_role(self, client, admin_auth_header, existing_staff):
        """Cập nhật nhân viên với role_id không tồn tại - 400"""
        response = client.put(f"/staff/{existing_staff.id}", headers=admin_auth_header, json={"role_id": 9999})
        assert response.status_code == 400
        assert "không tồn tại" in response.json()["detail"].lower()

    def test_delete_staff_not_found(self, client, admin_auth_header):
        """Xóa nhân viên không tồn tại - 404"""
        response = client.delete("/staff/9999", headers=admin_auth_header)
        assert response.status_code == 404

    def test_reset_password_not_found(self, client, admin_auth_header):
        """Đặt lại mật khẩu cho nhân viên không tồn tại - 404"""
        response = client.post("/staff/9999/reset-password", headers=admin_auth_header, json={"new_password": "NewPassword@123"})
        assert response.status_code == 404
