import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, get_db
from main import app
import models

# Use file-based SQLite for testing to maintain table persistence during tests
DB_FILE = "/tmp/oms_test.db"
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_FILE}"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db():
    Base.metadata.create_all(bind=engine)
    db_session = TestingSessionLocal()
    # Re-seed test channels
    channels_to_seed = [
        ("MANUAL", "Manual"),
        ("SHOPEE", "Shopee"),
        ("TIKTOK_SHOP", "TikTok Shop"),
        ("LAZADA", "Lazada"),
    ]
    for code, name in channels_to_seed:
        existing = db_session.query(models.Channel).filter(models.Channel.code == code).first()
        if not existing:
            db_session.add(models.Channel(code=code, name=name, is_active=True))
    db_session.commit()
    try:
        yield db_session
    finally:
        db_session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()
        import os
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
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

def test_create_order_and_flow(client, db, monkeypatch):
    # 1. Seed Customer and Channel
    cust = models.Customer(name="John Doe", email="john@example.com", phone="12345", address="123 Main St")
    db.add(cust)
    chan = db.query(models.Channel).filter(models.Channel.code == "SHOPEE").first()
    db.commit()
    db.refresh(cust)
    
    # Mock call_api
    called_urls = []
    def mock_call_api(url, method="GET", data=None):
        called_urls.append((url, method, data))
        if "pim-api" in url:
            return {
                "product_name": "Test Shirt",
                "variant_name": "Red / M",
                "price": 100.0,
                "image_url": "http://example.com/shirt.jpg"
            }
        elif "wms-api" in url:
            if "cancel" in url:
                return {"status": "success", "fulfillment_number": "FM-ORD-001"}
            return {"status": "PENDING"}
        return {}
        
    monkeypatch.setattr("main.call_api", mock_call_api)
    monkeypatch.setattr(
        "main.allocate_order_items",
        lambda order_items: [
            {
                "warehouse_code": "WH-001",
                "items": [
                    {
                        "sku_code": item.sku_code,
                        "product_name": item.product_name,
                        "quantity": item.quantity,
                    }
                    for item in order_items
                ],
            }
        ],
    )
    
    # 2. Create Order
    payload = {
        "order_number": "ORD-001",
        "customer_id": cust.id,
        "channel_id": chan.id,
        "shipping_fee": 15.0,
        "shipping_address": "123 Main St",
        "note": "Deliver after 5 PM",
        "created_by": "admin",
        "items": [
            {
                "sku_code": "TSHIRT-RED-M",
                "quantity": 2
            }
        ]
    }
    response = client.post("/orders", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["order_number"] == "ORD-001"
    assert data["status"] == "DRAFT"
    assert float(data["total_amount"]) == 215.0 # (100 * 2) + 15
    assert len(data["items"]) == 1
    assert data["items"][0]["sku_code"] == "TSHIRT-RED-M"
    assert data["items"][0]["product_name"] == "Test Shirt"
    
    order_id = data["id"]
    
    # 3. Confirm Order
    confirm_resp = client.post(f"/orders/{order_id}/confirm")
    assert confirm_resp.status_code == 200
    confirm_data = confirm_resp.json()
    assert confirm_data["status"] == "PROCESSING"
    assert len(confirm_data["fulfillment_orders"]) == 1
    assert confirm_data["fulfillment_orders"][0]["fulfillment_number"] == "FM-ORD-001"
    
    # 4. Callback status update (CONFIRMED -> PROCESSING -> PICKING)
    status_payload = {"status": "PICKING"}
    status_resp = client.patch(f"/orders/{order_id}/status", json=status_payload)
    assert status_resp.status_code == 200
    assert status_resp.json()["status"] == "PICKING"
    
    # 5. Cancel Order
    cancel_resp = client.post(f"/orders/{order_id}/cancel")
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["status"] == "CANCELLED"

def test_dashboard_stats(client, db):
    # Seed data
    cust = models.Customer(name="Jane Doe", phone="54321")
    db.add(cust)
    chan = db.query(models.Channel).filter(models.Channel.code == "MANUAL").first()
    db.commit()
    db.refresh(cust)

    order1 = models.Order(order_number="ORD-D1", customer_id=cust.id, channel_id=chan.id, status="DRAFT", total_amount=150.0, shipping_fee=10.0, shipping_address="Test Addr")
    order2 = models.Order(order_number="ORD-D2", customer_id=cust.id, channel_id=chan.id, status="CANCELLED", total_amount=50.0, shipping_fee=0.0, shipping_address="Test Addr")
    db.add(order1)
    db.add(order2)
    db.commit()

    resp = client.get("/dashboard/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert data["order_count"] == 2
    assert data["customer_count"] == 1
    assert data["revenue"] == 150.0 # Exclude CANCELLED order2 total_amount
    assert data["status_counts"]["DRAFT"] == 1
    assert data["status_counts"]["CANCELLED"] == 1

def test_edit_draft_order(client, db, monkeypatch):
    cust = models.Customer(name="Alice Smith", phone="99999")
    db.add(cust)
    chan = db.query(models.Channel).filter(models.Channel.code == "TIKTOK_SHOP").first()
    db.commit()
    db.refresh(cust)

    order = models.Order(order_number="ORD-EDIT-1", customer_id=cust.id, channel_id=chan.id, status="DRAFT", total_amount=100.00, shipping_fee=10.00, shipping_address="Old Addr")
    db.add(order)
    db.flush()
    item = models.OrderItem(order_id=order.id, sku_code="SKU-1", product_name="P1", quantity=1, unit_price=90.00, subtotal=90.00)
    db.add(item)
    db.commit()

    # Mock call_api
    def mock_call_api(url, method="GET", data=None):
        return {
            "product_name": "New Product",
            "variant_name": "Blue / L",
            "price": 50.00,
            "image_url": "http://example.com/blue.jpg"
        }
    monkeypatch.setattr("main.call_api", mock_call_api)

    # Edit draft order
    update_payload = {
        "shipping_address": "New Addr",
        "shipping_fee": 15.00,
        "items": [
            {
                "sku_code": "SKU-2",
                "quantity": 3
            }
        ]
    }
    resp = client.put(f"/orders/{order.id}", json=update_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["shipping_address"] == "New Addr"
    assert float(data["shipping_fee"]) == 15.00
    assert float(data["total_amount"]) == 165.00 # (50 * 3) + 15
    assert len(data["items"]) == 1
    assert data["items"][0]["sku_code"] == "SKU-2"

def test_edit_nondraft_order_blocked(client, db):
    cust = models.Customer(name="Bob", phone="88888")
    db.add(cust)
    chan = db.query(models.Channel).filter(models.Channel.code == "LAZADA").first()
    db.commit()

    order = models.Order(order_number="ORD-EDIT-2", customer_id=cust.id, channel_id=chan.id, status="PROCESSING", total_amount=10.0, shipping_fee=0.0, shipping_address="Test Addr")
    db.add(order)
    db.commit()

    resp = client.put(f"/orders/{order.id}", json={"shipping_address": "Nowhere"})
    assert resp.status_code == 400
    assert "Cannot edit order in status PROCESSING" in resp.json()["detail"]

def test_delete_draft_order(client, db):
    cust = models.Customer(name="Charlie", phone="77777")
    db.add(cust)
    chan = db.query(models.Channel).filter(models.Channel.code == "MANUAL").first()
    db.commit()

    order = models.Order(order_number="ORD-DEL-1", customer_id=cust.id, channel_id=chan.id, status="DRAFT", total_amount=10.0, shipping_fee=0.0, shipping_address="Addr")
    db.add(order)
    db.commit()

    resp = client.delete(f"/orders/{order.id}")
    assert resp.status_code == 204

    # Try to delete non-draft
    order2 = models.Order(order_number="ORD-DEL-2", customer_id=cust.id, channel_id=chan.id, status="CONFIRMED", total_amount=10.0, shipping_fee=0.0, shipping_address="Addr")
    db.add(order2)
    db.commit()
    resp2 = client.delete(f"/orders/{order2.id}")
    assert resp2.status_code == 400

def test_products_search_proxy(client, monkeypatch):
    called = []
    def mock_get(self, url, *args, **kwargs):
        called.append((url, kwargs.get("params")))
        class MockResponse:
            status_code = 200
            is_error = False
            def json(self):
                return [{"sku_code": "TSHIRT", "product_name": "Shirt"}]
        return MockResponse()

    monkeypatch.setattr("httpx.Client.get", mock_get)

    resp = client.get("/products/search?q=shirt")
    assert resp.status_code == 200
    assert resp.json()[0]["sku_code"] == "TSHIRT"

def test_order_filtering_search_pagination(client, db):
    cust1 = models.Customer(name="Alexander", phone="11111")
    cust2 = models.Customer(name="Beatrix", phone="22222")
    db.add(cust1)
    db.add(cust2)
    chan1 = db.query(models.Channel).filter(models.Channel.code == "SHOPEE").first()
    chan2 = db.query(models.Channel).filter(models.Channel.code == "LAZADA").first()
    db.commit()

    order1 = models.Order(order_number="ORD-FIT-1", customer_id=cust1.id, channel_id=chan1.id, status="DRAFT", total_amount=10.0, shipping_fee=0.0, shipping_address="Addr")
    order2 = models.Order(order_number="ORD-FIT-2", customer_id=cust2.id, channel_id=chan2.id, status="CONFIRMED", total_amount=20.0, shipping_fee=0.0, shipping_address="Addr")
    db.add(order1)
    db.add(order2)
    db.commit()

    # Filter status
    resp = client.get("/orders?status=DRAFT")
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["order_number"] == "ORD-FIT-1"

    # Search customer name
    resp2 = client.get("/orders?search=Beatrix")
    assert resp2.status_code == 200
    assert resp2.json()["total"] == 1
    assert resp2.json()["items"][0]["order_number"] == "ORD-FIT-2"

    # Pagination
    resp3 = client.get("/orders?limit=1&page=1")
    assert resp3.status_code == 200
    assert len(resp3.json()["items"]) == 1
    assert resp3.json()["total"] == 2
    assert resp3.json()["pages"] == 2

def test_illegal_status_transitions(client, db):
    cust = models.Customer(name="Dave", phone="33333")
    db.add(cust)
    chan = db.query(models.Channel).filter(models.Channel.code == "MANUAL").first()
    db.commit()

    order = models.Order(order_number="ORD-FLOW-1", customer_id=cust.id, channel_id=chan.id, status="DRAFT", total_amount=10.0, shipping_fee=0.0, shipping_address="Addr")
    db.add(order)
    db.commit()

    # DRAFT -> SHIPPED is illegal (must go DRAFT -> CONFIRMED)
    resp = client.patch(f"/orders/{order.id}/status", json={"status": "SHIPPED"})
    assert resp.status_code == 400
    assert "Illegal transition" in resp.json()["detail"]

def test_seeded_channels(client, db):
    resp = client.get("/channels")
    assert resp.status_code == 200
    codes = [c["code"] for c in resp.json()["items"]]
    assert "MANUAL" in codes
    assert "SHOPEE" in codes
    assert "TIKTOK_SHOP" in codes
    assert "LAZADA" in codes

def test_auto_generated_order_number(client, db, monkeypatch):
    cust = models.Customer(name="Elena", phone="44444")
    db.add(cust)
    chan = db.query(models.Channel).filter(models.Channel.code == "MANUAL").first()
    db.commit()

    def mock_call_api(url, method="GET", data=None):
        return {"price": 10.0}
    monkeypatch.setattr("main.call_api", mock_call_api)

    payload = {
        "customer_id": cust.id,
        "channel_id": chan.id,
        "shipping_fee": 5.0,
        "shipping_address": "Addr",
        "items": []
    }
    resp = client.post("/orders", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["order_number"].startswith("ORD-")

def test_cors_headers(client):
    # Preflight options request
    resp = client.options("/orders", headers={
        "Origin": "http://localhost:13101",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type"
    })
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:13101"
