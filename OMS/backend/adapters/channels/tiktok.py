from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any
import logging

from adapters.channels.base import ChannelAdapter, NormalizedOrder

logger = logging.getLogger("oms_backend")


class TikTokAdapter(ChannelAdapter):
    """Adapter cho kênh bán TikTok Shop"""

    def __init__(self, app_key: Optional[str] = None, app_secret: Optional[str] = None):
        self.app_key = app_key
        self.app_secret = app_secret

    @property
    def channel_code(self) -> str:
        return "TIKTOK"

    async def fetch_orders(
        self,
        from_date: datetime,
        to_date: datetime,
    ) -> List[NormalizedOrder]:
        logger.info(f"TikTokAdapter.fetch_orders from {from_date} to {to_date}")
        return []

    async def handle_webhook(
        self,
        payload: Dict[str, Any],
    ) -> Optional[NormalizedOrder]:
        logger.info(f"TikTokAdapter.handle_webhook payload: {payload}")
        order_data = payload.get("data") or payload.get("order") or payload
        order_id = order_data.get("order_id") or order_data.get("id") or order_data.get("channel_order_id")
        if not order_id:
            return None

        recipient = order_data.get("recipient_address", {})
        items = []
        for item in order_data.get("item_list", []):
            items.append({
                "sku_code": item.get("seller_sku") or item.get("sku_id") or "TIKTOK-DEFAULT-SKU",
                "product_name": item.get("product_name", "TikTok Product"),
                "variant_name": item.get("sku_name"),
                "quantity": item.get("quantity", 1),
                "unit_price": Decimal(str(item.get("sku_original_price", 0))),
                "subtotal": Decimal(str(item.get("sku_original_price", 0))) * item.get("quantity", 1),
            })

        payment_info = order_data.get("payment_info", {})
        total = Decimal(str(payment_info.get("total_amount") or order_data.get("total_amount") or 0))

        return NormalizedOrder(
            channel_code=self.channel_code,
            channel_order_id=str(order_id),
            customer_name=recipient.get("full_name") or "TikTok Customer",
            customer_phone=recipient.get("phone_number") or "0900000000",
            shipping_address=recipient.get("full_address") or "TikTok Address",
            items=items,
            total_amount=total,
            shipping_fee=Decimal(str(payment_info.get("shipping_fee") or 0)),
            channel_metadata=order_data,
        )

    async def sync_order_status(
        self,
        channel_order_id: str,
        status: str,
    ) -> bool:
        logger.info(f"TikTokAdapter.sync_order_status for {channel_order_id} -> {status}")
        return True

    async def get_order_detail(
        self,
        channel_order_id: str,
    ) -> Optional[NormalizedOrder]:
        logger.info(f"TikTokAdapter.get_order_detail for {channel_order_id}")
        return None
