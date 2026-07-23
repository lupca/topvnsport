import math
import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import Date, cast, func
from sqlalchemy.orm import Session

import models
import schemas
import utils.phone_helper
from database import get_db
from utils.api_utils import PIM_API_URL, WMS_API_URL, utcnow
from utils.auth import get_current_user, get_optional_user

logger = logging.getLogger("oms_backend")

router = APIRouter(prefix="/orders", tags=["Orders"])

ALLOWED_TRANSITIONS = {
    "DRAFT": ["CONFIRMED", "CANCELLED"],
    "CONFIRMED": ["PROCESSING", "CANCELLED"],
    "PROCESSING": ["PICKING", "CANCELLED"],
    "PICKING": ["PACKED", "CANCELLED"],
    "PACKED": ["SHIPPED", "CANCELLED"],
    "SHIPPED": ["COMPLETED"],
    "CANCELLED": [],
    "COMPLETED": []
}


def _call_api(*args, **kwargs):
    import main
    return main.call_api(*args, **kwargs)


def _allocate_order_items(*args, **kwargs):
    import main
    return main.allocate_order_items(*args, **kwargs)


@router.post("", response_model=schemas.OrderOut, status_code=status.HTTP_201_CREATED)
def create_order(payload: schemas.OrderCreateInput, db: Session = Depends(get_db), current_user: Optional[dict] = Depends(get_optional_user)):
    # 1. Validate customer
    customer = db.query(models.Customer).filter(models.Customer.id == payload.customer_id).first()
    if not customer:
        raise HTTPException(status_code=400, detail="Customer not found")
        
    # 2. Validate channel
    channel = db.query(models.Channel).filter(models.Channel.id == payload.channel_id).first()
    if not channel:
        raise HTTPException(status_code=400, detail="Channel not found")
    if not channel.is_active:
        raise HTTPException(status_code=400, detail="Channel is inactive")

    # --- SECURE OTP VERIFICATION INTEGRATION ---
    is_storefront = channel.code == "STOREFRONT"
    if is_storefront:
        if not payload.verification_token:
            raise HTTPException(status_code=403, detail="Verification token is missing.")

        otp_ver = db.query(models.OtpVerification).filter(
            models.OtpVerification.verification_token == payload.verification_token
        ).first()

        if not otp_ver:
            raise HTTPException(status_code=403, detail="Invalid verification token.")

        # Match token to customer phone number
        norm_customer_phone = utils.phone_helper.normalize_phone(customer.phone)
        norm_token_phone = utils.phone_helper.normalize_phone(otp_ver.phone_number)
        if norm_customer_phone != norm_token_phone:
            raise HTTPException(status_code=403, detail="Verification token does not match customer phone number.")

        # Lifecycle Checks
        if otp_ver.verified_at is None:
            raise HTTPException(status_code=403, detail="Verification token has not been verified.")
        if otp_ver.used_at is not None:
            raise HTTPException(status_code=403, detail="Verification token has already been used.")
        if otp_ver.verification_expires_at < utcnow():
            raise HTTPException(status_code=403, detail="Verification token has expired.")

        # Atomically consume the token inside the same transaction
        otp_ver.used_at = utcnow()
        otp_ver.status = "CONSUMED"
        db.flush()
        
    # Auto-generate order_number if not provided
    if not payload.order_number:
        today_str = datetime.now(timezone.utc).strftime("%Y%m%d")
        prefix = f"ORD-{today_str}-"
        count_today = db.query(models.Order).filter(models.Order.order_number.like(f"{prefix}%")).count()
        suffix_int = count_today + 1
        while True:
            candidate = f"{prefix}{suffix_int:04d}"
            existing = db.query(models.Order).filter(models.Order.order_number == candidate).first()
            if not existing:
                order_number = candidate
                break
            suffix_int += 1
    else:
        order_number = payload.order_number
        existing = db.query(models.Order).filter(models.Order.order_number == order_number).first()
        if existing:
            raise HTTPException(status_code=400, detail="Order number already exists")
        
    # 3. Validate items & call PMI API
    order_items = []
    total_amount = Decimal("0.00")
    for item in payload.items:
        pmi_url = f"{PIM_API_URL}/api/products/by-sku/{item.sku_code}"
        pmi_data = _call_api(pmi_url, "GET")
        
        unit_price = Decimal(str(pmi_data.get("price", 0.0)))
        subtotal = unit_price * item.quantity
        total_amount += subtotal
        
        db_item = models.OrderItem(
            sku_code=item.sku_code,
            product_name=pmi_data.get("product_name"),
            variant_name=pmi_data.get("variant_name"),
            quantity=item.quantity,
            unit_price=unit_price,
            subtotal=subtotal,
            image_url=pmi_data.get("image_url")
        )
        order_items.append(db_item)
        
    final_total = total_amount + payload.shipping_fee
    
    # 5. Create Order
    new_order = models.Order(
        order_number=order_number,
        customer_id=payload.customer_id,
        channel_id=payload.channel_id,
        status="DRAFT",
        total_amount=final_total,
        shipping_fee=payload.shipping_fee,
        shipping_address=payload.shipping_address,
        note=payload.note,
        created_by=payload.created_by,
    )
    db.add(new_order)
    db.flush()
    
    for item in order_items:
        item.order_id = new_order.id
        db.add(item)
    
    db.commit()
    db.refresh(new_order)
    return new_order


@router.get("")
def list_orders(
    page: int = 1,
    limit: int = 100,
    status: Optional[str] = None,
    channel_id: Optional[int] = None,
    date: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    query = db.query(models.Order).order_by(models.Order.created_at.desc())
    if status:
        query = query.filter(models.Order.status == status)
    if channel_id is not None:
        query = query.filter(models.Order.channel_id == channel_id)
    if date:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d").date()
            query = query.filter(cast(models.Order.created_at, Date) == target_date)
        except ValueError:
            pass
    if search:
        query = query.join(models.Customer).filter(
            (models.Order.order_number.ilike(f"%{search}%")) |
            (models.Customer.name.ilike(f"%{search}%")) |
            (models.Customer.phone.ilike(f"%{search}%"))
        )
        
    total_count = query.count()
    pages = math.ceil(total_count / limit) if limit > 0 else 0
    if page < 1:
        page = 1
    offset = (page - 1) * limit
    items = query.offset(offset).limit(limit).all()
    
    return {
        "items": items,
        "total": total_count,
        "page": page,
        "pages": pages,
        "limit": limit
    }


@router.get("/{id}", response_model=schemas.OrderOut)
def retrieve_order(id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    order = db.query(models.Order).filter(models.Order.id == id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.put("/{id}", response_model=schemas.OrderOut)
def update_order(id: int, payload: schemas.OrderUpdateInput, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    order = db.query(models.Order).filter(models.Order.id == id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != "DRAFT":
        raise HTTPException(status_code=400, detail=f"Cannot edit order in status {order.status}")
        
    if payload.customer_id is not None:
        customer = db.query(models.Customer).filter(models.Customer.id == payload.customer_id).first()
        if not customer:
            raise HTTPException(status_code=400, detail="Customer not found")
        order.customer_id = payload.customer_id
        
    if payload.channel_id is not None:
        channel = db.query(models.Channel).filter(models.Channel.id == payload.channel_id).first()
        if not channel:
            raise HTTPException(status_code=400, detail="Channel not found")
        if not channel.is_active:
            raise HTTPException(status_code=400, detail="Channel is inactive")
        order.channel_id = payload.channel_id
        
    if payload.shipping_address is not None:
        order.shipping_address = payload.shipping_address
        
    if payload.note is not None:
        order.note = payload.note
        
    if payload.shipping_fee is not None:
        order.shipping_fee = payload.shipping_fee
        
    if payload.items is not None:
        # Clear existing items
        db.query(models.OrderItem).filter(models.OrderItem.order_id == order.id).delete()
        
        order_items = []
        subtotal_sum = Decimal("0.00")
        for item in payload.items:
            pmi_url = f"{PIM_API_URL}/api/products/by-sku/{item.sku_code}"
            pmi_data = _call_api(pmi_url, "GET")
            
            unit_price = Decimal(str(pmi_data.get("price", 0.0)))
            subtotal = unit_price * item.quantity
            subtotal_sum += subtotal
            
            db_item = models.OrderItem(
                order_id=order.id,
                sku_code=item.sku_code,
                product_name=pmi_data.get("product_name"),
                variant_name=pmi_data.get("variant_name"),
                quantity=item.quantity,
                unit_price=unit_price,
                subtotal=subtotal,
                image_url=pmi_data.get("image_url")
            )
            db.add(db_item)
            order_items.append(db_item)
            
        shipping_fee = payload.shipping_fee if payload.shipping_fee is not None else order.shipping_fee
        order.total_amount = subtotal_sum + shipping_fee
    else:
        if payload.shipping_fee is not None:
            existing_subtotal = db.query(func.sum(models.OrderItem.subtotal)).filter(models.OrderItem.order_id == order.id).scalar() or Decimal("0.00")
            order.total_amount = Decimal(str(existing_subtotal)) + payload.shipping_fee
            
    db.commit()
    db.refresh(order)
    return order


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    order = db.query(models.Order).filter(models.Order.id == id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != "DRAFT":
        raise HTTPException(status_code=400, detail="Only DRAFT orders can be deleted")
    db.delete(order)
    db.commit()
    return


@router.post("/{id}/confirm", response_model=schemas.OrderOut)
def confirm_order(id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    order = db.query(models.Order).filter(models.Order.id == id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    if order.status != "DRAFT":
        raise HTTPException(status_code=400, detail="Only DRAFT orders can be confirmed")
        
    allocations = _allocate_order_items(order.items)
    order.status = "CONFIRMED"
    db.flush()

    wms_url = f"{WMS_API_URL}/fulfillment-orders"
    is_split = len(allocations) > 1

    try:
        successful_fulfillments = []
        for idx, allocation in enumerate(allocations, start=1):
            fulfillment_number = (
                f"FM-{order.order_number}-{idx}"
                if is_split
                else f"FM-{order.order_number}"
            )
            wms_payload = {
                "fulfillment_number": fulfillment_number,
                "oms_order_id": order.id,
                "oms_order_number": order.order_number,
                "warehouse_code": allocation["warehouse_code"],
                "status": "PENDING",
                "items": allocation["items"],
            }

            wms_resp = _call_api(wms_url, "POST", wms_payload)
            successful_fulfillments.append(fulfillment_number)
            fo_status = wms_resp.get("status", "PENDING")

            db.add(
                models.FulfillmentOrder(
                    order_id=order.id,
                    fulfillment_number=fulfillment_number,
                    warehouse_code=allocation["warehouse_code"],
                    status=fo_status,
                )
            )
    except HTTPException as e:
        db.rollback()
        # Rollback ghost reservations in WMS
        for fn in successful_fulfillments:
            try:
                _call_api(f"{WMS_API_URL}/fulfillment-orders/{fn}/cancel", "POST")
            except Exception as rollback_err:
                logger.error(f"Failed to rollback WMS fulfillment {fn}: {rollback_err}")
        raise HTTPException(status_code=e.status_code, detail=f"WMS integration failed: {e.detail}")
    
    order.status = "PROCESSING"
    db.commit()
    db.refresh(order)
    return order


@router.get("/{id}/stock-check")
def check_order_stock(id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    order = db.query(models.Order).filter(models.Order.id == id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    try:
        allocations = _allocate_order_items(order.items)
        return {
            "sufficient": True,
            "message": "Tồn kho đủ để duyệt đơn.",
            "allocations": allocations,
        }
    except HTTPException as e:
        if e.status_code == 400:
            return {
                "sufficient": False,
                "message": e.detail,
                "allocations": [],
            }
        raise


@router.post("/{id}/cancel", response_model=schemas.OrderOut)
def cancel_order(id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    order = db.query(models.Order).filter(models.Order.id == id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    if order.status in ["SHIPPED", "CANCELLED", "COMPLETED"]:
        raise HTTPException(status_code=400, detail=f"Cannot cancel order in {order.status} status")
        
    if order.status in ["PROCESSING", "PICKING", "PACKED"]:
        for fo in order.fulfillment_orders:
            wms_cancel_url = f"{WMS_API_URL}/fulfillment-orders/{fo.fulfillment_number}/cancel"
            try:
                _call_api(wms_cancel_url, "POST")
            except HTTPException as e:
                raise HTTPException(status_code=e.status_code, detail=f"WMS cancel failed: {e.detail}")
            fo.status = "CANCELLED"
            
    order.status = "CANCELLED"
    db.commit()
    db.refresh(order)
    return order


@router.patch("/{id}/status", response_model=schemas.OrderOut)
def update_order_status(id: int, payload: schemas.OrderStatusUpdate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    order = db.query(models.Order).filter(models.Order.id == id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    current_status = order.status
    new_status = payload.status
    
    if new_status not in ALLOWED_TRANSITIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status: {new_status}"
        )
        
    if new_status != current_status and new_status not in ALLOWED_TRANSITIONS[current_status]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Illegal transition from {current_status} to {new_status}"
        )
        
    order.status = new_status
    db.commit()
    db.refresh(order)
    return order
