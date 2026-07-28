from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import hmac
import os
import re
from typing import List, Optional, Dict, Any
import logging

from adapters.payments.base import PaymentProvider, PaymentTransaction

logger = logging.getLogger("oms_backend")


from sqlalchemy.orm import Session


class SePayAdapter(PaymentProvider):
    """Adapter cho cổng thanh toán / ngân hàng SePay"""

    def __init__(
        self,
        merchant_id: Optional[str] = None,
        secret_key: Optional[str] = None,
        db: Optional[Session] = None,
    ):
        if db:
            from services.config_service import get_sepay_config
            config = get_sepay_config(db)
            self.merchant_id = merchant_id or config["merchant_id"]
            self.secret_key = secret_key or config["secret_key"]
        else:
            self.merchant_id = merchant_id or os.getenv("SEPAY_MERCHANT_ID", "")
            self.secret_key = secret_key or os.getenv("SEPAY_SECRET_KEY", "")

    @property
    def provider_code(self) -> str:
        return "SEPAY"

    def match_order_number(self, content: str) -> Optional[str]:
        """Trích xuất mã đơn hàng từ nội dung chuyển khoản"""
        if not content:
            return None
        # Match explicit prefix like ORD-1234, OMS-001, ORD-20260728-0001 etc.
        match = re.search(r"(ORD-[\w-]+|OMS-[\w-]+|\b[A-Z0-9]{6,20}\b)", content, re.IGNORECASE)
        if match:
            return match.group(1).upper()
        return None

    async def verify_signature(self, payload: bytes, signature: str) -> bool:
        if not self.secret_key:
            return True
        expected = hmac.new(
            self.secret_key.encode("utf-8"),
            payload,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature.lower())

    async def handle_webhook(
        self,
        payload: Dict[str, Any],
        signature: str = "",
    ) -> Optional[PaymentTransaction]:
        logger.info(f"SePayAdapter.handle_webhook payload: {payload}")
        notification_type = payload.get("notification_type")
        order_data = payload.get("order", {})
        transaction_data = payload.get("transaction", {})

        # Handle Gateway format or Bank Transfer format
        if notification_type in ("PAYMENT_SUCCESS", "ORDER_PAID") or transaction_data.get("transaction_status") == "APPROVED":
            txn_id = (
                order_data.get("order_id")
                or order_data.get("id")
                or transaction_data.get("transaction_id")
                or payload.get("id")
                or payload.get("referenceCode")
            )
            amount_val = order_data.get("order_amount") or transaction_data.get("amount") or payload.get("transferAmount") or 0
            content = (
                order_data.get("order_invoice_number")
                or order_data.get("order_description")
                or payload.get("content")
                or payload.get("description")
                or ""
            )
            return PaymentTransaction(
                provider=self.provider_code,
                provider_txn_id=str(txn_id or f"SEPAY-{datetime.now(timezone.utc).timestamp()}"),
                amount=Decimal(str(amount_val)),
                content=str(content),
                transaction_date=datetime.now(timezone.utc).replace(tzinfo=None),
                raw_data=payload,
            )

        # Handle simple bank transfer webhook format
        if "transferAmount" in payload or "accumulated" in payload or "content" in payload:
            txn_id = payload.get("id") or payload.get("referenceCode") or payload.get("code")
            amount_val = payload.get("transferAmount") or payload.get("amount") or 0
            content = payload.get("content") or payload.get("description") or ""
            return PaymentTransaction(
                provider=self.provider_code,
                provider_txn_id=str(txn_id or f"SEPAY-{datetime.now(timezone.utc).timestamp()}"),
                amount=Decimal(str(amount_val)),
                content=str(content),
                transaction_date=datetime.now(timezone.utc).replace(tzinfo=None),
                raw_data=payload,
            )

        return None

    async def query_transaction(self, txn_id: str) -> Optional[PaymentTransaction]:
        logger.info(f"SePayAdapter.query_transaction for {txn_id}")
        return None

    async def list_transactions(
        self,
        from_date: datetime,
        to_date: datetime,
    ) -> List[PaymentTransaction]:
        logger.info(f"SePayAdapter.list_transactions from {from_date} to {to_date}")
        return []
