from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any


@dataclass
class InvoiceRequest:
    """Yêu cầu xuất hóa đơn"""
    order_id: int
    customer_name: str
    customer_tax_code: Optional[str]
    customer_address: str
    items: List[Dict[str, Any]]
    total_amount: Decimal
    vat_amount: Decimal = Decimal("0")


@dataclass
class InvoiceResult:
    """Kết quả xuất hóa đơn"""
    provider: str
    invoice_number: str
    invoice_date: datetime
    pdf_url: str
    status: str
    order_id: int = 0
    raw_response: Dict[str, Any] = field(default_factory=dict)


class InvoiceProvider(ABC):
    """Base interface cho mọi e-invoice provider"""

    @property
    @abstractmethod
    def provider_code(self) -> str:
        """VNPT, VIETTEL, MEINVOICE"""
        pass

    @abstractmethod
    async def issue_invoice(
        self,
        request: InvoiceRequest,
    ) -> InvoiceResult:
        """Xuất 1 hóa đơn"""
        pass

    @abstractmethod
    async def batch_issue(
        self,
        requests: List[InvoiceRequest],
    ) -> List[InvoiceResult]:
        """Xuất hàng loạt hóa đơn"""
        pass

    @abstractmethod
    async def cancel_invoice(
        self,
        invoice_number: str,
        reason: str,
    ) -> bool:
        """Hủy hóa đơn"""
        pass

    @abstractmethod
    async def get_invoice_pdf(
        self,
        invoice_number: str,
    ) -> bytes:
        """Download PDF hóa đơn"""
        pass
