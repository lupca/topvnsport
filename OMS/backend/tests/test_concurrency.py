import concurrent.futures
from datetime import datetime, timedelta, timezone
from database import get_db
from main import app
import models
from tests.conftest import TestingSessionLocal


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def thread_safe_get_db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_concurrent_order_number_generation(client, db, monkeypatch):
    app.dependency_overrides[get_db] = thread_safe_get_db

    # Mock PIM API call
    def mock_call_api(url, method="GET", json=None):
        if "/api/products/by-sku/" in url:
            return {
                "sku_code": url.split("/")[-1],
                "product_name": "Test Product",
                "variant_name": "Default",
                "price": 100000.0,
                "image_url": "http://example.com/img.jpg",
            }
        return {}

    monkeypatch.setattr("routers.orders._call_api", mock_call_api)

    # Ensure a customer and channel exist
    cust = models.Customer(name="Concurrent User", phone="0988888888")
    chan = db.query(models.Channel).filter(models.Channel.code == "MANUAL").first()
    if not chan:
        chan = models.Channel(code="MANUAL", name="Manual", is_active=True)
        db.add(chan)
    db.add(cust)
    db.commit()
    db.refresh(cust)

    payload = {
        "customer_id": cust.id,
        "channel_id": chan.id,
        "shipping_fee": 10000.0,
        "shipping_address": "123 Test St",
        "items": [{"sku_code": "SKU-CONC-1", "quantity": 1}],
    }

    # Execute 10 parallel requests
    def make_request():
        return client.post("/orders", json=payload)

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(make_request) for _ in range(10)]
        responses = [f.result() for f in futures]

    assert all(r.status_code == 201 for r in responses), f"Statuses: {[r.status_code for r in responses]}, Details: {[r.text for r in responses]}"
    order_numbers = [r.json()["order_number"] for r in responses]
    assert len(order_numbers) == 10
    assert len(set(order_numbers)) == 10


def test_concurrent_otp_token_consumption(client, db, monkeypatch):
    app.dependency_overrides[get_db] = thread_safe_get_db

    # Mock PIM API call
    def mock_call_api(url, method="GET", json=None):
        if "/api/products/by-sku/" in url:
            return {
                "sku_code": url.split("/")[-1],
                "product_name": "Storefront Product",
                "variant_name": "Default",
                "price": 50000.0,
                "image_url": "http://example.com/img.jpg",
            }
        return {}

    monkeypatch.setattr("routers.orders._call_api", mock_call_api)

    # Setup customer and storefront channel
    phone = "0977777777"
    cust = models.Customer(name="Storefront Customer", phone=phone)
    chan = db.query(models.Channel).filter(models.Channel.code == "STOREFRONT").first()
    if not chan:
        chan = models.Channel(code="STOREFRONT", name="Storefront", is_active=True)
        db.add(chan)
    db.add(cust)
    db.commit()
    db.refresh(cust)

    # Create a verified OTP verification token
    token = "test-token-conc-12345"
    otp_record = models.OtpVerification(
        phone_number=phone,
        otp_hash="dummy_hash",
        expires_at=utcnow() + timedelta(minutes=5),
        verified_at=utcnow(),
        verification_token=token,
        verification_expires_at=utcnow() + timedelta(minutes=15),
    )
    db.add(otp_record)
    db.commit()

    payload = {
        "customer_id": cust.id,
        "channel_id": chan.id,
        "shipping_fee": 5000.0,
        "shipping_address": "456 Storefront St",
        "verification_token": token,
        "items": [{"sku_code": "SKU-OTP-1", "quantity": 1}],
    }

    # Execute 2 concurrent order creations with the same token
    def make_request():
        return client.post("/orders", json=payload)

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(make_request) for _ in range(2)]
        responses = [f.result() for f in futures]

    status_codes = [r.status_code for r in responses]
    # Exactly one request should succeed (201) and one should be rejected (403)
    assert 201 in status_codes, f"Status codes: {status_codes}"
    assert 403 in status_codes, f"Status codes: {status_codes}"
    assert status_codes.count(201) == 1
    assert status_codes.count(403) == 1
