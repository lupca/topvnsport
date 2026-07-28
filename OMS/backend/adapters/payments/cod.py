from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional, Dict, Any
import logging

from adapters.payments.base import PaymentProvider, PaymentTransaction

logger = logging.getLogger("oms_backend")


class CODAdapter(PaymentProvider):
    """Adapter cho Cash On Delivery (COD)"""

    @property
    def provider_code(self) -> str:
        return "COD"

    async def verify_signature(self, payload: bytes, signature: str) -> bool:
        return True

    async def handle_webhook(
        self,
        payload: Dict[str, Any],
        signature: str = "",
    ) -> Optional[PaymentTransaction]:
        txn_id = payload.get("tracking_number") or payload.get("order_number") or payload.get("txn_id")
        amount = Decimal(str(payload.get("amount", 0)))
        content = payload.get("note") or f"COD Payment for {payload.get('order_number')}"

        return PaymentTransaction(
            provider=self.provider_code,
            provider_txn_id=str(txn_id or f"COD-{datetime.now(timezone.utc).timestamp()}"),
            amount=amount,
            content=str(content),
            transaction_date=datetime.now(timezone.utc).replace(tzinfo=None),
            raw_data=payload,
        )

    async def query_transaction(self, txn_id: str) -> Optional[PaymentTransaction]:
        return None

    async def list_transactions(
        self,
        from_date: datetime,
        to_date: datetime,
    ) -> List[PaymentTransaction]:
        return []
