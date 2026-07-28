import pytest
from fastapi import status
from utils.permissions import (
    Permission,
    ROLE_PERMISSIONS,
    has_permission,
    require_permission,
    require_role,
)
from utils.auth import INTERNAL_SERVICE_TOKEN


# ============================================================================
# Unit Tests for has_permission
# ============================================================================

def test_has_permission_service_bypass():
    identity = {"actor_type": "SERVICE", "actor_username": "OMS"}
    assert has_permission(identity, Permission.PRODUCT_CREATE) is True
    assert has_permission(identity, Permission.CATEGORY_DELETE) is True
    assert has_permission(identity, "any:permission") is True


def test_has_permission_admin_bypass():
    identity = {"actor_type": "USER", "role": "admin", "permissions": []}
    assert has_permission(identity, Permission.PRODUCT_CREATE) is True
    assert has_permission(identity, Permission.CATEGORY_DELETE) is True
    assert has_permission(identity, "random:permission") is True


def test_has_permission_mock_user_object_admin_bypass():
    mock_user = type("MockUser", (), {"role": "admin", "username": "test_admin"})()
    identity = {"actor_type": "USER", "actor_username": "test_admin", "user": mock_user}
    assert has_permission(identity, Permission.PRODUCT_CREATE) is True


def test_has_permission_wildcard():
    identity = {"actor_type": "USER", "role": "custom", "permissions": ["*"]}
    assert has_permission(identity, Permission.PRODUCT_CREATE) is True

    identity_pmi_star = {"actor_type": "USER", "role": "custom", "permissions": ["pmi:*"]}
    assert has_permission(identity_pmi_star, Permission.CATEGORY_UPDATE) is True


def test_has_permission_domain_wildcard():
    identity = {"actor_type": "USER", "role": "custom", "permissions": ["product:*"]}
    assert has_permission(identity, Permission.PRODUCT_CREATE) is True
    assert has_permission(identity, Permission.PRODUCT_DELETE) is True
    assert has_permission(identity, Permission.CATEGORY_CREATE) is False

    identity_pmi_domain = {"actor_type": "USER", "role": "custom", "permissions": ["pmi:category:*"]}
    assert has_permission(identity_pmi_domain, Permission.CATEGORY_CREATE) is True
    assert has_permission(identity_pmi_domain, Permission.PRODUCT_CREATE) is False


def test_has_permission_exact_and_prefixed():
    identity = {"actor_type": "USER", "role": "custom", "permissions": ["product:create", "pmi:category:update"]}
    assert has_permission(identity, Permission.PRODUCT_CREATE) is True
    assert has_permission(identity, "pmi:product:create") is True
    assert has_permission(identity, Permission.CATEGORY_UPDATE) is True
    assert has_permission(identity, Permission.PRODUCT_DELETE) is False


test_role_viewer = {"actor_type": "USER", "role": "viewer", "permissions": []}
test_role_inventory = {"actor_type": "USER", "role": "inventory_staff", "permissions": []}
test_role_pm = {"actor_type": "USER", "role": "product_manager", "permissions": []}


def test_has_permission_role_fallback():
    # Viewer role
    assert has_permission(test_role_viewer, Permission.PRODUCT_READ) is True
    assert has_permission(test_role_viewer, Permission.PRODUCT_CREATE) is False
    assert has_permission(test_role_viewer, Permission.CATEGORY_DELETE) is False

    # Inventory staff role
    assert has_permission(test_role_inventory, Permission.PRODUCT_READ) is True
    assert has_permission(test_role_inventory, Permission.PRODUCT_UPDATE) is True
    assert has_permission(test_role_inventory, Permission.PRODUCT_CREATE) is False
    assert has_permission(test_role_inventory, Permission.CHANNEL_DELETE) is False

    # Product manager role
    assert has_permission(test_role_pm, Permission.PRODUCT_CREATE) is True
    assert has_permission(test_role_pm, Permission.CATEGORY_DELETE) is True
    assert has_permission(test_role_pm, Permission.CHANNEL_UPDATE) is True
    assert has_permission(test_role_pm, Permission.ATTRIBUTE_CREATE) is True


def test_has_permission_invalid_identity():
    assert has_permission(None, Permission.PRODUCT_READ) is False
    assert has_permission({}, Permission.PRODUCT_READ) is False
    assert has_permission("invalid", Permission.PRODUCT_READ) is False


# ============================================================================
# Integration Tests for RBAC Enforcement in API Routes
# ============================================================================

def test_rbac_unauthenticated_requests_return_401(client_no_auth_override):
    """Rule 1: Unauthenticated requests return 401 Unauthorized."""
    endpoints = [
        ("POST", "/products/generate-code", {"category_code": "CAT", "product_name": "Test"}),
        ("POST", "/categories", {"name": "Cat", "code": "CAT1"}),
        ("POST", "/api/channels", {"code": "CHAN1", "name": "Channel 1"}),
        ("POST", "/attributes", {"code": "ATTR1", "name": "Attr 1", "type": "text"}),
    ]
    for method, path, json_data in endpoints:
        if method == "POST":
            response = client_no_auth_override.post(path, json=json_data)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED, f"Failed on {path}"
        assert response.json()["detail"] == "Authentication credentials are required"


def test_rbac_insufficient_permissions_returns_403(client_no_auth_override):
    """Rule 4: Authenticated user with insufficient permissions returns 403 Forbidden."""
    headers_viewer = {
        "X-User-Id": "100",
        "X-User-Username": "viewer_user",
        "X-User-Role": "viewer",
        "X-User-Permissions": "product:read,category:read,channel:read,attribute:read",
    }

    # Test mutation endpoints for viewer role
    r1 = client_no_auth_override.post(
        "/products/generate-code",
        headers=headers_viewer,
        json={"category_code": "CAT", "product_name": "Test Product"}
    )
    assert r1.status_code == status.HTTP_403_FORBIDDEN
    assert r1.json()["detail"] == "Forbidden: Insufficient permissions"

    r2 = client_no_auth_override.post(
        "/categories",
        headers=headers_viewer,
        json={"name": "New Cat", "code": "NEW_CAT"}
    )
    assert r2.status_code == status.HTTP_403_FORBIDDEN
    assert r2.json()["detail"] == "Forbidden: Insufficient permissions"

    r3 = client_no_auth_override.post(
        "/api/channels",
        headers=headers_viewer,
        json={"code": "SHOPEE", "name": "Shopee VN"}
    )
    assert r3.status_code == status.HTTP_403_FORBIDDEN
    assert r3.json()["detail"] == "Forbidden: Insufficient permissions"

    r4 = client_no_auth_override.post(
        "/attributes",
        headers=headers_viewer,
        json={"code": "COLOR", "name": "Color", "type": "text"}
    )
    assert r4.status_code == status.HTTP_403_FORBIDDEN
    assert r4.json()["detail"] == "Forbidden: Insufficient permissions"


def test_rbac_authorized_service_actor_succeeds(client_no_auth_override):
    """Rule 2: Service actor with API key bypasses permission check."""
    headers_service = {"X-API-Key": INTERNAL_SERVICE_TOKEN}

    response = client_no_auth_override.post(
        "/products/generate-code",
        headers=headers_service,
        json={"category_code": "SHOES", "product_name": "Running Shoes"}
    )
    assert response.status_code == status.HTTP_200_OK
    assert "product_code" in response.json()


def test_rbac_authorized_admin_user_succeeds(client_no_auth_override):
    """Rule 2: Admin user with role 'admin' bypasses permission check."""
    headers_admin = {
        "X-User-Id": "1",
        "X-User-Username": "admin_user",
        "X-User-Role": "admin",
    }

    response = client_no_auth_override.post(
        "/products/generate-code",
        headers=headers_admin,
        json={"category_code": "SHIRT", "product_name": "Polo Shirt"}
    )
    assert response.status_code == status.HTTP_200_OK
    assert "product_code" in response.json()


def test_rbac_authorized_permitted_user_succeeds(client_no_auth_override):
    """Rule 3: User with explicit required permission succeeds."""
    headers_staff = {
        "X-User-Id": "200",
        "X-User-Username": "staff_user",
        "X-User-Role": "custom",
        "X-User-Permissions": "product:create,category:create",
    }

    response = client_no_auth_override.post(
        "/products/generate-code",
        headers=headers_staff,
        json={"category_code": "BALL", "product_name": "Soccer Ball"}
    )
    assert response.status_code == status.HTTP_200_OK
    assert "product_code" in response.json()


def test_require_role_dependency_directly(client_no_auth_override):
    """Test require_role dependency directly."""
    dep = require_role(["admin", "product_manager"])

    import asyncio

    # Service actor -> allowed
    service_id = {"actor_type": "SERVICE", "actor_username": "OMS"}
    res_svc = asyncio.run(dep(service_id))
    assert res_svc == service_id

    # Admin user -> allowed
    admin_id = {"actor_type": "USER", "role": "admin"}
    res_admin = asyncio.run(dep(admin_id))
    assert res_admin == admin_id

    # Allowed role user -> allowed
    pm_id = {"actor_type": "USER", "role": "product_manager"}
    res_pm = asyncio.run(dep(pm_id))
    assert res_pm == pm_id

    # Disallowed role user -> 403 Forbidden
    viewer_id = {"actor_type": "USER", "role": "viewer"}
    with pytest.raises(Exception) as excinfo:
        asyncio.run(dep(viewer_id))
    assert excinfo.value.status_code == status.HTTP_403_FORBIDDEN
    assert excinfo.value.detail == "Forbidden: Insufficient permissions"
