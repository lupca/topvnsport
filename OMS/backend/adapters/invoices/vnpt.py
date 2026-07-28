from datetime import datetime, timezone
import logging
from typing import List, Optional
import uuid

from adapters.invoices.base import InvoiceProvider, InvoiceRequest, InvoiceResult

logger = logging.getLogger("oms_backend")


class VNPTInvoiceProvider(InvoiceProvider):
    """Adapter cho VNPT e-Invoice"""

    @property
    def provider_code(self) -> str:
        return "VNPT"

    async def issue_invoice(
        self,
        request: InvoiceRequest,
    ) -> InvoiceResult:
        logger.info(f"VNPTInvoiceProvider.issue_invoice for order {request.order_id}")
        inv_num = f"VNPT-{request.order_id}-{uuid.uuid4().hex[:6].upper()}"
        return InvoiceResult(
            provider=self.provider_code,
            invoice_number=inv_num,
            invoice_date=datetime.now(timezone.utc).replace(tzinfo=None),
            pdf_url=f"https://einvoice.vnpt.vn/download/{inv_num}.pdf",
            status="ISSUED",
            order_id=request.order_id,
            raw_response={"status": "OK", "invoice_number": inv_num},
        )

    async def batch_issue(
        self,
        requests: List[InvoiceRequest],
    ) -> List[InvoiceResult]:
        logger.info(f"VNPTInvoiceProvider.batch_issue {len(requests)} requests")
        results = []
        for req in requests:
            res = await self.issue_invoice(req)
            results.append(res)
        return results

    async def cancel_invoice(
        self,
        invoice_number: str,
        reason: str,
    ) -> bool:
        logger.info(f"VNPTInvoiceProvider.cancel_invoice {invoice_number}: {reason}")
        return True

    async def get_invoice_pdf(
        self,
        invoice_number: str,
    ) -> bytes:
        logger.info(f"VNPTInvoiceProvider.get_invoice_pdf for {invoice_number}")
        return f"%PDF-1.4 Mock PDF for {invoice_number}".encode("utf-8")
