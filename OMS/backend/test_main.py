import os
os.environ.setdefault("INTEGRITY_MODE", "development")
os.environ.setdefault("ENV", "development")
os.environ.setdefault("FERNET_KEY", "lz_K8Z8d1d-0iO-4yN2Vb11234567890abcdefghijk=")
os.environ["TESTING"] = "1"


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
        ("STOREFRONT", "Storefront"),
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


@pytest.fixture(scope="function")
def configure_sms(db):
    from utils.crypto import encrypt_value
    config1 = models.SystemConfig(
        config_key="speed_sms_token",
        config_value=encrypt_value("speedsms_token_xyz123"),
        description="SpeedSMS API Access Token"
    )
    config2 = models.SystemConfig(
        config_key="SPEEDSMS_API_KEY",
        config_value=encrypt_value("speedsms_token_xyz123"),
        description="SpeedSMS API Access Token Alternative"
    )
    db.add(config1)
    db.add(config2)
    db.commit()
    return config1

def test_send_otp_rate_limit_and_lockout(client, db, configure_sms, monkeypatch):
    monkeypatch.setattr("services.sms_service.send_speed_sms", lambda p, o, t: {"status": "success", "provider_response": "OK", "failed_reason": None})

    phone = "0987654321"

    # First send is successful
    res1 = client.post("/api/sms/send-otp", json={"phone_number": phone})
    assert res1.status_code == 200

    # Second send within 60s returns 429
    res2 = client.post("/api/sms/send-otp", json={"phone_number": phone})
    assert res2.status_code == 429
    assert "gửi yêu cầu quá nhanh" in res2.json()["detail"]

    # Exceeding 5 requests blocks phone with a 15-minute lockout (HTTP 403)
    limit_record = db.query(models.SmsRateLimit).filter(
        models.SmsRateLimit.phone_number == "84987654321",
        models.SmsRateLimit.action_type == "send"
    ).first()
    assert limit_record is not None
    limit_record.attempt_count = 6
    db.commit()

    res3 = client.post("/api/sms/send-otp", json={"phone_number": phone})
    assert res3.status_code == 403
    assert "tạm khóa" in res3.json()["detail"]

def test_otp_hashing(client, db, configure_sms, monkeypatch):
    monkeypatch.setattr("services.sms_service.send_speed_sms", lambda p, o, t: {"status": "success", "provider_response": "OK", "failed_reason": None})

    phone = "0912345678"
    res = client.post("/api/sms/send-otp", json={"phone_number": phone})
    assert res.status_code == 200

    otp_record = db.query(models.OtpVerification).filter(
        models.OtpVerification.phone_number == "84912345678"
    ).first()
    assert otp_record is not None
    assert len(otp_record.otp_hash) == 64  # SHA256 length hex
    assert not otp_record.otp_hash.isdigit()

def test_sms_provider_failure(client, db, configure_sms, monkeypatch):
    def mock_failed_send(phone, otp, token):
        return {"status": "failed", "provider_response": "Authentication Failed", "failed_reason": "Invalid key"}

    monkeypatch.setattr("services.sms_service.send_speed_sms", mock_failed_send)

    phone = "0922222222"
    resp = client.post("/api/sms/send-otp", json={"phone_number": phone})
    
    assert resp.status_code == 500
    
    otp_record = db.query(models.OtpVerification).filter(
        models.OtpVerification.phone_number == "84922222222"
    ).first()
    assert otp_record.provider_status == "failed"
    assert otp_record.failed_reason == "Invalid key"

def test_otp_verification_flow(client, db, configure_sms, monkeypatch):
    monkeypatch.setattr("services.sms_service.send_speed_sms", lambda p, o, t: {"status": "success", "provider_response": "OK", "failed_reason": None})

    phone = "0933333333"
    res_send = client.post("/api/sms/send-otp", json={"phone_number": phone})
    assert res_send.status_code == 200

    res_otp = client.get(f"/api/sms/test-last-otp?phone={phone}")
    assert res_otp.status_code == 200
    otp_code = res_otp.json()["otp_code"]

    # Verify with incorrect code -> 400
    res_wrong = client.post("/api/sms/verify-otp", json={"phone_number": phone, "otp_code": "000000"})
    assert res_wrong.status_code == 400
    assert "Mã OTP không chính xác" in res_wrong.json()["detail"]

    # Verify with correct code -> 200 and return token
    res_correct = client.post("/api/sms/verify-otp", json={"phone_number": phone, "otp_code": otp_code})
    assert res_correct.status_code == 200
    token = res_correct.json()["verification_token"]
    assert len(token) > 0

    # Try verifying again -> 400
    res_again = client.post("/api/sms/verify-otp", json={"phone_number": phone, "otp_code": otp_code})
    assert res_again.status_code == 400

    # Test verification lockout after 5 failures
    phone_lock = "0977777777"
    client.post("/api/sms/send-otp", json={"phone_number": phone_lock})
    for _ in range(4):
        res = client.post("/api/sms/verify-otp", json={"phone_number": phone_lock, "otp_code": "111111"})
        assert res.status_code == 400
    
    # 5th attempt -> 403 lockout
    res_lock = client.post("/api/sms/verify-otp", json={"phone_number": phone_lock, "otp_code": "111111"})
    assert res_lock.status_code == 403
    assert "tạm khóa" in res_lock.json()["detail"]

def test_order_creation_otp_security(client, db, monkeypatch):
    cust = models.Customer(name="E2E Buyer", phone="0944444444", address="Street")
    db.add(cust)
    chan = db.query(models.Channel).filter(models.Channel.code == "STOREFRONT").first()
    db.commit()
    db.refresh(cust)

    monkeypatch.setattr("main.call_api", lambda url, m, d=None: {
        "price": 1000.0,
        "product_name": "Test product",
        "variant_name": "Test variant",
        "image_url": "http://img.com"
    })

    order_payload = {
        "customer_id": cust.id,
        "channel_id": chan.id,
        "shipping_fee": 100.0,
        "shipping_address": "Street",
        "items": [{"sku_code": "SKU-TEST", "quantity": 1}]
    }

    # 1. Attempt checkout with no token -> 403 Forbidden
    res_no_token = client.post("/orders", json={**order_payload})
    assert res_no_token.status_code == 403
    assert "Verification token is missing" in res_no_token.json()["detail"]

    # 2. Attempt checkout with invalid token -> 403 Forbidden
    res_invalid_token = client.post("/orders", json={**order_payload, "verification_token": "fake-token"})
    assert res_invalid_token.status_code == 403
    assert "Invalid verification token" in res_invalid_token.json()["detail"]

    # 3. Checkout with valid token -> 201 Created & marks token as used
    from datetime import datetime, timedelta
    token_record = models.OtpVerification(
        phone_number="84944444444",
        otp_hash="hashed",
        expires_at=datetime.utcnow() + timedelta(minutes=5),
        verified_at=datetime.utcnow(),
        verification_token="valid-token-123",
        verification_expires_at=datetime.utcnow() + timedelta(minutes=15)
    )
    db.add(token_record)
    db.commit()

    res_valid = client.post("/orders", json={**order_payload, "verification_token": "valid-token-123"})
    assert res_valid.status_code == 201

    db.refresh(token_record)
    assert token_record.used_at is not None
    assert token_record.status == "CONSUMED"

    # 4. Attempt replay attack (reuse token) -> 403 Forbidden
    res_replay = client.post("/orders", json={**order_payload, "verification_token": "valid-token-123"})
    assert res_replay.status_code == 403
    assert "Verification token has already been used" in res_replay.json()["detail"]


def test_validation_errors_translation_vietnamese(client):
    # Missing name when creating customer
    resp = client.post("/customers", json={"phone": "123456"})
    assert resp.status_code == 422
    errors = resp.json()["detail"]
    name_error = next(e for e in errors if "name" in e["loc"])
    assert name_error["msg"] == "Trường này là bắt buộc"
    assert name_error["type"] == "missing"
