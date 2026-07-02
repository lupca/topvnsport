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

def log_stock_transaction(db: Session, sku_code: str, location_id: int, transaction_type: str, quantity: int, note: str = None):
    tx = models.StockTransaction(
        sku_code=sku_code,
        location_id=location_id,
        transaction_type=transaction_type,
        quantity=quantity,
        note=note
    )
    db.add(tx)
    db.flush()

def notify_oms_status(oms_order_id: int, new_status: str):
    if not oms_order_id:
        logger.info("notify_oms_status skipped: oms_order_id is null")
        return
    oms_url = os.getenv("OMS_API_URL", "http://oms_backend:8001")
    target_url = f"{oms_url}/orders/{oms_order_id}/status"
    logger.info(f"Notifying OMS of status {new_status} for order {oms_order_id} at URL: {target_url}")
    try:
        req = urllib.request.Request(
            target_url,
            data=json.dumps({"status": new_status}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="PATCH"
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            resp_data = resp.read()
            logger.info(f"Successfully notified OMS of status {new_status}: {resp_data}")
    except Exception as e:
        logger.error(f"Failed to notify OMS of status {new_status} for order {oms_order_id}: {e}")

@app.get("/status")
def get_status(db: Session = Depends(get_db)):
    try:
        # Check database connection
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "database": "disconnected", "detail": str(e)}

@app.get("/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
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

# --- Warehouse CRUD Endpoints ---

@app.post("/warehouses", response_model=schemas.WarehouseResponse, status_code=status.HTTP_201_CREATED)
def create_warehouse(warehouse: schemas.WarehouseCreate, db: Session = Depends(get_db)):
    db_warehouse = db.query(models.Warehouse).filter(models.Warehouse.code == warehouse.code).first()
    if db_warehouse:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Warehouse with code {warehouse.code} already exists."
        )
    new_warehouse = models.Warehouse(
        code=warehouse.code,
        name=warehouse.name,
        address=warehouse.address,
        is_active=warehouse.is_active
    )
    db.add(new_warehouse)
    db.commit()
    db.refresh(new_warehouse)
    return new_warehouse

@app.get("/warehouses", response_model=List[schemas.WarehouseResponse])
def list_warehouses(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.Warehouse).offset(skip).limit(limit).all()

@app.get("/warehouses/{warehouse_id}", response_model=schemas.WarehouseResponse)
def get_warehouse(warehouse_id: int, db: Session = Depends(get_db)):
    db_warehouse = db.query(models.Warehouse).filter(models.Warehouse.id == warehouse_id).first()
    if not db_warehouse:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Warehouse with ID {warehouse_id} not found."
        )
    return db_warehouse

@app.get("/warehouses/code/{code}", response_model=schemas.WarehouseResponse)
def get_warehouse_by_code(code: str, db: Session = Depends(get_db)):
    db_warehouse = db.query(models.Warehouse).filter(models.Warehouse.code == code).first()
    if not db_warehouse:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Warehouse with code {code} not found."
        )
    return db_warehouse

@app.put("/warehouses/{warehouse_id}", response_model=schemas.WarehouseResponse)
def update_warehouse(warehouse_id: int, warehouse: schemas.WarehouseCreate, db: Session = Depends(get_db)):
    db_warehouse = db.query(models.Warehouse).filter(models.Warehouse.id == warehouse_id).first()
    if not db_warehouse:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Warehouse with ID {warehouse_id} not found."
        )
    # Check if changing code to one that already exists
    if db_warehouse.code != warehouse.code:
        code_exists = db.query(models.Warehouse).filter(models.Warehouse.code == warehouse.code).first()
        if code_exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Warehouse with code {warehouse.code} already exists."
            )
    
    db_warehouse.code = warehouse.code
    db_warehouse.name = warehouse.name
    db_warehouse.address = warehouse.address
    db_warehouse.is_active = warehouse.is_active
    
    db.commit()
    db.refresh(db_warehouse)
    return db_warehouse

@app.delete("/warehouses/{warehouse_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_warehouse(warehouse_id: int, db: Session = Depends(get_db)):
    db_warehouse = db.query(models.Warehouse).filter(models.Warehouse.id == warehouse_id).first()
    if not db_warehouse:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Warehouse with ID {warehouse_id} not found."
        )
    db.delete(db_warehouse)
    db.commit()
    return None


# --- Locations API ---

@app.get("/locations", response_model=List[schemas.LocationResponse])
def list_locations(db: Session = Depends(get_db)):
    return db.query(models.Location).all()

@app.get("/warehouses/{id}/locations", response_model=List[schemas.LocationResponse])
def get_warehouse_locations(id: int, db: Session = Depends(get_db)):
    wh = db.query(models.Warehouse).filter(models.Warehouse.id == id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    return db.query(models.Location).filter(models.Location.warehouse_id == id).all()

@app.get("/locations/code/{code}", response_model=schemas.LocationResponse)
def get_location_by_code_route(code: str, db: Session = Depends(get_db)):
    loc = db.query(models.Location).filter(models.Location.location_code == code).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    return loc

@app.get("/locations/{id_or_code}", response_model=schemas.LocationResponse)
def get_location(id_or_code: str, db: Session = Depends(get_db)):
    loc = None
    if id_or_code.isdigit():
        loc = db.query(models.Location).filter(models.Location.id == int(id_or_code)).first()
    if not loc:
        loc = db.query(models.Location).filter(models.Location.location_code == id_or_code).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    return loc


@app.post("/locations", response_model=schemas.LocationResponse, status_code=201)
def create_location(payload: schemas.LocationCreate, db: Session = Depends(get_db)):
    # Check duplicate code within same warehouse
    dup = db.query(models.Location).filter(
        models.Location.warehouse_id == payload.warehouse_id,
        models.Location.location_code == payload.location_code
    ).first()
    if dup:
        raise HTTPException(status_code=400, detail="Location code already exists in this warehouse")
    loc = models.Location(
        warehouse_id=payload.warehouse_id,
        location_code=payload.location_code,
        zone=payload.zone,
        aisle=payload.aisle,
        rack=payload.rack,
        shelf=payload.shelf,
        type=payload.type,
        is_active=payload.is_active
    )
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return loc

@app.put("/locations/{id}", response_model=schemas.LocationResponse)
def update_location(id: int, payload: schemas.LocationCreate, db: Session = Depends(get_db)):
    loc = db.query(models.Location).filter(models.Location.id == id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    loc.location_code = payload.location_code
    loc.zone = payload.zone
    loc.aisle = payload.aisle
    loc.rack = payload.rack
    loc.shelf = payload.shelf
    loc.type = payload.type
    loc.is_active = payload.is_active
    db.commit()
    db.refresh(loc)
    return loc

@app.delete("/locations/{id}", status_code=204)
def delete_location(id: int, db: Session = Depends(get_db)):
    loc = db.query(models.Location).filter(models.Location.id == id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    # Verify no stock
    has_stock = db.query(models.Inventory).filter(
        models.Inventory.location_id == id,
        models.Inventory.qty_on_hand > 0
    ).first()
    if has_stock:
        raise HTTPException(status_code=400, detail="Cannot delete location with active stock")
    db.delete(loc)
    db.commit()
    return None


# --- Barcode Mapping API ---

@app.get("/barcode-mappings", response_model=List[schemas.BarcodeMappingResponse])
def list_barcode_mappings(db: Session = Depends(get_db)):
    return db.query(models.BarcodeMapping).all()

@app.get("/barcode-mappings/lookup/{barcode}", response_model=schemas.BarcodeMappingResponse)
def lookup_barcode_mapping_by_barcode(barcode: str, db: Session = Depends(get_db)):
    bm = db.query(models.BarcodeMapping).filter(models.BarcodeMapping.barcode == barcode).first()
    if not bm:
        raise HTTPException(status_code=404, detail="Barcode mapping not found")
    return bm

@app.get("/barcode-mappings/{barcode}", response_model=schemas.BarcodeMappingResponse)
def lookup_barcode_mapping(barcode: str, db: Session = Depends(get_db)):
    bm = db.query(models.BarcodeMapping).filter(models.BarcodeMapping.barcode == barcode).first()
    if not bm:
        raise HTTPException(status_code=404, detail="Barcode mapping not found")
    return bm

@app.post("/barcode-mappings", response_model=schemas.BarcodeMappingResponse, status_code=201)
def create_barcode_mapping(payload: schemas.BarcodeMappingCreate, db: Session = Depends(get_db)):
    # Check duplicate barcode
    dup = db.query(models.BarcodeMapping).filter(models.BarcodeMapping.barcode == payload.barcode).first()
    if dup:
        raise HTTPException(status_code=400, detail="Barcode already mapped")
    bm = models.BarcodeMapping(
        barcode=payload.barcode,
        barcode_type=payload.barcode_type,
        sku_code=payload.sku_code,
        product_name=payload.product_name,
        variant_name=payload.variant_name,
        image_url=payload.image_url
    )
    db.add(bm)
    db.commit()
    db.refresh(bm)
    return bm

@app.put("/barcode-mappings/{id}", response_model=schemas.BarcodeMappingResponse)
def update_barcode_mapping(id: int, payload: schemas.BarcodeMappingCreate, db: Session = Depends(get_db)):
    bm = db.query(models.BarcodeMapping).filter(models.BarcodeMapping.id == id).first()
    if not bm:
        raise HTTPException(status_code=404, detail="Barcode mapping not found")
    bm.barcode = payload.barcode
    bm.barcode_type = payload.barcode_type
    bm.sku_code = payload.sku_code
    bm.product_name = payload.product_name
    bm.variant_name = payload.variant_name
    bm.image_url = payload.image_url
    db.commit()
    db.refresh(bm)
    return bm

@app.delete("/barcode-mappings/{id}", status_code=204)
def delete_barcode_mapping(id: int, db: Session = Depends(get_db)):
    bm = db.query(models.BarcodeMapping).filter(models.BarcodeMapping.id == id).first()
    if not bm:
        raise HTTPException(status_code=404, detail="Barcode mapping not found")
    db.delete(bm)
    db.commit()
    return None


# --- Inventory API ---

@app.get("/inventory", response_model=List[schemas.InventoryResponse])
def list_inventory(db: Session = Depends(get_db)):
    return db.query(models.Inventory).all()

class InventoryAdjustInput(schemas.BaseModel):
    sku_code: str
    location_id: int
    quantity: int  # delta change (positive or negative)
    note: Optional[str] = None

@app.post("/inventory/adjust", response_model=schemas.InventoryResponse)
def adjust_inventory(payload: InventoryAdjustInput, db: Session = Depends(get_db)):
    inv = db.query(models.Inventory).filter(
        models.Inventory.sku_code == payload.sku_code,
        models.Inventory.location_id == payload.location_id
    ).first()
    if not inv:
        # Create new record if positive adjust
        if payload.quantity < 0:
            raise HTTPException(status_code=400, detail="Cannot adjust below zero")
        inv = models.Inventory(
            sku_code=payload.sku_code,
            product_name=payload.sku_code,  # Fallback to SKU
            location_id=payload.location_id,
            qty_on_hand=0,
            qty_reserved=0
        )
        db.add(inv)
        db.flush()
        
    new_qty = inv.qty_on_hand + payload.quantity
    if new_qty < 0:
        raise HTTPException(status_code=400, detail="Adjustment would result in negative quantity")
    if new_qty < inv.qty_reserved:
        raise HTTPException(status_code=400, detail="Adjustment would make qty_on_hand lower than qty_reserved")
        
    inv.qty_on_hand = new_qty
    log_stock_transaction(db, payload.sku_code, payload.location_id, "ADJUST", payload.quantity, payload.note)
    db.commit()
    db.refresh(inv)
    return inv

class InventoryTransferInput(schemas.BaseModel):
    sku_code: str
    from_location_id: int
    to_location_id: int
    quantity: int
    note: Optional[str] = None

@app.post("/inventory/transfer")
def transfer_inventory(payload: InventoryTransferInput, db: Session = Depends(get_db)):
    if payload.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be positive")
    
    src = db.query(models.Inventory).filter(
        models.Inventory.sku_code == payload.sku_code,
        models.Inventory.location_id == payload.from_location_id
    ).first()
    if not src or (src.qty_on_hand - src.qty_reserved) < payload.quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock available for transfer")
        
    dest = db.query(models.Inventory).filter(
        models.Inventory.sku_code == payload.sku_code,
        models.Inventory.location_id == payload.to_location_id
    ).first()
    if not dest:
        dest = models.Inventory(
            sku_code=payload.sku_code,
            product_name=src.product_name,
            location_id=payload.to_location_id,
            qty_on_hand=0,
            qty_reserved=0
        )
        db.add(dest)
        db.flush()
        
    src.qty_on_hand -= payload.quantity
    dest.qty_on_hand += payload.quantity
    
    log_stock_transaction(db, payload.sku_code, payload.from_location_id, "TRANSFER", -payload.quantity, payload.note)
    log_stock_transaction(db, payload.sku_code, payload.to_location_id, "TRANSFER", payload.quantity, payload.note)
    db.commit()
    return {"status": "success", "transferred": payload.quantity}


# --- Inbound API ---

@app.get("/inbound-shipments", response_model=List[schemas.InboundShipmentResponse])
def list_inbound_shipments(db: Session = Depends(get_db)):
    return db.query(models.InboundShipment).all()

@app.get("/inbound-shipments/{id}", response_model=schemas.InboundShipmentResponse)
def get_inbound_shipment(id: int, db: Session = Depends(get_db)):
    shipment = db.query(models.InboundShipment).filter(models.InboundShipment.id == id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Inbound shipment not found")
    return shipment

@app.post("/inbound-shipments", response_model=schemas.InboundShipmentResponse, status_code=201)
def create_inbound_shipment(payload: schemas.InboundShipmentCreate, db: Session = Depends(get_db)):
    # Check duplicate inbound number
    dup = db.query(models.InboundShipment).filter(models.InboundShipment.inbound_number == payload.inbound_number).first()
    if dup:
        raise HTTPException(status_code=400, detail="Inbound shipment already exists")
    shipment = models.InboundShipment(
        inbound_number=payload.inbound_number,
        warehouse_id=payload.warehouse_id,
        supplier_name=payload.supplier_name,
        status="pending",
        note=payload.note,
        created_by=payload.created_by,
        expected_date=payload.expected_date
    )
    db.add(shipment)
    db.flush()
    for item in payload.items:
        db_item = models.InboundItem(
            inbound_shipment_id=shipment.id,
            sku_code=item.sku_code,
            product_name=item.product_name,
            expected_qty=item.expected_qty,
            received_qty=item.received_qty or 0,
            location_id=item.location_id,
            status=item.status or "pending"
        )
        db.add(db_item)
    db.commit()
    db.refresh(shipment)
    return shipment

class InboundReceiveItemInput(schemas.BaseModel):
    sku_code: str
    received_qty: int
    location_id: int

class InboundReceiveInput(schemas.BaseModel):
    items: List[InboundReceiveItemInput]

@app.post("/inbound-shipments/{id}/receive")
def receive_inbound_shipment(id: int, payload: InboundReceiveInput, db: Session = Depends(get_db)):
    shipment = db.query(models.InboundShipment).filter(models.InboundShipment.id == id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Inbound shipment not found")
    for r_item in payload.items:
        item = db.query(models.InboundItem).filter(
            models.InboundItem.inbound_shipment_id == id,
            models.InboundItem.sku_code == r_item.sku_code
        ).first()
        if item:
            item.received_qty += r_item.received_qty
            item.location_id = r_item.location_id
            item.status = "received"
    shipment.status = "receiving"
    db.commit()
    return {"status": "success"}

class InboundReceiveScanInput(schemas.BaseModel):
    barcode: str
    quantity: int = 1

class InboundPutAwayInput(schemas.BaseModel):
    sku_code: str
    location_id: Optional[int] = None
    location_code: Optional[str] = None

@app.post("/inbound/{id}/receive-scan")
def receive_scan_inbound_shipment(id: int, payload: InboundReceiveScanInput, db: Session = Depends(get_db)):
    shipment = db.query(models.InboundShipment).filter(models.InboundShipment.id == id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Inbound shipment not found")
    bm = db.query(models.BarcodeMapping).filter(models.BarcodeMapping.barcode == payload.barcode).first()
    if not bm:
        raise HTTPException(status_code=400, detail=f"Barcode {payload.barcode} mapping not found")
    item = db.query(models.InboundItem).filter(
        models.InboundItem.inbound_shipment_id == id,
        models.InboundItem.sku_code == bm.sku_code
    ).first()
    if not item:
        raise HTTPException(status_code=400, detail=f"SKU {bm.sku_code} not expected in this shipment")
    item.received_qty += payload.quantity
    item.status = "receiving"
    shipment.status = "receiving"
    db.commit()
    return {
        "status": "success",
        "sku_code": item.sku_code,
        "product_name": item.product_name,
        "received_qty": item.received_qty,
        "expected_qty": item.expected_qty
    }

@app.post("/inbound/{id}/put-away")
def put_away_inbound_item(id: int, payload: InboundPutAwayInput, db: Session = Depends(get_db)):
    shipment = db.query(models.InboundShipment).filter(models.InboundShipment.id == id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Inbound shipment not found")
    item = db.query(models.InboundItem).filter(
        models.InboundItem.inbound_shipment_id == id,
        models.InboundItem.sku_code == payload.sku_code
    ).first()
    if not item:
        raise HTTPException(status_code=400, detail=f"SKU {payload.sku_code} not found in this shipment")
    location = None
    if payload.location_code:
        location = db.query(models.Location).filter(models.Location.location_code == payload.location_code).first()
        if not location:
            raise HTTPException(status_code=400, detail=f"Location code {payload.location_code} not found")
    elif payload.location_id:
        location = db.query(models.Location).filter(models.Location.id == payload.location_id).first()
        if not location:
            raise HTTPException(status_code=400, detail=f"Location ID {payload.location_id} not found")
    if not location:
        raise HTTPException(status_code=400, detail="Must provide valid location_id or location_code")
    item.location_id = location.id
    item.status = "put_away"
    db.commit()
    return {"status": "success", "sku_code": item.sku_code, "location_id": location.id, "location_code": location.location_code}

@app.post("/inbound-shipments/{id}/complete")
@app.post("/inbound/{id}/complete")
@app.patch("/inbound-shipments/{id}/complete")
@app.patch("/inbound/{id}/complete")
def complete_inbound_shipment(id: int, db: Session = Depends(get_db)):
    shipment = db.query(models.InboundShipment).filter(models.InboundShipment.id == id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Inbound shipment not found")
    for item in shipment.items:
        if not item.location_id:
            raise HTTPException(status_code=400, detail=f"Location not assigned for SKU {item.sku_code}")
        inv = db.query(models.Inventory).filter(
            models.Inventory.sku_code == item.sku_code,
            models.Inventory.location_id == item.location_id
        ).first()
        if not inv:
            inv = models.Inventory(
                sku_code=item.sku_code,
                product_name=item.product_name,
                location_id=item.location_id,
                qty_on_hand=0,
                qty_reserved=0
            )
            db.add(inv)
            db.flush()
        inv.qty_on_hand += item.received_qty
        log_stock_transaction(db, item.sku_code, item.location_id, "INBOUND", item.received_qty, f"Inbound {shipment.inbound_number}")
    shipment.status = "COMPLETED"
    shipment.received_date = datetime.utcnow()
    db.commit()
    return {"status": "success"}



# --- Fulfillment API ---

@app.post("/fulfillment-orders", response_model=schemas.FulfillmentOrderWMSResponse, status_code=status.HTTP_201_CREATED)
def create_fulfillment_order(payload: schemas.FulfillmentOrderCreateInput, db: Session = Depends(get_db)):
    # Check if fulfillment_number already exists
    db_fo = db.query(models.FulfillmentOrder_WMS).filter(models.FulfillmentOrder_WMS.fulfillment_number == payload.fulfillment_number).first()
    if db_fo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Fulfillment order {payload.fulfillment_number} already exists"
        )
    
    # 1. Create FulfillmentOrder_WMS record
    new_fo = models.FulfillmentOrder_WMS(
        fulfillment_number=payload.fulfillment_number,
        oms_order_id=payload.oms_order_id,
        oms_order_number=payload.oms_order_number,
        status=payload.status or "PENDING"
    )
    db.add(new_fo)
    db.flush()
    
    # 2. Process items
    for item in payload.items:
        # Find location with enough qty_on_hand
        inv = db.query(models.Inventory).join(models.Location).join(models.Warehouse)\
            .filter(
                models.Warehouse.code == payload.warehouse_code,
                models.Inventory.sku_code == item.sku_code,
                (models.Inventory.qty_on_hand - models.Inventory.qty_reserved) >= item.quantity
            ).first()
        
        if not inv:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No location in warehouse {payload.warehouse_code} has enough available stock for SKU {item.sku_code}. Required: {item.quantity}."
            )
        
        # Reserve quantity
        inv.qty_reserved += item.quantity
        log_stock_transaction(db, item.sku_code, inv.location_id, "RESERVE", item.quantity, f"Reserve for {new_fo.fulfillment_number}")
        
        # Create PickListItem
        pick_item = models.PickListItem(
            fulfillment_order_id=new_fo.id,
            sku_code=item.sku_code,
            product_name=item.product_name,
            location_id=inv.location_id,
            quantity=item.quantity,
            status="pending"
        )
        db.add(pick_item)
        
    db.commit()
    db.refresh(new_fo)
    return new_fo

@app.post("/fulfillment-orders/{id}/cancel")
def cancel_fulfillment_order(id: str, db: Session = Depends(get_db)):
    if id.isdigit():
        fo = db.query(models.FulfillmentOrder_WMS).filter(models.FulfillmentOrder_WMS.id == int(id)).first()
    else:
        fo = db.query(models.FulfillmentOrder_WMS).filter(models.FulfillmentOrder_WMS.fulfillment_number == id).first()
        
    if not fo:
        fo = db.query(models.FulfillmentOrder_WMS).filter(models.FulfillmentOrder_WMS.fulfillment_number == id).first()
        
    if not fo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fulfillment order not found"
        )
        
    if fo.status == "CANCELLED":
        return {"status": "already_cancelled", "fulfillment_number": fo.fulfillment_number}
        
    # Revert reserved quantities
    for item in fo.pick_list_items:
        inv = db.query(models.Inventory).filter(
            models.Inventory.sku_code == item.sku_code,
            models.Inventory.location_id == item.location_id
        ).first()
        if inv:
            inv.qty_reserved = max(0, inv.qty_reserved - item.quantity)
            log_stock_transaction(db, item.sku_code, item.location_id, "UNRESERVE", -item.quantity, f"Cancel {fo.fulfillment_number}")
            
    fo.status = "CANCELLED"
    db.commit()
    return {"status": "success", "fulfillment_number": fo.fulfillment_number}

class FulfillmentScanPickInput(schemas.BaseModel):
    barcode: str
    quantity: int = 1

class FulfillmentScanPackInput(schemas.BaseModel):
    tracking_number: str
    carrier_name: Optional[str] = "Default Carrier"

@app.post("/fulfillment-orders/{id}/start-pick")
def start_pick_fulfillment_order(id: str, db: Session = Depends(get_db)):
    if id.isdigit():
        fo = db.query(models.FulfillmentOrder_WMS).filter(models.FulfillmentOrder_WMS.id == int(id)).first()
    else:
        fo = db.query(models.FulfillmentOrder_WMS).filter(models.FulfillmentOrder_WMS.fulfillment_number == id).first()
        
    if not fo:
        raise HTTPException(status_code=404, detail="Fulfillment order not found")
        
    fo.status = "PICKING"
    for item in fo.pick_list_items:
        if item.status == "pending":
            item.status = "picking"
    db.commit()
    notify_oms_status(fo.oms_order_id, "PICKING")
    return {"status": "success", "fulfillment_number": fo.fulfillment_number, "status_code": fo.status}

@app.post("/fulfillment-orders/{id}/scan-pick")
def scan_pick_fulfillment_order(id: str, payload: FulfillmentScanPickInput, db: Session = Depends(get_db)):
    if id.isdigit():
        fo = db.query(models.FulfillmentOrder_WMS).filter(models.FulfillmentOrder_WMS.id == int(id)).first()
    else:
        fo = db.query(models.FulfillmentOrder_WMS).filter(models.FulfillmentOrder_WMS.fulfillment_number == id).first()
        
    if not fo:
        raise HTTPException(status_code=404, detail="Fulfillment order not found")
        
    bm = db.query(models.BarcodeMapping).filter(models.BarcodeMapping.barcode == payload.barcode).first()
    if not bm:
        raise HTTPException(status_code=400, detail=f"Barcode {payload.barcode} mapping not found")
        
    item = db.query(models.PickListItem).filter(
        models.PickListItem.fulfillment_order_id == fo.id,
        models.PickListItem.sku_code == bm.sku_code
    ).first()
    if not item:
        raise HTTPException(status_code=400, detail=f"SKU {bm.sku_code} not in this fulfillment order's pick list")
        
    item.picked_qty += payload.quantity
    if item.picked_qty >= item.quantity:
        item.status = "picked"
    else:
        item.status = "picking"
        
    db.commit()
    return {
        "status": "success",
        "sku_code": item.sku_code,
        "product_name": item.product_name,
        "picked_qty": item.picked_qty,
        "required_qty": item.quantity,
        "item_status": item.status
    }

@app.post("/fulfillment-orders/{id}/complete-pick")
def complete_pick_fulfillment_order(id: str, db: Session = Depends(get_db)):
    if id.isdigit():
        fo = db.query(models.FulfillmentOrder_WMS).filter(models.FulfillmentOrder_WMS.id == int(id)).first()
    else:
        fo = db.query(models.FulfillmentOrder_WMS).filter(models.FulfillmentOrder_WMS.fulfillment_number == id).first()
        
    if not fo:
        raise HTTPException(status_code=404, detail="Fulfillment order not found")
        
    fo.status = "PICKED"
    for item in fo.pick_list_items:
        if item.picked_qty < item.quantity:
            item.picked_qty = item.quantity
        item.status = "picked"
        
    db.commit()
    notify_oms_status(fo.oms_order_id, "PICKING")
    return {"status": "success", "fulfillment_number": fo.fulfillment_number, "status_code": fo.status}

@app.post("/fulfillment-orders/{id}/pick")
def pick_fulfillment_order(id: str, db: Session = Depends(get_db)):
    if id.isdigit():
        fo = db.query(models.FulfillmentOrder_WMS).filter(models.FulfillmentOrder_WMS.id == int(id)).first()
    else:
        fo = db.query(models.FulfillmentOrder_WMS).filter(models.FulfillmentOrder_WMS.fulfillment_number == id).first()
        
    if not fo:
        raise HTTPException(status_code=404, detail="Fulfillment order not found")
        
    fo.status = "PICKING"
    for item in fo.pick_list_items:
        item.picked_qty = item.quantity
        item.status = "picked"
    db.commit()
    notify_oms_status(fo.oms_order_id, "PICKING")
    return {"status": "success", "fulfillment_number": fo.fulfillment_number}

@app.post("/fulfillment-orders/{id}/scan-pack")
def scan_pack_fulfillment_order(id: str, payload: FulfillmentScanPackInput, db: Session = Depends(get_db)):
    if id.isdigit():
        fo = db.query(models.FulfillmentOrder_WMS).filter(models.FulfillmentOrder_WMS.id == int(id)).first()
    else:
        fo = db.query(models.FulfillmentOrder_WMS).filter(models.FulfillmentOrder_WMS.fulfillment_number == id).first()
        
    if not fo:
        raise HTTPException(status_code=404, detail="Fulfillment order not found")
        
    fo.status = "PACKING"
    session = db.query(models.PackingSession).filter(models.PackingSession.fulfillment_order_id == fo.id).first()
    if not session:
        session = models.PackingSession(
            fulfillment_order_id=fo.id,
            status="packing",
            tracking_number=payload.tracking_number,
            carrier_name=payload.carrier_name,
            started_at=datetime.utcnow()
        )
        db.add(session)
    else:
        session.tracking_number = payload.tracking_number
        session.carrier_name = payload.carrier_name
        session.status = "packing"
        
    db.commit()
    return {"status": "success", "fulfillment_number": fo.fulfillment_number, "tracking_number": payload.tracking_number}

@app.post("/fulfillment-orders/{id}/complete-pack")
def complete_pack_fulfillment_order(id: str, db: Session = Depends(get_db)):
    if id.isdigit():
        fo = db.query(models.FulfillmentOrder_WMS).filter(models.FulfillmentOrder_WMS.id == int(id)).first()
    else:
        fo = db.query(models.FulfillmentOrder_WMS).filter(models.FulfillmentOrder_WMS.fulfillment_number == id).first()
        
    if not fo:
        raise HTTPException(status_code=404, detail="Fulfillment order not found")
        
    fo.status = "PACKED"
    session = db.query(models.PackingSession).filter(models.PackingSession.fulfillment_order_id == fo.id).first()
    if not session:
        session = models.PackingSession(
            fulfillment_order_id=fo.id,
            status="completed",
            tracking_number="TRK-AUTO-GEN",
            carrier_name="Default Carrier",
            completed_at=datetime.utcnow()
        )
        db.add(session)
    else:
        session.status = "completed"
        session.completed_at = datetime.utcnow()
        
    db.commit()
    notify_oms_status(fo.oms_order_id, "PACKED")
    return {"status": "success", "fulfillment_number": fo.fulfillment_number, "status_code": fo.status}

@app.post("/fulfillment-orders/{id}/pack")
def pack_fulfillment_order(id: str, tracking_number: str = "TRK123", db: Session = Depends(get_db)):
    if id.isdigit():
        fo = db.query(models.FulfillmentOrder_WMS).filter(models.FulfillmentOrder_WMS.id == int(id)).first()
    else:
        fo = db.query(models.FulfillmentOrder_WMS).filter(models.FulfillmentOrder_WMS.fulfillment_number == id).first()
        
    if not fo:
        raise HTTPException(status_code=404, detail="Fulfillment order not found")
        
    fo.status = "PACKED"
    session = models.PackingSession(
        fulfillment_order_id=fo.id,
        status="completed",
        tracking_number=tracking_number,
        carrier_name="Default Carrier",
        completed_at=datetime.utcnow()
    )
    db.add(session)
    db.commit()
    notify_oms_status(fo.oms_order_id, "PACKED")
    return {"status": "success", "fulfillment_number": fo.fulfillment_number}

@app.post("/fulfillment-orders/{id}/ship")
def ship_fulfillment_order(id: str, db: Session = Depends(get_db)):
    if id.isdigit():
        fo = db.query(models.FulfillmentOrder_WMS).filter(models.FulfillmentOrder_WMS.id == int(id)).first()
    else:
        fo = db.query(models.FulfillmentOrder_WMS).filter(models.FulfillmentOrder_WMS.fulfillment_number == id).first()
        
    if not fo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fulfillment order not found"
        )
        
    if fo.status == "SHIPPED":
        return {"status": "already_shipped", "fulfillment_number": fo.fulfillment_number}
        
    for item in fo.pick_list_items:
        inv = db.query(models.Inventory).filter(
            models.Inventory.sku_code == item.sku_code,
            models.Inventory.location_id == item.location_id
        ).first()
        if not inv or inv.qty_on_hand < item.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient physical stock to ship SKU {item.sku_code}"
            )
        inv.qty_on_hand -= item.quantity
        inv.qty_reserved = max(0, inv.qty_reserved - item.quantity)
        log_stock_transaction(db, item.sku_code, item.location_id, "OUTBOUND", -item.quantity, f"Ship {fo.fulfillment_number}")
        
    fo.status = "SHIPPED"
    fo.completed_at = datetime.utcnow()
    db.commit()
    notify_oms_status(fo.oms_order_id, "SHIPPED")
    return {"status": "success", "fulfillment_number": fo.fulfillment_number}


@app.get("/fulfillment-orders", response_model=List[schemas.FulfillmentOrderWMSResponse])
def list_fulfillment_orders(db: Session = Depends(get_db)):
    return db.query(models.FulfillmentOrder_WMS).all()

@app.get("/fulfillment-orders/{id}", response_model=schemas.FulfillmentOrderWMSResponse)
def get_fulfillment_order(id: str, db: Session = Depends(get_db)):
    if id.isdigit():
        fo = db.query(models.FulfillmentOrder_WMS).filter(models.FulfillmentOrder_WMS.id == int(id)).first()
    else:
        fo = db.query(models.FulfillmentOrder_WMS).filter(models.FulfillmentOrder_WMS.fulfillment_number == id).first()
    if not fo:
        raise HTTPException(status_code=404, detail="Fulfillment order not found")
    return fo


# --- Product Sync API ---

@app.post("/products/sync")
def sync_products(db: Session = Depends(get_db)):
    pmi_url = "http://pim-api:8000/products?limit=100"
    try:
        req = urllib.request.Request(pmi_url, method="GET")
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode("utf-8"))
            products = data.get("items", [])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch products from PMI: {str(e)}")
        
    synced_count = 0
    for prod in products:
        for var in prod.get("variants", []):
            sku = var.get("sku_code")
            if not sku:
                continue
            barcode = f"BAR-{sku}"
            bm = db.query(models.BarcodeMapping).filter(models.BarcodeMapping.sku_code == sku).first()
            if not bm:
                bm = models.BarcodeMapping(
                    barcode=barcode,
                    barcode_type="EAN-13",
                    sku_code=sku,
                    product_name=prod.get("name"),
                    variant_name=var.get("tier_1_option") or "Standard",
                    image_url=prod.get("media", [{}])[0].get("image_url") if prod.get("media") else None
                )
                db.add(bm)
            else:
                bm.product_name = prod.get("name")
                bm.variant_name = var.get("tier_1_option") or "Standard"
                if prod.get("media"):
                    bm.image_url = prod.get("media")[0].get("image_url")
            synced_count += 1
    db.commit()
    return {"status": "success", "synced_count": synced_count}


# --- Stock Transaction Logs ---

@app.get("/stock-transactions", response_model=List[schemas.StockTransactionResponse])
def list_stock_transactions(sku_code: Optional[str] = None, location_id: Optional[int] = None, transaction_type: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.StockTransaction)
    if sku_code:
        query = query.filter(models.StockTransaction.sku_code == sku_code)
    if location_id:
        query = query.filter(models.StockTransaction.location_id == location_id)
    if transaction_type:
        query = query.filter(models.StockTransaction.transaction_type == transaction_type)
    return query.order_by(models.StockTransaction.created_at.desc()).all()
