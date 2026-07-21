from typing import List, Optional
from datetime import datetime
import urllib.request
import json
import os
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text, func

from database import engine, Base, get_db
import models, schemas
from utils.helpers import log_stock_transaction, notify_oms_status
from utils.auth import get_current_user

import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("wms_backend")

# Initialize database tables
Base.metadata.create_all(bind=engine)


app = FastAPI(title="WMS Backend API", version="1.0.0")

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:13100,http://localhost:13101,http://localhost:13102,http://localhost:13103"
    ).split(",")
    if origin.strip()
]

allowed_origin_regex = r"^https?://(localhost|127\.0\.0\.1|0\.0\.0\.0|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(:\d+)?$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=allowed_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "wms-backend"}

@app.get("/status")
def get_status(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    try:
        # Check database connection
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "database": "disconnected", "detail": str(e)}

@app.get("/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    warehouse_count = db.query(models.Warehouse).count()
    location_count = db.query(models.Location).count()
    qty_on_hand = db.query(func.sum(models.Inventory.qty_on_hand)).scalar() or 0
    qty_reserved = db.query(func.sum(models.Inventory.qty_reserved)).scalar() or 0
    inbound_count = db.query(models.InboundShipment).count()
    fulfillment_count = db.query(models.FulfillmentOrder_WMS).count()
    return {
        "warehouse_count": warehouse_count,
        "location_count": location_count,
        "total_qty_on_hand": int(qty_on_hand),
        "total_qty_reserved": int(qty_reserved),
        "inbound_count": inbound_count,
        "fulfillment_count": fulfillment_count
    }

# Import Routers
from routers.warehouses import router as warehouses_router
from routers.barcode_mappings import router as barcode_mappings_router
from routers.inventory import router as inventory_router, public_router as public_inventory_router
from routers.inbound import router as inbound_router
from routers.fulfillment import router as fulfillment_router
from routers.transactions import router as transactions_router

# Include Routers
app.include_router(public_inventory_router)
app.include_router(warehouses_router, dependencies=[Depends(get_current_user)])
app.include_router(barcode_mappings_router, dependencies=[Depends(get_current_user)])
app.include_router(inventory_router, dependencies=[Depends(get_current_user)])
app.include_router(inbound_router, dependencies=[Depends(get_current_user)])
app.include_router(fulfillment_router, dependencies=[Depends(get_current_user)])
app.include_router(transactions_router, dependencies=[Depends(get_current_user)])
