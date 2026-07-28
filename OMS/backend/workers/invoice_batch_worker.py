from typing import List
import logging
from sqlalchemy.orm import Session

import models
from services.invoice_service import InvoiceService

logger = logging.getLogger("oms_backend")


async def process_invoice_queue(
    db: Session,
    provider_code: str = "VNPT",
    limit: int = 50,
) -> List[models.Invoice]:
    """Worker xuất hóa đơn điện tử hàng loạt cho các đơn hàng COMPLETED chưa xuất hóa đơn"""
    completed_orders = (
        db.query(models.Order)
        .filter(
            models.Order.status.in_(["COMPLETED", "PAID"]),
            ~models.Order.invoices.any(),
        )
        .limit(limit)
        .all()
    )
    order_ids = [o.id for o in completed_orders]

    if not order_ids:
        logger.info("Invoice batch worker: No pending orders to issue invoices.")
        return []

    logger.info(f"Invoice batch worker processing {len(order_ids)} orders with provider {provider_code}")
    invoices = await InvoiceService.batch_issue_invoices(db, order_ids, provider_code=provider_code)
    return invoices
