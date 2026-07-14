from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from database import get_db
import models
import schemas
from utils.helpers import log_stock_transaction

router = APIRouter(tags=['Inbound'])

@router.get("/inbound-shipments", response_model=List[schemas.InboundShipmentResponse])
def list_inbound_shipments(db: Session = Depends(get_db)):
    return db.query(models.InboundShipment).all()

@router.get("/inbound-shipments/{id}", response_model=schemas.InboundShipmentResponse)
def get_inbound_shipment(id: int, db: Session = Depends(get_db)):
    shipment = db.query(models.InboundShipment).filter(models.InboundShipment.id == id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Inbound shipment not found")
    return shipment

@router.post("/inbound-shipments", response_model=schemas.InboundShipmentResponse, status_code=201)
def create_inbound_shipment(payload: schemas.InboundShipmentCreate, db: Session = Depends(get_db)):
    # Check duplicate inbound number
    dup = db.query(models.InboundShipment).filter(models.InboundShipment.inbound_number == payload.inbound_number).first()
    if dup:
        raise HTTPException(status_code=400, detail="Inbound shipment already exists")
    total_amount = sum(item.expected_qty * (item.unit_cost or 0) for item in payload.items)
    shipment = models.InboundShipment(
        inbound_number=payload.inbound_number,
        warehouse_id=payload.warehouse_id,
        supplier_name=payload.supplier_name,
        status="pending",
        note=payload.note,
        created_by=payload.created_by,
        expected_date=payload.expected_date,
        receiver_name=payload.receiver_name,
        original_document_number=payload.original_document_number,
        total_amount=total_amount
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
            status=item.status or "pending",
            unit_cost=item.unit_cost
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

@router.post("/inbound-shipments/{id}/receive")
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

@router.post("/inbound/{id}/receive-scan")
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

@router.post("/inbound/{id}/put-away")
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

@router.post("/inbound-shipments/{id}/complete")
@router.post("/inbound/{id}/complete")
@router.patch("/inbound-shipments/{id}/complete")
@router.patch("/inbound/{id}/complete")
def complete_inbound_shipment(id: int, db: Session = Depends(get_db)):
    shipment = db.query(models.InboundShipment).filter(models.InboundShipment.id == id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Inbound shipment not found")
    if shipment.status == "COMPLETED":
        raise HTTPException(status_code=400, detail="Already completed")
    for item in shipment.items:
        if not item.location_id:
            raise HTTPException(status_code=400, detail=f"Location not assigned for SKU {item.sku_code}")
        inv = db.query(models.Inventory).filter(
            models.Inventory.sku_code == item.sku_code,
            models.Inventory.location_id == item.location_id
        ).with_for_update().first()
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
