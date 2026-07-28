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
