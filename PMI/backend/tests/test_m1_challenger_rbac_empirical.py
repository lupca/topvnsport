import os
import sys
from fastapi import status

# Ensure PMI/backend is in sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from utils.permissions import Permission, has_permission
from utils.auth import INTERNAL_SERVICE_TOKEN


# ============================================================================
# 1. SERVICE KEY AUTHENTICATION & INVALID KEY REJECTION (401)
# ============================================================================

def test_valid_service_key_grants_access(client_no_auth_override):
    """Valid X-API-Key grants SERVICE actor access."""
    headers = {"X-API-Key": INTERNAL_SERVICE_TOKEN}
    response = client_no_auth_override.get("/api/auth/me", headers=headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["actor_type"] == "SERVICE"
    assert data["actor_username"] == "OMS"  # Default service name


def test_invalid_service_key_rejected_401(client_no_auth_override):
    """Invalid X-API-Key is strictly rejected with 401 Unauthorized."""
    headers = {"X-API-Key": "invalid_fake_key_99999"}
    response = client_no_auth_override.get("/api/auth/me", headers=headers)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json()["detail"] == "Invalid Service API Key"


def test_missing_credentials_rejected_401(client_no_auth_override):
    """Requests with no authentication headers are rejected with 401 Unauthorized."""
    response = client_no_auth_override.get("/api/auth/me")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json()["detail"] == "Authentication credentials are required"


# ============================================================================
# 2. ROLE FALLBACK (ROLE_PERMISSIONS) WHEN PERMISSIONS HEADER IS ABSENT
# ============================================================================

def test_role_fallback_viewer_permissions():
    """Viewer role with empty/absent permissions list falls back to ROLE_PERMISSIONS['viewer']."""
    identity = {"actor_type": "USER", "actor_username": "viewer_user", "role": "viewer", "permissions": []}
    assert has_permission(identity, Permission.PRODUCT_READ) is True
    assert has_permission(identity, Permission.CATEGORY_READ) is True
    assert has_permission(identity, Permission.ATTRIBUTE_READ) is True
    assert has_permission(identity, Permission.CHANNEL_READ) is True
    # Viewer must NOT have mutation permissions
    assert has_permission(identity, Permission.PRODUCT_CREATE) is False
    assert has_permission(identity, Permission.PRODUCT_UPDATE) is False
    assert has_permission(identity, Permission.PRODUCT_DELETE) is False
    assert has_permission(identity, Permission.CATEGORY_CREATE) is False
    assert has_permission(identity, Permission.ATTRIBUTE_CREATE) is False
    assert has_permission(identity, Permission.CHANNEL_CREATE) is False


def test_role_fallback_inventory_staff_permissions():
    """Inventory staff role falls back to ROLE_PERMISSIONS['inventory_staff']."""
    identity = {"actor_type": "USER", "actor_username": "inv_user", "role": "inventory_staff", "permissions": []}
    assert has_permission(identity, Permission.PRODUCT_READ) is True
    assert has_permission(identity, Permission.PRODUCT_UPDATE) is True
    assert has_permission(identity, Permission.CATEGORY_READ) is True
    # Inventory staff cannot create/delete products or mutate categories/channels
    assert has_permission(identity, Permission.PRODUCT_CREATE) is False
    assert has_permission(identity, Permission.PRODUCT_DELETE) is False
    assert has_permission(identity, Permission.CATEGORY_CREATE) is False
    assert has_permission(identity, Permission.CHANNEL_DELETE) is False


def test_role_fallback_product_manager_permissions():
    """Product Manager role falls back to ROLE_PERMISSIONS['product_manager']."""
    identity = {"actor_type": "USER", "actor_username": "pm_user", "role": "product_manager", "permissions": []}
    assert has_permission(identity, Permission.PRODUCT_CREATE) is True
    assert has_permission(identity, Permission.PRODUCT_UPDATE) is True
    assert has_permission(identity, Permission.PRODUCT_DELETE) is True
    assert has_permission(identity, Permission.CATEGORY_CREATE) is True
    assert has_permission(identity, Permission.ATTRIBUTE_CREATE) is True
    assert has_permission(identity, Permission.CHANNEL_CREATE) is True


def test_role_fallback_admin_permissions():
    """Admin role falls back to full bypass / asterisk."""
    identity = {"actor_type": "USER", "actor_username": "admin_user", "role": "admin", "permissions": []}
    assert has_permission(identity, Permission.PRODUCT_CREATE) is True
    assert has_permission(identity, "any_custom_permission:action") is True


# ============================================================================
# 3. WILDCARD PERMISSION EVALUATION (*, pmi:*, product:*, pmi:category:*)
# ============================================================================

def test_wildcard_asterisk():
    """Global '*' wildcard evaluates to True for any permission."""
    identity = {"actor_type": "USER", "role": "custom", "permissions": ["*"]}
    assert has_permission(identity, Permission.PRODUCT_CREATE) is True
    assert has_permission(identity, Permission.CATEGORY_DELETE) is True
    assert has_permission(identity, "custom:action") is True


def test_wildcard_pmi_asterisk():
    """PMI domain 'pmi:*' wildcard evaluates to True for PMI permissions."""
    identity = {"actor_type": "USER", "role": "custom", "permissions": ["pmi:*"]}
    assert has_permission(identity, Permission.PRODUCT_CREATE) is True
    assert has_permission(identity, Permission.CATEGORY_UPDATE) is True
    assert has_permission(identity, Permission.ATTRIBUTE_DELETE) is True


def test_domain_level_wildcard():
    """Domain-level wildcard 'product:*' grants all product actions but not category actions."""
    identity = {"actor_type": "USER", "role": "custom", "permissions": ["product:*"]}
    assert has_permission(identity, Permission.PRODUCT_CREATE) is True
    assert has_permission(identity, Permission.PRODUCT_READ) is True
    assert has_permission(identity, Permission.PRODUCT_UPDATE) is True
    assert has_permission(identity, Permission.PRODUCT_DELETE) is True
    # Category actions are NOT granted
    assert has_permission(identity, Permission.CATEGORY_CREATE) is False
    assert has_permission(identity, Permission.ATTRIBUTE_READ) is False


def test_pmi_prefixed_domain_wildcard():
    """'pmi:category:*' grants category actions but not product actions."""
    identity = {"actor_type": "USER", "role": "custom", "permissions": ["pmi:category:*"]}
    assert has_permission(identity, Permission.CATEGORY_CREATE) is True
    assert has_permission(identity, Permission.CATEGORY_UPDATE) is True
    assert has_permission(identity, Permission.CATEGORY_DELETE) is True
    assert has_permission(identity, Permission.PRODUCT_CREATE) is False


def test_pmi_prefixed_exact_permission():
    """'pmi:attribute:read' grants 'attribute:read' and 'pmi:attribute:read'."""
    identity = {"actor_type": "USER", "role": "custom", "permissions": ["pmi:attribute:read"]}
    assert has_permission(identity, Permission.ATTRIBUTE_READ) is True
    assert has_permission(identity, "pmi:attribute:read") is True
    assert has_permission(identity, Permission.ATTRIBUTE_CREATE) is False


# ============================================================================
# 4. MUTATION ENDPOINT PERMISSION REJECTION STRESS TESTS (403 FORBIDDEN)
# ============================================================================

def test_mutation_endpoints_reject_unauthorized_requests(client_no_auth_override):
    """
    Stress test all mutation endpoints in products, categories, channels, attributes, and upload
    with an authenticated viewer role (who has read permissions but NO mutation permissions).
    Every mutation endpoint MUST strictly return 403 Forbidden.
    """
    headers_viewer = {
        "X-User-Id": "100",
        "X-User-Username": "viewer_user",
        "X-User-Role": "viewer",
        "X-User-Permissions": "product:read,category:read,channel:read,attribute:read",
    }

    mutation_endpoints = [
        # products.py
        ("POST", "/products/generate-code", {"category_code": "CAT", "product_name": "Test"}),
        ("POST", "/products", {
            "name": "Unauthorized Product",
            "product_code": "UNAUTH-001",
            "category_id": 1,
            "status": "Draft",
            "tier_variations": [],
            "variants": []
        }),
        ("PUT", "/products/1", {"name": "Updated Name"}),
        ("PUT", "/products/1/variants/1", {"price": 99.99}),
        ("DELETE", "/products/1", None),

        # categories.py
        ("POST", "/categories", {"name": "New Cat", "code": "NEW_CAT"}),
        ("PUT", "/categories/1", {"name": "Updated Cat", "code": "CAT_1"}),
        ("DELETE", "/categories/1", None),

        # channels.py
        ("POST", "/api/channels", {"code": "TIKTOK", "name": "TikTok Shop"}),
        ("PUT", "/api/channels/1", {"code": "TIKTOK", "name": "TikTok Shop VN"}),
        ("DELETE", "/api/channels/1", None),
        ("PUT", "/api/channels/1/config", {"app_key": "k", "app_secret": "s", "is_active": True}),

        # attributes.py
        ("POST", "/attributes", {"code": "COLOR", "name": "Color", "type": "text"}),
        ("PUT", "/attributes/1", {"code": "COLOR", "name": "Color", "type": "text"}),
        ("DELETE", "/attributes/1", None),
        ("POST", "/attribute-groups", {"code": "GENERAL", "name": "General"}),
        ("PUT", "/attribute-groups/1", {"code": "GENERAL", "name": "General Specs"}),
        ("DELETE", "/attribute-groups/1", None),

        # upload.py
        ("POST", "/upload", None),
    ]

    failed_endpoints = []

    for method, path, payload in mutation_endpoints:
        if method == "POST":
            if path == "/upload":
                # multipart form data upload
                files = {"file": ("test.jpg", b"dummy image content", "image/jpeg")}
                resp = client_no_auth_override.post(path, headers=headers_viewer, files=files)
            else:
                resp = client_no_auth_override.post(path, headers=headers_viewer, json=payload)
        elif method == "PUT":
            resp = client_no_auth_override.put(path, headers=headers_viewer, json=payload)
        elif method == "DELETE":
            resp = client_no_auth_override.delete(path, headers=headers_viewer)

        if resp.status_code != status.HTTP_403_FORBIDDEN:
            failed_endpoints.append({
                "endpoint": f"{method} {path}",
                "actual_status": resp.status_code,
                "response_body": resp.text[:200]
            })

    assert not failed_endpoints, f"The following mutation endpoints failed 403 Forbidden enforcement:\n{failed_endpoints}"
