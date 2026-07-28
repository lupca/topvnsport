from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import hmac
import os
from typing import List, Optional, Dict, Any
import logging

from adapters.payments.base import PaymentProvider, PaymentTransaction

logger = logging.getLogger("oms_backend")


class VNPayAdapter(PaymentProvider):
    """Adapter cho VNPay Payment Gateway"""

    def __init__(self, tmn_code: Optional[str] = None, hash_secret: Optional[str] = None):
        self.tmn_code = tmn_code or os.getenv("VNPAY_TMN_CODE", "")
        self.hash_secret = hash_secret or os.getenv("VNPAY_HASH_SECRET", "")

    @property
    def provider_code(self) -> str:
        return "VNPAY"

    async def verify_signature(self, payload: bytes, signature: str) -> bool:
        if not self.hash_secret:
            return True
        expected = hmac.new(
            self.hash_secret.encode("utf-8"),
            payload,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature.lower())

    async def handle_webhook(
        self,
        payload: Dict[str, Any],
        signature: str = "",
    ) -> Optional[PaymentTransaction]:
        logger.info(f"VNPayAdapter.handle_webhook payload: {payload}")
        vnp_response_code = payload.get("vnp_ResponseCode")
        if vnp_response_code != "00":
            logger.warning(f"VNPay transaction failed with code: {vnp_response_code}")
            return None

        txn_id = payload.get("vnp_TransactionNo") or payload.get("vnp_TxnRef")
        amount_raw = payload.get("vnp_Amount", 0)
        # VNPay amount is multiplied by 100
        amount = Decimal(str(amount_raw)) / Decimal("100") if amount_raw else Decimal("0")
        content = payload.get("vnp_OrderInfo") or payload.get("vnp_TxnRef") or ""

        return PaymentTransaction(
            provider=self.provider_code,
            provider_txn_id=str(txn_id),
            amount=amount,
            content=str(content),
            transaction_date=datetime.now(timezone.utc).replace(tzinfo=None),
            raw_data=payload,
        )

    async def query_transaction(self, txn_id: str) -> Optional[PaymentTransaction]:
        logger.info(f"VNPayAdapter.query_transaction for {txn_id}")
        return None

    async def list_transactions(
        self,
        from_date: datetime,
        to_date: datetime,
    ) -> List[PaymentTransaction]:
        logger.info(f"VNPayAdapter.list_transactions from {from_date} to {to_date}")
        return []
