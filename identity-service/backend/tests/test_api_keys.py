import datetime
import os
import re
import uuid

import pytest

from models import ApiKey, Role, Seller, StaffAccount, Tenant
from utils.api_keys import hash_api_key
from utils.password import hash_password

KEY_RE = re.compile(r"^vk_(live|test)_[A-Za-z0-9_-]{32,}$")
INTERNAL_TOKEN = os.environ["INTERNAL_SERVICE_TOKEN"]


def _utcnow():
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)


@pytest.fixture
def seller(db_session, seed_admin_user):
    seller = Seller(
        tenant_id=seed_admin_user.tenant_id,
        tax_code="0101234567",
        name="Shop Thể Thao A",
        is_active=True,
    )
    db_session.add(seller)
    db_session.commit()
    db_session.refresh(seller)
    return seller


@pytest.fixture
def other_tenant_seller(db_session):
    tenant = Tenant(code="other-tenant", name="Other Tenant", is_active=True)
    db_session.add(tenant)
    db_session.flush()
    seller = Seller(tenant_id=tenant.id, tax_code="0909999999", name="Other Shop", is_active=True)
    db_session.add(seller)
    db_session.commit()
    db_session.refresh(seller)
    return seller


@pytest.fixture
def viewer_header(client, db_session, seed_admin_user):
    role = Role(code="viewer", name="Viewer", permissions=["pmi:read"])
    db_session.add(role)
    db_session.flush()
    db_session.add(
        StaffAccount(
            username="viewer_user",
            email="viewer@test.com",
            hashed_password=hash_password("Viewer@123"),
            role_id=role.id,
            tenant_id=seed_admin_user.tenant_id,
            is_active=True,
        )
    )
    db_session.commit()
    resp = client.post("/auth/login", json={"username": "viewer_user", "password": "Viewer@123"})
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def _create(client, headers, seller_id, scopes=("insights:read",), **extra):
    body = {"name": "VOMA Insights", "seller_id": str(seller_id), "scopes": list(scopes), **extra}
    return client.post("/api-keys/", json=body, headers=headers)


@pytest.fixture
def make_key(client, admin_auth_header, seller):
    def _make(scopes=("insights:read",), **extra):
        resp = _create(client, admin_auth_header, seller.id, scopes, **extra)
        assert resp.status_code == 201, resp.text
        return resp.json()

    return _make


def _verify(client, key, method="GET", uri="/api/oms/orders?page=1&limit=1", **headers):
    hdrs = {"X-API-Key": key, "X-Original-Method": method, "X-Original-URI": uri}
    hdrs.update({k.replace("_", "-"): v for k, v in headers.items()})
    return client.get("/auth/verify", headers=hdrs)


# ---------------------------------------------------------------------------
# Management API
# ---------------------------------------------------------------------------


def test_create_returns_full_key_once_and_stores_only_hash(client, admin_auth_header, seller, db_session):
    resp = _create(client, admin_auth_header, seller.id, ["insights:read", "inbound:write"])
    assert resp.status_code == 201, resp.text
    data = resp.json()
    key = data["key"]
    assert KEY_RE.match(key)
    assert key.startswith("vk_test_")
    assert data["prefix"] == key[: len("vk_test_") + 8]
    assert data["last4"] == key[-4:]
    assert data["scopes"] == ["insights:read", "inbound:write"]
    assert data["seller_id"] == str(seller.id)
    assert data["seller_name"] == seller.name
    assert data["tenant_id"] == str(seller.tenant_id)
    assert data["status"] == "active"
    assert data["created_by_username"] == "admin"

    stored = db_session.query(ApiKey).one()
    assert stored.key_hash == hash_api_key(key)
    assert key not in (stored.key_hash, stored.prefix, stored.last4)


def test_list_never_returns_secret(client, admin_auth_header, make_key):
    created = make_key()
    resp = client.get("/api-keys/", headers=admin_auth_header)
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["id"] == created["id"]
    assert "key" not in items[0]
    assert "key_hash" not in items[0]
    assert created["key"] not in resp.text


def test_list_is_tenant_scoped(client, admin_auth_header, db_session, other_tenant_seller):
    db_session.add(
        ApiKey(
            name="foreign",
            key_hash=hash_api_key("vk_test_" + "x" * 43),
            prefix="vk_test_xxxxxxxx",
            last4="xxxx",
            tenant_id=other_tenant_seller.tenant_id,
            seller_id=other_tenant_seller.id,
            scopes=["insights:read"],
        )
    )
    db_session.commit()
    resp = client.get("/api-keys/", headers=admin_auth_header)
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_rejects_seller_of_other_tenant(client, admin_auth_header, other_tenant_seller):
    resp = _create(client, admin_auth_header, other_tenant_seller.id)
    assert resp.status_code == 404


@pytest.mark.parametrize("scopes", [[], ["admin:*"], ["insights:read", "oms:write"]])
def test_create_rejects_invalid_scopes(client, admin_auth_header, seller, scopes):
    resp = _create(client, admin_auth_header, seller.id, scopes)
    assert resp.status_code == 422


def test_create_rejects_past_expiry(client, admin_auth_header, seller):
    past = (_utcnow() - datetime.timedelta(hours=1)).isoformat()
    resp = _create(client, admin_auth_header, seller.id, expires_at=past)
    assert resp.status_code == 400


def test_create_rejects_inactive_seller(client, admin_auth_header, seller, db_session):
    seller.is_active = False
    db_session.commit()
    resp = _create(client, admin_auth_header, seller.id)
    assert resp.status_code == 400


def test_management_requires_admin(client, viewer_header, seller):
    assert client.get("/api-keys/", headers=viewer_header).status_code == 403
    assert _create(client, viewer_header, seller.id).status_code == 403
    assert client.get("/sellers/", headers=viewer_header).status_code == 403


def test_management_requires_authentication(client, seller):
    assert client.get("/api-keys/").status_code == 401
    assert _create(client, {}, seller.id).status_code == 401


def test_api_key_cannot_manage_api_keys(client, make_key):
    key = make_key()["key"]
    resp = client.get("/api-keys/", headers={"X-API-Key": key})
    assert resp.status_code == 401


def test_revoke_marks_key_revoked_and_is_idempotent(client, admin_auth_header, make_key):
    created = make_key()
    resp = client.post(f"/api-keys/{created['id']}/revoke", headers=admin_auth_header)
    assert resp.status_code == 200
    assert resp.json()["status"] == "revoked"
    revoked_at = resp.json()["revoked_at"]
    assert revoked_at

    again = client.post(f"/api-keys/{created['id']}/revoke", headers=admin_auth_header)
    assert again.status_code == 200
    assert again.json()["revoked_at"] == revoked_at


def test_revoke_unknown_or_foreign_key_returns_404(client, admin_auth_header, db_session, other_tenant_seller):
    foreign = ApiKey(
        name="foreign",
        key_hash=hash_api_key("vk_test_" + "y" * 43),
        prefix="vk_test_yyyyyyyy",
        last4="yyyy",
        tenant_id=other_tenant_seller.tenant_id,
        seller_id=other_tenant_seller.id,
        scopes=["insights:read"],
    )
    db_session.add(foreign)
    db_session.commit()
    assert client.post(f"/api-keys/{foreign.id}/revoke", headers=admin_auth_header).status_code == 404
    assert client.post(f"/api-keys/{uuid.uuid4()}/revoke", headers=admin_auth_header).status_code == 404
    db_session.refresh(foreign)
    assert foreign.revoked_at is None


def test_list_sellers_is_tenant_scoped(client, admin_auth_header, seller, other_tenant_seller):
    resp = client.get("/sellers/", headers=admin_auth_header)
    assert resp.status_code == 200
    assert [s["id"] for s in resp.json()] == [str(seller.id)]


# ---------------------------------------------------------------------------
# Gateway verification (/auth/verify)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "method,uri",
    [
        ("GET", "/api/pmi/products?page=1&limit=100"),
        ("GET", "/api/oms/orders"),
        ("GET", "/api/oms/orders/?updated_since=2026-01-01T00:00:00Z"),
        ("GET", "/api/wms/inbound-shipments"),
    ],
)
def test_verify_valid_read_key_sets_identity_headers(client, make_key, seller, method, uri):
    created = make_key()
    resp = _verify(client, created["key"], method, uri)
    assert resp.status_code == 200, resp.text
    assert resp.headers["X-Tenant-Id"] == str(seller.tenant_id)
    assert resp.headers["X-Tenant-Code"] == "topvn"
    assert resp.headers["X-Seller-Id"] == str(seller.id)
    assert resp.headers["X-User-Id"] == f"apikey:{created['id']}"
    assert resp.headers["X-User-Username"] == f"apikey:{created['prefix']}"
    assert resp.headers["X-User-Role"] == "api_key"
    body = resp.json()
    assert body["auth_type"] == "api_key"
    assert body["scopes"] == ["insights:read"]


def test_verify_inbound_write_scope(client, make_key):
    key = make_key(scopes=("inbound:write",))["key"]
    assert _verify(client, key, "POST", "/api/wms/inbound-shipments").status_code == 200
    # inbound:write alone does not grant reads
    assert _verify(client, key, "GET", "/api/oms/orders").status_code == 403


def test_verify_wrong_scope_is_403(client, make_key):
    key = make_key(scopes=("insights:read",))["key"]
    resp = _verify(client, key, "POST", "/api/wms/inbound-shipments")
    assert resp.status_code == 403


@pytest.mark.parametrize(
    "method,uri",
    [
        ("GET", "/api/oms/customers"),
        ("GET", "/api/oms/orders/123"),
        ("DELETE", "/api/oms/orders"),
        ("PUT", "/api/pmi/products"),
        ("GET", "/api/identity/api-keys/"),
        ("GET", "/api/oms/orders/../customers"),
        ("GET", "/api/oms/%6Frders"),
        ("GET", "/api/oms//orders"),
        ("GET", "/orders"),  # prod per-service hosts: never accepted for API keys
        ("GET", "/oms-api/orders"),
        ("POST", "/api/wms/inbound-shipments/1/receive"),
    ],
)
def test_verify_path_outside_allowlist_is_403(client, make_key, method, uri):
    key = make_key(scopes=("insights:read", "inbound:write"))["key"]
    assert _verify(client, key, method, uri).status_code == 403


def test_verify_missing_original_request_info_is_403(client, make_key):
    key = make_key()["key"]
    resp = client.get("/auth/verify", headers={"X-API-Key": key})
    assert resp.status_code == 403


def test_verify_revoked_key_is_401(client, admin_auth_header, make_key):
    created = make_key()
    client.post(f"/api-keys/{created['id']}/revoke", headers=admin_auth_header)
    assert _verify(client, created["key"]).status_code == 401


def test_verify_expired_key_is_401(client, make_key, db_session):
    created = make_key()
    api_key = db_session.get(ApiKey, uuid.UUID(created["id"]))
    api_key.expires_at = _utcnow() - datetime.timedelta(seconds=1)
    db_session.commit()
    assert _verify(client, created["key"]).status_code == 401


def test_verify_not_yet_expired_key_is_ok(client, make_key):
    future = (_utcnow() + datetime.timedelta(days=30)).isoformat()
    created = make_key(expires_at=future)
    assert created["expires_at"]
    assert _verify(client, created["key"]).status_code == 200


@pytest.mark.parametrize(
    "bad_key",
    [
        "vk_test_" + "A" * 43,  # well-formed, unknown
        "vk_test_short",
        "vk_prod_" + "A" * 43,
        "vk_test_" + "A" * 40 + "!!!",
    ],
)
def test_verify_unknown_or_malformed_key_is_401(client, make_key, bad_key):
    make_key()
    assert _verify(client, bad_key).status_code == 401


def test_verify_seller_mismatch_is_403(client, make_key, other_tenant_seller):
    key = make_key()["key"]
    resp = _verify(client, key, X_Seller_Id=str(other_tenant_seller.id))
    assert resp.status_code == 403
    assert _verify(client, key, X_Seller_Id="not-a-uuid").status_code == 403


def test_verify_matching_seller_header_is_ok(client, make_key, seller):
    key = make_key()["key"]
    resp = _verify(client, key, X_Seller_Id=str(seller.id).upper())
    assert resp.status_code == 200
    assert resp.headers["X-Seller-Id"] == str(seller.id)


def test_verify_inactive_seller_or_tenant_is_401(client, make_key, seller, db_session):
    key = make_key()["key"]
    seller.is_active = False
    db_session.commit()
    assert _verify(client, key).status_code == 401
    seller.is_active = True
    seller.tenant.is_active = False
    db_session.commit()
    assert _verify(client, key).status_code == 401


def test_verify_rejects_api_key_combined_with_jwt(client, make_key, admin_auth_header):
    key = make_key()["key"]
    resp = _verify(client, key, Authorization=admin_auth_header["Authorization"])
    assert resp.status_code == 401


def test_internal_service_token_is_not_an_api_key(client, seed_admin_user):
    resp = client.get(
        "/auth/verify",
        headers={
            "X-API-Key": INTERNAL_TOKEN,
            "X-Original-Method": "GET",
            "X-Original-URI": "/api/oms/orders",
        },
    )
    assert resp.status_code == 401
    assert "X-Tenant-Id" not in resp.headers


def test_verify_updates_last_used_at_with_throttle(client, make_key, db_session):
    created = make_key()
    key_id = uuid.UUID(created["id"])
    assert _verify(client, created["key"]).status_code == 200
    db_session.expire_all()
    first = db_session.get(ApiKey, key_id).last_used_at
    assert first is not None

    assert _verify(client, created["key"]).status_code == 200
    db_session.expire_all()
    assert db_session.get(ApiKey, key_id).last_used_at == first  # throttled

    api_key = db_session.get(ApiKey, key_id)
    api_key.last_used_at = first - datetime.timedelta(minutes=5)
    db_session.commit()
    assert _verify(client, created["key"]).status_code == 200
    db_session.expire_all()
    assert db_session.get(ApiKey, key_id).last_used_at > first - datetime.timedelta(minutes=5)


def test_jwt_verify_echoes_requested_seller(client, admin_auth_header, seed_admin_user):
    seller_id = str(uuid.uuid4())
    resp = client.get(
        "/auth/verify",
        headers={**admin_auth_header, "X-Seller-Id": seller_id},
    )
    assert resp.status_code == 200
    assert resp.headers["X-Seller-Id"] == seller_id
    assert resp.headers["X-Tenant-Id"] == str(seed_admin_user.tenant_id)

    without = client.get("/auth/verify", headers=admin_auth_header)
    assert without.status_code == 200
    assert "X-Seller-Id" not in without.headers


def test_jwt_verify_ignores_non_vk_api_key_header(client, admin_auth_header):
    resp = client.get(
        "/auth/verify",
        headers={**admin_auth_header, "X-API-Key": INTERNAL_TOKEN},
    )
    assert resp.status_code == 200
    assert resp.json()["auth_type"] == "jwt"


# ---------------------------------------------------------------------------
# Internal seller-membership endpoint (used by PMI)
# ---------------------------------------------------------------------------


def test_internal_seller_membership(client, seller, other_tenant_seller, make_key):
    url = f"/internal/sellers/{seller.id}?tenant_id={seller.tenant_id}"
    ok = client.get(url, headers={"X-API-Key": INTERNAL_TOKEN})
    assert ok.status_code == 200
    assert ok.json() == {
        "seller_id": str(seller.id),
        "tenant_id": str(seller.tenant_id),
        "active": True,
    }
    assert client.get(url).status_code == 401
    assert client.get(url, headers={"X-API-Key": "wrong"}).status_code == 401
    assert client.get(url, headers={"X-API-Key": make_key()["key"]}).status_code == 401
    foreign = f"/internal/sellers/{seller.id}?tenant_id={other_tenant_seller.tenant_id}"
    assert client.get(foreign, headers={"X-API-Key": INTERNAL_TOKEN}).status_code == 404
