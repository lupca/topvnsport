from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any
import logging

from adapters.channels.base import ChannelAdapter, NormalizedOrder

logger = logging.getLogger("oms_backend")


class ShopeeAdapter(ChannelAdapter):
    """Adapter cho kênh bán Shopee"""

    def __init__(self, partner_id: Optional[str] = None, partner_key: Optional[str] = None):
        self.partner_id = partner_id
        self.partner_key = partner_key

    @property
    def channel_code(self) -> str:
        return "SHOPEE"

    async def fetch_orders(
        self,
        from_date: datetime,
        to_date: datetime,
    ) -> List[NormalizedOrder]:
        logger.info(f"ShopeeAdapter.fetch_orders from {from_date} to {to_date}")
        return []

    async def handle_webhook(
        self,
        payload: Dict[str, Any],
    ) -> Optional[NormalizedOrder]:
        logger.info(f"ShopeeAdapter.handle_webhook payload: {payload}")
        order_data = payload.get("data") or payload.get("order") or payload
        order_sn = order_data.get("ordersn") or order_data.get("order_sn") or order_data.get("channel_order_id")
        if not order_sn:
            return None

        buyer_user = order_data.get("buyer_user", {})
        recipient = order_data.get("recipient_address", {})

        items = []
        for item in order_data.get("item_list", []):
            items.append({
                "sku_code": item.get("item_sku") or item.get("model_sku") or "SHOPEE-DEFAULT-SKU",
                "product_name": item.get("item_name", "Shopee Product"),
                "variant_name": item.get("model_name"),
                "quantity": item.get("model_quantity_purchased", 1),
                "unit_price": Decimal(str(item.get("model_discounted_price", 0))),
                "subtotal": Decimal(str(item.get("model_discounted_price", 0))) * item.get("model_quantity_purchased", 1),
            })

        total = Decimal(str(order_data.get("total_amount") or order_data.get("escrow_amount") or 0))
        fee = Decimal(str(order_data.get("actual_shipping_fee") or 0))

        return NormalizedOrder(
            channel_code=self.channel_code,
            channel_order_id=str(order_sn),
            customer_name=recipient.get("name") or buyer_user.get("buyer_username") or "Shopee Customer",
            customer_phone=recipient.get("phone") or "0900000000",
            shipping_address=recipient.get("full_address") or "Shopee Address",
            items=items,
            total_amount=total,
            shipping_fee=fee,
            channel_metadata=order_data,
        )

    async def sync_order_status(
        self,
        channel_order_id: str,
        status: str,
    ) -> bool:
        logger.info(f"ShopeeAdapter.sync_order_status for {channel_order_id} -> {status}")
        return True

    async def get_order_detail(
        self,
        channel_order_id: str,
    ) -> Optional[NormalizedOrder]:
        logger.info(f"ShopeeAdapter.get_order_detail for {channel_order_id}")
        return None
