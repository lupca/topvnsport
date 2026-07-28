from unittest.mock import MagicMock
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient

from main import app
import models
from database import get_db


def test_sepay_webhook_success(client, db):
    # Create sample customer and channel
    customer = models.Customer(name="Test User", phone="0987654321")
    channel = models.Channel(code="STOREFRONT_TEST_IPN", name="Storefront Test IPN")
    db.add(customer)
    db.add(channel)
    db.commit()

    order = models.Order(
        order_number="ORD-SEPAY-001",
        customer_id=customer.id,
        channel_id=channel.id,
        status="NEW",
        total_amount=500000,
        shipping_fee=30000,
        shipping_address="123 Street",
        payment_status="PENDING",
    )
    db.add(order)
    db.commit()

    ipn_payload = {
        "notification_type": "PAYMENT_SUCCESS",
        "order": {
            "order_invoice_number": "ORD-SEPAY-001",
            "order_amount": 530000,
            "order_id": "SP-ORDER-12345"
        },
        "transaction": {
            "transaction_status": "APPROVED",
            "payment_method": "BANK_TRANSFER",
            "transaction_id": "TXN-999"
        }
    }

    response = client.post("/webhooks/sepay", json=ipn_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["order_number"] == "ORD-SEPAY-001"

    # Verify DB update
    updated_order = db.query(models.Order).filter(models.Order.order_number == "ORD-SEPAY-001").first()
    assert updated_order.payment_status == "PAID"
    assert updated_order.payment_method == "BANK_TRANSFER"
    assert updated_order.sepay_order_id == "SP-ORDER-12345"
    assert updated_order.paid_at is not None


def test_sepay_webhook_idempotency(client, db):
    customer = models.Customer(name="Test User 2", phone="0987654322")
    channel = models.Channel(code="STOREFRONT_TEST_IPN2", name="Storefront Test IPN 2")
    db.add(customer)
    db.add(channel)
    db.commit()

    order = models.Order(
        order_number="ORD-SEPAY-002",
        customer_id=customer.id,
        channel_id=channel.id,
        status="NEW",
        total_amount=100000,
        shipping_fee=30000,
        shipping_address="456 Street",
        payment_status="PAID",
    )
    db.add(order)
    db.commit()

    ipn_payload = {
        "notification_type": "PAYMENT_SUCCESS",
        "order": {
            "order_invoice_number": "ORD-SEPAY-002",
            "order_amount": 130000,
        },
        "transaction": {
            "transaction_status": "APPROVED",
        }
    }

    response = client.post("/webhooks/sepay", json=ipn_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["message"] == "Already paid"
