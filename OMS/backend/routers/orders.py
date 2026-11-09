import math
import logging
from datetime import date as date_type, datetime, time, timedelta, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

import models
import schemas
import utils.phone_helper
from database import get_db
from utils.api_utils import PIM_API_URL, WMS_API_URL, utcnow
from utils.auth import get_current_user, get_optional_user
from utils.tenant_context import require_tenant_context

logger = logging.getLogger("oms_backend")

router = APIRouter(prefix="/orders", tags=["Orders"])

ALLOWED_TRANSITIONS = {
    "DRAFT": ["CONFIRMED", "CANCELLED"],
    "CONFIRMED": ["PROCESSING", "CANCELLED"],
    "PROCESSING": ["PICKING", "CANCELLED"],
    "PICKING": ["PACKED", "CANCELLED"],
    "PACKED": ["SHIPPED", "CANCELLED"],
    "SHIPPED": ["COMPLETED", "RETURNED"],
    "CANCELLATION_PENDING": ["CANCELLED"],
    "CANCELLED": [],
    "COMPLETED": ["RETURNED"],
    # Delivered order sent back by the buyer. Terminal.
    "RETURNED": [],
}

# Statuses from which an order may be marked RETURNED.
RETURNABLE_STATUSES = ("SHIPPED", "COMPLETED")

MAX_LIST_LIMIT = 100


def _call_api(*args, **kwargs):
    import main
    return main.call_api(*args, **kwargs)


def _allocate_order_items(*args, **kwargs):
    import main
    return main.allocate_order_items(*args, **kwargs)


def _to_naive_utc(value: Optional[datetime]) -> Optional[datetime]:
    """Order timestamps are stored as naive UTC; normalise aware inputs."""
    if value is None or value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _order_total(items_subtotal: Decimal, shipping_fee: Decimal, discount_amount: Decimal) -> Decimal:
    gross = Decimal(str(items_subtotal)) + Decimal(str(shipping_fee))
    discount = Decimal(str(discount_amount or 0))
    if discount > gross:
        raise HTTPException(
            status_code=400,
            detail="discount_amount cannot exceed items subtotal plus shipping fee",
        )
    return gross - discount


def _record_order_event(db: Session, order: models.Order, event_type: str, payload: dict, created_by: Optional[str]) -> None:
    """Append an audit row to order_events in the caller's transaction."""
    db.add(
        models.OrderEvent(
            tenant_id=order.tenant_id,
            seller_id=order.seller_id,
            order_id=order.id,
            order=order,
            event_type=event_type,
            payload={
                "order_id": order.id,
                "tenant_id": str(order.tenant_id),
                "seller_id": str(order.seller_id),
                "order_number": order.order_number,
                **payload,
            },
            created_by=created_by or "system",
        )
    )


def _mark_returned(
    db: Session,
    order: models.Order,
    current_user: Optional[dict],
    returned_at: Optional[datetime] = None,
    return_shipping_cost: Optional[Decimal] = None,
    reason: Optional[str] = None,
) -> None:
    old_status = order.status
    order.status = "RETURNED"
    if returned_at is not None or order.returned_at is None:
        order.returned_at = _to_naive_utc(returned_at) or utcnow()
    if return_shipping_cost:
        order.seller_shipping_cost = Decimal(str(order.seller_shipping_cost or 0)) + return_shipping_cost
    _record_order_event(
        db,
        order,
        "order.returned",
        {
            "old_status": old_status,
            "new_status": "RETURNED",
            "returned_at": order.returned_at.isoformat(),
            "return_shipping_cost": float(return_shipping_cost) if return_shipping_cost is not None else None,
            "reason": reason,
        },
        (current_user or {}).get("username"),
    )


@router.post("", response_model=schemas.OrderOut, status_code=status.HTTP_201_CREATED)
def create_order(payload: schemas.OrderCreateInput, db: Session = Depends(get_db), current_user: Optional[dict] = Depends(get_optional_user)):
    context = require_tenant_context()
    # Finance fields are seller-side bookkeeping; a public (storefront) caller
    # must never be able to grant itself a discount or set seller costs.
    if current_user is None and (
        payload.discount_amount
        or payload.seller_shipping_cost
        or payload.platform_fee is not None
    ):
        raise HTTPException(
            status_code=403,
            detail="discount_amount, seller_shipping_cost and platform_fee require an authenticated user",
        )
    # 1. Validate customer
    customer = db.query(models.Customer).filter(models.Customer.id == payload.customer_id, models.Customer.is_deleted == False).first()
    if not customer:
        raise HTTPException(status_code=400, detail="Customer not found")
        
    # 2. Validate channel
    channel = db.query(models.Channel).filter(models.Channel.id == payload.channel_id, models.Channel.is_deleted == False).first()
    if not channel:
        raise HTTPException(status_code=400, detail="Channel not found")
    if not channel.is_active:
        raise HTTPException(status_code=400, detail="Channel is inactive")

    # 3. Validate items & call PMI API
    order_items_data = []
    total_amount = Decimal("0.00")
    for item in payload.items:
        pmi_url = f"{PIM_API_URL}/api/products/by-sku/{item.sku_code}"
        pmi_data = _call_api(pmi_url, "GET")
        
        unit_price = Decimal(str(pmi_data.get("price", 0.0)))
        subtotal = unit_price * item.quantity
        total_amount += subtotal
        
        order_items_data.append({
            "sku_code": item.sku_code,
            "product_name": pmi_data.get("product_name"),
            "variant_name": pmi_data.get("variant_name"),
            "quantity": item.quantity,
            "unit_price": unit_price,
            "subtotal": subtotal,
            "image_url": pmi_data.get("image_url")
        })
        
    final_total = _order_total(total_amount, payload.shipping_fee, payload.discount_amount)
    is_storefront = channel.code == "STOREFRONT"
    norm_customer_phone = utils.phone_helper.normalize_phone(customer.phone)

    MAX_RETRIES = 10
    for attempt in range(MAX_RETRIES):
        try:
            # --- SECURE OTP VERIFICATION INTEGRATION ---
            if is_storefront:
                if not payload.verification_token:
                    raise HTTPException(status_code=403, detail="Verification token is missing.")

                otp_ver = db.query(models.OtpVerification).filter(
                    models.OtpVerification.verification_token == payload.verification_token
                ).with_for_update().first()

                if not otp_ver:
                    raise HTTPException(status_code=403, detail="Invalid verification token.")

                # Match token to customer phone number
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
                updated_count = db.query(models.OtpVerification).filter(
                    models.OtpVerification.id == otp_ver.id,
                    models.OtpVerification.used_at.is_(None)
                ).update({
                    "used_at": utcnow(),
                    "status": "CONSUMED"
                }, synchronize_session=False)

                if updated_count == 0:
                    raise HTTPException(status_code=403, detail="Verification token has already been used.")
                db.flush()

            # Auto-generate order_number if not provided
            if not payload.order_number:
                today_str = datetime.now(timezone.utc).strftime("%Y%m%d")
                prefix = f"ORD-{today_str}-"
                count_today = db.query(models.Order).filter(models.Order.order_number.like(f"{prefix}%")).count()
                suffix_int = count_today + 1 + attempt
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

            new_order = models.Order(
                tenant_id=context.tenant_id,
                seller_id=context.seller_id,
                order_number=order_number,
                customer_id=payload.customer_id,
                channel_id=payload.channel_id,
                status="DRAFT",
                total_amount=final_total,
                shipping_fee=payload.shipping_fee,
                discount_amount=payload.discount_amount,
                seller_shipping_cost=payload.seller_shipping_cost,
                platform_fee=payload.platform_fee,
                shipping_address=payload.shipping_address,
                note=payload.note,
                created_by=payload.created_by,
            )
            for item_data in order_items_data:
                new_order.items.append(models.OrderItem(
                    sku_code=item_data["sku_code"],
                    product_name=item_data["product_name"],
                    variant_name=item_data["variant_name"],
                    quantity=item_data["quantity"],
                    unit_price=item_data["unit_price"],
                    subtotal=item_data["subtotal"],
                    image_url=item_data["image_url"]
                ))
            db.add(new_order)

            db.commit()
            db.refresh(new_order)
            return new_order
        except HTTPException:
            db.rollback()
            raise
        except IntegrityError:
            db.rollback()
            if payload.order_number:
                raise HTTPException(status_code=400, detail="Order number already exists")
            if attempt == MAX_RETRIES - 1:
                raise HTTPException(status_code=500, detail="Could not generate unique order number after retries")


@router.get("", response_model=schemas.PaginatedOrders)
def list_orders(
    page: int = 1,
    limit: int = 100,
    status: Optional[str] = None,
    channel_id: Optional[int] = None,
    channel_code: Optional[str] = None,
    payment_status: Optional[str] = None,
    date: Optional[str] = None,
    date_from: Optional[date_type] = Query(None, description="YYYY-MM-DD, inclusive, on created_at (UTC)"),
    date_to: Optional[date_type] = Query(None, description="YYYY-MM-DD, inclusive, on created_at (UTC)"),
    updated_since: Optional[datetime] = Query(None, description="ISO 8601; returns orders with updated_at >= value"),
    search: Optional[str] = None,
    db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    # Tenant/seller scoping is applied automatically by the session listener
    # in database.py (with_loader_criteria on TenantSellerOwned).
    query = db.query(models.Order)
    if status:
        query = query.filter(models.Order.status == status)
    if channel_id is not None:
        query = query.filter(models.Order.channel_id == channel_id)
    if channel_code:
        query = query.filter(models.Order.channel_code == channel_code)
    if payment_status:
        query = query.filter(models.Order.payment_status == payment_status)
    if date:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d").date()
            # Half-open day range (same result as CAST(created_at AS DATE) on
            # Postgres, but index-friendly and portable).
            query = query.filter(
                models.Order.created_at >= datetime.combine(target_date, time.min),
                models.Order.created_at < datetime.combine(target_date + timedelta(days=1), time.min),
            )
        except ValueError:
            pass
    if date_from is not None:
        query = query.filter(models.Order.created_at >= datetime.combine(date_from, time.min))
    if date_to is not None:
        query = query.filter(models.Order.created_at < datetime.combine(date_to + timedelta(days=1), time.min))
    if updated_since is not None:
        query = query.filter(models.Order.updated_at >= _to_naive_utc(updated_since))
    if search:
        query = query.join(models.Customer).filter(
            (models.Order.order_number.ilike(f"%{search}%")) |
            (models.Customer.name.ilike(f"%{search}%")) |
            (models.Customer.phone.ilike(f"%{search}%"))
        )

    limit = min(max(limit, 1), MAX_LIST_LIMIT)
    if page < 1:
        page = 1
    total_count = query.count()
    pages = math.ceil(total_count / limit)
    offset = (page - 1) * limit
    items = (
        query.options(
            selectinload(models.Order.items),
            selectinload(models.Order.customer),
            selectinload(models.Order.channel),
            selectinload(models.Order.fulfillment_orders),
        )
        .order_by(models.Order.created_at.desc(), models.Order.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

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
        customer = db.query(models.Customer).filter(models.Customer.id == payload.customer_id, models.Customer.is_deleted == False).first()
        if not customer:
            raise HTTPException(status_code=400, detail="Customer not found")
        order.customer_id = payload.customer_id
        
    if payload.channel_id is not None:
        channel = db.query(models.Channel).filter(models.Channel.id == payload.channel_id, models.Channel.is_deleted == False).first()
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

    if payload.discount_amount is not None:
        order.discount_amount = payload.discount_amount
    if payload.seller_shipping_cost is not None:
        order.seller_shipping_cost = payload.seller_shipping_cost
    if payload.platform_fee is not None:
        order.platform_fee = payload.platform_fee
        
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
            
        order.total_amount = _order_total(subtotal_sum, order.shipping_fee, order.discount_amount)
    else:
        if payload.shipping_fee is not None or payload.discount_amount is not None:
            existing_subtotal = db.query(func.sum(models.OrderItem.subtotal)).filter(models.OrderItem.order_id == order.id).scalar() or Decimal("0.00")
            order.total_amount = _order_total(existing_subtotal, order.shipping_fee, order.discount_amount)
            
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
    context = require_tenant_context()
    order = db.query(models.Order).filter(models.Order.id == id).with_for_update().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    if order.status != "DRAFT":
        raise HTTPException(status_code=400, detail="Only DRAFT orders can be confirmed")
        
    allocations = _allocate_order_items(order.items)

    wms_url = f"{WMS_API_URL}/fulfillment-orders"
    is_split = len(allocations) > 1

    successful_fulfillments = []
    try:
        for idx, allocation in enumerate(allocations, start=1):
            fulfillment_number = (
                f"FM-{order.order_number}-{idx}"
                if is_split
                else f"FM-{order.order_number}"
            )
            wms_payload = {
                "tenant_id": str(context.tenant_id),
                "seller_id": str(context.seller_id),
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
                    tenant_id=context.tenant_id,
                    seller_id=context.seller_id,
                    order_id=order.id,
                    fulfillment_number=fulfillment_number,
                    warehouse_code=allocation["warehouse_code"],
                    status=fo_status,
                )
            )
        
        order.status = "PROCESSING"
        db.commit()
        db.refresh(order)
        return order
    except HTTPException as e:
        db.rollback()
        # Rollback ghost reservations in WMS
        for fn in successful_fulfillments:
            try:
                _call_api(f"{WMS_API_URL}/fulfillment-orders/{fn}/cancel", "POST")
            except Exception as rollback_err:
                logger.error(f"Failed to rollback WMS fulfillment {fn}: {rollback_err}")
        raise HTTPException(status_code=e.status_code, detail=f"WMS integration failed: {e.detail}")
    except Exception as e:
        db.rollback()
        for fn in successful_fulfillments:
            try:
                _call_api(f"{WMS_API_URL}/fulfillment-orders/{fn}/cancel", "POST")
            except Exception as rollback_err:
                logger.error(f"Failed to rollback WMS fulfillment {fn}: {rollback_err}")
        raise HTTPException(status_code=500, detail=f"WMS integration failed: {str(e)}")


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
        
    if order.status in ["SHIPPED", "CANCELLED", "COMPLETED", "RETURNED"]:
        raise HTTPException(status_code=400, detail=f"Cannot cancel order in {order.status} status")
        
    has_partial_failure = False
    if order.status in ["PROCESSING", "PICKING", "PACKED", "CANCELLATION_PENDING"]:
        for fo in order.fulfillment_orders:
            if fo.status == "CANCELLED":
                continue
            wms_cancel_url = f"{WMS_API_URL}/fulfillment-orders/{fo.fulfillment_number}/cancel"
            try:
                _call_api(wms_cancel_url, "POST")
                fo.status = "CANCELLED"
            except Exception as e:
                logger.error(f"Failed to cancel WMS fulfillment order {fo.fulfillment_number}: {e}")
                has_partial_failure = True
            
    if has_partial_failure:
        order.status = "CANCELLATION_PENDING"
    else:
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

    if new_status == "RETURNED" and current_status != "RETURNED":
        _mark_returned(db, order, current_user)
    else:
        order.status = new_status
    db.commit()
    db.refresh(order)
    return order


@router.post("/{id}/return", response_model=schemas.OrderOut)
def return_order(
    id: int,
    payload: Optional[schemas.OrderReturnInput] = Body(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Mark a delivered (SHIPPED/COMPLETED) order as RETURNED and stamp returned_at."""
    payload = payload or schemas.OrderReturnInput()
    order = db.query(models.Order).filter(models.Order.id == id).with_for_update().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status not in RETURNABLE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Only SHIPPED or COMPLETED orders can be returned (current: {order.status})",
        )
    _mark_returned(
        db,
        order,
        current_user,
        returned_at=payload.returned_at,
        return_shipping_cost=payload.return_shipping_cost,
        reason=payload.reason,
    )
    db.commit()
    db.refresh(order)
    return order


@router.patch("/{id}/finance", response_model=schemas.OrderOut)
def update_order_finance(
    id: int,
    payload: schemas.OrderFinanceUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Record costs known only after fulfilment/settlement (any status)."""
    order = db.query(models.Order).filter(models.Order.id == id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=400, detail="No finance fields provided")
    previous = {}
    for field, value in changes.items():
        if field == "seller_shipping_cost" and value is None:
            raise HTTPException(status_code=400, detail="seller_shipping_cost cannot be null")
        previous[field] = getattr(order, field)
        setattr(order, field, value)
    _record_order_event(
        db,
        order,
        "order.finance_updated",
        {
            "changes": {k: (float(v) if v is not None else None) for k, v in changes.items()},
            "previous": {k: (float(v) if v is not None else None) for k, v in previous.items()},
        },
        (current_user or {}).get("username"),
    )
    db.commit()
    db.refresh(order)
    return order


@router.get("/{id}/events")
def get_order_events(id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    order = db.query(models.Order).filter(models.Order.id == id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    events = (
        db.query(models.OrderEvent)
        .filter(models.OrderEvent.order_id == id)
        .order_by(models.OrderEvent.created_at.asc())
        .all()
    )
    return [
        {
            "id": e.id,
            "order_id": e.order_id,
            "event_type": e.event_type,
            "payload": e.payload,
            "created_by": e.created_by,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in events
    ]
