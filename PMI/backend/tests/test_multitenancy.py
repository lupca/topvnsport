import importlib
import json
import uuid

import pytest
from sqlalchemy import delete
from sqlalchemy.exc import IntegrityError

import models
from tests.conftest import TEST_SELLER_ID, TEST_TENANT_ID


SELLER_B = uuid.UUID("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
TENANT_B = uuid.UUID("22222222-2222-4222-8222-222222222222")
SELLER_C = uuid.UUID("cccccccc-cccc-4ccc-8ccc-cccccccccccc")


def _tenant_context(tenant_id, seller_id):
    return importlib.import_module("utils.context").tenant_context(tenant_id, seller_id)


def _headers(tenant_id, seller_id):
    return {
        "X-User-Id": "1",
        "X-User-Username": "tenant-test",
        "X-Tenant-Id": str(tenant_id),
        "X-Seller-Id": str(seller_id),
    }


def _seed_seller(db, tenant_id, seller_id, suffix):
    with _tenant_context(tenant_id, seller_id):
        category = models.Category(name=f"Category {suffix}", code="shared-code")
        channel = models.Channel(name=f"Channel {suffix}", code="shared-code")
        product = models.Product(
            product_code="shared-code",
            slug="shared-slug",
            name=f"Product {suffix}",
            category=category,
            weight=100,
            status="Published",
        )
        variant = models.ProductVariant(
            product=product,
            sku_code="shared-sku",
            price=100_000,
        )
        promotion = models.Promotion(
            code="shared-code",
            name=f"Promotion {suffix}",
            discount_type=models.DiscountType.PERCENTAGE,
            discount_value=10,
            status=models.PromotionStatus.DRAFT,
        )
        promotion.scopes.append(
            models.PromotionScope(scope_type=models.ScopeType.ALL)
        )
        db.add_all([category, channel, product, variant, promotion])
        db.flush()
        ids = {
            "category": category.id,
            "channel": channel.id,
            "product": product.id,
            "variant": variant.id,
            "promotion": promotion.id,
            "scope": promotion.scopes[0].id,
        }
    return ids


def test_automatic_query_isolation_and_seller_scoped_natural_keys(
    client, db_session, monkeypatch
):
    memberships = {
        str(TEST_SELLER_ID): str(TEST_TENANT_ID),
        str(SELLER_B): str(TEST_TENANT_ID),
        str(SELLER_C): str(TENANT_B),
    }
    monkeypatch.setenv("PMI_SELLER_TENANT_MAP", json.dumps(memberships))

    ids_a = _seed_seller(db_session, TEST_TENANT_ID, TEST_SELLER_ID, "A")
    ids_b = _seed_seller(db_session, TEST_TENANT_ID, SELLER_B, "B")
    ids_c = _seed_seller(db_session, TENANT_B, SELLER_C, "C")

    for tenant_id, seller_id, suffix in (
        (TEST_TENANT_ID, TEST_SELLER_ID, "A"),
        (TEST_TENANT_ID, SELLER_B, "B"),
        (TENANT_B, SELLER_C, "C"),
    ):
        db_session.expire_all()
        with _tenant_context(tenant_id, seller_id):
            assert [row.name for row in db_session.query(models.Product).filter_by(product_code="shared-code")] == [
                f"Product {suffix}"
            ]
            assert [row.name for row in db_session.query(models.Category).filter_by(code="shared-code")] == [
                f"Category {suffix}"
            ]
            assert [row.name for row in db_session.query(models.Promotion).filter_by(code="shared-code")] == [
                f"Promotion {suffix}"
            ]
            assert [row.name for row in db_session.query(models.Channel).filter_by(code="shared-code")] == [
                f"Channel {suffix}"
            ]
            assert db_session.query(models.ProductVariant).filter_by(sku_code="shared-sku").count() == 1

    headers_a = _headers(TEST_TENANT_ID, TEST_SELLER_ID)
    response = client.get("/products", headers=headers_a, params={"q": "Product"})
    assert response.status_code == 200
    assert [row["name"] for row in response.json()["items"]] == ["Product A"]

    assert client.get(f"/products/{ids_b['product']}", headers=headers_a).status_code == 404
    assert client.get(f"/products/{ids_c['product']}", headers=headers_a).status_code == 404
    assert client.delete(f"/products/{ids_b['product']}", headers=headers_a).status_code == 404
    assert client.put(
        f"/categories/{ids_b['category']}",
        headers=headers_a,
        json={"name": "forged", "code": "forged", "parent_id": None},
    ).status_code == 404
    assert client.delete(f"/api/channels/{ids_b['channel']}", headers=headers_a).status_code == 404
    assert client.get(f"/api/promotions/{ids_b['promotion']}", headers=headers_a).status_code == 404

    db_session.expire_all()
    with _tenant_context(TEST_TENANT_ID, TEST_SELLER_ID):
        assert db_session.query(models.Product).filter_by(id=ids_b["product"]).update(
            {"name": "bulk-forged"}
        ) == 0
        assert db_session.execute(
            delete(models.PromotionScope).where(
                models.PromotionScope.promotion_id == ids_b["promotion"]
            )
        ).rowcount == 0

    db_session.expire_all()
    with _tenant_context(TEST_TENANT_ID, SELLER_B):
        assert db_session.query(models.Product).filter_by(id=ids_b["product"]).one().name == "Product B"
        assert db_session.query(models.Category).filter_by(id=ids_b["category"]).one().name == "Category B"
        assert db_session.query(models.Channel).filter_by(id=ids_b["channel"]).one().name == "Channel B"
        assert db_session.query(models.Promotion).filter_by(id=ids_b["promotion"]).one().name == "Promotion B"
        assert db_session.query(models.PromotionScope).filter_by(id=ids_b["scope"]).count() == 1

    public_response = client.get("/public/products", params={"q": "Product"})
    assert public_response.status_code == 200
    assert [row["name"] for row in public_response.json()["items"]] == ["Product A"]

    nested = db_session.begin_nested()
    try:
        with _tenant_context(TEST_TENANT_ID, TEST_SELLER_ID):
            db_session.add(models.Category(name="Duplicate A", code="shared-code"))
            with pytest.raises(IntegrityError):
                db_session.flush()
    finally:
        nested.rollback()


def test_request_context_fails_closed(client_no_auth_override, monkeypatch):
    monkeypatch.setenv(
        "PMI_SELLER_TENANT_MAP",
        json.dumps(
            {
                str(TEST_SELLER_ID): str(TEST_TENANT_ID),
                str(SELLER_C): str(TENANT_B),
            }
        ),
    )
    base_headers = {
        "X-User-Id": "1",
        "X-User-Username": "tenant-test",
        "X-Tenant-Id": str(TEST_TENANT_ID),
    }

    assert client_no_auth_override.get("/products", headers=base_headers).status_code == 400
    assert client_no_auth_override.get(
        "/products",
        headers={**base_headers, "X-Seller-Id": "not-a-uuid"},
    ).status_code == 400
    assert client_no_auth_override.get(
        "/products",
        headers={**base_headers, "X-Seller-Id": str(SELLER_C)},
    ).status_code == 403
