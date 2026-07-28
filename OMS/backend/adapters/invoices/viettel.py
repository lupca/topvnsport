from datetime import datetime, timezone
import logging
from typing import List
import uuid

from adapters.invoices.base import InvoiceProvider, InvoiceRequest, InvoiceResult

logger = logging.getLogger("oms_backend")


class ViettelInvoiceProvider(InvoiceProvider):
    """Adapter cho Viettel S-Invoice"""

    @property
    def provider_code(self) -> str:
        return "VIETTEL"

    async def issue_invoice(
        self,
        request: InvoiceRequest,
    ) -> InvoiceResult:
        logger.info(f"ViettelInvoiceProvider.issue_invoice for order {request.order_id}")
        inv_num = f"VTL-{request.order_id}-{uuid.uuid4().hex[:6].upper()}"
        return InvoiceResult(
            provider=self.provider_code,
            invoice_number=inv_num,
            invoice_date=datetime.now(timezone.utc).replace(tzinfo=None),
            pdf_url=f"https://sinvoice.viettel.vn/download/{inv_num}.pdf",
            status="ISSUED",
            order_id=request.order_id,
            raw_response={"status": "OK", "invoice_number": inv_num},
        )

    async def batch_issue(
        self,
        requests: List[InvoiceRequest],
    ) -> List[InvoiceResult]:
        results = []
        for req in requests:
            results.append(await self.issue_invoice(req))
        return results

    async def cancel_invoice(
        self,
        invoice_number: str,
        reason: str,
    ) -> bool:
        logger.info(f"ViettelInvoiceProvider.cancel_invoice {invoice_number}: {reason}")
        return True

    async def get_invoice_pdf(
        self,
        invoice_number: str,
    ) -> bytes:
        return f"%PDF-1.4 Mock Viettel PDF for {invoice_number}".encode("utf-8")
