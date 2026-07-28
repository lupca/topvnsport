from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import hmac
import os
from typing import List, Optional, Dict, Any
import logging

from adapters.payments.base import PaymentProvider, PaymentTransaction

logger = logging.getLogger("oms_backend")


class MoMoAdapter(PaymentProvider):
    """Adapter cho MoMo Payment Gateway"""

    def __init__(self, partner_code: Optional[str] = None, secret_key: Optional[str] = None):
        self.partner_code = partner_code or os.getenv("MOMO_PARTNER_CODE", "")
        self.secret_key = secret_key or os.getenv("MOMO_SECRET_KEY", "")

    @property
    def provider_code(self) -> str:
        return "MOMO"

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
        logger.info(f"MoMoAdapter.handle_webhook payload: {payload}")
        result_code = payload.get("resultCode")
        if result_code != 0:
            logger.warning(f"MoMo transaction failed with resultCode: {result_code}")
            return None

        txn_id = payload.get("transId") or payload.get("orderId")
        amount = Decimal(str(payload.get("amount", 0)))
        content = payload.get("orderInfo") or payload.get("orderId") or ""

        return PaymentTransaction(
            provider=self.provider_code,
            provider_txn_id=str(txn_id),
            amount=amount,
            content=str(content),
            transaction_date=datetime.now(timezone.utc).replace(tzinfo=None),
            raw_data=payload,
        )

    async def query_transaction(self, txn_id: str) -> Optional[PaymentTransaction]:
        logger.info(f"MoMoAdapter.query_transaction for {txn_id}")
        return None

    async def list_transactions(
        self,
        from_date: datetime,
        to_date: datetime,
    ) -> List[PaymentTransaction]:
        logger.info(f"MoMoAdapter.list_transactions from {from_date} to {to_date}")
        return []
