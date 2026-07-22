import pytest
from datetime import datetime, timezone, timedelta
from decimal import Decimal
import sys
import os

# Ensure backend modules can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../OMS/backend')))

from fastapi.testclient import TestClient
from main import app
from database import Base, engine, SessionLocal
import models

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    # Ensure test promotion is clean
    db.query(models.PromotionUsage).delete()
    db.query(models.Promotion).delete()
    db.commit()
    yield
    db.close()

def test_promotion_crud():
    now = datetime.now(timezone.utc)
    starts = (now - timedelta(days=1)).isoformat()
    expires = (now + timedelta(days=7)).isoformat()

    # 1. Create Promotion
    payload = {
        "code": "TESTPROMO30",
        "name": "Giảm 30% Đơn Đầu",
        "description": "Ưu đãi chào mừng",
        "discount_type": "PERCENTAGE",
        "discount_value": 30.0,
        "min_order_value": 100000.0,
        "max_discount": 300000.0,
        "usage_limit": 10,
        "starts_at": starts,
        "expires_at": expires,
        "is_active": True
    }
    response = client.post("/promotions", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["code"] == "TESTPROMO30"
    promo_id = data["id"]

    # 2. Get Promotion
    response = client.get(f"/promotions/{promo_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Giảm 30% Đơn Đầu"

    # 3. List Promotions
    response = client.get("/promotions")
    assert response.status_code == 200
    assert len(response.json()) >= 1

    # 4. List Active Promotions
    response = client.get("/public/promotions/active")
    assert response.status_code == 200
    assert any(p["code"] == "TESTPROMO30" for p in response.json())

def test_promotion_validation():
    # Valid code with subtotal >= min_order_value
    val_res = client.post("/public/promotions/validate", json={"code": "TESTPROMO30", "order_subtotal": 500000.0})
    assert val_res.status_code == 200
    data = val_res.json()
    assert data["valid"] is True
    # 30% of 500,000 is 150,000 <= max_discount (300,000)
    assert data["discount_amount"] == 150000.0

    # Max discount cap check (30% of 2,000,000 = 600,000 -> capped at 300,000)
    val_res_cap = client.post("/public/promotions/validate", json={"code": "TESTPROMO30", "order_subtotal": 2000000.0})
    assert val_res_cap.status_code == 200
    assert val_res_cap.json()["discount_amount"] == 300000.0

    # Min order value failed
    val_res_fail = client.post("/public/promotions/validate", json={"code": "TESTPROMO30", "order_subtotal": 50000.0})
    assert val_res_fail.status_code == 200
    assert val_res_fail.json()["valid"] is False
    assert "tối thiểu" in val_res_fail.json()["error_message"]

    # Invalid code
    val_res_invalid = client.post("/public/promotions/validate", json={"code": "NONEXISTENT", "order_subtotal": 500000.0})
    assert val_res_invalid.status_code == 200
    assert val_res_invalid.json()["valid"] is False
