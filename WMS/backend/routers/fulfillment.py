from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from database import get_db
import models
import schemas
from utils.helpers import log_stock_transaction, notify_oms_status

router = APIRouter(tags=['Fulfillment'])

def _get_fulfillment_order(db: Session, id_or_number: str) -> models.FulfillmentOrder_WMS:
    if id_or_number.isdigit():
        fo = db.query(models.FulfillmentOrder_WMS).filter(models.FulfillmentOrder_WMS.id == int(id_or_number)).first()
        if fo:
            return fo
    return db.query(models.FulfillmentOrder_WMS).filter(models.FulfillmentOrder_WMS.fulfillment_number == id_or_number).first()

@router.post("/fulfillment-orders", response_model=schemas.FulfillmentOrderWMSResponse, status_code=status.HTTP_201_CREATED)
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
        status=payload.status or "PENDING",
        original_document_number=payload.original_document_number,
        total_amount=0
    )
    db.add(new_fo)
    db.flush()
    
    # 2. Process items
    total_amount = 0
    for item in payload.items:
        required_qty = item.quantity
        
        # Look up selling price from BarcodeMapping
        bm = db.query(models.BarcodeMapping).filter(models.BarcodeMapping.sku_code == item.sku_code).first()
        selling_price = bm.selling_price if (bm and bm.selling_price) else 0
        
        # Lock all available inventory for this SKU in this warehouse
        inventories = db.query(models.Inventory).join(models.Location).join(models.Warehouse)\
            .filter(
                models.Warehouse.code == payload.warehouse_code,
                models.Inventory.sku_code == item.sku_code,
                (models.Inventory.qty_on_hand - models.Inventory.qty_reserved) > 0
            ).with_for_update().all()
            
        total_available = sum((inv.qty_on_hand - inv.qty_reserved) for inv in inventories)
        if total_available < required_qty:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Not enough available stock for SKU {item.sku_code} in warehouse {payload.warehouse_code}. Required: {required_qty}, Available: {total_available}."
            )
            
        remaining_to_reserve = required_qty
        for inv in inventories:
            if remaining_to_reserve <= 0:
                break
                
            available_here = inv.qty_on_hand - inv.qty_reserved
            qty_to_reserve = min(available_here, remaining_to_reserve)
            
            inv.qty_reserved += qty_to_reserve
            remaining_to_reserve -= qty_to_reserve
            
            log_stock_transaction(db, item.sku_code, inv.location_id, "RESERVE", qty_to_reserve, f"Reserve for {new_fo.fulfillment_number}")
            
            # Create PickListItem
            pick_item = models.PickListItem(
                fulfillment_order_id=new_fo.id,
                sku_code=item.sku_code,
                product_name=item.product_name,
                location_id=inv.location_id,
                quantity=qty_to_reserve,
                status="pending",
                selling_price=selling_price
            )
            db.add(pick_item)
            total_amount += qty_to_reserve * selling_price
        
    new_fo.total_amount = total_amount
    db.commit()
    db.refresh(new_fo)
    return new_fo

@router.post("/fulfillment-orders/{id}/cancel")
def cancel_fulfillment_order(id: str, db: Session = Depends(get_db)):
    fo = _get_fulfillment_order(db, id)
        
    if not fo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fulfillment order not found"
        )
        
    if fo.status == "SHIPPED":
        raise HTTPException(status_code=400, detail="Cannot cancel a shipped order")
        
    if fo.status == "CANCELLED":
        return {"status": "already_cancelled", "fulfillment_number": fo.fulfillment_number}
        
    # Revert reserved quantities
    for item in fo.pick_list_items:
        inv = db.query(models.Inventory).filter(
            models.Inventory.sku_code == item.sku_code,
            models.Inventory.location_id == item.location_id
        ).with_for_update().first()
        if inv:
            inv.qty_reserved = max(0, inv.qty_reserved - item.quantity)
            log_stock_transaction(db, item.sku_code, item.location_id, "UNRESERVE", -item.quantity, f"Cancel {fo.fulfillment_number}")
            
    fo.status = "CANCELLED"
    try:
        notify_oms_status(fo.oms_order_id, fo.fulfillment_number, "CANCELLED")
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Lỗi đồng bộ với OMS, thao tác bị hủy.")
    return {"status": "success", "fulfillment_number": fo.fulfillment_number}

class FulfillmentScanPickInput(schemas.BaseModel):
    barcode: str
    quantity: int = 1

class FulfillmentScanPackInput(schemas.BaseModel):
    tracking_number: str
    carrier_name: Optional[str] = "Default Carrier"

@router.post("/fulfillment-orders/{id}/start-pick")
def start_pick_fulfillment_order(id: str, db: Session = Depends(get_db)):
    fo = _get_fulfillment_order(db, id)
        
    if not fo:
        raise HTTPException(status_code=404, detail="Fulfillment order not found")
        
    fo.status = "PICKING"
    for item in fo.pick_list_items:
        if item.status == "pending":
            item.status = "picking"
    try:
        notify_oms_status(fo.oms_order_id, fo.fulfillment_number, "PICKING")
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Lỗi đồng bộ với OMS, thao tác bị hủy.")
    return {"status": "success", "fulfillment_number": fo.fulfillment_number, "status_code": fo.status}

@router.post("/fulfillment-orders/{id}/scan-pick")
def scan_pick_fulfillment_order(id: str, payload: FulfillmentScanPickInput, db: Session = Depends(get_db)):
    fo = _get_fulfillment_order(db, id)
        
    if not fo:
        raise HTTPException(status_code=404, detail="Fulfillment order not found")
        
    bm = db.query(models.BarcodeMapping).filter(models.BarcodeMapping.barcode == payload.barcode).first()
    if not bm:
        bm = db.query(models.BarcodeMapping).filter(models.BarcodeMapping.sku_code == payload.barcode).first()
        if not bm:
            raise HTTPException(status_code=400, detail=f"Barcode or SKU {payload.barcode} mapping not found")
        
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

@router.post("/fulfillment-orders/{id}/complete-pick")
def complete_pick_fulfillment_order(id: str, db: Session = Depends(get_db)):
    fo = _get_fulfillment_order(db, id)
        
    if not fo:
        raise HTTPException(status_code=404, detail="Fulfillment order not found")
        
    fo.status = "PICKED"
    for item in fo.pick_list_items:
        if item.picked_qty < item.quantity:
            item.picked_qty = item.quantity
        item.status = "picked"
        
    try:
        notify_oms_status(fo.oms_order_id, fo.fulfillment_number, "PICKING")
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Lỗi đồng bộ với OMS, thao tác bị hủy.")
    return {"status": "success", "fulfillment_number": fo.fulfillment_number, "status_code": fo.status}

@router.post("/fulfillment-orders/{id}/pick")
def pick_fulfillment_order(id: str, db: Session = Depends(get_db)):
    fo = _get_fulfillment_order(db, id)
        
    if not fo:
        raise HTTPException(status_code=404, detail="Fulfillment order not found")
        
    fo.status = "PICKING"
    for item in fo.pick_list_items:
        item.picked_qty = item.quantity
        item.status = "picked"
    try:
        notify_oms_status(fo.oms_order_id, fo.fulfillment_number, "PICKING")
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Lỗi đồng bộ với OMS, thao tác bị hủy.")
    return {"status": "success", "fulfillment_number": fo.fulfillment_number}

@router.post("/fulfillment-orders/{id}/scan-pack")
def scan_pack_fulfillment_order(id: str, payload: FulfillmentScanPackInput, db: Session = Depends(get_db)):
    fo = _get_fulfillment_order(db, id)
        
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

@router.post("/fulfillment-orders/{id}/complete-pack")
def complete_pack_fulfillment_order(id: str, db: Session = Depends(get_db)):
    fo = _get_fulfillment_order(db, id)
        
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
        
    try:
        notify_oms_status(fo.oms_order_id, fo.fulfillment_number, "PACKED")
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Lỗi đồng bộ với OMS, thao tác bị hủy.")
    return {"status": "success", "fulfillment_number": fo.fulfillment_number, "status_code": fo.status}

@router.post("/fulfillment-orders/{id}/pack")
def pack_fulfillment_order(id: str, tracking_number: str = "TRK123", db: Session = Depends(get_db)):
    fo = _get_fulfillment_order(db, id)
        
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
    try:
        notify_oms_status(fo.oms_order_id, fo.fulfillment_number, "PACKED")
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Lỗi đồng bộ với OMS, thao tác bị hủy.")
    return {"status": "success", "fulfillment_number": fo.fulfillment_number}

@router.post("/fulfillment-orders/{id}/ship")
def ship_fulfillment_order(id: str, db: Session = Depends(get_db)):
    fo = _get_fulfillment_order(db, id)
        
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
        ).with_for_update().first()
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
    try:
        notify_oms_status(fo.oms_order_id, fo.fulfillment_number, "SHIPPED")
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Lỗi đồng bộ với OMS, thao tác bị hủy.")
    return {"status": "success", "fulfillment_number": fo.fulfillment_number}

@router.get("/fulfillment-orders", response_model=List[schemas.FulfillmentOrderWMSResponse])
def list_fulfillment_orders(db: Session = Depends(get_db)):
    return db.query(models.FulfillmentOrder_WMS).all()

@router.get("/fulfillment-orders/{id}", response_model=schemas.FulfillmentOrderWMSResponse)
def get_fulfillment_order(id: str, db: Session = Depends(get_db)):
    fo = _get_fulfillment_order(db, id)
    if not fo:
        raise HTTPException(status_code=404, detail="Fulfillment order not found")
    return fo
