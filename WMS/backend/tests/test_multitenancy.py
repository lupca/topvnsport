from uuid import UUID

import models
from utils.tenant_context import TenantContext


TENANT_ID = UUID("00000000-0000-0000-0000-000000000001")
SELLER_A = UUID("00000000-0000-0000-0000-000000000101")
SELLER_B = UUID("00000000-0000-0000-0000-000000000102")
SELLER_C = UUID("00000000-0000-0000-0000-000000000103")


def _owned(model, seller_id, **values):
    return model(tenant_id=TENANT_ID, seller_id=seller_id, **values)


def _seed_three_sellers(db):
    db.info.pop("tenant_context", None)
    records = []
    for index, seller_id in enumerate((SELLER_A, SELLER_B, SELLER_C), start=1):
        warehouse = _owned(
            models.Warehouse,
            seller_id,
            code="WH-SHARED",
            name=f"Warehouse {index}",
        )
        db.add(warehouse)
        db.flush()
        location = _owned(
            models.Location,
            seller_id,
            warehouse_id=warehouse.id,
            location_code="LOC-SHARED",
        )
        db.add(location)
        db.flush()
        inventory = _owned(
            models.Inventory,
            seller_id,
            sku_code="SKU-SHARED",
            product_name=f"Product {index}",
            location_id=location.id,
            qty_on_hand=index * 10,
            qty_reserved=index,
        )
        barcode = _owned(
            models.BarcodeMapping,
            seller_id,
            barcode="BAR-SHARED",
            sku_code="SKU-SHARED",
            product_name=f"Product {index}",
        )
        fulfillment = _owned(
            models.FulfillmentOrder_WMS,
            seller_id,
            fulfillment_number="FUL-SHARED",
            status="PENDING",
        )
        db.add_all([inventory, barcode, fulfillment])
        db.flush()
        records.append((warehouse.id, location.id, inventory.id))
    db.commit()
    db.info["tenant_context"] = TenantContext(TENANT_ID, SELLER_A)
    return records


def test_reads_and_totals_are_scoped_to_one_of_three_sellers(client, db_session):
    records = _seed_three_sellers(db_session)

    inventory_response = client.get("/inventory")
    assert inventory_response.status_code == 200
    assert [row["qty_on_hand"] for row in inventory_response.json()] == [10]

    stock_response = client.get("/public/stock?sku_codes=SKU-SHARED")
    assert stock_response.status_code == 200
    assert stock_response.json()["stock"]["SKU-SHARED"] == 9

    dashboard_response = client.get("/dashboard/stats")
    assert dashboard_response.status_code == 200
    assert dashboard_response.json()["warehouse_count"] == 1
    assert dashboard_response.json()["location_count"] == 1
    assert dashboard_response.json()["total_qty_on_hand"] == 10
    assert dashboard_response.json()["total_qty_reserved"] == 1

    warehouse_response = client.get("/warehouses/code/WH-SHARED")
    assert warehouse_response.status_code == 200
    assert warehouse_response.json()["name"] == "Warehouse 1"
    db_session.info.pop("tenant_context", None)
    assert db_session.get(models.Inventory, records[1][2]).qty_on_hand == 20
    assert db_session.get(models.Inventory, records[2][2]).qty_on_hand == 30


def test_cross_seller_transfer_and_reserve_rollback_without_quantity_changes(
    client, db_session
):
    records = _seed_three_sellers(db_session)
    db_session.info.pop("tenant_context", None)
    _, location_a_id, inventory_a_id = records[0]
    _, location_b_id, inventory_b_id = records[1]
    inventory_a = db_session.get(models.Inventory, inventory_a_id)
    inventory_b = db_session.get(models.Inventory, inventory_b_id)
    before = (inventory_a.qty_on_hand, inventory_a.qty_reserved,
              inventory_b.qty_on_hand, inventory_b.qty_reserved)

    transfer_response = client.post(
        "/inventory/transfer",
        json={
            "sku_code": "SKU-SHARED",
            "from_location_id": location_a_id,
            "to_location_id": location_b_id,
            "quantity": 3,
        },
    )
    assert transfer_response.status_code == 400

    # Seller A cannot reserve seller B/C stock, even with colliding warehouse/SKU.
    inventory_a.qty_on_hand = 0
    db_session.commit()
    reserve_response = client.post(
        "/fulfillment-orders",
        json={
            "fulfillment_number": "FUL-NEW",
            "oms_order_id": 99,
            "oms_order_number": "ORD-99",
            "warehouse_code": "WH-SHARED",
            "items": [{
                "sku_code": "SKU-SHARED",
                "product_name": "Product",
                "quantity": 2,
            }],
        },
    )
    assert reserve_response.status_code == 400

    db_session.info.pop("tenant_context", None)
    db_session.expire_all()
    refreshed_a = db_session.get(models.Inventory, inventory_a_id)
    refreshed_b = db_session.get(models.Inventory, inventory_b_id)
    assert (refreshed_a.qty_reserved, refreshed_b.qty_on_hand, refreshed_b.qty_reserved) == (
        before[1], before[2], before[3]
    )


def test_missing_or_mismatched_context_never_falls_back_to_global_stock(
    client, db_session
):
    _seed_three_sellers(db_session)

    missing = client.get(
        "/public/stock?sku_codes=SKU-SHARED",
        headers={"X-Tenant-Id": "", "X-Seller-Id": ""},
    )
    assert missing.status_code == 400

    mismatched = client.get(
        "/inventory",
        headers={"X-Seller-Id": str(SELLER_B)},
    )
    assert mismatched.status_code == 403
