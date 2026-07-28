import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
import models

def test_over_picking_returns_400(client, db_session):
    # Setup Warehouse, Location, Inventory, BarcodeMapping, FO
    wh = models.Warehouse(code="WH-M8-1", name="M8 WH 1")
    db_session.add(wh)
    db_session.commit()

    loc = models.Location(warehouse_id=wh.id, location_code="LOC-M8-1", type="STORAGE")
    db_session.add(loc)
    db_session.commit()

    inv = models.Inventory(sku_code="SKU-M8-OVERPICK", product_name="M8 Item", location_id=loc.id, qty_on_hand=100, qty_reserved=10)
    db_session.add(inv)
    
    bm = models.BarcodeMapping(barcode="BAR-M8-OVERPICK", barcode_type="EAN-13", sku_code="SKU-M8-OVERPICK", product_name="M8 Item")
    db_session.add(bm)
    
    fo = models.FulfillmentOrder_WMS(fulfillment_number="FO-M8-001", oms_order_id=101, status="PICKING")
    db_session.add(fo)
    db_session.commit()

    pick_item = models.PickListItem(
        fulfillment_order_id=fo.id,
        sku_code="SKU-M8-OVERPICK",
        product_name="M8 Item",
        location_id=loc.id,
        quantity=5,
        picked_qty=0,
        status="picking"
    )
    db_session.add(pick_item)
    db_session.commit()

    # 1. Pick 3 items (valid)
    resp = client.post(f"/fulfillment-orders/{fo.id}/scan-pick", json={"barcode": "BAR-M8-OVERPICK", "quantity": 3})
    assert resp.status_code == 200
    assert resp.json()["picked_qty"] == 3

    # 2. Pick 3 items (total 6 > 5 requested) -> should fail with HTTP 400
    resp = client.post(f"/fulfillment-orders/{fo.id}/scan-pick", json={"barcode": "BAR-M8-OVERPICK", "quantity": 3})
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Cannot pick more than requested quantity"

    # Verify database state remains 3
    db_session.refresh(pick_item)
    assert pick_item.picked_qty == 3

def test_complete_pick_sends_picked_to_oms(client, db_session):
    wh = models.Warehouse(code="WH-M8-2", name="M8 WH 2")
    db_session.add(wh)
    db_session.commit()

    fo = models.FulfillmentOrder_WMS(fulfillment_number="FO-M8-OMS-01", oms_order_id=505, status="PICKING")
    db_session.add(fo)
    db_session.commit()

    with patch("routers.fulfillment.notify_oms_status") as mock_notify:
        resp = client.post(f"/fulfillment-orders/{fo.id}/complete-pick")
        assert resp.status_code == 200
        assert resp.json()["status_code"] == "PICKED"
        mock_notify.assert_called_once_with(505, "FO-M8-OMS-01", "PICKED")

def test_inbound_shipment_receive_locking(client, db_session):
    wh = models.Warehouse(code="WH-M8-3", name="M8 WH 3")
    db_session.add(wh)
    db_session.commit()

    loc = models.Location(warehouse_id=wh.id, location_code="LOC-M8-REC", type="RECEIVING")
    db_session.add(loc)
    db_session.commit()

    shipment = models.InboundShipment(inbound_number="INB-M8-001", warehouse_id=wh.id, supplier_name="Supplier M8", status="pending")
    db_session.add(shipment)
    db_session.commit()

    item = models.InboundItem(
        inbound_shipment_id=shipment.id,
        sku_code="SKU-M8-REC",
        product_name="M8 Inbound Item",
        expected_qty=20,
        received_qty=0,
        status="pending"
    )
    db_session.add(item)
    db_session.commit()

    receive_payload = {
        "items": [
            {
                "sku_code": "SKU-M8-REC",
                "received_qty": 10,
                "location_id": loc.id
            }
        ]
    }
    resp = client.post(f"/inbound-shipments/{shipment.id}/receive", json=receive_payload)
    assert resp.status_code == 200
    assert resp.json()["status"] == "success"

    db_session.refresh(item)
    assert item.received_qty == 10
    assert item.status == "received"
    assert item.location_id == loc.id
