from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
import models
from services.invoice_service import InvoiceService

router = APIRouter(prefix="/api/invoices", tags=["Invoices"])


class BatchInvoiceRequest(BaseModel):
    order_ids: List[int]
    provider: str = "VNPT"


class CancelInvoiceRequest(BaseModel):
    reason: str


@router.get("")
def list_invoices(
    status: Optional[str] = None,
    provider: Optional[str] = None,
    order_id: Optional[int] = None,
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    query = db.query(models.Invoice).order_by(models.Invoice.created_at.desc())
    if status:
        query = query.filter(models.Invoice.status == status)
    if provider:
        query = query.filter(models.Invoice.provider == provider)
    if order_id is not None:
        query = query.filter(models.Invoice.order_id == order_id)

    total = query.count()
    offset = (page - 1) * limit
    invoices = query.offset(offset).limit(limit).all()

    return {
        "items": [
            {
                "id": inv.id,
                "order_id": inv.order_id,
                "provider": inv.provider,
                "invoice_number": inv.invoice_number,
                "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else None,
                "status": inv.status,
                "pdf_url": inv.pdf_url,
                "created_at": inv.created_at.isoformat() if inv.created_at else None,
            }
            for inv in invoices
        ],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.post("/batch")
async def batch_issue_invoices(
    req: BatchInvoiceRequest,
    db: Session = Depends(get_db),
):
    if not req.order_ids:
        raise HTTPException(status_code=400, detail="Danh sách order_ids không được rỗng.")
    invoices = await InvoiceService.batch_issue_invoices(db, req.order_ids, provider_code=req.provider)
    return {
        "success": True,
        "count": len(invoices),
        "invoices": [
            {
                "id": inv.id,
                "order_id": inv.order_id,
                "invoice_number": inv.invoice_number,
                "status": inv.status,
                "pdf_url": inv.pdf_url,
            }
            for inv in invoices
        ],
    }


@router.get("/{id}/pdf")
async def download_invoice_pdf(id: int, db: Session = Depends(get_db)):
    invoice = db.query(models.Invoice).filter(models.Invoice.id == id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    provider = InvoiceService.get_provider(invoice.provider)
    pdf_bytes = await provider.get_invoice_pdf(invoice.invoice_number)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=invoice_{invoice.invoice_number}.pdf"},
    )


@router.post("/{id}/cancel")
async def cancel_invoice(
    id: int,
    req: CancelInvoiceRequest,
    db: Session = Depends(get_db),
):
    try:
        invoice = await InvoiceService.cancel_invoice(db, id, req.reason)
        return {"success": True, "invoice_id": invoice.id, "status": invoice.status}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
