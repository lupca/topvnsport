from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from utils.api_utils import utcnow
from utils.auth import get_current_user
from routers.orders import ALLOWED_TRANSITIONS

router = APIRouter(prefix="/orders", tags=["Fulfillment"])


@router.patch("/{id}/fulfillments/{fulfillment_number}/status", response_model=schemas.OrderOut)
def update_fulfillment_status(id: int, fulfillment_number: str, payload: schemas.FulfillmentStatusUpdate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    order = db.query(models.Order).filter(models.Order.id == id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    if order.status == "CANCELLED":
        raise HTTPException(status_code=409, detail="Order is already cancelled")
        
    target_fo = next((fo for fo in order.fulfillment_orders if fo.fulfillment_number == fulfillment_number), None)
    if not target_fo:
        raise HTTPException(status_code=404, detail="Fulfillment order not found")

    new_status = payload.status
    if new_status not in ALLOWED_TRANSITIONS:
        raise HTTPException(status_code=400, detail=f"Invalid status: {new_status}")
        
    precedence = {"CANCELLED": -1, "DRAFT": 0, "CONFIRMED": 1, "PROCESSING": 2, "PICKING": 3, "PACKED": 4, "SHIPPED": 5, "COMPLETED": 6}
    if precedence.get(new_status, 0) < precedence.get(target_fo.status, 0):
        # Idempotent: ignore regress attempts (e.g. late callback)
        return order
        
    target_fo.status = new_status
    if new_status == "SHIPPED":
        target_fo.shipped_at = utcnow()
        
    # Recalculate parent order status
    all_statuses = [fo.status for fo in order.fulfillment_orders]
    active_statuses = [s for s in all_statuses if s != "CANCELLED"]
    if not active_statuses:
        order.status = "CANCELLED"
    else:
        min_status = min(active_statuses, key=lambda s: precedence.get(s, 2))
        # Only update if it's a valid transition or same status
        order.status = min_status
        
    db.commit()
    db.refresh(order)
    return order
