from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any
import logging

from adapters.channels.base import ChannelAdapter, NormalizedOrder

logger = logging.getLogger("oms_backend")


class WebAdapter(ChannelAdapter):
    """Adapter cho kênh bán Web Storefront / Direct Order"""

    @property
    def channel_code(self) -> str:
        return "WEB"

    async def fetch_orders(
        self,
        from_date: datetime,
        to_date: datetime,
    ) -> List[NormalizedOrder]:
        return []

    async def handle_webhook(
        self,
        payload: Dict[str, Any],
    ) -> Optional[NormalizedOrder]:
        order_id = payload.get("order_number") or payload.get("channel_order_id")
        if not order_id:
            return None

        items = []
        for item in payload.get("items", []):
            items.append({
                "sku_code": item.get("sku_code"),
                "product_name": item.get("product_name"),
                "variant_name": item.get("variant_name"),
                "quantity": item.get("quantity", 1),
                "unit_price": Decimal(str(item.get("unit_price", 0))),
                "subtotal": Decimal(str(item.get("subtotal", 0))),
            })

        return NormalizedOrder(
            channel_code=self.channel_code,
            channel_order_id=str(order_id),
            customer_name=payload.get("customer_name", "Web Customer"),
            customer_phone=payload.get("customer_phone", "0900000000"),
            shipping_address=payload.get("shipping_address", ""),
            items=items,
            total_amount=Decimal(str(payload.get("total_amount", 0))),
            shipping_fee=Decimal(str(payload.get("shipping_fee", 0))),
            channel_metadata=payload,
        )

    async def sync_order_status(
        self,
        channel_order_id: str,
        status: str,
    ) -> bool:
        return True

    async def get_order_detail(
        self,
        channel_order_id: str,
    ) -> Optional[NormalizedOrder]:
        return None
