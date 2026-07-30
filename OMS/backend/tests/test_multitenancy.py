from decimal import Decimal
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy.exc import IntegrityError

import models
from main import app
from utils.auth import JWT_ALGORITHM, JWT_SECRET_KEY
from utils.tenant_context import tenant_context


TENANT_A = UUID("10000000-0000-0000-0000-000000000001")
TENANT_B = UUID("20000000-0000-0000-0000-000000000001")
SELLER_A = UUID("10000000-0000-0000-0000-00000000000a")
SELLER_B = UUID("10000000-0000-0000-0000-00000000000b")
SELLER_C = UUID("20000000-0000-0000-0000-00000000000c")


def _headers(tenant_id, seller_id):
    return {
        "X-User-Id": "1",
        "X-User-Username": "tenant-test",
        "X-Tenant-Id": str(tenant_id),
        "X-Seller-Id": str(seller_id),
    }


def _seed_seller(db, tenant_id, seller_id, suffix):
    with tenant_context(tenant_id, seller_id):
        customer = models.Customer(
            name=f"Customer {suffix}",
            phone=f"09000000{suffix}",
        )
        channel = models.Channel(
            code=f"CHANNEL_{suffix}",
            name=f"Channel {suffix}",
        )
        db.add_all([customer, channel])
        db.flush()
        order = models.Order(
            order_number=f"ORDER-{suffix}",
            customer_id=customer.id,
            channel_id=channel.id,
            status="DRAFT",
            total_amount=Decimal("100.00"),
            shipping_fee=Decimal("10.00"),
            shipping_address=f"Address {suffix}",
            note=f"owned by {suffix}",
        )
        db.add(order)
        db.commit()
        return customer.id, channel.id, order.id


def test_three_seller_reads_and_mutations_are_isolated(client, db):
    customer_a, _channel_a, order_a = _seed_seller(
        db, TENANT_A, SELLER_A, "A"
    )
    customer_b, _channel_b, order_b = _seed_seller(
        db, TENANT_A, SELLER_B, "B"
    )
    customer_c, _channel_c, order_c = _seed_seller(
        db, TENANT_B, SELLER_C, "C"
    )

    headers_a = _headers(TENANT_A, SELLER_A)
    assert client.get("/orders", headers=headers_a).json()["total"] == 1
    assert client.get("/customers", headers=headers_a).json()["total"] == 1
    dashboard = client.get("/dashboard/stats", headers=headers_a).json()
    assert dashboard["order_count"] == 1
    assert dashboard["customer_count"] == 1
    assert dashboard["revenue"] == 100.0

    for foreign_order in (order_b, order_c):
        assert client.get(
            f"/orders/{foreign_order}", headers=headers_a
        ).status_code == 404
        assert client.put(
            f"/orders/{foreign_order}",
            headers=headers_a,
            json={"note": "cross-seller mutation"},
        ).status_code == 404
        assert client.delete(
            f"/orders/{foreign_order}", headers=headers_a
        ).status_code == 404

    for foreign_customer in (customer_b, customer_c):
        assert client.get(
            f"/customers/{foreign_customer}", headers=headers_a
        ).status_code == 404
        assert client.put(
            f"/customers/{foreign_customer}",
            headers=headers_a,
            json={"name": "cross-seller mutation"},
        ).status_code == 404
        assert client.delete(
            f"/customers/{foreign_customer}", headers=headers_a
        ).status_code == 404

    with tenant_context(TENANT_A, SELLER_A):
        assert db.query(models.Order).filter(models.Order.id == order_a).count() == 1
        assert db.query(models.Order).filter(models.Order.id == order_b).count() == 0
    with tenant_context(TENANT_A, SELLER_B):
        assert db.query(models.Order).filter(models.Order.id == order_b).one().note == "owned by B"
        assert db.query(models.Customer).filter(
            models.Customer.id == customer_b
        ).one().name == "Customer B"
    with tenant_context(TENANT_B, SELLER_C):
        assert db.query(models.Order).filter(models.Order.id == order_c).one().note == "owned by C"
        assert db.query(models.Customer).filter(
            models.Customer.id == customer_c
        ).one().name == "Customer C"


def test_owned_rows_are_stamped_and_child_parent_mismatch_is_rejected(db):
    _customer_a, _channel_a, order_a = _seed_seller(
        db, TENANT_A, SELLER_A, "PARENT"
    )

    with tenant_context(TENANT_A, SELLER_A):
        order = db.query(models.Order).filter(models.Order.id == order_a).one()
        fulfillment = models.FulfillmentOrder(
            order=order,
            fulfillment_number="FM-PARENT",
            warehouse_code="WH-A",
            status="PENDING",
        )
        db.add(fulfillment)
        db.commit()
        assert fulfillment.tenant_id == TENANT_A
        assert fulfillment.seller_id == SELLER_A

    with tenant_context(TENANT_A, SELLER_B):
        db.add(
            models.FulfillmentOrder(
                order_id=order_a,
                fulfillment_number="FM-CROSS-SELLER",
                warehouse_code="WH-B",
                status="PENDING",
            )
        )
        with pytest.raises(ValueError, match="ownership must match"):
            db.commit()
        db.rollback()


def test_request_context_fails_closed_and_direct_jwt_uses_token_tenant(client):
    with TestClient(app) as isolated_client:
        assert isolated_client.get("/orders").status_code == 401
        assert isolated_client.get(
            "/orders",
            headers={
                "X-User-Id": "1",
                "X-User-Username": "gateway-user",
                "X-Tenant-Id": str(TENANT_A),
                "X-Seller-Id": "not-a-uuid",
            },
        ).status_code == 400
        assert isolated_client.get(
            "/orders",
            headers={"X-API-Key": "oms_wms_internal_api_key_secret_2026"},
        ).status_code == 400

        token = jwt.encode(
            {
                "sub": "direct-user",
                "staff_id": 99,
                "tenant_id": str(TENANT_A),
                "tenant_code": "tenant-a",
                "role": "admin",
            },
            JWT_SECRET_KEY,
            algorithm=JWT_ALGORITHM,
        )
        response = isolated_client.get(
            "/orders",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Seller-Id": str(SELLER_A),
            },
        )
        assert response.status_code == 200

        conflict = isolated_client.get(
            "/orders",
            headers={
                "Authorization": f"Bearer {token}",
                "X-User-Id": "1",
                "X-User-Username": "gateway-user",
                "X-Tenant-Id": str(TENANT_B),
                "X-Seller-Id": str(SELLER_A),
            },
        )
        assert conflict.status_code == 403


def test_expand_phase_keeps_legacy_global_natural_key_contract(db):
    _seed_seller(db, TENANT_A, SELLER_A, "UNIQUE")
    with tenant_context(TENANT_A, SELLER_B):
        db.add(models.Customer(name="Other seller", phone="09000000UNIQUE"))
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()

    # PMI-030 replaces this legacy global constraint only after backfill.
    assert models.Customer.__table__.c.tenant_id.nullable is True
    assert models.Customer.__table__.c.seller_id.nullable is True
