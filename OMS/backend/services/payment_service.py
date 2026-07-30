from datetime import datetime, timezone
from typing import Optional
import logging
import re
from sqlalchemy.orm import Session

import models
from utils.tenant_context import require_tenant_context
from adapters.payments.base import PaymentTransaction
from events.dispatcher import EventDispatcher, OrderEvent

logger = logging.getLogger("oms_backend")


class PaymentService:

    @staticmethod
    def match_order_for_transaction(db: Session, txn: PaymentTransaction) -> Optional[models.Order]:
        """Tìm đơn hàng phù hợp với giao dịch thanh toán"""
        # 1. Check exact match by sepay_order_id or order_number in content
        if txn.content:
            order = db.query(models.Order).filter(models.Order.order_number == txn.content.strip()).first()
            if order:
                return order

            order = db.query(models.Order).filter(models.Order.sepay_order_id == txn.content.strip()).first()
            if order:
                return order

            # 2. Extract order pattern from content string
            match = re.search(r"(ORD-[A-Z0-9-]+|OMS-\d+|\b[A-Z0-9]{6,20}\b)", txn.content, re.IGNORECASE)
            if match:
                extracted = match.group(1).upper()
                order = db.query(models.Order).filter(models.Order.order_number == extracted).first()
                if order:
                    return order

        # 3. Check provider_txn_id matching sepay_order_id
        if txn.provider_txn_id:
            order = db.query(models.Order).filter(models.Order.sepay_order_id == txn.provider_txn_id).first()
            if order:
                return order

        return None

    @staticmethod
    async def process_payment_transaction(
        db: Session,
        txn: PaymentTransaction,
        created_by: str = "payment_webhook",
    ) -> Optional[models.Payment]:
        """Xử lý giao dịch thanh toán: ghi sổ Payment, PaymentLedger và cập nhật Order status"""
        # Idempotency check on provider + provider_txn_id
        existing_payment = (
            db.query(models.Payment)
            .filter(
                models.Payment.provider == txn.provider,
                models.Payment.provider_txn_id == txn.provider_txn_id,
            )
            .first()
        )
        if existing_payment:
            logger.info(f"Payment already processed for {txn.provider} {txn.provider_txn_id}")
            return existing_payment

        context = require_tenant_context()
        order = PaymentService.match_order_for_transaction(db, txn)
        if not order:
            logger.warning(f"Could not match order for transaction {txn.provider_txn_id} content: {txn.content}")
            return None

        # Create Payment record
        payment = models.Payment(
            tenant_id=context.tenant_id,
            seller_id=context.seller_id,
            order_id=order.id,
            provider=txn.provider,
            provider_txn_id=txn.provider_txn_id,
            amount=txn.amount,
            status="SUCCESS",
            reconciled_at=datetime.now(timezone.utc).replace(tzinfo=None),
            raw_data=txn.raw_data,
        )
        db.add(payment)
        db.flush()

        # Double-entry ledger record
        ledger_entry = models.PaymentLedger(
            payment_id=payment.id,
            entry_type="CREDIT",
            amount=txn.amount,
            running_balance=txn.amount,
            metadata_json={"content": txn.content, "order_number": order.order_number},
        )
        db.add(ledger_entry)

        # Update order payment status
        order.payment_status = "PAID"
        payment_method = txn.provider
        if txn.raw_data and isinstance(txn.raw_data, dict):
            transaction_data = txn.raw_data.get("transaction", {})
            if isinstance(transaction_data, dict) and transaction_data.get("payment_method"):
                payment_method = transaction_data["payment_method"]
        order.payment_method = str(payment_method)
        if txn.provider_txn_id:
            order.sepay_order_id = str(txn.provider_txn_id)
        order.paid_at = datetime.now(timezone.utc).replace(tzinfo=None)

        db.commit()
        db.refresh(payment)

        # Dispatch event
        await EventDispatcher.dispatch(
            OrderEvent.PAID,
            {
                "order_id": order.id,
                "order_number": order.order_number,
                "payment_id": payment.id,
                "payment_method": txn.provider,
                "amount": float(txn.amount),
            },
            db=db,
            created_by=created_by,
        )

        return payment
