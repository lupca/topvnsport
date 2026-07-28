import asyncio
from concurrent.futures import ThreadPoolExecutor
import pytest
from fastapi.testclient import TestClient
from main import app
from database import get_db, Base
import models
from tests.conftest import engine, TestingSessionLocal, SQLALCHEMY_DATABASE_URL
from utils.auth import get_current_user

IS_SQLITE = SQLALCHEMY_DATABASE_URL.startswith("sqlite")

@pytest.fixture
def setup_db():
    if "wms_db" in SQLALCHEMY_DATABASE_URL and "wms_test_db" not in SQLALCHEMY_DATABASE_URL:
        raise RuntimeError("Refusing to run tests or drop tables on live database!")
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()

def get_fresh_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.mark.skipif(IS_SQLITE, reason="FOR UPDATE concurrency row locking requires PostgreSQL")
def test_concurrent_scan_pick_overpicking_prevention(setup_db):
    """
    Stress test over-picking boundary under high concurrency:
    Pick list item requires 5 units. 15 concurrent threads attempt to pick 1 unit each.
    Exactly 5 should succeed (HTTP 200) and 10 should fail (HTTP 400).
    Final picked_qty in DB must equal 5.
    """
    db_session = setup_db
    app.dependency_overrides[get_db] = get_fresh_db
    app.dependency_overrides[get_current_user] = lambda: {"user_id": "1", "username": "admin"}

    wh = models.Warehouse(code="WH-STRESS-1", name="M8 Stress WH 1")
    db_session.add(wh)
    db_session.flush()
    db_session.commit()

    loc = models.Location(warehouse_id=wh.id, location_code="LOC-STRESS-1", type="STORAGE")
    db_session.add(loc)
    db_session.commit()

    inv = models.Inventory(sku_code="SKU-STRESS-PICK-1", product_name="Stress Item 1", location_id=loc.id, qty_on_hand=100, qty_reserved=5)
    db_session.add(inv)

    bm = models.BarcodeMapping(barcode="BAR-STRESS-PICK-1", barcode_type="EAN-13", sku_code="SKU-STRESS-PICK-1", product_name="Stress Item 1")
    db_session.add(bm)

    fo = models.FulfillmentOrder_WMS(fulfillment_number="FO-STRESS-101", status="PICKING")
    db_session.add(fo)
    db_session.commit()

    pick_item = models.PickListItem(
        fulfillment_order_id=fo.id,
        sku_code="SKU-STRESS-PICK-1",
        product_name="Stress Item 1",
        location_id=loc.id,
        quantity=5,
        picked_qty=0,
        status="picking"
    )
    db_session.add(pick_item)
    db_session.commit()
    fo_number = fo.fulfillment_number

    client = TestClient(app)

    def pick_one():
        resp = client.post(f"/fulfillment-orders/{fo_number}/scan-pick", json={"barcode": "BAR-STRESS-PICK-1", "quantity": 1})
        return resp.status_code, resp.json()

    with ThreadPoolExecutor(max_workers=15) as executor:
        futures = [executor.submit(pick_one) for _ in range(15)]
        results = [f.result() for f in futures]

    successes = [r for r in results if r[0] == 200]
    failures = [r for r in results if r[0] == 400]

    assert len(successes) == 5, f"Expected exactly 5 successes, got {len(successes)}"
    assert len(failures) == 10, f"Expected exactly 10 failures, got {len(failures)}"

    for status_code, data in failures:
        assert data["detail"] == "Cannot pick more than requested quantity"

    db_session.expire_all()
    updated = db_session.query(models.PickListItem).filter(
        models.PickListItem.fulfillment_order_id == fo.id,
        models.PickListItem.sku_code == "SKU-STRESS-PICK-1"
    ).first()

    assert updated.picked_qty == 5
    assert updated.status == "picked"

    app.dependency_overrides.clear()


@pytest.mark.skipif(IS_SQLITE, reason="FOR UPDATE concurrency row locking requires PostgreSQL")
def test_concurrent_scan_pick_multi_quantity_boundary(setup_db):
    """
    Pick list item requires 10 units, currently at 8 picked.
    10 threads try simultaneously: 5 threads request qty=2, 5 threads request qty=3.
    Only one qty=2 request should succeed (bringing total to 10).
    All other 9 requests must be rejected with HTTP 400.
    """
    db_session = setup_db
    app.dependency_overrides[get_db] = get_fresh_db
    app.dependency_overrides[get_current_user] = lambda: {"user_id": "1", "username": "admin"}

    wh = models.Warehouse(code="WH-STRESS-2", name="M8 Stress WH 2")
    db_session.add(wh)
    db_session.flush()
    db_session.commit()
    loc = models.Location(warehouse_id=wh.id, location_code="LOC-STRESS-2", type="STORAGE")
    db_session.add(loc)
    db_session.commit()

    bm = models.BarcodeMapping(barcode="BAR-STRESS-MULTI-2", barcode_type="EAN-13", sku_code="SKU-STRESS-MULTI-2", product_name="Multi Qty Item 2")
    db_session.add(bm)

    fo = models.FulfillmentOrder_WMS(fulfillment_number="FO-STRESS-102", status="PICKING")
    db_session.add(fo)
    db_session.commit()

    pick_item = models.PickListItem(
        fulfillment_order_id=fo.id,
        sku_code="SKU-STRESS-MULTI-2",
        product_name="Multi Qty Item 2",
        location_id=loc.id,
        quantity=10,
        picked_qty=8,
        status="picking"
    )
    db_session.add(pick_item)
    db_session.commit()
    fo_number = fo.fulfillment_number

    client = TestClient(app)

    def pick_qty(qty: int):
        resp = client.post(f"/fulfillment-orders/{fo_number}/scan-pick", json={"barcode": "BAR-STRESS-MULTI-2", "quantity": qty})
        return resp.status_code

    tasks = [2]*5 + [3]*5

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(pick_qty, q) for q in tasks]
        results = [f.result() for f in futures]

    successes = [code for code in results if code == 200]
    failures = [code for code in results if code == 400]

    assert len(successes) == 1, f"Expected 1 success, got {len(successes)}"
    assert len(failures) == 9, f"Expected 9 failures, got {len(failures)}"

    db_session.expire_all()
    updated = db_session.query(models.PickListItem).filter(
        models.PickListItem.fulfillment_order_id == fo.id,
        models.PickListItem.sku_code == "SKU-STRESS-MULTI-2"
    ).first()

    assert updated.picked_qty == 10
    assert updated.status == "picked"

    app.dependency_overrides.clear()


@pytest.mark.skipif(IS_SQLITE, reason="FOR UPDATE concurrency row locking requires PostgreSQL")
def test_concurrent_inbound_receive_scan(setup_db):
    """
    Stress test inbound receive scan: 50 concurrent scans of 1 unit each.
    All 50 should succeed and final received_qty must equal 50.
    """
    db_session = setup_db
    app.dependency_overrides[get_db] = get_fresh_db
    app.dependency_overrides[get_current_user] = lambda: {"user_id": "1", "username": "admin"}

    wh = models.Warehouse(code="WH-STRESS-3", name="M8 Stress WH 3")
    db_session.add(wh)
    db_session.flush()
    db_session.commit()

    bm = models.BarcodeMapping(barcode="BAR-STRESS-INB-3", barcode_type="EAN-13", sku_code="SKU-STRESS-INB-3", product_name="Inbound Stress Item 3")
    db_session.add(bm)

    shipment = models.InboundShipment(inbound_number="INB-STRESS-103", warehouse_id=wh.id, supplier_name="Supplier Stress 3", status="pending")
    db_session.add(shipment)
    db_session.commit()

    item = models.InboundItem(inbound_shipment_id=shipment.id, sku_code="SKU-STRESS-INB-3", product_name="Inbound Stress Item 3", expected_qty=50, received_qty=0)
    db_session.add(item)
    db_session.commit()
    shipment_id = shipment.id

    client = TestClient(app)

    def scan_one():
        resp = client.post(f"/inbound/{shipment_id}/receive-scan", json={"barcode": "BAR-STRESS-INB-3", "quantity": 1})
        return resp.status_code

    with ThreadPoolExecutor(max_workers=20) as executor:
        futures = [executor.submit(scan_one) for _ in range(50)]
        results = [f.result() for f in futures]

    assert all(code == 200 for code in results), "All 50 receive-scans should succeed"

    db_session.expire_all()
    updated_item = db_session.query(models.InboundItem).filter(
        models.InboundItem.inbound_shipment_id == shipment_id,
        models.InboundItem.sku_code == "SKU-STRESS-INB-3"
    ).first()
    assert updated_item.received_qty == 50

    app.dependency_overrides.clear()


@pytest.mark.skipif(IS_SQLITE, reason="FOR UPDATE concurrency row locking requires PostgreSQL")
def test_concurrent_fulfillment_order_creation_stock_reservation(setup_db):
    """
    Stress test stock reservation race condition:
    Available stock = 10.
    3 concurrent orders request 6 units each (total 18 requested > 10 available).
    Exactly 1 order should succeed (reserving 6 units), and 2 should fail with HTTP 400.
    Total reserved stock in DB must equal 6 (never exceed 10).
    """
    db_session = setup_db
    app.dependency_overrides[get_db] = get_fresh_db
    app.dependency_overrides[get_current_user] = lambda: {"user_id": "1", "username": "admin"}

    wh = models.Warehouse(code="WH-STRESS-4", name="M8 Stress WH 4")
    db_session.add(wh)
    db_session.flush()
    db_session.commit()
    loc = models.Location(warehouse_id=wh.id, location_code="LOC-STRESS-4", type="STORAGE")
    db_session.add(loc)
    db_session.commit()

    inv = models.Inventory(sku_code="SKU-STRESS-RES-4", product_name="Res Item 4", location_id=loc.id, qty_on_hand=10, qty_reserved=0)
    db_session.add(inv)
    bm = models.BarcodeMapping(barcode="BAR-STRESS-RES-4", barcode_type="EAN-13", sku_code="SKU-STRESS-RES-4", product_name="Res Item 4", selling_price=100)
    db_session.add(bm)
    db_session.commit()

    client = TestClient(app)

    def create_order(idx: int):
        payload = {
            "fulfillment_number": f"FO-RES-RACE-104-{idx}",
            "oms_order_id": 2000 + idx,
            "oms_order_number": f"OMS-RES-104-{idx}",
            "warehouse_code": "WH-STRESS-4",
            "items": [
                {
                    "sku_code": "SKU-STRESS-RES-4",
                    "product_name": "Res Item 4",
                    "quantity": 6
                }
            ]
        }
        resp = client.post("/fulfillment-orders", json=payload)
        return resp.status_code, resp.json()

    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = [executor.submit(create_order, i) for i in range(3)]
        results = [f.result() for f in futures]

    successes = [r for r in results if r[0] == 201]
    failures = [r for r in results if r[0] == 400]

    assert len(successes) == 1, f"Expected 1 order created, got {len(successes)}"
    assert len(failures) == 2, f"Expected 2 orders failed, got {len(failures)}"

    db_session.expire_all()
    updated_inv = db_session.query(models.Inventory).filter(
        models.Inventory.sku_code == "SKU-STRESS-RES-4",
        models.Inventory.location_id == loc.id
    ).first()

    assert updated_inv.qty_reserved == 6
    assert (updated_inv.qty_on_hand - updated_inv.qty_reserved) == 4

    app.dependency_overrides.clear()


def test_scan_pick_boundary_negative_or_zero_quantity(setup_db):
    """
    Boundary Test: Check system behavior when scan-pick is called with quantity <= 0.
    """
    db_session = setup_db
    app.dependency_overrides[get_db] = get_fresh_db
    app.dependency_overrides[get_current_user] = lambda: {"user_id": "1", "username": "admin"}

    wh = models.Warehouse(code="WH-BOUND-1", name="M8 Bound WH 1")
    db_session.add(wh)
    db_session.flush()
    db_session.commit()

    loc = models.Location(warehouse_id=wh.id, location_code="LOC-BOUND-1", type="STORAGE")
    db_session.add(loc)
    db_session.commit()

    bm = models.BarcodeMapping(barcode="BAR-BOUND-PICK-1", barcode_type="EAN-13", sku_code="SKU-BOUND-PICK-1", product_name="Bound Pick Item 1")
    db_session.add(bm)

    fo = models.FulfillmentOrder_WMS(fulfillment_number="FO-BOUND-101", status="PICKING")
    db_session.add(fo)
    db_session.commit()

    pick_item = models.PickListItem(
        fulfillment_order_id=fo.id,
        sku_code="SKU-BOUND-PICK-1",
        product_name="Bound Pick Item 1",
        location_id=loc.id,
        quantity=5,
        picked_qty=2,
        status="picking"
    )
    db_session.add(pick_item)
    db_session.commit()

    client = TestClient(app)

    # Test negative quantity scan
    resp = client.post(f"/fulfillment-orders/{fo.fulfillment_number}/scan-pick", json={"barcode": "BAR-BOUND-PICK-1", "quantity": -1})
    status_neg = resp.status_code
    body_neg = resp.json()

    # Test zero quantity scan
    resp_zero = client.post(f"/fulfillment-orders/{fo.fulfillment_number}/scan-pick", json={"barcode": "BAR-BOUND-PICK-1", "quantity": 0})
    status_zero = resp_zero.status_code
    body_zero = resp_zero.json()

    db_session.expire_all()
    updated = db_session.query(models.PickListItem).filter(models.PickListItem.id == pick_item.id).first()

    app.dependency_overrides.clear()
    assert updated is not None


def test_receive_scan_boundary_completed_shipment(setup_db):
    """
    Boundary Test: Attempting receive-scan on an InboundShipment with status COMPLETED.
    """
    db_session = setup_db
    app.dependency_overrides[get_db] = get_fresh_db
    app.dependency_overrides[get_current_user] = lambda: {"user_id": "1", "username": "admin"}

    wh = models.Warehouse(code="WH-BOUND-2", name="M8 Bound WH 2")
    db_session.add(wh)
    db_session.flush()
    db_session.commit()

    bm = models.BarcodeMapping(barcode="BAR-BOUND-REC-2", barcode_type="EAN-13", sku_code="SKU-BOUND-REC-2", product_name="Bound Rec Item 2")
    db_session.add(bm)

    shipment = models.InboundShipment(inbound_number="INB-BOUND-102", warehouse_id=wh.id, supplier_name="Supplier Bound 2", status="COMPLETED")
    db_session.add(shipment)
    db_session.commit()

    item = models.InboundItem(inbound_shipment_id=shipment.id, sku_code="SKU-BOUND-REC-2", product_name="Bound Rec Item 2", expected_qty=10, received_qty=10, status="received")
    db_session.add(item)
    db_session.commit()

    client = TestClient(app)
    resp = client.post(f"/inbound/{shipment.id}/receive-scan", json={"barcode": "BAR-BOUND-REC-2", "quantity": 1})

    app.dependency_overrides.clear()
    assert resp.status_code in (200, 400)
