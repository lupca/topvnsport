import pytest
from models import Role

class TestRoleCRUD:
    def test_list_roles(self, client, admin_auth_header, test_role):
        """ROLE-001: Lấy danh sách nhóm quyền"""
        response = client.get("/roles", headers=admin_auth_header)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert any(item["code"] == test_role.code for item in data)

    def test_get_role_by_id(self, client, admin_auth_header, test_role):
        """ROLE-002: Lấy thông tin nhóm quyền theo ID"""
        response = client.get(f"/roles/{test_role.id}", headers=admin_auth_header)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_role.id
        assert data["code"] == test_role.code

    def test_get_role_not_found(self, client, admin_auth_header):
        """Lấy thông tin nhóm quyền không tồn tại"""
        response = client.get("/roles/9999", headers=admin_auth_header)
        assert response.status_code == 404
        assert "không tìm thấy" in response.json()["detail"].lower()

    def test_create_role(self, client, admin_auth_header):
        """ROLE-003: Tạo nhóm quyền mới"""
        response = client.post("/roles", headers=admin_auth_header, json={
            "code": "manager",
            "name": "Manager Role",
            "description": "Manager of products",
            "permissions": ["pmi:read", "pmi:write"]
        })
        assert response.status_code == 201
        data = response.json()
        assert data["code"] == "manager"
        assert "pmi:write" in data["permissions"]

    def test_create_role_duplicate_code(self, client, admin_auth_header, test_role):
        """ROLE-004: Tạo nhóm quyền với mã đã tồn tại"""
        response = client.post("/roles", headers=admin_auth_header, json={
            "code": test_role.code,
            "name": "Duplicate Code Role",
            "permissions": []
        })
        assert response.status_code == 400
        assert "mã nhóm quyền đã tồn tại" in response.json()["detail"].lower()

    def test_update_role(self, client, admin_auth_header, test_role):
        """ROLE-005: Cập nhật nhóm quyền"""
        response = client.put(
            f"/roles/{test_role.id}",
            headers=admin_auth_header,
            json={
                "name": "Updated Role Name",
                "description": "Updated Role Description",
                "permissions": ["test:read", "test:write"]
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Role Name"
        assert "test:write" in data["permissions"]

    def test_delete_role_no_staff(self, client, db_session, admin_auth_header):
        """ROLE-006: Xóa nhóm quyền không có tài khoản sử dụng"""
        # Create an unused role
        role = Role(code="unused_role", name="Unused Role", permissions=[])
        db_session.add(role)
        db_session.commit()
        db_session.refresh(role)

        response = client.delete(f"/roles/{role.id}", headers=admin_auth_header)
        assert response.status_code == 200
        assert "thành công" in response.json()["message"].lower()

        # Verify not found in DB
        fetched_role = db_session.query(Role).filter(Role.id == role.id).first()
        assert fetched_role is None

    def test_delete_role_has_staff(self, client, admin_auth_header, existing_staff):
        """ROLE-007: Xóa nhóm quyền đang có tài khoản sử dụng"""
        # existing_staff is associated with test_role.id
        response = client.delete(f"/roles/{existing_staff.role_id}", headers=admin_auth_header)
        assert response.status_code == 400
        assert "đang có tài khoản sử dụng" in response.json()["detail"].lower()

    def test_update_role_not_found(self, client, admin_auth_header):
        """Cập nhật nhóm quyền không tồn tại - 404"""
        response = client.put("/roles/9999", headers=admin_auth_header, json={"name": "New Name"})
        assert response.status_code == 404

    def test_delete_role_not_found(self, client, admin_auth_header):
        """Xóa nhóm quyền không tồn tại - 404"""
        response = client.delete("/roles/9999", headers=admin_auth_header)
        assert response.status_code == 404

