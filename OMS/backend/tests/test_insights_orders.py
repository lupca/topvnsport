"""Order list contract for VOMA Insights: finance fields, filters, RETURNED, scoping."""

import os
from datetime import datetime, timedelta
from decimal import Decimal
from urllib.parse import quote
from uuid import UUID, uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, event, inspect, text

import models
from adapters.channels.shopee import ShopeeAdapter
from adapters.channels.tiktok import TikTokAdapter
from services.order_service import OrderService
from utils.tenant_context import tenant_context

TENANT_A = UUID("10000000-0000-0000-0000-000000000001")
SELLER_A = UUID("10000000-0000-0000-0000-00000000000a")
SELLER_B = UUID("10000000-0000-0000-0000-00000000000b")

CONTRACT_KEYS = {
    "order_number",
    "status",
    "created_at",
    "updated_at",
    "channel_code",
    "shipping_fee",
    "discount_amount",
    "seller_shipping_cost",
    "platform_fee",
    "returned_at",
    "items",
}


def _headers(tenant_id, seller_id):
    return {
        "X-User-Id": "1",
        "X-User-Username": "insights-test",
        "X-Tenant-Id": str(tenant_id),
        "X-Seller-Id": str(seller_id),
    }


def _customer_and_channel(db, code="SHOPEE", phone="0911000000"):
    customer = models.Customer(name="Insights Buyer", phone=phone)
    db.add(customer)
    channel = db.query(models.Channel).filter(models.Channel.code == code).first()
    if channel is None:
        channel = models.Channel(code=code, name=code)
        db.add(channel)
    db.flush()
    return customer, channel


def _order(db, customer, channel, number, status="COMPLETED", created_at=None, updated_at=None, lines=1, **extra):
    order = models.Order(
        order_number=number,
        customer_id=customer.id,
        channel_id=channel.id,
        channel_code=channel.code,
        status=status,
        total_amount=Decimal("210000.00"),
        shipping_fee=Decimal("10000.00"),
        shipping_address="1 Insights St",
        created_at=created_at,
        updated_at=updated_at,
        **extra,
    )
    for index in range(lines):
        order.items.append(
            models.OrderItem(
                sku_code=f"SKU-{number}-{index}",
                product_name="Shirt",
                quantity=2,
                unit_price=Decimal("100000.00"),
                subtotal=Decimal("200000.00"),
            )
        )
    db.add(order)
    db.commit()
    return order


# --- Response shape -------------------------------------------------------

def test_list_orders_returns_contract_shape_with_items(client, db):
    customer, channel = _customer_and_channel(db)
    _order(
        db,
        customer,
        channel,
        "ORD-SHAPE-1",
        discount_amount=Decimal("15000.00"),
        seller_shipping_cost=Decimal("22000.00"),
        platform_fee=Decimal("12345.50"),
    )
    _order(db, customer, channel, "ORD-SHAPE-2", status="SHIPPED", lines=2)

    resp = client.get("/orders?page=1&limit=10")
    assert resp.status_code == 200
    body = resp.json()
    assert set(body) == {"items", "total", "page", "pages", "limit"}
    assert (body["total"], body["page"], body["pages"], body["limit"]) == (2, 1, 1, 10)

    by_number = {item["order_number"]: item for item in body["items"]}
    first = by_number["ORD-SHAPE-1"]
    assert CONTRACT_KEYS <= set(first)
    assert first["channel_code"] == "SHOPEE"
    assert first["shipping_fee"] == 10000.0
    assert first["discount_amount"] == 15000.0
    assert first["seller_shipping_cost"] == 22000.0
    assert first["platform_fee"] == 12345.5
    assert first["returned_at"] is None
    assert first["updated_at"] is not None
    assert first["items"] == [
        {
            "id": first["items"][0]["id"],
            "order_id": first["items"][0]["order_id"],
            "sku_code": "SKU-ORD-SHAPE-1-0",
            "product_name": "Shirt",
            "variant_name": None,
            "quantity": 2,
            "unit_price": 100000.0,
            "subtotal": 200000.0,
            "image_url": None,
        }
    ]
    # OMS frontend list uses customer.name; it is now eagerly loaded.
    assert first["customer"]["name"] == "Insights Buyer"

    second = by_number["ORD-SHAPE-2"]
    assert second["discount_amount"] == 0.0
    assert second["seller_shipping_cost"] == 0.0
    assert second["platform_fee"] is None
    assert len(second["items"]) == 2


def test_list_orders_caps_limit_at_100(client, db):
    resp = client.get("/orders?limit=500")
    assert resp.status_code == 200
    assert resp.json()["limit"] == 100
    assert resp.json()["pages"] == 0


def test_list_orders_loads_relations_without_n_plus_one(client, db):
    customer, channel = _customer_and_channel(db)
    engine = db.get_bind()
    statements = []

    def count(conn, cursor, statement, params, context, executemany):
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)

    def run_list():
        statements.clear()
        event.listen(engine, "before_cursor_execute", count)
        try:
            assert client.get("/orders?limit=100").status_code == 200
        finally:
            event.remove(engine, "before_cursor_execute", count)
        return len(statements)

    _order(db, customer, channel, "ORD-N1-1", lines=2)
    few = run_list()
    for index in range(2, 8):
        _order(db, customer, channel, f"ORD-N1-{index}", lines=3)
    many = run_list()
    assert many == few


# --- Filters ----------------------------------------------------------------

def test_list_orders_date_range_and_updated_since_filters(client, db):
    customer, channel = _customer_and_channel(db)
    _order(db, customer, channel, "ORD-D-0101", created_at=datetime(2026, 1, 1, 23, 59), updated_at=datetime(2026, 1, 1, 23, 59))
    _order(db, customer, channel, "ORD-D-0115", created_at=datetime(2026, 1, 15, 8, 0), updated_at=datetime(2026, 3, 1, 9, 0))
    _order(db, customer, channel, "ORD-D-0131", created_at=datetime(2026, 1, 31, 23, 0), updated_at=datetime(2026, 1, 31, 23, 0))
    _order(db, customer, channel, "ORD-D-0201", created_at=datetime(2026, 2, 1, 0, 0), updated_at=datetime(2026, 2, 1, 0, 0))

    def numbers(query):
        resp = client.get(f"/orders?{query}")
        assert resp.status_code == 200, resp.text
        return sorted(item["order_number"] for item in resp.json()["items"])

    assert numbers("date_from=2026-01-15&date_to=2026-01-31") == ["ORD-D-0115", "ORD-D-0131"]
    assert numbers("date_from=2026-01-31") == ["ORD-D-0131", "ORD-D-0201"]
    assert numbers("date_to=2026-01-01") == ["ORD-D-0101"]
    # Legacy single-day filter still works.
    assert numbers("date=2026-01-15") == ["ORD-D-0115"]

    assert numbers("updated_since=2026-02-01T00:00:00") == ["ORD-D-0115", "ORD-D-0201"]
    # Timezone-aware input is normalised to UTC (07:00+07:00 == 00:00Z).
    assert numbers(f"updated_since={quote('2026-02-01T07:00:00+07:00')}") == ["ORD-D-0115", "ORD-D-0201"]
    assert numbers("updated_since=2026-02-01T00:00:00Z") == ["ORD-D-0115", "ORD-D-0201"]
    assert numbers("updated_since=2026-03-01T09:00:01Z") == []
    assert numbers("date_from=2026-01-01&updated_since=2026-01-31T00:00:00Z") == [
        "ORD-D-0115",
        "ORD-D-0131",
        "ORD-D-0201",
    ]

    assert client.get("/orders?date_from=01-02-2026").status_code == 422
    assert client.get("/orders?updated_since=yesterday").status_code == 422


def test_updated_at_moves_on_status_change(client, db):
    customer, channel = _customer_and_channel(db)
    old = datetime(2025, 1, 1)
    order = _order(db, customer, channel, "ORD-UPD-1", status="SHIPPED", created_at=old, updated_at=old)

    assert client.get("/orders?updated_since=2025-06-01T00:00:00Z").json()["total"] == 0
    assert client.patch(f"/orders/{order.id}/status", json={"status": "COMPLETED"}).status_code == 200
    assert client.get("/orders?updated_since=2025-06-01T00:00:00Z").json()["total"] == 1


# --- Finance fields on create/update -----------------------------------------

def _mock_pmi(monkeypatch, price=100000):
    def mock_call_api(url, method="GET", data=None):
        return {"price": price, "product_name": "Shirt", "variant_name": "M", "image_url": None}

    monkeypatch.setattr("main.call_api", mock_call_api)


def test_create_and_update_order_with_finance_fields(client, db, monkeypatch):
    _mock_pmi(monkeypatch)
    customer, channel = _customer_and_channel(db, code="MANUAL")
    payload = {
        "customer_id": customer.id,
        "channel_id": channel.id,
        "shipping_fee": 30000,
        "shipping_address": "1 Insights St",
        "items": [{"sku_code": "SKU-1", "quantity": 2}],
        "discount_amount": 20000,
        "seller_shipping_cost": 25000,
    }
    resp = client.post("/orders", json=payload)
    assert resp.status_code == 201, resp.text
    created = resp.json()
    assert Decimal(created["total_amount"]) == Decimal("210000")  # 200k + 30k - 20k
    assert Decimal(created["discount_amount"]) == Decimal("20000")
    assert Decimal(created["seller_shipping_cost"]) == Decimal("25000")
    assert created["platform_fee"] is None

    resp = client.put(f"/orders/{created['id']}", json={"discount_amount": 50000, "platform_fee": 9000})
    assert resp.status_code == 200, resp.text
    updated = resp.json()
    assert Decimal(updated["total_amount"]) == Decimal("180000")
    assert Decimal(updated["platform_fee"]) == Decimal("9000")

    too_much = client.put(f"/orders/{created['id']}", json={"discount_amount": 500000})
    assert too_much.status_code == 400
    assert client.post("/orders", json={**payload, "discount_amount": -1}).status_code == 422
    assert client.post("/orders", json={**payload, "discount_amount": 999999}).status_code == 400


def test_finance_patch_updates_costs_in_any_status_and_audits(client, db):
    customer, channel = _customer_and_channel(db)
    order = _order(db, customer, channel, "ORD-FIN-1", status="COMPLETED")

    resp = client.patch(f"/orders/{order.id}/finance", json={"platform_fee": 18000, "seller_shipping_cost": 12000})
    assert resp.status_code == 200, resp.text
    assert Decimal(resp.json()["platform_fee"]) == Decimal("18000")
    assert Decimal(resp.json()["seller_shipping_cost"]) == Decimal("12000")

    assert client.patch(f"/orders/{order.id}/finance", json={}).status_code == 400
    assert client.patch(f"/orders/{order.id}/finance", json={"seller_shipping_cost": None}).status_code == 400
    # platform_fee may be reset to unknown.
    assert client.patch(f"/orders/{order.id}/finance", json={"platform_fee": None}).json()["platform_fee"] is None

    events = client.get(f"/orders/{order.id}/events").json()
    assert [e["event_type"] for e in events] == ["order.finance_updated"] * 2


# --- RETURNED flow --------------------------------------------------------------

def test_return_endpoint_marks_order_returned(client, db):
    customer, channel = _customer_and_channel(db)
    order = _order(db, customer, channel, "ORD-RET-1", status="COMPLETED", seller_shipping_cost=Decimal("20000"))

    resp = client.post(
        f"/orders/{order.id}/return",
        json={"returned_at": "2026-05-02T10:00:00+07:00", "return_shipping_cost": 15000, "reason": "Sai size"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "RETURNED"
    assert body["returned_at"].startswith("2026-05-02T03:00:00")
    assert Decimal(body["seller_shipping_cost"]) == Decimal("35000")

    listed = client.get("/orders?status=RETURNED").json()["items"]
    assert [o["order_number"] for o in listed] == ["ORD-RET-1"]
    assert listed[0]["returned_at"].startswith("2026-05-02T03:00:00")

    events = client.get(f"/orders/{order.id}/events").json()
    assert events[-1]["event_type"] == "order.returned"
    assert events[-1]["payload"]["old_status"] == "COMPLETED"
    assert events[-1]["payload"]["reason"] == "Sai size"

    # Terminal: no further transitions, not cancellable, not returnable again.
    assert client.post(f"/orders/{order.id}/return").status_code == 400
    assert client.post(f"/orders/{order.id}/cancel").status_code == 400
    assert client.patch(f"/orders/{order.id}/status", json={"status": "COMPLETED"}).status_code == 400


def test_return_requires_delivered_order(client, db):
    customer, channel = _customer_and_channel(db)
    draft = _order(db, customer, channel, "ORD-RET-DRAFT", status="DRAFT")
    processing = _order(db, customer, channel, "ORD-RET-PROC", status="PROCESSING")

    assert client.post(f"/orders/{draft.id}/return").status_code == 400
    assert client.post(f"/orders/{processing.id}/return").status_code == 400
    assert client.patch(f"/orders/{processing.id}/status", json={"status": "RETURNED"}).status_code == 400
    assert client.post("/orders/999999/return").status_code == 404


def test_status_patch_to_returned_stamps_returned_at(client, db):
    customer, channel = _customer_and_channel(db)
    order = _order(db, customer, channel, "ORD-RET-PATCH", status="SHIPPED")

    before = datetime.utcnow() - timedelta(seconds=5)
    resp = client.patch(f"/orders/{order.id}/status", json={"status": "RETURNED"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "RETURNED"
    returned_at = datetime.fromisoformat(resp.json()["returned_at"])
    assert returned_at >= before
    assert client.get(f"/orders/{order.id}/events").json()[-1]["event_type"] == "order.returned"


def test_fulfillment_endpoint_rejects_returned_status(client, db):
    customer, channel = _customer_and_channel(db)
    order = _order(db, customer, channel, "ORD-RET-FO", status="SHIPPED")
    db.add(models.FulfillmentOrder(order_id=order.id, fulfillment_number="FM-RET", warehouse_code="WH", status="SHIPPED"))
    db.commit()

    resp = client.patch(f"/orders/{order.id}/fulfillments/FM-RET/status", json={"status": "RETURNED"})
    assert resp.status_code == 400


def test_returned_orders_excluded_from_dashboard_revenue(client, db):
    customer, channel = _customer_and_channel(db)
    _order(db, customer, channel, "ORD-REV-OK", status="COMPLETED")
    _order(db, customer, channel, "ORD-REV-RET", status="RETURNED", returned_at=datetime(2026, 1, 2))

    stats = client.get("/dashboard/stats").json()
    assert stats["revenue"] == 210000.0
    assert stats["status_counts"]["RETURNED"] == 1


# --- Tenant / seller scoping ---------------------------------------------------

def test_list_orders_is_scoped_to_caller_seller(client, db):
    for seller, suffix in ((SELLER_A, "A"), (SELLER_B, "B")):
        with tenant_context(TENANT_A, seller):
            customer = models.Customer(name=f"Buyer {suffix}", phone=f"09220000{suffix}")
            channel = models.Channel(code=f"SHOPEE_{suffix}", name="Shopee")
            db.add_all([customer, channel])
            db.flush()
            _order(db, customer, channel, f"ORD-SCOPE-{suffix}", lines=2)

    for seller, suffix in ((SELLER_A, "A"), (SELLER_B, "B")):
        for query in ("", "?updated_since=2000-01-01T00:00:00Z", "?date_from=2000-01-01", f"?search=Buyer"):
            body = client.get(f"/orders{query}", headers=_headers(TENANT_A, seller)).json()
            assert body["total"] == 1, (suffix, query, body)
            assert [o["order_number"] for o in body["items"]] == [f"ORD-SCOPE-{suffix}"]
            assert {i["sku_code"] for i in body["items"][0]["items"]} == {
                f"SKU-ORD-SCOPE-{suffix}-0",
                f"SKU-ORD-SCOPE-{suffix}-1",
            }

    with tenant_context(TENANT_A, SELLER_B):
        order_b = db.query(models.Order).filter(models.Order.order_number == "ORD-SCOPE-B").one()
        order_b.status = "SHIPPED"
        db.commit()
        order_b_id = order_b.id
    headers_a = _headers(TENANT_A, SELLER_A)
    assert client.post(f"/orders/{order_b_id}/return", headers=headers_a).status_code == 404
    assert client.patch(f"/orders/{order_b_id}/finance", headers=headers_a, json={"platform_fee": 1}).status_code == 404


# --- Channel adapters -------------------------------------------------------------

@pytest.mark.asyncio
async def test_marketplace_adapters_fill_finance_fields_when_sent(db):
    shopee = await ShopeeAdapter(partner_key="").handle_webhook(
        {
            "data": {
                "order_sn": "SP-FIN-1",
                "recipient_address": {"name": "A", "phone": "0933000001", "full_address": "HN"},
                "item_list": [{"item_sku": "SKU-SP", "model_quantity_purchased": 1, "model_discounted_price": 100000}],
                "total_amount": 120000,
                "actual_shipping_fee": 20000,
                "order_income": {
                    "voucher_from_seller": 10000,
                    "seller_discount": 5000,
                    "commission_fee": 4000,
                    "service_fee": 3000,
                    "seller_transaction_fee": 2500,
                },
            }
        }
    )
    assert shopee.discount_amount == Decimal("15000")
    assert shopee.platform_fee == Decimal("9500")
    assert shopee.seller_shipping_cost == Decimal("0")

    plain = await ShopeeAdapter(partner_key="").handle_webhook({"data": {"order_sn": "SP-FIN-2"}})
    assert plain.discount_amount == Decimal("0")
    assert plain.platform_fee is None

    tiktok = await TikTokAdapter(app_secret="").handle_webhook(
        {"data": {"order_id": "TT-FIN-1", "payment_info": {"total_amount": 90000, "shipping_fee": 0, "seller_discount": 7000}}}
    )
    assert tiktok.discount_amount == Decimal("7000")
    assert tiktok.platform_fee is None

    order = await OrderService.create_or_ingest_order(db, shopee, created_by="test")
    assert order.discount_amount == Decimal("15000")
    assert order.platform_fee == Decimal("9500")
    assert order.seller_shipping_cost == Decimal("0")


# --- Migration on PostgreSQL -------------------------------------------------------

def test_finance_migration_on_existing_postgres_rows(monkeypatch):
    postgres_url = os.getenv("OMS_TEST_POSTGRES_URL")
    if not postgres_url:
        pytest.skip("set OMS_TEST_POSTGRES_URL to run the PostgreSQL migration test")

    schema_name = f"oms_finance_{uuid4().hex}"
    admin_engine = create_engine(postgres_url)
    search_path = quote(f"-csearch_path={schema_name}")
    test_url = f"{postgres_url}{'&' if '?' in postgres_url else '?'}options={search_path}"
    config = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
    test_engine = None
    try:
        with admin_engine.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema_name}"'))
        monkeypatch.setenv("DATABASE_URL", test_url.replace("%", "%%"))
        command.upgrade(config, "0009_backfill_default_tenant")

        test_engine = create_engine(test_url)
        owner = {"t": str(TENANT_A), "s": str(SELLER_A)}
        with test_engine.begin() as connection:
            customer_id = connection.execute(
                text("INSERT INTO customers (tenant_id, seller_id, name, phone, is_deleted) VALUES (:t, :s, 'C', '0900', false) RETURNING id"),
                owner,
            ).scalar()
            channel_id = connection.execute(
                text("INSERT INTO channels (tenant_id, seller_id, code, name, is_active, is_deleted) VALUES (:t, :s, 'MANUAL', 'Manual', true, false) RETURNING id"),
                owner,
            ).scalar()
            connection.execute(
                text(
                    "INSERT INTO orders (tenant_id, seller_id, order_number, customer_id, channel_id, status, "
                    "total_amount, shipping_fee, shipping_address, created_at, updated_at) "
                    "VALUES (:t, :s, 'LEGACY-1', :c, :ch, 'COMPLETED', 100, 10, 'Addr', '2025-01-02 03:04:05', NULL)"
                ),
                {**owner, "c": customer_id, "ch": channel_id},
            )

        command.upgrade(config, "head")
        command.upgrade(config, "head")

        with test_engine.connect() as connection:
            row = connection.execute(
                text("SELECT discount_amount, seller_shipping_cost, platform_fee, returned_at, updated_at FROM orders")
            ).one()
            assert row.discount_amount == Decimal("0")
            assert row.seller_shipping_cost == Decimal("0")
            assert row.platform_fee is None
            assert row.returned_at is None
            assert row.updated_at == datetime(2025, 1, 2, 3, 4, 5)
            assert "ix_orders_updated_at" in {i["name"] for i in inspect(connection).get_indexes("orders")}

        command.downgrade(config, "0009_backfill_default_tenant")
        with test_engine.connect() as connection:
            columns = {c["name"] for c in inspect(connection).get_columns("orders")}
            assert not {"discount_amount", "seller_shipping_cost", "platform_fee", "returned_at"} & columns
    finally:
        if test_engine is not None:
            test_engine.dispose()
        with admin_engine.begin() as connection:
            connection.execute(text(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE'))
        admin_engine.dispose()


def test_public_order_creation_cannot_set_finance_fields(client, db, monkeypatch):
    _mock_pmi(monkeypatch)
    customer, channel = _customer_and_channel(db, code="MANUAL", phone="0944000000")
    db.commit()
    public_headers = {"X-User-Id": "", "X-User-Username": ""}  # no gateway identity -> public context
    payload = {
        "customer_id": customer.id,
        "channel_id": channel.id,
        "shipping_fee": 0,
        "shipping_address": "Addr",
        "items": [{"sku_code": "SKU-1", "quantity": 1}],
    }
    for field, value in (("discount_amount", 50000), ("seller_shipping_cost", 1), ("platform_fee", 0)):
        resp = client.post("/orders", json={**payload, field: value}, headers=public_headers)
        assert resp.status_code == 403, (field, resp.text)

    ok = client.post("/orders", json=payload, headers=public_headers)
    assert ok.status_code == 201, ok.text
    assert Decimal(ok.json()["total_amount"]) == Decimal("100000")
    assert Decimal(ok.json()["discount_amount"]) == Decimal("0")
