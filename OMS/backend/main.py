import os
import asyncio
import hmac
import inspect
import json
import logging
import math
import threading
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Dict, List, Optional
import httpx
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, Depends, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func, cast, Date, inspect as sa_inspect, text

import models
from utils.auth import get_current_user, get_optional_user

import schemas
from database import engine, Base, get_db, SessionLocal

import secrets
import hashlib
import uuid
import utils.phone_helper
import utils.crypto
import services.zalo_service

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("oms_backend")

# Create DB tables
Base.metadata.create_all(bind=engine)


def ensure_zalo_otp_schema() -> None:
    """Add the Zalo message mapping column for existing OMS databases."""
    inspector = sa_inspect(engine)
    columns = {
        column["name"]
        for column in inspector.get_columns(models.OtpVerification.__tablename__)
    }
    if "zalo_message_id" not in columns:
        with engine.begin() as connection:
            if engine.dialect.name == "postgresql":
                connection.execute(
                    text(
                        "ALTER TABLE otp_verifications "
                        "ADD COLUMN IF NOT EXISTS zalo_message_id VARCHAR(100)"
                    )
                )
            else:
                connection.execute(
                    text(
                        "ALTER TABLE otp_verifications "
                        "ADD COLUMN zalo_message_id VARCHAR(100)"
                    )
                )

    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS "
                "ix_otp_verifications_zalo_message_id "
                "ON otp_verifications (zalo_message_id)"
            )
        )


ensure_zalo_otp_schema()


# Seed initial channels data (Manual, Shopee, TikTok Shop, Lazada)
db_seed = SessionLocal()
try:
    channels_to_seed = [
        ("MANUAL", "Manual"),
        ("STOREFRONT", "Storefront"),
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
DEFAULT_FULFILLMENT_WAREHOUSE_CODE = os.getenv("FULFILLMENT_WAREHOUSE_CODE", "WH-001")
PIM_API_KEY = os.getenv("PIM_API_KEY", "oms_wms_internal_api_key_secret_2026")

app = FastAPI(title="OMS Backend API", version="1.0.0")

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_zalo_refresh_lock = threading.Lock()
zalo_token_scheduler: Optional[BackgroundScheduler] = None


def refresh_zalo_tokens_job() -> None:
    """Refresh and atomically persist the rotated Zalo OA token pair."""
    if not _zalo_refresh_lock.acquire(blocking=False):
        logger.info("Skipping overlapping Zalo token refresh.")
        return

    db = SessionLocal()
    try:
        configs = {
            config.config_key: config
            for config in db.query(models.SystemConfig).filter(
                models.SystemConfig.config_key.in_(
                    [
                        "zalo_access_token",
                        "zalo_refresh_token",
                        "zalo_app_id",
                        "zalo_app_secret",
                        "zalo_secret_key",
                    ]
                )
            )
        }
        app_id_config = configs.get("zalo_app_id")
        secret_config = configs.get("zalo_secret_key") or configs.get("zalo_app_secret")
        refresh_config = configs.get("zalo_refresh_token")

        if not all(
            config and config.config_value
            for config in (app_id_config, secret_config, refresh_config)
        ):
            logger.warning("Zalo token refresh skipped because its configuration is incomplete.")
            return

        refresh_result = services.zalo_service.refresh_zalo_token(
            app_id_config.config_value,
            secret_config.config_value,
            refresh_config.config_value,
        )
        result = (
            asyncio.run(refresh_result)
            if inspect.isawaitable(refresh_result)
            else refresh_result
        )
        if (
            result.get("status") != "success"
            or not result.get("access_token")
            or not result.get("refresh_token")
        ):
            logger.error("Zalo token refresh failed: %s", result.get("failed_reason"))
            return

        access_config = configs.get("zalo_access_token")
        if access_config is None:
            access_config = models.SystemConfig(
                config_key="zalo_access_token",
                description="Zalo OA Access Token",
            )
            db.add(access_config)

        access_config.config_value = result["access_token"]
        refresh_config.config_value = result["refresh_token"]
        db.commit()
        logger.info("Zalo OA tokens refreshed successfully.")
    except Exception:
        db.rollback()
        logger.exception("Unexpected error while refreshing Zalo OA tokens.")
    finally:
        db.close()
        _zalo_refresh_lock.release()


@app.on_event("startup")
def start_zalo_token_scheduler() -> None:
    global zalo_token_scheduler
    if zalo_token_scheduler and zalo_token_scheduler.running:
        return

    zalo_token_scheduler = BackgroundScheduler()
    zalo_token_scheduler.add_job(
        refresh_zalo_tokens_job,
        trigger="interval",
        hours=20,
        id="zalo_token_refresh",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    zalo_token_scheduler.start()


@app.on_event("shutdown")
def stop_zalo_token_scheduler() -> None:
    global zalo_token_scheduler
    if zalo_token_scheduler and zalo_token_scheduler.running:
        zalo_token_scheduler.shutdown(wait=False)
    zalo_token_scheduler = None


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    translated_errors = []
    for err in exc.errors():
        err_type = err.get("type")
        ctx = err.get("ctx") or {}
        msg = err.get("msg", "")
        
        if err_type == "missing":
            translated_msg = "Trường này là bắt buộc"
        elif err_type == "greater_than_equal":
            limit = ctx.get("limit_value") or ctx.get("ge")
            translated_msg = f"Giá trị phải lớn hơn hoặc bằng {limit}"
        elif err_type == "less_than_equal":
            limit = ctx.get("limit_value") or ctx.get("le")
            translated_msg = f"Giá trị phải nhỏ hơn hoặc bằng {limit}"
        elif err_type == "string_too_short":
            min_length = ctx.get("min_length")
            translated_msg = f"Độ dài tối thiểu là {min_length} ký tự"
        elif err_type == "value_error":
            if msg.startswith("Value error, "):
                translated_msg = msg[len("Value error, "):]
            else:
                translated_msg = msg
        else:
            translated_msg = msg
            
        translated_errors.append({
            "loc": err.get("loc"),
            "msg": translated_msg,
            "type": err_type
        })
        
    return JSONResponse(
        status_code=422,
        content={"detail": translated_errors}
    )

def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)

def call_api(url: str, method: str = "GET", data: dict = None):
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": PIM_API_KEY
    }
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

def _fetch_inventory_snapshot(order_items: List[models.OrderItem]) -> tuple[Dict[str, Dict[str, int]], Dict[str, dict]]:
    warehouse_url = f"{WMS_API_URL}/warehouses?limit=100000"
    inventory_url = f"{WMS_API_URL}/inventory?limit=100000"
    locations_url = f"{WMS_API_URL}/locations?limit=100000"
    headers = {"X-API-Key": PIM_API_KEY}
    with httpx.Client(timeout=10.0, headers=headers) as client:
        warehouses_resp = client.get(warehouse_url)
        inventory_resp = client.get(inventory_url)
        locations_resp = client.get(locations_url)

    if warehouses_resp.is_error:
        raise HTTPException(status_code=warehouses_resp.status_code, detail="Failed to fetch WMS warehouses")
    if inventory_resp.is_error:
        raise HTTPException(status_code=inventory_resp.status_code, detail="Failed to fetch WMS inventory")
    if locations_resp.is_error:
        raise HTTPException(status_code=locations_resp.status_code, detail="Failed to fetch WMS locations")

    warehouses = warehouses_resp.json()
    inventories = inventory_resp.json()
    locations = locations_resp.json()
    if not isinstance(warehouses, list) or not isinstance(inventories, list) or not isinstance(locations, list):
        raise HTTPException(status_code=500, detail="Unexpected WMS payload format")

    warehouse_by_id = {
        item.get("id"): item.get("code")
        for item in warehouses
        if isinstance(item, dict)
    }
    location_to_warehouse = {
        item.get("id"): item.get("warehouse_id")
        for item in locations
        if isinstance(item, dict)
    }

    available_by_warehouse: Dict[str, Dict[str, int]] = {}
    for record in inventories:
        if not isinstance(record, dict):
            continue
        location_id = record.get("location_id")
        warehouse_id = location_to_warehouse.get(location_id)
        warehouse_code = warehouse_by_id.get(warehouse_id)
        sku_code = record.get("sku_code")
        if not warehouse_code or not sku_code:
            continue

        qty_on_hand = int(record.get("qty_on_hand") or 0)
        qty_reserved = int(record.get("qty_reserved") or 0)
        qty_available = int(record.get("qty_available") or (qty_on_hand - qty_reserved))
        qty_available = max(0, qty_available)

        wh_sku = available_by_warehouse.setdefault(warehouse_code, {})
        # Sum available qty across all locations in the same warehouse.
        wh_sku[sku_code] = wh_sku.get(sku_code, 0) + qty_available

    required_by_sku: Dict[str, dict] = {}
    for item in order_items:
        required = required_by_sku.setdefault(
            item.sku_code,
            {
                "sku_code": item.sku_code,
                "product_name": item.product_name,
                "quantity": 0,
            },
        )
        required["quantity"] += int(item.quantity)

    return available_by_warehouse, required_by_sku


def allocate_order_items(order_items: List[models.OrderItem]) -> List[dict]:
    try:
        available_by_warehouse, required_by_sku = _fetch_inventory_snapshot(order_items)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Unable to allocate order from WMS inventory: %s", e)
        raise HTTPException(status_code=500, detail="Unable to allocate inventory from WMS")

    if not required_by_sku:
        raise HTTPException(status_code=400, detail="Order has no items to allocate")

    # First try: allocate all items from one warehouse.
    for warehouse_code, sku_map in available_by_warehouse.items():
        if all(sku_map.get(sku_code, 0) >= req["quantity"] for sku_code, req in required_by_sku.items()):
            return [
                {
                    "warehouse_code": warehouse_code,
                    "items": [
                        {
                            "sku_code": req["sku_code"],
                            "product_name": req["product_name"],
                            "quantity": req["quantity"],
                        }
                        for req in required_by_sku.values()
                    ],
                }
            ]

    # Split allocation across multiple warehouses.
    remaining = {sku_code: req["quantity"] for sku_code, req in required_by_sku.items()}
    allocations: List[dict] = []

    sorted_warehouses = sorted(
        available_by_warehouse.items(),
        key=lambda wh: sum(wh[1].get(sku, 0) for sku in required_by_sku.keys()),
        reverse=True,
    )

    for warehouse_code, sku_map in sorted_warehouses:
        allocated_items = []
        for sku_code, req in required_by_sku.items():
            need = remaining.get(sku_code, 0)
            if need <= 0:
                continue
            take = min(need, int(sku_map.get(sku_code, 0)))
            if take <= 0:
                continue
            remaining[sku_code] = need - take
            allocated_items.append(
                {
                    "sku_code": sku_code,
                    "product_name": req["product_name"],
                    "quantity": take,
                }
            )

        if allocated_items:
            allocations.append({"warehouse_code": warehouse_code, "items": allocated_items})

        if all(qty <= 0 for qty in remaining.values()):
            break

    if any(qty > 0 for qty in remaining.values()):
        shortage_details = [
            f"{sku_code}: thiếu {qty}"
            for sku_code, qty in remaining.items()
            if qty > 0
        ]
        raise HTTPException(
            status_code=400,
            detail=f"Không đủ tồn kho để duyệt đơn. {'; '.join(shortage_details)}",
        )

    return allocations

@app.get("/")
def read_root():
    return {"status": "ok", "service": "oms-backend"}

# --- Dashboard Stats ---

@app.get("/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
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
def search_products(request: Request, current_user: dict = Depends(get_current_user)):
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
def create_customer(customer: schemas.CustomerCreate, db: Session = Depends(get_db), current_user: Optional[dict] = Depends(get_optional_user)):
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
    db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
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
def retrieve_customer(customer_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    return customer

@app.put("/customers/{customer_id}", response_model=schemas.CustomerOut)
def update_customer(customer_id: int, customer_data: schemas.CustomerUpdate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
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
def delete_customer(customer_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
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
def create_channel(channel: schemas.ChannelCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
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
    db: Session = Depends(get_db), current_user: Optional[dict] = Depends(get_optional_user)):
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
def retrieve_channel(channel_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    channel = db.query(models.Channel).filter(models.Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
    return channel

@app.put("/channels/{channel_id}", response_model=schemas.ChannelOut)
def update_channel(channel_id: int, channel_data: schemas.ChannelUpdate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
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
def delete_channel(channel_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
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


@app.get("/orders")
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

@app.get("/orders/{id}", response_model=schemas.OrderOut)
def retrieve_order(id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    order = db.query(models.Order).filter(models.Order.id == id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@app.put("/orders/{id}", response_model=schemas.OrderOut)
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
def delete_order(id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    order = db.query(models.Order).filter(models.Order.id == id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != "DRAFT":
        raise HTTPException(status_code=400, detail="Only DRAFT orders can be deleted")
    db.delete(order)
    db.commit()
    return

@app.post("/orders/{id}/confirm", response_model=schemas.OrderOut)
def confirm_order(id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    order = db.query(models.Order).filter(models.Order.id == id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    if order.status != "DRAFT":
        raise HTTPException(status_code=400, detail="Only DRAFT orders can be confirmed")
        
    allocations = allocate_order_items(order.items)
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

            wms_resp = call_api(wms_url, "POST", wms_payload)
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
                call_api(f"{WMS_API_URL}/fulfillment-orders/{fn}/cancel", "POST")
            except Exception as rollback_err:
                logger.error(f"Failed to rollback WMS fulfillment {fn}: {rollback_err}")
        raise HTTPException(status_code=e.status_code, detail=f"WMS integration failed: {e.detail}")
    
    order.status = "PROCESSING"
    db.commit()
    db.refresh(order)
    return order


@app.get("/orders/{id}/stock-check")
def check_order_stock(id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    order = db.query(models.Order).filter(models.Order.id == id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    try:
        allocations = allocate_order_items(order.items)
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

@app.post("/orders/{id}/cancel", response_model=schemas.OrderOut)
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
                call_api(wms_cancel_url, "POST")
            except HTTPException as e:
                raise HTTPException(status_code=e.status_code, detail=f"WMS cancel failed: {e.detail}")
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
    
    # Removed legacy synchronization loop for fulfillment orders.
    # Frontend/WMS should use /orders/{id}/fulfillments/{fn}/status for sync.
    db.commit()
    db.refresh(order)
    return order


@app.patch("/orders/{id}/fulfillments/{fulfillment_number}/status", response_model=schemas.OrderOut)
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


# For E2E testing purposes
LAST_OTPS = {}

def generate_otp() -> str:
    return "".join(secrets.choice("0123456789") for _ in range(6))

def hash_otp(otp: str) -> str:
    return hashlib.sha256(otp.encode("utf-8")).hexdigest()

def mask_token(token: str) -> str:
    if not token:
        return ""
    if len(token) <= 5:
        return "*" * len(token)
    return token[:5] + "*" * (len(token) - 5)

if os.getenv("INTEGRITY_MODE") == "development" or os.getenv("ENV") == "development":
    @app.get("/api/sms/test-last-otp")
    def get_test_last_otp(phone: str, db: Session = Depends(get_db)):
        normalized_phone = utils.phone_helper.normalize_phone(phone)
        otp_code = LAST_OTPS.get(normalized_phone)
        if not otp_code:
            raise HTTPException(status_code=404, detail="No OTP found for this phone number")
        return {"otp_code": otp_code}

@app.post("/api/sms/send-otp")
async def send_otp(payload: schemas.SendOtpRequest, db: Session = Depends(get_db)):
    phone = payload.phone_number
    normalized_phone = utils.phone_helper.normalize_phone(phone)
    now_time = utcnow()
    is_development = (
        os.getenv("INTEGRITY_MODE") == "development"
        or os.getenv("ENV") == "development"
    )

    # Retrieve or create SmsRateLimit for sending
    db_limit = db.query(models.SmsRateLimit).filter(
        models.SmsRateLimit.phone_number == normalized_phone,
        models.SmsRateLimit.action_type == "send"
    ).first()

    if not db_limit:
        db_limit = models.SmsRateLimit(
            phone_number=normalized_phone,
            action_type="send",
            attempt_count=0,
            last_attempt_at=now_time
        )
        db.add(db_limit)
        db.flush()

    # 1. Lockout Check
    is_locked = False
    if db_limit.lockout_until and db_limit.lockout_until > now_time:
        is_locked = True
    elif db_limit.attempt_count >= 5 and now_time - db_limit.last_attempt_at < timedelta(minutes=15):
        if not db_limit.lockout_until:
            db_limit.lockout_until = db_limit.last_attempt_at + timedelta(minutes=15)
            db.commit()
        if db_limit.lockout_until > now_time:
            is_locked = True

    if is_locked:
        raise HTTPException(
            status_code=403,
            detail="Số điện thoại này đã bị tạm khóa do gửi quá nhiều OTP hoặc xác minh sai quá nhiều lần. Vui lòng thử lại sau 15 phút."
        )

    # 2. Cooldown Check (60 seconds)
    if db_limit.attempt_count > 0 and now_time - db_limit.last_attempt_at < timedelta(seconds=60):
        raise HTTPException(
            status_code=429,
            detail="Bạn đang gửi yêu cầu quá nhanh. Vui lòng đợi 60 giây trước khi thử lại."
        )

    # 3. 15-minute Limit Window (Max 5 attempts)
    if now_time - db_limit.last_attempt_at > timedelta(minutes=15):
        db_limit.attempt_count = 1
    else:
        db_limit.attempt_count += 1

    if db_limit.attempt_count > 5:
        db_limit.lockout_until = now_time + timedelta(minutes=15)
        db.commit()
        raise HTTPException(
            status_code=403,
            detail="Số điện thoại này đã bị tạm khóa do gửi quá nhiều OTP hoặc xác minh sai quá nhiều lần. Vui lòng thử lại sau 15 phút."
        )

    db_limit.last_attempt_at = now_time
    
    # 4. Generate OTP
    otp_code = generate_otp()
    otp_hash = hash_otp(otp_code)
    expires_at = now_time + timedelta(minutes=5)

    # 5. Fetch Zalo ZBS configuration
    zalo_configs = {
        config.config_key: config.config_value
        for config in db.query(models.SystemConfig).filter(
            models.SystemConfig.config_key.in_(
                ["zalo_access_token", "zalo_template_id"]
            )
        )
    }
    zalo_access_token = zalo_configs.get("zalo_access_token")
    zalo_template_id = zalo_configs.get("zalo_template_id")

    has_zalo_config = bool(zalo_access_token and zalo_template_id)
    if not has_zalo_config and not is_development:
        raise HTTPException(
            status_code=500,
            detail="Cấu hình dịch vụ Zalo OTP chưa đầy đủ. Vui lòng liên hệ quản trị viên.",
        )

    # Create verification record (pending status)
    otp_ver = models.OtpVerification(
        phone_number=normalized_phone,
        otp_hash=otp_hash,
        expires_at=expires_at,
        provider_status="PENDING"
    )
    db.add(otp_ver)
    db.commit()

    # Store for test-last-otp endpoint in development
    if is_development:
        LAST_OTPS[normalized_phone] = otp_code

    # 6. Async call to Zalo (handling potential synchronous monkeypatch)
    if is_development and not has_zalo_config:
        result = {
            "status": "success",
            "error_code": 0,
            "provider_response": {"mode": "development"},
            "failed_reason": None,
            "message_id": f"development-{uuid.uuid4()}",
        }
    else:
        res = services.zalo_service.send_zalo_otp(
            normalized_phone,
            otp_code,
            zalo_access_token,
            zalo_template_id,
        )
        if inspect.isawaitable(res):
            result = await res
        else:
            result = res

    # 7. Update verification log with provider outcome
    error_code = result.get("error_code")
    try:
        error_code = int(error_code) if error_code is not None else None
    except (TypeError, ValueError):
        error_code = None
    error_message = services.zalo_service.ZALO_ERROR_MESSAGES.get(
        error_code,
        result.get("failed_reason")
        or "Không thể gửi mã OTP qua Zalo. Vui lòng thử lại.",
    )

    otp_ver.provider_status = result.get("status", "failed")
    otp_ver.provider_response = json.dumps(
        result.get("provider_response", result),
        ensure_ascii=False,
        default=str,
    )
    otp_ver.failed_reason = (
        error_message if result.get("status") != "success" else None
    )
    otp_ver.zalo_message_id = result.get("message_id")
    otp_ver.sent_at = utcnow()
    db.commit()

    if result.get("status") != "success":
        raise HTTPException(status_code=400, detail=error_message)

    return {"success": True}

@app.post("/api/sms/verify-otp", response_model=schemas.VerifyOtpResponse)
def verify_otp(payload: schemas.VerifyOtpRequest, db: Session = Depends(get_db)):
    phone = payload.phone_number
    normalized_phone = utils.phone_helper.normalize_phone(phone)
    now_time = utcnow()

    # 1. Check verify rate limit
    db_limit = db.query(models.SmsRateLimit).filter(
        models.SmsRateLimit.phone_number == normalized_phone,
        models.SmsRateLimit.action_type == "verify"
    ).first()

    if db_limit and db_limit.lockout_until and db_limit.lockout_until > now_time:
        raise HTTPException(
            status_code=403,
            detail="Số điện thoại này đã bị tạm khóa do gửi quá nhiều OTP hoặc xác minh sai quá nhiều lần. Vui lòng thử lại sau 15 phút."
        )

    # 2. Retrieve active OTP record
    otp_ver = db.query(models.OtpVerification).filter(
        models.OtpVerification.phone_number == normalized_phone,
        models.OtpVerification.verified_at.is_(None),
        models.OtpVerification.expires_at > now_time
    ).order_by(models.OtpVerification.created_at.desc()).first()

    if not otp_ver:
        raise HTTPException(status_code=400, detail="Mã OTP không chính xác hoặc đã hết hạn. Vui lòng kiểm tra lại.")

    # 3. Match hashes
    provided_hash = hash_otp(payload.otp_code)
    if otp_ver.otp_hash == provided_hash:
        # Success: Reset limit, create token
        if db_limit:
            db_limit.attempt_count = 0
            db_limit.lockout_until = None

        verification_token = str(uuid.uuid4())
        otp_ver.verified_at = now_time
        otp_ver.verification_token = verification_token
        otp_ver.verification_expires_at = now_time + timedelta(minutes=15)
        
        db.commit()
        return {"success": True, "verification_token": verification_token}
    else:
        # Failure: Increment attempt count
        if not db_limit:
            db_limit = models.SmsRateLimit(
                phone_number=normalized_phone,
                action_type="verify",
                attempt_count=1,
                last_attempt_at=now_time
            )
            db.add(db_limit)
        else:
            db_limit.attempt_count += 1
            db_limit.last_attempt_at = now_time

        if db_limit.attempt_count >= 5:
            db_limit.lockout_until = now_time + timedelta(minutes=15)
            # Invalidate active OTP record
            otp_ver.expires_at = now_time  # Force expiration
            db.commit()
            raise HTTPException(
                status_code=403,
                detail="Số điện thoại này đã bị tạm khóa do gửi quá nhiều OTP hoặc xác minh sai quá nhiều lần. Vui lòng thử lại sau 15 phút."
            )
        
        db.commit()
        raise HTTPException(
            status_code=400,
            detail=f"Mã OTP không chính xác. Incorrect OTP. {5 - db_limit.attempt_count} attempts remaining."
        )


def _extract_zalo_message_id(payload: dict) -> Optional[str]:
    for key in ("message_id", "msg_id"):
        value = payload.get(key)
        if value is not None:
            return str(value)

    for key in ("data", "message", "recipient", "sender"):
        nested = payload.get(key)
        if isinstance(nested, dict):
            message_id = _extract_zalo_message_id(nested)
            if message_id:
                return message_id
    return None


@app.post("/api/sms/zalo-webhook")
async def zalo_webhook(request: Request, db: Session = Depends(get_db)):
    raw_body = await request.body()
    secret_config = db.query(models.SystemConfig).filter(
        models.SystemConfig.config_key == "zalo_secret_key"
    ).first()
    oa_secret_key = (
        secret_config.config_value
        if secret_config and secret_config.config_value
        else os.getenv("OA_SECRET_KEY")
    )
    if not oa_secret_key:
        logger.error("Zalo webhook secret is not configured; rejecting webhook.")
        raise HTTPException(
            status_code=503,
            detail="Webhook Zalo chưa được cấu hình.",
        )

    supplied_signature = (
        request.headers.get("X-Zalo-Signature")
        or request.headers.get("X-ZEvent-Signature")
        or request.headers.get("X-Zalo-Webhook-Signature")
        or ""
    )
    if supplied_signature.lower().startswith("sha256="):
        supplied_signature = supplied_signature[7:]

    expected_signature = hmac.new(
        oa_secret_key.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected_signature, supplied_signature.lower()):
        raise HTTPException(
            status_code=401,
            detail="Chữ ký webhook Zalo không hợp lệ.",
        )

    try:
        payload = json.loads(raw_body)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="Dữ liệu webhook Zalo không hợp lệ.",
        )
    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=400,
            detail="Dữ liệu webhook Zalo không hợp lệ.",
        )

    event_name = payload.get("event_name") or payload.get("event")
    if event_name != "user_received_message":
        return {"success": True, "updated": False}

    message_id = _extract_zalo_message_id(payload)
    if not message_id:
        raise HTTPException(
            status_code=400,
            detail="Webhook Zalo thiếu mã tin nhắn.",
        )

    otp_ver = db.query(models.OtpVerification).filter(
        models.OtpVerification.zalo_message_id == message_id
    ).order_by(models.OtpVerification.created_at.desc()).first()
    if not otp_ver:
        return {"success": True, "updated": False}

    otp_ver.provider_status = "DELIVERED"
    db.commit()
    return {"success": True, "updated": True}


ZALO_CONFIG_DESCRIPTIONS = {
    "zalo_app_id": "Zalo App ID",
    "zalo_secret_key": "Zalo App Secret Key",
    "zalo_access_token": "Zalo OA Access Token",
    "zalo_refresh_token": "Zalo OA Refresh Token",
    "zalo_template_id": "Zalo ZBS OTP Template ID",
}


def get_masked_zalo_config(db: Session) -> dict:
    configs = {
        config.config_key: config.config_value or ""
        for config in db.query(models.SystemConfig).filter(
            models.SystemConfig.config_key.in_(ZALO_CONFIG_DESCRIPTIONS)
        )
    }
    return {
        config_key: mask_token(configs.get(config_key, ""))
        for config_key in ZALO_CONFIG_DESCRIPTIONS
    }


@app.get("/api/configs/sms", response_model=schemas.ZaloConfigOut)
def get_sms_config(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_masked_zalo_config(db)


@app.put("/api/configs/sms", response_model=schemas.ZaloConfigOut)
def update_sms_config(
    payload: schemas.ZaloConfigUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    submitted_values = payload.model_dump(exclude_none=True)
    updates = {
        config_key: config_value
        for config_key, config_value in submitted_values.items()
        if "*" not in config_value
    }

    if updates:
        existing_configs = {
            config.config_key: config
            for config in db.query(models.SystemConfig).filter(
                models.SystemConfig.config_key.in_(updates)
            )
        }
        for config_key, config_value in updates.items():
            config = existing_configs.get(config_key)
            if config is None:
                db.add(
                    models.SystemConfig(
                        config_key=config_key,
                        config_value=config_value,
                        description=ZALO_CONFIG_DESCRIPTIONS[config_key],
                    )
                )
            else:
                config.config_value = config_value
        db.commit()

    return get_masked_zalo_config(db)
