"""Product list contract used by VOMA Insights: category name, variant fields, scoping."""

import importlib
import json
import uuid
from decimal import Decimal

import models
from tests.conftest import TEST_SELLER_ID, TEST_TENANT_ID

SELLER_B = uuid.UUID("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")


def _tenant_context(tenant_id, seller_id):
    return importlib.import_module("utils.context").tenant_context(tenant_id, seller_id)


def _headers(seller_id):
    return {"X-Tenant-Id": str(TEST_TENANT_ID), "X-Seller-Id": str(seller_id)}


def _seed(db, seller_id, suffix, with_category=True):
    with _tenant_context(TEST_TENANT_ID, seller_id):
        category = models.Category(name=f"Áo thun {suffix}", code=f"ao-thun-{suffix}") if with_category else None
        product = models.Product(
            product_code=f"INS-{suffix}",
            slug=f"ins-{suffix}",
            name=f"Insights Product {suffix}",
            category=category,
            weight=200,
            status="Published",
        )
        db.add(product)
        db.add_all(
            [
                models.ProductVariant(
                    product=product,
                    sku_code=f"INS-{suffix}-RED-M",
                    tier_1_option="Đỏ",
                    tier_2_option="M",
                    price=Decimal("199000"),
                    default_cost_price=Decimal("85000.50"),
                ),
                models.ProductVariant(
                    product=product,
                    sku_code=f"INS-{suffix}-PLAIN",
                    price=Decimal("150000"),
                ),
            ]
        )
        db.flush()
        return product.id


def test_list_products_exposes_category_and_variant_contract_fields(client, db_session):
    _seed(db_session, TEST_SELLER_ID, "A")
    _seed(db_session, TEST_SELLER_ID, "NOCAT", with_category=False)

    resp = client.get("/products", headers=_headers(TEST_SELLER_ID), params={"q": "Insights Product", "page": 1, "limit": 100})
    assert resp.status_code == 200
    body = resp.json()
    assert {"items", "total", "page", "limit", "pages"} <= set(body)
    by_name = {p["name"]: p for p in body["items"]}
    assert set(by_name) == {"Insights Product A", "Insights Product NOCAT"}

    product = by_name["Insights Product A"]
    assert product["id"]
    assert product["category"]["name"] == "Áo thun A"
    assert by_name["Insights Product NOCAT"]["category"] is None

    variants = {v["sku_code"]: v for v in product["variants"]}
    red = variants["INS-A-RED-M"]
    assert red["name"] == "Đỏ / M"
    assert Decimal(str(red["price"])) == Decimal("199000")
    assert Decimal(str(red["default_cost_price"])) == Decimal("85000.50")
    plain = variants["INS-A-PLAIN"]
    assert plain["name"] is None
    assert plain["default_cost_price"] is None


def test_list_products_caps_limit_and_page(client, db_session):
    resp = client.get("/products", headers=_headers(TEST_SELLER_ID), params={"limit": 1000, "page": 0})
    assert resp.status_code == 200
    assert resp.json()["limit"] == 100
    assert resp.json()["page"] == 1


def test_list_products_is_scoped_to_caller_seller(client, db_session, monkeypatch):
    monkeypatch.setenv(
        "PMI_SELLER_TENANT_MAP",
        json.dumps({str(TEST_SELLER_ID): str(TEST_TENANT_ID), str(SELLER_B): str(TEST_TENANT_ID)}),
    )
    _seed(db_session, TEST_SELLER_ID, "A")
    _seed(db_session, SELLER_B, "B")

    for seller_id, suffix in ((TEST_SELLER_ID, "A"), (SELLER_B, "B")):
        db_session.expire_all()
        resp = client.get("/products", headers=_headers(seller_id), params={"limit": 100})
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert [p["name"] for p in items] == [f"Insights Product {suffix}"]
        assert items[0]["category"]["name"] == f"Áo thun {suffix}"
        assert {v["sku_code"] for v in items[0]["variants"]} == {f"INS-{suffix}-RED-M", f"INS-{suffix}-PLAIN"}
