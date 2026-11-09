"""Inbound shipment contract used by VOMA Insights (list + purchase-draft create)."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

import models
from utils.tenant_context import TenantContext

TENANT_ID = UUID("00000000-0000-0000-0000-000000000001")
SELLER_A = UUID("00000000-0000-0000-0000-000000000101")  # the test client's seller
SELLER_B = UUID("00000000-0000-0000-0000-000000000102")

CONTRACT_KEYS = {"inbound_number", "supplier_name", "status", "expected_date", "received_date", "created_at", "items"}
ITEM_KEYS = {"sku_code", "expected_qty", "received_qty", "unit_cost"}


def _seed_shipment(db, seller_id, number, unit_cost="125000.50"):
    db.info.pop("tenant_context", None)
    owner = {"tenant_id": TENANT_ID, "seller_id": seller_id}
    warehouse = models.Warehouse(code=f"WH-{number}", name="WH", **owner)
    db.add(warehouse)
    db.flush()
    shipment = models.InboundShipment(
        inbound_number=number,
        warehouse_id=warehouse.id,
        supplier_name=f"NCC {number}",
        status="COMPLETED",
        expected_date=datetime(2026, 3, 1),
        received_date=datetime(2026, 3, 2, 9, 30),
        **owner,
    )
    db.add(shipment)
    db.flush()
    db.add(
        models.InboundItem(
            inbound_shipment_id=shipment.id,
            sku_code=f"SKU-{number}",
            product_name="Shirt",
            expected_qty=10,
            received_qty=9,
            unit_cost=Decimal(unit_cost),
            **owner,
        )
    )
    db.commit()
    db.info["tenant_context"] = TenantContext(TENANT_ID, SELLER_A)
    return warehouse.id


def test_list_inbound_shipments_contract_shape_and_seller_scope(client, db_session):
    _seed_shipment(db_session, SELLER_A, "INB-A-1")
    _seed_shipment(db_session, SELLER_B, "INB-B-1")

    resp = client.get("/inbound-shipments")
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list)
    assert [s["inbound_number"] for s in body] == ["INB-A-1"]

    shipment = body[0]
    assert CONTRACT_KEYS <= set(shipment)
    assert shipment["supplier_name"] == "NCC INB-A-1"
    assert shipment["status"] == "COMPLETED"
    assert shipment["expected_date"].startswith("2026-03-01")
    assert shipment["received_date"].startswith("2026-03-02T09:30")
    assert shipment["created_at"]
    assert len(shipment["items"]) == 1
    item = shipment["items"][0]
    assert ITEM_KEYS <= set(item)
    assert (item["sku_code"], item["expected_qty"], item["received_qty"], item["unit_cost"]) == (
        "SKU-INB-A-1",
        10,
        9,
        125000.5,
    )


def test_create_pending_inbound_with_unit_cost_without_number(client, db_session):
    warehouse_id = _seed_shipment(db_session, SELLER_A, "INB-A-EXISTING")
    payload = {
        "status": "pending",
        "supplier_name": "NCC Insights",
        "note": "Tạo từ VOMA Insights",
        "warehouse_id": warehouse_id,
        "items": [
            {"sku_code": "SKU-1", "product_name": "Áo", "expected_qty": 20, "unit_cost": 80000},
            {"sku_code": "SKU-2", "product_name": "Quần", "expected_qty": 5, "unit_cost": 150000.5},
        ],
    }
    resp = client.post("/inbound-shipments", json=payload)
    assert resp.status_code == 201, resp.text
    created = resp.json()
    assert created["inbound_number"].startswith("INB-")
    assert created["status"] == "pending"
    assert created["note"] == "Tạo từ VOMA Insights"
    assert created["total_amount"] == 20 * 80000 + 5 * 150000.5
    assert {(i["sku_code"], i["unit_cost"], i["received_qty"]) for i in created["items"]} == {
        ("SKU-1", 80000.0, 0),
        ("SKU-2", 150000.5, 0),
    }

    # Explicit numbers still work and duplicates are still rejected.
    explicit = client.post("/inbound-shipments", json={**payload, "inbound_number": "INB-MANUAL-1"})
    assert explicit.status_code == 201
    assert explicit.json()["inbound_number"] == "INB-MANUAL-1"
    assert client.post("/inbound-shipments", json={**payload, "inbound_number": "INB-MANUAL-1"}).status_code == 400

    numbers = {s["inbound_number"] for s in client.get("/inbound-shipments").json()}
    assert {created["inbound_number"], "INB-MANUAL-1", "INB-A-EXISTING"} == numbers


def test_create_inbound_rejects_other_sellers_warehouse(client, db_session):
    foreign_warehouse = _seed_shipment(db_session, SELLER_B, "INB-B-WH")
    resp = client.post(
        "/inbound-shipments",
        json={
            "supplier_name": "NCC",
            "warehouse_id": foreign_warehouse,
            "items": [{"sku_code": "SKU-1", "product_name": "Áo", "expected_qty": 1, "unit_cost": 1}],
        },
    )
    assert resp.status_code == 400
