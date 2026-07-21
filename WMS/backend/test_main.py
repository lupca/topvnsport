import os
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, get_db
from utils.auth import get_current_user
from main import app
import models

@pytest.fixture(autouse=True)
def mock_notify_oms():
    with patch('routers.fulfillment.notify_oms_status') as mock:
        yield mock


# Use file-based SQLite for testing to maintain table persistence during tests
DB_FILE = "/tmp/test.db"
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_FILE}"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db():
    # Setup: Create tables
    Base.metadata.create_all(bind=engine)
    db_session = TestingSessionLocal()
    try:
        yield db_session
    finally:
        db_session.close()
        # Teardown: Drop tables and remove file
        Base.metadata.drop_all(bind=engine)
        engine.dispose()
        if os.path.exists(DB_FILE):
            try:
                os.remove(DB_FILE)
            except OSError:
                pass

@pytest.fixture(scope="function")
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: {"user_id": "1", "username": "admin"}
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

def test_status(client):
    response = client.get("/status")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_warehouse_crud(client):
    # 1. Create Warehouse
    payload = {
        "code": "WH-TEST",
        "name": "Test Warehouse",
        "address": "456 Test St",
        "is_active": True
    }
    response = client.post("/warehouses", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["code"] == "WH-TEST"
    assert data["id"] is not None

    # 2. Get Warehouse by code
    response = client.get("/warehouses/code/WH-TEST")
    assert response.status_code == 200
    assert response.json()["name"] == "Test Warehouse"

    # 3. List Warehouses
    response = client.get("/warehouses")
    assert response.status_code == 200
    assert len(response.json()) == 1

    # 4. Update Warehouse
    update_payload = {
        "code": "WH-TEST-UPD",
        "name": "Updated Warehouse Name",
        "address": "456 Test St Updated",
        "is_active": False
    }
    response = client.put(f"/warehouses/{data['id']}", json=update_payload)
    assert response.status_code == 200
    assert response.json()["code"] == "WH-TEST-UPD"
    assert response.json()["is_active"] is False

    # 5. Delete Warehouse
    response = client.delete(f"/warehouses/{data['id']}")
    assert response.status_code == 204

    # 6. Verify Delete
    response = client.get(f"/warehouses/{data['id']}")
    assert response.status_code == 404


def test_create_fulfillment_order(client, db):
    # Seed a warehouse, location, and inventory first
    wh = models.Warehouse(code="WH-001", name="Test Warehouse 1", is_active=True)
    db.add(wh)
    db.commit()
    db.refresh(wh)
    
    loc = models.Location(
        warehouse_id=wh.id,
        location_code="LOC-TEST-01",
        is_active=True
    )
    db.add(loc)
    db.commit()
    db.refresh(loc)
    
    inv = models.Inventory(
        sku_code="SKU-TEST-A",
        product_name="Product Test A",
        location_id=loc.id,
        qty_on_hand=50,
        qty_reserved=0
    )
    db.add(inv)
    db.commit()
    
    # 1. Create fulfillment order
    payload = {
        "fulfillment_number": "FM-ORD-123",
        "oms_order_id": 12,
        "oms_order_number": "ORD-123",
        "warehouse_code": "WH-001",
        "status": "PENDING",
        "items": [
            {
                "sku_code": "SKU-TEST-A",
                "product_name": "Product Test A",
                "quantity": 10
            }
        ]
    }
    response = client.post("/fulfillment-orders", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["fulfillment_number"] == "FM-ORD-123"
    assert len(data["pick_list_items"]) == 1
    assert data["pick_list_items"][0]["quantity"] == 10
    
    # Verify stock reserved
    db.refresh(inv)
    assert inv.qty_reserved == 10
    
    # 2. Cancel fulfillment order
    response = client.post("/fulfillment-orders/FM-ORD-123/cancel")
    assert response.status_code == 200
    assert response.json()["status"] == "success"
    
    # Verify stock reserved reverted
    db.refresh(inv)
    assert inv.qty_reserved == 0


def test_locations_crud(client):
    # Setup: Create a warehouse first
    wh_payload = {"code": "WH-LOC-TEST", "name": "Loc Test Warehouse"}
    wh_resp = client.post("/warehouses", json=wh_payload)
    wh_id = wh_resp.json()["id"]

    # 1. Create Location
    loc_payload = {
        "warehouse_id": wh_id,
        "location_code": "KHO1-STORAGE-TEST",
        "zone": "KHO1",
        "aisle": "A01",
        "rack": "K01",
        "shelf": "T01",
        "type": "STORAGE",
        "is_active": True
    }
    response = client.post("/locations", json=loc_payload)
    assert response.status_code == 201
    data = response.json()
    assert data["location_code"] == "KHO1-STORAGE-TEST"
    loc_id = data["id"]

    # 2. List Locations
    response = client.get("/locations")
    assert response.status_code == 200
    assert len(response.json()) >= 1

    # 3. Update Location
    loc_payload["location_code"] = "KHO1-STORAGE-TEST-UPD"
    response = client.put(f"/locations/{loc_id}", json=loc_payload)
    assert response.status_code == 200
    assert response.json()["location_code"] == "KHO1-STORAGE-TEST-UPD"

    # 4. Delete Location
    response = client.delete(f"/locations/{loc_id}")
    assert response.status_code == 204


def test_barcode_mapping_crud(client):
    payload = {
        "barcode": "8930009999999",
        "barcode_type": "EAN-13",
        "sku_code": "SKU-BM-TEST",
        "product_name": "BM Test Product",
        "variant_name": "Standard"
    }
    # 1. Create
    response = client.post("/barcode-mappings", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["sku_code"] == "SKU-BM-TEST"
    bm_id = data["id"]

    # 2. Lookup by Barcode string
    response = client.get("/barcode-mappings/8930009999999")
    assert response.status_code == 200
    assert response.json()["sku_code"] == "SKU-BM-TEST"

    # 3. Delete
    response = client.delete(f"/barcode-mappings/{bm_id}")
    assert response.status_code == 204


def test_inventory_adjust_and_transfer(client, db):
    # Setup Warehouse & Locations
    wh = models.Warehouse(code="WH-INV-TEST", name="Inv Warehouse", is_active=True)
    db.add(wh)
    db.commit()
    
    loc1 = models.Location(warehouse_id=wh.id, location_code="LOC-ADJ-1", type="STORAGE", is_active=True)
    loc2 = models.Location(warehouse_id=wh.id, location_code="LOC-ADJ-2", type="STORAGE", is_active=True)
    db.add_all([loc1, loc2])
    db.commit()

    # 1. Adjust Stock
    adjust_payload = {
        "sku_code": "SKU-ADJ-TEST",
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
        "sku_code": "SKU-ADJ-TEST",
        "from_location_id": loc1.id,
        "to_location_id": loc2.id,
        "quantity": 20,
        "note": "Transfer 20 units"
    }
    response = client.post("/inventory/transfer", json=transfer_payload)
    assert response.status_code == 200
    
    # Verify quantities
    inv1 = db.query(models.Inventory).filter(models.Inventory.sku_code == "SKU-ADJ-TEST", models.Inventory.location_id == loc1.id).first()
    inv2 = db.query(models.Inventory).filter(models.Inventory.sku_code == "SKU-ADJ-TEST", models.Inventory.location_id == loc2.id).first()
    assert inv1.qty_on_hand == 30
    assert inv2.qty_on_hand == 20

    # Verify StockTransaction logs
    response = client.get("/stock-transactions?sku_code=SKU-ADJ-TEST")
    assert response.status_code == 200
    txs = response.json()
    assert len(txs) == 3


def test_dashboard_stats_route(client, db):
    wh = models.Warehouse(code="WH-STATS", name="Stats WH", is_active=True)
    db.add(wh)
    db.commit()
    db.refresh(wh)

    loc = models.Location(warehouse_id=wh.id, location_code="LOC-STATS", type="STORAGE", is_active=True)
    db.add(loc)
    db.commit()
    db.refresh(loc)

    inv = models.Inventory(sku_code="SKU-STATS", product_name="Stats Product", location_id=loc.id, qty_on_hand=100, qty_reserved=10)
    db.add(inv)

    inbound = models.InboundShipment(inbound_number="IN-STATS", warehouse_id=wh.id, supplier_name="NCC-STATS", status="pending")
    db.add(inbound)

    fo = models.FulfillmentOrder_WMS(fulfillment_number="FM-STATS", status="pending")
    db.add(fo)
    db.commit()

    resp = client.get("/dashboard/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert data["warehouse_count"] >= 1
    assert data["location_count"] >= 1
    assert data["total_qty_on_hand"] >= 100
    assert data["total_qty_reserved"] >= 10
    assert data["inbound_count"] >= 1
    assert data["fulfillment_count"] >= 1


def test_warehouse_locations_and_lookup_by_code(client, db):
    wh = models.Warehouse(code="WH-LOC", name="Loc WH", is_active=True)
    db.add(wh)
    db.commit()
    db.refresh(wh)

    loc = models.Location(warehouse_id=wh.id, location_code="LOC-LOC-CODE", zone="ZONE1", aisle="A1", rack="K1", shelf="T1", type="STORAGE", is_active=True)
    db.add(loc)
    db.commit()
    db.refresh(loc)

    # 1. Get warehouse locations
    resp = client.get(f"/warehouses/{wh.id}/locations")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["location_code"] == "LOC-LOC-CODE"

    # 2. Get location by alphanumeric code via code path
    resp = client.get("/locations/code/LOC-LOC-CODE")
    assert resp.status_code == 200
    assert resp.json()["id"] == loc.id

    # 3. Get location by alphanumeric code via direct get
    resp = client.get("/locations/LOC-LOC-CODE")
    assert resp.status_code == 200
    assert resp.json()["id"] == loc.id

    # 4. Get location by integer ID
    resp = client.get(f"/locations/{loc.id}")
    assert resp.status_code == 200
    assert resp.json()["location_code"] == "LOC-LOC-CODE"


def test_barcode_mappings_lookup_route(client, db):
    bm = models.BarcodeMapping(barcode="1234567890123", barcode_type="EAN-13", sku_code="SKU-BM-1", product_name="BM 1 Product")
    db.add(bm)
    db.commit()

    resp = client.get("/barcode-mappings/lookup/1234567890123")
    assert resp.status_code == 200
    assert resp.json()["sku_code"] == "SKU-BM-1"


def test_inbound_flow_scanning_and_putaway(client, db):
    wh = models.Warehouse(code="WH-INBOUND", name="Inbound WH", is_active=True)
    db.add(wh)
    db.commit()
    db.refresh(wh)

    loc = models.Location(warehouse_id=wh.id, location_code="LOC-INB", type="STORAGE", is_active=True)
    db.add(loc)
    db.commit()
    db.refresh(loc)

    bm = models.BarcodeMapping(barcode="EAN-INBOUND", barcode_type="EAN-13", sku_code="SKU-INB", product_name="Inbound Prod")
    db.add(bm)
    db.commit()

    shipment = models.InboundShipment(inbound_number="INB-001", warehouse_id=wh.id, supplier_name="Supplier 1", status="pending")
    db.add(shipment)
    db.commit()
    db.refresh(shipment)

    item = models.InboundItem(inbound_shipment_id=shipment.id, sku_code="SKU-INB", product_name="Inbound Prod", expected_qty=10, received_qty=0)
    db.add(item)
    db.commit()

    scan_payload = {"barcode": "EAN-INBOUND", "quantity": 5}
    resp = client.post(f"/inbound/{shipment.id}/receive-scan", json=scan_payload)
    assert resp.status_code == 200
    assert resp.json()["received_qty"] == 5

    putaway_payload = {"sku_code": "SKU-INB", "location_code": "LOC-INB"}
    resp = client.post(f"/inbound/{shipment.id}/put-away", json=putaway_payload)
    assert resp.status_code == 200
    assert resp.json()["location_code"] == "LOC-INB"

    resp = client.patch(f"/inbound/{shipment.id}/complete")
    assert resp.status_code == 200

    inv = db.query(models.Inventory).filter(models.Inventory.sku_code == "SKU-INB", models.Inventory.location_id == loc.id).first()
    assert inv is not None
    assert inv.qty_on_hand == 5

    tx = db.query(models.StockTransaction).filter(models.StockTransaction.sku_code == "SKU-INB", models.StockTransaction.transaction_type == "INBOUND").first()
    assert tx is not None
    assert tx.quantity == 5


def test_outbound_fulfillment_picking_packing_flow(client, db):
    wh = models.Warehouse(code="WH-OUTBOUND", name="Outbound WH", is_active=True)
    db.add(wh)
    db.commit()
    db.refresh(wh)

    loc = models.Location(warehouse_id=wh.id, location_code="LOC-OUTB", type="STORAGE", is_active=True)
    db.add(loc)
    db.commit()
    db.refresh(loc)

    inv = models.Inventory(sku_code="SKU-OUTB", product_name="Outbound Prod", location_id=loc.id, qty_on_hand=50, qty_reserved=0)
    db.add(inv)
    db.commit()

    bm = models.BarcodeMapping(barcode="EAN-OUTBOUND", barcode_type="EAN-13", sku_code="SKU-OUTB", product_name="Outbound Prod")
    db.add(bm)
    db.commit()

    create_payload = {
        "fulfillment_number": "FM-OUTB-001",
        "oms_order_id": 99,
        "oms_order_number": "ORD-99",
        "warehouse_code": "WH-OUTBOUND",
        "status": "PENDING",
        "items": [
            {
                "sku_code": "SKU-OUTB",
                "product_name": "Outbound Prod",
                "quantity": 10
            }
        ]
    }
    resp = client.post("/fulfillment-orders", json=create_payload)
    assert resp.status_code == 201
    fo_id = resp.json()["id"]

    resp = client.post(f"/fulfillment-orders/{fo_id}/start-pick")
    assert resp.status_code == 200
    assert resp.json()["status_code"] == "PICKING"

    scan_pick_payload = {"barcode": "EAN-OUTBOUND", "quantity": 10}
    resp = client.post(f"/fulfillment-orders/{fo_id}/scan-pick", json=scan_pick_payload)
    assert resp.status_code == 200
    assert resp.json()["picked_qty"] == 10
    assert resp.json()["item_status"] == "picked"

    resp = client.post(f"/fulfillment-orders/{fo_id}/complete-pick")
    assert resp.status_code == 200
    assert resp.json()["status_code"] == "PICKED"

    scan_pack_payload = {"tracking_number": "SPXVN123456"}
    resp = client.post(f"/fulfillment-orders/{fo_id}/scan-pack", json=scan_pack_payload)
    assert resp.status_code == 200
    assert resp.json()["tracking_number"] == "SPXVN123456"

    resp = client.post(f"/fulfillment-orders/{fo_id}/complete-pack")
    assert resp.status_code == 200
    assert resp.json()["status_code"] == "PACKED"

    resp = client.post(f"/fulfillment-orders/{fo_id}/ship")
    assert resp.status_code == 200

    db.refresh(inv)
    assert inv.qty_on_hand == 40
    assert inv.qty_reserved == 0

    tx = db.query(models.StockTransaction).filter(models.StockTransaction.sku_code == "SKU-OUTB", models.StockTransaction.transaction_type == "OUTBOUND").first()
    assert tx is not None
    assert tx.quantity == -10


def test_inbound_shipment_financial_fields(client, db):
    wh = models.Warehouse(code="WH-IN-FIN", name="Inbound Fin WH", is_active=True)
    db.add(wh)
    db.commit()
    db.refresh(wh)

    payload = {
        "inbound_number": "INB-FIN-001",
        "warehouse_id": wh.id,
        "supplier_name": "Supplier ABC",
        "receiver_name": "Receiver XYZ",
        "original_document_number": "DOC-INB-999",
        "note": "Testing financial fields",
        "created_by": "Admin",
        "items": [
            {
                "sku_code": "SKU-FIN-1",
                "product_name": "Financial Prod 1",
                "expected_qty": 5,
                "unit_cost": 150000.0
            },
            {
                "sku_code": "SKU-FIN-2",
                "product_name": "Financial Prod 2",
                "expected_qty": 10,
                "unit_cost": 200000.0
            }
        ]
    }
    response = client.post("/inbound-shipments", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["receiver_name"] == "Receiver XYZ"
    assert data["original_document_number"] == "DOC-INB-999"
    # Total = 5 * 150000 + 10 * 200000 = 750000 + 2000000 = 2750000
    assert float(data["total_amount"]) == 2750000.0
    assert len(data["items"]) == 2
    assert float(data["items"][0]["unit_cost"]) == 150000.0


def test_fulfillment_order_financial_fields(client, db):
    wh = models.Warehouse(code="WH-OUT-FIN", name="Outbound Fin WH", is_active=True)
    db.add(wh)
    db.commit()
    db.refresh(wh)

    loc = models.Location(warehouse_id=wh.id, location_code="LOC-OUT-FIN", type="STORAGE", is_active=True)
    db.add(loc)
    db.commit()
    db.refresh(loc)

    inv = models.Inventory(sku_code="SKU-OUT-FIN", product_name="Outbound Fin Prod", location_id=loc.id, qty_on_hand=100, qty_reserved=0)
    db.add(inv)

    bm = models.BarcodeMapping(
        barcode="BAR-OUT-FIN",
        barcode_type="EAN-13",
        sku_code="SKU-OUT-FIN",
        product_name="Outbound Fin Prod",
        selling_price=450000.0 # Selling price cached in mapping
    )
    db.add(bm)
    db.commit()

    payload = {
        "fulfillment_number": "FM-FIN-001",
        "oms_order_id": 88,
        "oms_order_number": "ORD-88",
        "warehouse_code": "WH-OUT-FIN",
        "original_document_number": "DOC-OUTB-888",
        "items": [
            {
                "sku_code": "SKU-OUT-FIN",
                "product_name": "Outbound Fin Prod",
                "quantity": 2
            }
        ]
    }
    response = client.post("/fulfillment-orders", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["original_document_number"] == "DOC-OUTB-888"
    # Total = 2 * 450000 = 900000
    assert float(data["total_amount"]) == 900000.0
    assert len(data["pick_list_items"]) == 1
    assert float(data["pick_list_items"][0]["selling_price"]) == 450000.0


def test_public_stock_single_sku(client, db):
    wh = models.Warehouse(code="WH-PUB-1", name="Public WH 1", is_active=True)
    db.add(wh)
    db.commit()
    loc = models.Location(warehouse_id=wh.id, location_code="LOC-PUB-1", is_active=True)
    db.add(loc)
    db.commit()
    inv = models.Inventory(
        sku_code="SKU-PUB-A",
        product_name="Public Product A",
        location_id=loc.id,
        qty_on_hand=20,
        qty_reserved=5
    )
    db.add(inv)
    db.commit()

    resp = client.get("/public/stock?sku_codes=SKU-PUB-A")
    assert resp.status_code == 200
    data = resp.json()
    assert data["stock"]["SKU-PUB-A"] == 15
    assert len(data["items"]) == 1
    assert data["items"][0]["sku_code"] == "SKU-PUB-A"
    assert data["items"][0]["qty_available"] == 15
    assert data["items"][0]["qty_on_hand"] == 20
    assert data["items"][0]["qty_reserved"] == 5


def test_public_stock_comma_separated_and_missing_sku(client, db):
    wh = models.Warehouse(code="WH-PUB-2", name="Public WH 2", is_active=True)
    db.add(wh)
    db.commit()
    loc = models.Location(warehouse_id=wh.id, location_code="LOC-PUB-2", is_active=True)
    db.add(loc)
    db.commit()
    inv = models.Inventory(
        sku_code="SKU-EXISTING",
        product_name="Existing Product",
        location_id=loc.id,
        qty_on_hand=10,
        qty_reserved=0
    )
    db.add(inv)
    db.commit()

    resp = client.get("/public/stock?sku_codes=SKU-EXISTING,SKU-MISSING")
    assert resp.status_code == 200
    data = resp.json()
    assert data["stock"]["SKU-EXISTING"] == 10
    assert data["stock"]["SKU-MISSING"] == 0
    assert len(data["items"]) == 2
    item_map = {item["sku_code"]: item["qty_available"] for item in data["items"]}
    assert item_map["SKU-EXISTING"] == 10
    assert item_map["SKU-MISSING"] == 0


def test_public_stock_multi_location_aggregation(client, db):
    wh1 = models.Warehouse(code="WH-AGG-1", name="Agg WH 1", is_active=True)
    wh2 = models.Warehouse(code="WH-AGG-2", name="Agg WH 2", is_active=True)
    db.add_all([wh1, wh2])
    db.commit()
    loc1 = models.Location(warehouse_id=wh1.id, location_code="LOC-AGG-1", is_active=True)
    loc2 = models.Location(warehouse_id=wh2.id, location_code="LOC-AGG-2", is_active=True)
    db.add_all([loc1, loc2])
    db.commit()

    # Loc 1: on_hand=30, reserved=5 -> available=25
    inv1 = models.Inventory(sku_code="SKU-MULTI-LOC", product_name="Multi Loc SKU", location_id=loc1.id, qty_on_hand=30, qty_reserved=5)
    # Loc 2: on_hand=50, reserved=15 -> available=35
    inv2 = models.Inventory(sku_code="SKU-MULTI-LOC", product_name="Multi Loc SKU", location_id=loc2.id, qty_on_hand=50, qty_reserved=15)
    db.add_all([inv1, inv2])
    db.commit()

    resp = client.get("/public/stock?sku_codes=SKU-MULTI-LOC")
    assert resp.status_code == 200
    data = resp.json()
    # Aggregated stock = (30 - 5) + (50 - 15) = 25 + 35 = 60
    assert data["stock"]["SKU-MULTI-LOC"] == 60
    assert data["items"][0]["qty_on_hand"] == 80
    assert data["items"][0]["qty_reserved"] == 20
    assert data["items"][0]["qty_available"] == 60


def test_public_stock_unauthenticated(client, db):
    # Clear get_current_user override temporarily to verify public access
    app.dependency_overrides.pop(get_current_user, None)
    try:
        resp = client.get("/public/stock?sku_codes=SKU-UNAUTH")
        assert resp.status_code == 200
        data = resp.json()
        assert data["stock"]["SKU-UNAUTH"] == 0
    finally:
        app.dependency_overrides[get_current_user] = lambda: {"user_id": "1", "username": "admin"}


def test_public_stock_post_endpoint(client, db):
    wh = models.Warehouse(code="WH-POST-1", name="POST WH 1", is_active=True)
    db.add(wh)
    db.commit()
    loc = models.Location(warehouse_id=wh.id, location_code="LOC-POST-1", is_active=True)
    db.add(loc)
    db.commit()
    inv = models.Inventory(
        sku_code="SKU-POST-A",
        product_name="Post Product A",
        location_id=loc.id,
        qty_on_hand=50,
        qty_reserved=10
    )
    db.add(inv)
    db.commit()

    resp = client.post("/public/stock", json={"sku_codes": ["SKU-POST-A", "SKU-POST-MISSING"]})
    assert resp.status_code == 200
    data = resp.json()
    assert data["stock"]["SKU-POST-A"] == 40
    assert data["stock"]["SKU-POST-MISSING"] == 0
    assert len(data["items"]) == 2





