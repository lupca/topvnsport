from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any


@dataclass
class PaymentTransaction:
    """Giao dịch thanh toán chuẩn hóa"""
    provider: str
    provider_txn_id: str
    amount: Decimal
    content: str
    transaction_date: datetime
    raw_data: Dict[str, Any] = field(default_factory=dict)


class PaymentProvider(ABC):
    """Base interface cho mọi payment provider"""

    @property
    @abstractmethod
    def provider_code(self) -> str:
        """SEPAY, VNPAY, MOMO, COD"""
        pass

    @abstractmethod
    async def handle_webhook(
        self,
        payload: Dict[str, Any],
        signature: str = "",
    ) -> Optional[PaymentTransaction]:
        """Xử lý IPN webhook"""
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
    async def query_transaction(
        self,
        txn_id: str,
    ) -> Optional[PaymentTransaction]:
        """Truy vấn giao dịch theo ID"""
        pass

    @abstractmethod
    async def list_transactions(
        self,
        from_date: datetime,
        to_date: datetime,
    ) -> List[PaymentTransaction]:
        """Lấy danh sách giao dịch để đối soát"""
        pass
