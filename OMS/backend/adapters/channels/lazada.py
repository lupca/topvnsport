import os
import hashlib
import hmac
from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any
import logging

from adapters.channels.base import ChannelAdapter, NormalizedOrder

logger = logging.getLogger("oms_backend")


class LazadaAdapter(ChannelAdapter):
    """Adapter cho kênh bán Lazada"""

    def __init__(self, app_key: Optional[str] = None, app_secret: Optional[str] = None):
        self.app_key = app_key or os.getenv("LAZADA_APP_KEY", "")
        self.app_secret = app_secret or os.getenv("LAZADA_APP_SECRET", "")

    @property
    def channel_code(self) -> str:
        return "LAZADA"

    async def verify_signature(self, payload: bytes, signature: str) -> bool:
        if not self.app_secret:
            return True
        expected = hmac.new(
            self.app_secret.encode("utf-8"),
            payload,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature.lower())

    async def fetch_orders(
        self,
        from_date: datetime,
        to_date: datetime,
    ) -> List[NormalizedOrder]:
        logger.info(f"LazadaAdapter.fetch_orders from {from_date} to {to_date}")
        return []

    async def handle_webhook(
        self,
        payload: Dict[str, Any],
    ) -> Optional[NormalizedOrder]:
        logger.info(f"LazadaAdapter.handle_webhook payload: {payload}")
        order_data = payload.get("data") or payload.get("order") or payload
        order_id = order_data.get("order_id") or order_data.get("id") or order_data.get("channel_order_id")
        if not order_id:
            return None

        address_billing = order_data.get("address_billing", {})
        items = []
        for item in order_data.get("items", []):
            items.append({
                "sku_code": item.get("sku") or item.get("shop_sku") or "LAZADA-DEFAULT-SKU",
                "product_name": item.get("name", "Lazada Product"),
                "variant_name": item.get("variation"),
                "quantity": item.get("item_price", 1),
                "unit_price": Decimal(str(item.get("item_price", 0))),
                "subtotal": Decimal(str(item.get("item_price", 0))),
            })

        total = Decimal(str(order_data.get("price") or 0))

        return NormalizedOrder(
            channel_code=self.channel_code,
            channel_order_id=str(order_id),
            customer_name=address_billing.get("first_name", "Lazada Customer"),
            customer_phone=address_billing.get("phone") or "0900000000",
            shipping_address=address_billing.get("address1") or "Lazada Address",
            items=items,
            total_amount=total,
            shipping_fee=Decimal(str(order_data.get("shipping_fee") or 0)),
            channel_metadata=order_data,
        )

    async def sync_order_status(
        self,
        channel_order_id: str,
        status: str,
    ) -> bool:
        logger.info(f"LazadaAdapter.sync_order_status for {channel_order_id} -> {status}")
        return True

    async def get_order_detail(
        self,
        channel_order_id: str,
    ) -> Optional[NormalizedOrder]:
        logger.info(f"LazadaAdapter.get_order_detail for {channel_order_id}")
        return None
