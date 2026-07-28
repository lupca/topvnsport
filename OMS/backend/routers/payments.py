from datetime import datetime, timezone, timedelta
import os
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
import models
from services.sepay_service import SepayService, CheckoutData
from services.reconciliation_service import ReconciliationService

router = APIRouter(prefix="/api/payments", tags=["Payments"])
reconciliation_router = APIRouter(prefix="/api/reconciliation", tags=["Reconciliation"])


class CheckoutRequest(BaseModel):
    order_id: Optional[int] = None
    order_number: Optional[str] = None


class CheckoutResponse(BaseModel):
    action: str
    fields: Dict[str, Any]


@router.post("/checkout", response_model=CheckoutResponse)
def create_checkout(
    req: CheckoutRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Creates SePay checkout form data for an order.
    Frontend renders the form and auto-submits to SePay gateway.
    """
    if not req.order_id and not req.order_number:
        raise HTTPException(
            status_code=400,
            detail="Vui lòng cung cấp order_id hoặc order_number.",
        )

    query = db.query(models.Order)
    if req.order_id:
        order = query.filter(models.Order.id == req.order_id).first()
    else:
        order = query.filter(models.Order.order_number == req.order_number).first()

    if not order:
        raise HTTPException(status_code=404, detail="Đơn hàng không tồn tại.")

    if order.payment_status == "PAID":
        raise HTTPException(status_code=400, detail="Đơn hàng đã được thanh toán.")

    sepay = SepayService(db)

    base_url = os.getenv("WEB_BASE_URL") or sepay.web_base_url
    if not base_url or base_url == "https://topvnsport.vn":
        origin = request.headers.get("origin") or request.headers.get("referer")
        if origin:
            base_url = origin.rstrip("/")
        else:
            base_url = sepay.web_base_url or "https://topvnsport.vn"

    total_amount = int(float(order.total_amount) + float(order.shipping_fee))

    checkout_data = CheckoutData(
        order_number=order.order_number,
        amount=total_amount,
        description=f"Thanh toan don hang {order.order_number}",
        success_url=f"{base_url}/checkout/success?order={order.order_number}",
        error_url=f"{base_url}/checkout/error?order={order.order_number}",
        cancel_url=f"{base_url}/checkout/cancel?order={order.order_number}",
    )

    return sepay.generate_checkout_form(checkout_data)


@router.get("")
def list_payments(
    provider: Optional[str] = None,
    status: Optional[str] = None,
    order_id: Optional[int] = None,
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """List payments with optional filters"""
    query = db.query(models.Payment).order_by(models.Payment.created_at.desc())
    if provider:
        query = query.filter(models.Payment.provider == provider)
    if status:
        query = query.filter(models.Payment.status == status)
    if order_id is not None:
        query = query.filter(models.Payment.order_id == order_id)

    total = query.count()
    offset = (page - 1) * limit
    payments = query.offset(offset).limit(limit).all()

    return {
        "items": [
            {
                "id": p.id,
                "order_id": p.order_id,
                "provider": p.provider,
                "provider_txn_id": p.provider_txn_id,
                "amount": float(p.amount),
                "status": p.status,
                "reconciled_at": p.reconciled_at.isoformat() if p.reconciled_at else None,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in payments
        ],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/{id}")
def get_payment_detail(id: int, db: Session = Depends(get_db)):
    payment = db.query(models.Payment).filter(models.Payment.id == id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    ledger_entries = [
        {
            "id": entry.id,
            "entry_type": entry.entry_type,
            "amount": float(entry.amount),
            "running_balance": float(entry.running_balance) if entry.running_balance is not None else None,
            "metadata": entry.metadata_json,
            "created_at": entry.created_at.isoformat() if entry.created_at else None,
        }
        for entry in payment.ledger_entries
    ]

    return {
        "id": payment.id,
        "order_id": payment.order_id,
        "provider": payment.provider,
        "provider_txn_id": payment.provider_txn_id,
        "amount": float(payment.amount),
        "status": payment.status,
        "reconciled_at": payment.reconciled_at.isoformat() if payment.reconciled_at else None,
        "raw_data": payment.raw_data,
        "created_at": payment.created_at.isoformat() if payment.created_at else None,
        "ledger_entries": ledger_entries,
    }


@router.post("/{id}/reconcile")
def manual_reconcile_payment(id: int, db: Session = Depends(get_db)):
    payment = db.query(models.Payment).filter(models.Payment.id == id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    payment.status = "RECONCILED"
    payment.reconciled_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    db.refresh(payment)

    return {"success": True, "payment_id": payment.id, "status": payment.status}


@reconciliation_router.get("/report")
@router.get("/reconciliation/report")
async def get_reconciliation_report(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    provider: Optional[str] = None,
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    from_dt = datetime.strptime(from_date, "%Y-%m-%d") if from_date else (now - timedelta(days=1))
    to_dt = datetime.strptime(to_date, "%Y-%m-%d") if to_date else now

    report = await ReconciliationService.reconcile_payments(
        db, from_date=from_dt, to_date=to_dt, provider_code=provider
    )
    return report
