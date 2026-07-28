import pytest
from datetime import datetime, timezone
from decimal import Decimal

import models
from adapters.channels.base import NormalizedOrder
from adapters.payments.base import PaymentTransaction
from services.order_service import OrderService
from services.payment_service import PaymentService
from services.invoice_service import InvoiceService
from services.reconciliation_service import ReconciliationService
from workers.invoice_batch_worker import process_invoice_queue


@pytest.mark.asyncio
async def test_full_multichannel_flow(db):
    # 1. Ingest order from Shopee
    norm_shopee = NormalizedOrder(
        channel_code="SHOPEE",
        channel_order_id="SP-999001",
        customer_name="Nguyen Van Shopee",
        customer_phone="0911222333",
        shipping_address="123 Shopee Street, Hanoi",
        items=[
            {
                "sku_code": "SPORT-SHIRT-01",
                "product_name": "Sport T-Shirt",
                "variant_name": "Size L",
                "quantity": 2,
                "unit_price": 200000,
                "subtotal": 400000,
            }
        ],
        total_amount=Decimal("400000"),
        shipping_fee=Decimal("30000"),
    )
    shopee_order = await OrderService.create_or_ingest_order(db, norm_shopee, created_by="shopee_sync")
    assert shopee_order.id is not None
    assert shopee_order.channel_code == "SHOPEE"
    assert shopee_order.payment_status == "PENDING"

    # Verify audit event recorded in order_events table
    events = db.query(models.OrderEvent).filter(models.OrderEvent.order_id == shopee_order.id).all()
    assert len(events) >= 1
    assert events[0].event_type == "order.created"

    # 2. Payment reconciliation via SePay
    txn = PaymentTransaction(
        provider="SEPAY",
        provider_txn_id="SEP-TXN-888",
        amount=Decimal("430000"),
        content=shopee_order.order_number,
        transaction_date=datetime.now(timezone.utc).replace(tzinfo=None),
        raw_data={"gateway": "SePay QR"},
    )
    payment = await PaymentService.process_payment_transaction(db, txn, created_by="sepay_webhook")
    assert payment is not None
    assert payment.order_id == shopee_order.id
    assert payment.status == "SUCCESS"

    # Check updated order and payment ledger
    db.refresh(shopee_order)
    assert shopee_order.payment_status == "PAID"
    assert len(payment.ledger_entries) == 1
    assert payment.ledger_entries[0].entry_type == "CREDIT"

    # 3. Transition order status to COMPLETED
    completed_order = await OrderService.update_order_status(db, shopee_order.id, "COMPLETED", created_by="admin")
    assert completed_order.status == "COMPLETED"

    # 4. Batch issue e-invoices
    invoices = await process_invoice_queue(db, provider_code="VNPT")
    assert len(invoices) >= 1
    assert invoices[0].order_id == shopee_order.id
    assert invoices[0].provider == "VNPT"
    assert invoices[0].status == "ISSUED"

    # 5. Reconciliation Report
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    report = await ReconciliationService.reconcile_payments(
        db, from_date=datetime(2020, 1, 1), to_date=now
    )
    assert report["total_payments"] >= 1
    assert report["total_matched"] >= 1
