import os
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
import models
from services.sepay_service import SepayService, CheckoutData

router = APIRouter(prefix="/api/payments", tags=["Payments"])


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

    base_url = os.getenv("WEB_BASE_URL")
    if not base_url:
        origin = request.headers.get("origin") or request.headers.get("referer")
        if origin:
            base_url = origin.rstrip("/")
        else:
            base_url = "https://topvnsport.vn"

    total_amount = int(float(order.total_amount) + float(order.shipping_fee))

    sepay = SepayService()
    checkout_data = CheckoutData(
        order_number=order.order_number,
        amount=total_amount,
        description=f"Thanh toan don hang {order.order_number}",
        success_url=f"{base_url}/checkout/success?order={order.order_number}",
        error_url=f"{base_url}/checkout/error?order={order.order_number}",
        cancel_url=f"{base_url}/checkout/cancel?order={order.order_number}",
    )

    return sepay.generate_checkout_form(checkout_data)
