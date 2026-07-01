import os
import json
import logging
import math
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import List, Optional
import httpx
from fastapi import FastAPI, Depends, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func, cast, Date

import models
import schemas
from database import engine, Base, get_db, SessionLocal

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("oms_backend")

# Create DB tables
Base.metadata.create_all(bind=engine)

# Seed initial channels data (Manual, Shopee, TikTok Shop, Lazada)
db_seed = SessionLocal()
try:
    channels_to_seed = [
        ("MANUAL", "Manual"),
        ("SHOPEE", "Shopee"),
        ("TIKTOK_SHOP", "TikTok Shop"),
        ("LAZADA", "Lazada"),
    ]
    for code, name in channels_to_seed:
        existing_channel = db_seed.query(models.Channel).filter(models.Channel.code == code).first()
        if not existing_channel:
            db_seed.add(models.Channel(code=code, name=name, is_active=True))
    db_seed.commit()
    logger.info("Successfully seeded initial channels data.")
except Exception as e:
    logger.error(f"Error seeding channels data: {e}")
    db_seed.rollback()
finally:
    db_seed.close()

# Service URLs from env variables with compose defaults
PIM_API_URL = os.getenv("PIM_API_URL", os.getenv("PMI_URL", "http://pim-api:8000"))
WMS_API_URL = os.getenv("WMS_API_URL", os.getenv("WMS_URL", "http://wms-api:8002"))

app = FastAPI(title="OMS Backend API", version="1.0.0")

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)

def call_api(url: str, method: str = "GET", data: dict = None):
    headers = {"Content-Type": "application/json"}
    logger.info(f"Initiating inter-service API call: {method} {url}")
    try:
        with httpx.Client(timeout=5.0) as client:
            if method.upper() == "GET":
                resp = client.get(url, headers=headers)
            elif method.upper() == "POST":
                resp = client.post(url, headers=headers, json=data)
            elif method.upper() == "PUT":
                resp = client.put(url, headers=headers, json=data)
            elif method.upper() == "PATCH":
                resp = client.patch(url, headers=headers, json=data)
            elif method.upper() == "DELETE":
                resp = client.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            logger.info(f"Inter-service API call: {method} {url} returned status {resp.status_code}")
            
            if resp.status_code == 204:
                return None
                
            if resp.is_error:
                try:
                    err_detail = resp.json()
                except Exception:
                    err_detail = resp.text
                if isinstance(err_detail, dict) and "detail" in err_detail:
                    detail_msg = err_detail["detail"]
                else:
                    detail_msg = str(err_detail)
                raise HTTPException(status_code=resp.status_code, detail=f"API call failed: {detail_msg}")
                
            return resp.json()
    except httpx.HTTPError as e:
        logger.error(f"HTTP error during inter-service call to {url}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to connect to API: {str(e)}")
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error during inter-service call to {url}: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@app.get("/")
def read_root():
    return {"status": "ok", "service": "oms-backend"}

# --- Dashboard Stats ---

@app.get("/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    order_count = db.query(models.Order).count()
    customer_count = db.query(models.Customer).count()
    
    revenue_query = db.query(func.sum(models.Order.total_amount)).filter(models.Order.status != "CANCELLED").scalar()
    revenue = float(revenue_query) if revenue_query is not None else 0.0
    
    status_counts_query = db.query(models.Order.status, func.count(models.Order.id)).group_by(models.Order.status).all()
    status_counts = {status: count for status, count in status_counts_query}
    
    # 7-day daily activity stats (last 7 days ordered oldest to newest)
    daily_stats = []
    for i in range(6, -1, -1):
        d = utcnow() - timedelta(days=i)
        target_date = d.date()
        date_str = target_date.strftime("%Y-%m-%d")
        
        day_query = db.query(
            func.count(models.Order.id),
            func.sum(models.Order.total_amount)
        ).filter(
            cast(models.Order.created_at, Date) == target_date,
            models.Order.status != "CANCELLED"
        ).first()
        
        count = day_query[0] or 0
        rev = float(day_query[1]) if day_query[1] is not None else 0.0
        
        daily_stats.append({
            "date": date_str,
            "count": count,
            "revenue": rev
        })
        
    return {
        "order_count": order_count,
        "revenue": revenue,
        "customer_count": customer_count,
        "status_counts": status_counts,
        "daily_stats": daily_stats
    }

# --- Products Proxy Search ---

@app.get("/products/search")
def search_products(request: Request):
    params = dict(request.query_params)
    if "search" in params:
        params["q"] = params.pop("search")
    url = f"{PIM_API_URL}/products"
    logger.info(f"Proxying product search to PMI: {url} with params {params}")
    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(url, params=params)
            if resp.is_error:
                raise HTTPException(status_code=resp.status_code, detail=resp.text)
            resp_json = resp.json()
            if isinstance(resp_json, dict) and "items" in resp_json:
                return resp_json["items"]
            return resp_json
    except httpx.HTTPError as e:
        logger.error(f"HTTP error during product search proxy: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to search products: {str(e)}")

# --- Customer CRUD ---

@app.post("/customers", response_model=schemas.CustomerOut, status_code=status.HTTP_201_CREATED)
def create_customer(customer: schemas.CustomerCreate, db: Session = Depends(get_db)):
    db_customer = models.Customer(
        name=customer.name,
        phone=customer.phone,
        email=customer.email,
        address=customer.address
    )
    db.add(db_customer)
    try:
        db.commit()
        db.refresh(db_customer)
        return db_customer
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Customer with this phone number already exists."
        )

@app.get("/customers", response_model=schemas.PaginatedCustomers)
def list_customers(
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Customer)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (models.Customer.name.ilike(search_filter)) |
            (models.Customer.phone.ilike(search_filter)) |
            (models.Customer.email.ilike(search_filter))
        )
    
    total_count = query.count()
    pages = (total_count + limit - 1) // limit if limit > 0 else 0
    
    skip = (page - 1) * limit
    items = query.order_by(models.Customer.created_at.desc()).offset(skip).limit(limit).all()
    
    return {
        "items": items,
        "total": total_count,
        "page": page,
        "pages": pages,
        "limit": limit
    }

@app.get("/customers/{customer_id}", response_model=schemas.CustomerOut)
def retrieve_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    return customer

@app.put("/customers/{customer_id}", response_model=schemas.CustomerOut)
def update_customer(customer_id: int, customer_data: schemas.CustomerUpdate, db: Session = Depends(get_db)):
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    
    update_data = customer_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(customer, key, value)
    
    try:
        db.commit()
        db.refresh(customer)
        return customer
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Update failed. Phone number might already be in use."
        )

@app.delete("/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    db.delete(customer)
    db.commit()
    return

# --- Channel CRUD ---

@app.post("/channels", response_model=schemas.ChannelOut, status_code=status.HTTP_201_CREATED)
def create_channel(channel: schemas.ChannelCreate, db: Session = Depends(get_db)):
    db_channel = models.Channel(
        code=channel.code,
        name=channel.name,
        is_active=channel.is_active
    )
    db.add(db_channel)
    try:
        db.commit()
        db.refresh(db_channel)
        return db_channel
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Channel with this code already exists."
        )

@app.get("/channels", response_model=schemas.PaginatedChannels)
def list_channels(
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Channel)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (models.Channel.name.ilike(search_filter)) |
            (models.Channel.code.ilike(search_filter))
        )
    
    total_count = query.count()
    pages = (total_count + limit - 1) // limit if limit > 0 else 0
    
    skip = (page - 1) * limit
    items = query.order_by(models.Channel.id.desc()).offset(skip).limit(limit).all()
    
    return {
        "items": items,
        "total": total_count,
        "page": page,
        "pages": pages,
        "limit": limit
    }

@app.get("/channels/{channel_id}", response_model=schemas.ChannelOut)
def retrieve_channel(channel_id: int, db: Session = Depends(get_db)):
    channel = db.query(models.Channel).filter(models.Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
    return channel

@app.put("/channels/{channel_id}", response_model=schemas.ChannelOut)
def update_channel(channel_id: int, channel_data: schemas.ChannelUpdate, db: Session = Depends(get_db)):
    channel = db.query(models.Channel).filter(models.Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
    
    update_data = channel_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(channel, key, value)
        
    try:
        db.commit()
        db.refresh(channel)
        return channel
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Update failed. Code might already be in use."
        )

@app.delete("/channels/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_channel(channel_id: int, db: Session = Depends(get_db)):
    channel = db.query(models.Channel).filter(models.Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
    db.delete(channel)
    db.commit()
    return

# --- Order CRUD ---

@app.post("/orders", response_model=schemas.OrderOut, status_code=status.HTTP_201_CREATED)
def create_order(payload: schemas.OrderCreateInput, db: Session = Depends(get_db)):
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
        pmi_data = call_api(pmi_url, "GET")
        
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
        
    total_amount += payload.shipping_fee
    
    # 4. Create Order
    new_order = models.Order(
        order_number=order_number,
        customer_id=payload.customer_id,
        channel_id=payload.channel_id,
        status="DRAFT",
        total_amount=total_amount,
        shipping_fee=payload.shipping_fee,
        shipping_address=payload.shipping_address,
        note=payload.note,
        created_by=payload.created_by
    )
    db.add(new_order)
    db.flush()
    
    for item in order_items:
        item.order_id = new_order.id
        db.add(item)
        
    db.commit()
    db.refresh(new_order)
    return new_order

@app.get("/orders")
def list_orders(
    page: int = 1,
    limit: int = 100,
    status: Optional[str] = None,
    channel_id: Optional[int] = None,
    date: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
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

@app.get("/orders/{id}", response_model=schemas.OrderOut)
def retrieve_order(id: int, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@app.put("/orders/{id}", response_model=schemas.OrderOut)
def update_order(id: int, payload: schemas.OrderUpdateInput, db: Session = Depends(get_db)):
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
            pmi_data = call_api(pmi_url, "GET")
            
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

@app.delete("/orders/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(id: int, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != "DRAFT":
        raise HTTPException(status_code=400, detail="Only DRAFT orders can be deleted")
    db.delete(order)
    db.commit()
    return

@app.post("/orders/{id}/confirm", response_model=schemas.OrderOut)
def confirm_order(id: int, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    if order.status != "DRAFT":
        raise HTTPException(status_code=400, detail="Only DRAFT orders can be confirmed")
        
    order.status = "CONFIRMED"
    db.flush()
    
    fulfillment_number = f"FM-{order.order_number}"
    warehouse_code = "WH-001"
    
    wms_payload = {
        "fulfillment_number": fulfillment_number,
        "oms_order_id": order.id,
        "oms_order_number": order.order_number,
        "warehouse_code": warehouse_code,
        "status": "PENDING",
        "items": [
            {
                "sku_code": item.sku_code,
                "product_name": item.product_name,
                "quantity": item.quantity
            } for item in order.items
        ]
    }
    
    wms_url = f"{WMS_API_URL}/fulfillment-orders"
    try:
        wms_resp = call_api(wms_url, "POST", wms_payload)
    except HTTPException as e:
        db.rollback()
        raise HTTPException(status_code=e.status_code, detail=f"WMS integration failed: {e.detail}")
        
    fo_status = wms_resp.get("status", "PENDING")
    db_fo = models.FulfillmentOrder(
        order_id=order.id,
        fulfillment_number=fulfillment_number,
        warehouse_code=warehouse_code,
        status=fo_status
    )
    db.add(db_fo)
    
    order.status = "PROCESSING"
    db.commit()
    db.refresh(order)
    return order

@app.post("/orders/{id}/cancel", response_model=schemas.OrderOut)
def cancel_order(id: int, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    if order.status in ["SHIPPED", "CANCELLED", "COMPLETED"]:
        raise HTTPException(status_code=400, detail=f"Cannot cancel order in {order.status} status")
        
    if order.status in ["PROCESSING", "PICKING", "PACKED"]:
        wms_cancel_url = f"{WMS_API_URL}/fulfillment-orders/FM-{order.order_number}/cancel"
        try:
            call_api(wms_cancel_url, "POST")
        except HTTPException as e:
            raise HTTPException(status_code=e.status_code, detail=f"WMS cancel failed: {e.detail}")
            
        for fo in order.fulfillment_orders:
            fo.status = "CANCELLED"
            
    order.status = "CANCELLED"
    db.commit()
    db.refresh(order)
    return order

# Validate state flow in status PATCH update
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

@app.patch("/orders/{id}/status", response_model=schemas.OrderOut)
def update_order_status(id: int, payload: schemas.OrderStatusUpdate, db: Session = Depends(get_db)):
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
    
    for fo in order.fulfillment_orders:
        fo.status = new_status
        if new_status == "SHIPPED":
            fo.shipped_at = utcnow()
            
    db.commit()
    db.refresh(order)
    return order
