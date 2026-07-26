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
def test_concurrent_receive_scan(setup_db):
    db_session = setup_db
    app.dependency_overrides[get_db] = get_fresh_db
    app.dependency_overrides[get_current_user] = lambda: {"user_id": "1", "username": "admin"}
    
    wh = models.Warehouse(code="WH-CONC-REC", name="Conc Rec WH")
    db_session.add(wh)
    db_session.commit()

    bm = models.BarcodeMapping(barcode="BAR-REC-CONC", barcode_type="EAN-13", sku_code="SKU-REC-CONC", product_name="Conc Rec Prod")
    db_session.add(bm)
    db_session.commit()

    shipment = models.InboundShipment(inbound_number="INB-CONC-001", warehouse_id=wh.id, supplier_name="Supplier Conc", status="pending")
    db_session.add(shipment)
    db_session.commit()

    item = models.InboundItem(inbound_shipment_id=shipment.id, sku_code="SKU-REC-CONC", product_name="Conc Rec Prod", expected_qty=100, received_qty=0)
    db_session.add(item)
    db_session.commit()
    shipment_id = shipment.id

    client = TestClient(app)

    def scan_one():
        resp = client.post(f"/inbound/{shipment_id}/receive-scan", json={"barcode": "BAR-REC-CONC", "quantity": 1})
        return resp.status_code

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(scan_one) for _ in range(10)]
        results = [f.result() for f in futures]

    assert all(code == 200 for code in results)

    db_session.expire_all()
    updated_item = db_session.query(models.InboundItem).filter(
        models.InboundItem.inbound_shipment_id == shipment_id,
        models.InboundItem.sku_code == "SKU-REC-CONC"
    ).first()
    assert updated_item.received_qty == 10

    app.dependency_overrides.clear()


@pytest.mark.skipif(IS_SQLITE, reason="FOR UPDATE concurrency row locking requires PostgreSQL")
def test_concurrent_pick_scan(setup_db):
    db_session = setup_db
    app.dependency_overrides[get_db] = get_fresh_db
    app.dependency_overrides[get_current_user] = lambda: {"user_id": "1", "username": "admin"}
    
    wh = models.Warehouse(code="WH-CONC-PICK", name="Conc Pick WH")
    db_session.add(wh)
    db_session.commit()

    loc = models.Location(warehouse_id=wh.id, location_code="LOC-PICK-CONC", type="STORAGE")
    db_session.add(loc)
    db_session.commit()

    inv = models.Inventory(sku_code="SKU-PICK-CONC", product_name="Conc Pick Prod", location_id=loc.id, qty_on_hand=100, qty_reserved=20)
    db_session.add(inv)
    db_session.commit()

    bm = models.BarcodeMapping(barcode="BAR-PICK-CONC", barcode_type="EAN-13", sku_code="SKU-PICK-CONC", product_name="Conc Pick Prod")
    db_session.add(bm)
    db_session.commit()

    fo = models.FulfillmentOrder_WMS(fulfillment_number="FO-CONC-001", status="PICKING")
    db_session.add(fo)
    db_session.commit()

    pick_item = models.PickListItem(fulfillment_order_id=fo.id, sku_code="SKU-PICK-CONC", product_name="Conc Pick Prod", location_id=loc.id, quantity=20, picked_qty=0, status="picking")
    db_session.add(pick_item)
    db_session.commit()
    fo_id = fo.id

    client = TestClient(app)

    def pick_one():
        resp = client.post(f"/fulfillment-orders/{fo_id}/scan-pick", json={"barcode": "BAR-PICK-CONC", "quantity": 1})
        return resp.status_code

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(pick_one) for _ in range(10)]
        results = [f.result() for f in futures]

    assert all(code == 200 for code in results)

    db_session.expire_all()
    updated_pick_item = db_session.query(models.PickListItem).filter(
        models.PickListItem.fulfillment_order_id == fo_id,
        models.PickListItem.sku_code == "SKU-PICK-CONC"
    ).first()
    assert updated_pick_item.picked_qty == 10
    assert updated_pick_item.status == "picking"

    app.dependency_overrides.clear()


@pytest.mark.skipif(IS_SQLITE, reason="FOR UPDATE concurrency row locking requires PostgreSQL")
@pytest.mark.asyncio
async def test_async_concurrent_receive_scan(setup_db):
    db_session = setup_db
    app.dependency_overrides[get_db] = get_fresh_db
    app.dependency_overrides[get_current_user] = lambda: {"user_id": "1", "username": "admin"}

    wh = models.Warehouse(code="WH-ASYNC-REC", name="Async Rec WH")
    db_session.add(wh)
    db_session.commit()

    bm = models.BarcodeMapping(barcode="BAR-ASYNC-REC", barcode_type="EAN-13", sku_code="SKU-ASYNC-REC", product_name="Async Rec Prod")
    db_session.add(bm)
    db_session.commit()

    shipment = models.InboundShipment(inbound_number="INB-ASYNC-001", warehouse_id=wh.id, supplier_name="Supplier Async", status="pending")
    db_session.add(shipment)
    db_session.commit()

    item = models.InboundItem(inbound_shipment_id=shipment.id, sku_code="SKU-ASYNC-REC", product_name="Async Rec Prod", expected_qty=100, received_qty=0)
    db_session.add(item)
    db_session.commit()
    shipment_id = shipment.id

    client = TestClient(app)

    async def async_receive_scan(qty: int = 1):
        return await asyncio.to_thread(
            client.post, f"/inbound/{shipment_id}/receive-scan", json={"barcode": "BAR-ASYNC-REC", "quantity": qty}
        )

    results = await asyncio.gather(*[async_receive_scan(1) for _ in range(10)])
    assert all(r.status_code == 200 for r in results)

    db_session.expire_all()
    updated_item = db_session.query(models.InboundItem).filter(
        models.InboundItem.inbound_shipment_id == shipment_id,
        models.InboundItem.sku_code == "SKU-ASYNC-REC"
    ).first()
    assert updated_item.received_qty == 10

    app.dependency_overrides.clear()
