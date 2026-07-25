import pytest
import models

def test_list_inventory(client, db_session):
    wh = models.Warehouse(code="WH-TEST-LIST", name="List Test WH", is_active=True)
    db_session.add(wh)
    db_session.commit()

    loc = models.Location(warehouse_id=wh.id, location_code="LOC-LIST-1", type="STORAGE", is_active=True)
    db_session.add(loc)
    db_session.commit()

    inv = models.Inventory(sku_code="SKU-LIST-1", product_name="Test Product", location_id=loc.id, qty_on_hand=100, qty_reserved=10)
    db_session.add(inv)
    db_session.commit()

    response = client.get("/inventory")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert any(item["sku_code"] == "SKU-LIST-1" for item in data)


def test_inventory_adjust_and_transfer_operations(client, db_session):
    wh = models.Warehouse(code="WH-INV-OPS", name="Ops Warehouse", is_active=True)
    db_session.add(wh)
    db_session.commit()
    
    loc1 = models.Location(warehouse_id=wh.id, location_code="LOC-OPS-1", type="STORAGE", is_active=True)
    loc2 = models.Location(warehouse_id=wh.id, location_code="LOC-OPS-2", type="STORAGE", is_active=True)
    db_session.add_all([loc1, loc2])
    db_session.commit()

    # 1. Adjust Stock
    adjust_payload = {
        "sku_code": "SKU-OPS-TEST",
        "location_id": loc1.id,
        "quantity": 50,
        "note": "Initial stock adjust"
    }
    response = client.post("/inventory/adjust", json=adjust_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["qty_on_hand"] == 50
    assert data["qty_available"] == 50

    # 2. Transfer Stock
    transfer_payload = {
        "sku_code": "SKU-OPS-TEST",
        "from_location_id": loc1.id,
        "to_location_id": loc2.id,
        "quantity": 20,
        "note": "Transfer 20 units"
    }
    response = client.post("/inventory/transfer", json=transfer_payload)
    assert response.status_code == 200
    
    # Verify quantities
    inv1 = db_session.query(models.Inventory).filter(models.Inventory.sku_code == "SKU-OPS-TEST", models.Inventory.location_id == loc1.id).first()
    inv2 = db_session.query(models.Inventory).filter(models.Inventory.sku_code == "SKU-OPS-TEST", models.Inventory.location_id == loc2.id).first()
    assert inv1.qty_on_hand == 30
    assert inv2.qty_on_hand == 20


def test_public_stock_endpoints(client, db_session):
    wh = models.Warehouse(code="WH-PUB", name="Public WH", is_active=True)
    db_session.add(wh)
    db_session.commit()

    loc = models.Location(warehouse_id=wh.id, location_code="LOC-PUB-1", type="STORAGE", is_active=True)
    db_session.add(loc)
    db_session.commit()

    inv = models.Inventory(sku_code="SKU-PUB-1", product_name="Public Item", location_id=loc.id, qty_on_hand=80, qty_reserved=30)
    db_session.add(inv)
    db_session.commit()

    # GET /public/stock
    response = client.get("/public/stock?sku_codes=SKU-PUB-1")
    assert response.status_code == 200
    data = response.json()
    assert data["stock"]["SKU-PUB-1"] == 50

    # POST /public/stock
    response = client.post("/public/stock", json={"sku_codes": ["SKU-PUB-1"]})
    assert response.status_code == 200
    data = response.json()
    assert data["stock"]["SKU-PUB-1"] == 50
