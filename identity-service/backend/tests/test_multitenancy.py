import pytest
from sqlalchemy.exc import IntegrityError

from models import Role, Seller, StaffAccount, Tenant
from utils.jwt import decode_access_token
from utils.password import hash_password


def _staff(tenant, role, username):
    return StaffAccount(
        username=username,
        email=f"{username}@example.com",
        hashed_password=hash_password("Password@123"),
        role_id=role.id,
        tenant_id=tenant.id,
        is_active=True,
    )


def test_login_and_refresh_tokens_carry_distinct_tenant_context(
    client, db_session
):
    tenant_a = Tenant(code="tenant-a", name="Tenant A", is_active=True)
    tenant_b = Tenant(code="tenant-b", name="Tenant B", is_active=True)
    role = Role(code="tenant_staff", name="Tenant Staff", permissions=["pmi:read"])
    db_session.add_all([tenant_a, tenant_b, role])
    db_session.flush()
    staff_a = _staff(tenant_a, role, "staff_a")
    staff_b = _staff(tenant_b, role, "staff_b")
    db_session.add_all([staff_a, staff_b])
    db_session.commit()

    login_a = client.post(
        "/auth/login",
        json={"username": staff_a.username, "password": "Password@123"},
    )
    login_b = client.post(
        "/auth/login",
        json={"username": staff_b.username, "password": "Password@123"},
    )
    assert login_a.status_code == 200
    assert login_b.status_code == 200

    payload_a = decode_access_token(login_a.json()["access_token"])
    payload_b = decode_access_token(login_b.json()["access_token"])
    assert payload_a["tenant_id"] == str(tenant_a.id)
    assert payload_a["tenant_code"] == tenant_a.code
    assert payload_b["tenant_id"] == str(tenant_b.id)
    assert payload_b["tenant_code"] == tenant_b.code
    assert payload_a["tenant_id"] != payload_b["tenant_id"]
    assert "seller_id" not in payload_a
    assert "seller_id" not in payload_b

    refreshed = client.post(
        "/auth/refresh",
        json={"refresh_token": login_a.json()["refresh_token"]},
    )
    assert refreshed.status_code == 200
    refresh_payload = decode_access_token(refreshed.json()["access_token"])
    assert refresh_payload["tenant_id"] == str(tenant_a.id)
    assert refresh_payload["tenant_code"] == tenant_a.code
    assert "seller_id" not in refresh_payload


def test_seller_tax_code_is_unique_within_tenant(db_session):
    tenant_a = Tenant(code="seller-a", name="Seller Tenant A", is_active=True)
    tenant_b = Tenant(code="seller-b", name="Seller Tenant B", is_active=True)
    db_session.add_all([tenant_a, tenant_b])
    db_session.flush()
    db_session.add_all(
        [
            Seller(
                tenant_id=tenant_a.id,
                tax_code="TAX-001",
                name="Seller A",
                is_active=True,
            ),
            Seller(
                tenant_id=tenant_b.id,
                tax_code="TAX-001",
                name="Seller B",
                is_active=True,
            ),
        ]
    )
    db_session.commit()

    db_session.add(
        Seller(
            tenant_id=tenant_a.id,
            tax_code="TAX-001",
            name="Duplicate Seller A",
            is_active=True,
        )
    )
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_verify_uses_current_database_tenant_and_ignores_spoofed_headers(
    client, db_session
):
    tenant_a = Tenant(code="verify-a", name="Verify Tenant A", is_active=True)
    tenant_b = Tenant(code="verify-b", name="Verify Tenant B", is_active=True)
    role = Role(code="verify_staff", name="Verify Staff", permissions=["pmi:read"])
    db_session.add_all([tenant_a, tenant_b, role])
    db_session.flush()
    staff = _staff(tenant_a, role, "verify_staff")
    db_session.add(staff)
    db_session.commit()

    login = client.post(
        "/auth/login",
        json={"username": staff.username, "password": "Password@123"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]

    staff.tenant_id = tenant_b.id
    db_session.commit()
    response = client.get(
        "/auth/verify",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Tenant-Id": "00000000-0000-0000-0000-000000000000",
            "X-Tenant-Code": "spoofed",
        },
    )

    assert response.status_code == 200
    assert response.headers["X-Tenant-Id"] == str(tenant_b.id)
    assert response.headers["X-Tenant-Code"] == tenant_b.code
    assert response.json()["tenant_id"] == str(tenant_b.id)
    assert response.json()["tenant_code"] == tenant_b.code


def test_verify_rejects_inactive_tenant(client, db_session):
    tenant = Tenant(code="disabled", name="Disabled Tenant", is_active=True)
    role = Role(code="disabled_staff", name="Disabled Staff", permissions=[])
    db_session.add_all([tenant, role])
    db_session.flush()
    staff = _staff(tenant, role, "disabled_staff")
    db_session.add(staff)
    db_session.commit()

    login = client.post(
        "/auth/login",
        json={"username": staff.username, "password": "Password@123"},
    )
    assert login.status_code == 200
    tenant.is_active = False
    db_session.commit()

    response = client.get(
        "/auth/verify",
        headers={"Authorization": f"Bearer {login.json()['access_token']}"},
    )
    assert response.status_code == 401
