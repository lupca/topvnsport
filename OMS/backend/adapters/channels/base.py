from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any


@dataclass
class NormalizedOrder:
    """Chuẩn hóa đơn hàng từ mọi kênh"""
    channel_code: str
    channel_order_id: str
    customer_name: str
    customer_phone: str
    shipping_address: str
    items: List[Dict[str, Any]]
    total_amount: Decimal
    shipping_fee: Decimal = Decimal("0")
    customer_email: Optional[str] = None
    channel_metadata: Dict[str, Any] = field(default_factory=dict)
    # Finance fields (profit/loss). Adapters fill them only from data the
    # marketplace actually sent; otherwise they stay at the neutral default.
    discount_amount: Decimal = Decimal("0")        # seller-funded voucher/discount
    seller_shipping_cost: Decimal = Decimal("0")   # shipping paid by the shop (incl. return)
    platform_fee: Optional[Decimal] = None         # actual marketplace fees; None = unknown


def sum_present_amounts(source: Optional[Dict[str, Any]], keys: List[str]) -> Optional[Decimal]:
    """Sum the numeric values of ``keys`` present in ``source``.

    Returns ``None`` when none of the keys is present so callers can tell
    "marketplace did not send it" apart from "zero".
    """
    if not isinstance(source, dict):
        return None
    total = None
    for key in keys:
        value = source.get(key)
        if value is None or value == "":
            continue
        try:
            amount = abs(Decimal(str(value)))
        except (ArithmeticError, ValueError):
            continue
        total = (total or Decimal("0")) + amount
    return total


class ChannelAdapter(ABC):
    """Base interface cho mọi channel adapter"""

    @property
    @abstractmethod
    def channel_code(self) -> str:
        """SHOPEE, TIKTOK, LAZADA, WEB, POS"""
        pass

    @abstractmethod
    async def fetch_orders(
        self,
        from_date: datetime,
        to_date: datetime,
    ) -> List[NormalizedOrder]:
        """Poll đơn hàng mới từ marketplace"""
        pass

    @abstractmethod
    async def handle_webhook(
        self,
        payload: Dict[str, Any],
    ) -> Optional[NormalizedOrder]:
        """Xử lý webhook từ marketplace"""
        pass

    @abstractmethod
    async def verify_signature(
        self,
        payload: bytes,
        signature: str,
    ) -> bool:
        """Verify webhook signature"""
        pass

    @abstractmethod
    async def sync_order_status(
        self,
        channel_order_id: str,
        status: str,
    ) -> bool:
        """Đồng bộ trạng thái ngược lại marketplace"""
        pass

    @abstractmethod
    async def get_order_detail(
        self,
        channel_order_id: str,
    ) -> Optional[NormalizedOrder]:
        """Lấy chi tiết 1 đơn hàng"""
        pass
