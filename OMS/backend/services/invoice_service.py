from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional, Dict, Any
import logging
from sqlalchemy.orm import Session

import models
from adapters.invoices.base import InvoiceProvider, InvoiceRequest, InvoiceResult
from adapters.invoices.vnpt import VNPTInvoiceProvider
from adapters.invoices.viettel import ViettelInvoiceProvider
from adapters.invoices.meinvoice import MeInvoiceProvider

logger = logging.getLogger("oms_backend")

INVOICE_PROVIDERS: Dict[str, InvoiceProvider] = {
    "VNPT": VNPTInvoiceProvider(),
    "VIETTEL": ViettelInvoiceProvider(),
    "MEINVOICE": MeInvoiceProvider(),
}


class InvoiceService:

    @staticmethod
    def get_provider(provider_code: str = "VNPT") -> InvoiceProvider:
        return INVOICE_PROVIDERS.get(provider_code.upper(), INVOICE_PROVIDERS["VNPT"])

    @staticmethod
    async def issue_invoice_for_order(
        db: Session,
        order_id: int,
        provider_code: str = "VNPT",
    ) -> models.Invoice:
        order = db.query(models.Order).filter(models.Order.id == order_id).first()
        if not order:
            raise ValueError(f"Order {order_id} not found")

        customer = order.customer
        customer_name = customer.name if customer else "Customer"
        customer_address = order.shipping_address or (customer.address if customer else "")

        items_data = [
            {
                "sku_code": item.sku_code,
                "product_name": item.product_name,
                "quantity": item.quantity,
                "unit_price": float(item.unit_price),
                "subtotal": float(item.subtotal),
            }
            for item in order.items
        ]

        req = InvoiceRequest(
            order_id=order.id,
            customer_name=customer_name,
            customer_tax_code=None,
            customer_address=customer_address,
            items=items_data,
            total_amount=order.total_amount,
            vat_amount=Decimal("0"),
        )

        provider = InvoiceService.get_provider(provider_code)
        result: InvoiceResult = await provider.issue_invoice(req)

        invoice = models.Invoice(
            order_id=order.id,
            provider=result.provider,
            invoice_number=result.invoice_number,
            invoice_date=result.invoice_date,
            status=result.status,
            pdf_url=result.pdf_url,
            raw_response=result.raw_response,
        )
        db.add(invoice)
        db.commit()
        db.refresh(invoice)

        return invoice

    @staticmethod
    async def batch_issue_invoices(
        db: Session,
        order_ids: List[int],
        provider_code: str = "VNPT",
    ) -> List[models.Invoice]:
        invoices = []
        for oid in order_ids:
            try:
                inv = await InvoiceService.issue_invoice_for_order(db, oid, provider_code)
                invoices.append(inv)
            except Exception as e:
                logger.error(f"Failed to issue invoice for order {oid}: {e}")
        return invoices

    @staticmethod
    async def cancel_invoice(
        db: Session,
        invoice_id: int,
        reason: str,
    ) -> models.Invoice:
        invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
        if not invoice:
            raise ValueError(f"Invoice {invoice_id} not found")

        provider = InvoiceService.get_provider(invoice.provider)
        cancelled = await provider.cancel_invoice(invoice.invoice_number, reason)
        if cancelled:
            invoice.status = "CANCELLED"
            db.commit()
            db.refresh(invoice)

        return invoice
