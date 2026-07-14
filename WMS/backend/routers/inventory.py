from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
import models
import schemas
from utils.helpers import log_stock_transaction

router = APIRouter(tags=['Inventory'])

@router.get("/inventory", response_model=List[schemas.InventoryResponse])
def list_inventory(db: Session = Depends(get_db)):
    return db.query(models.Inventory).all()

class InventoryAdjustInput(schemas.BaseModel):
    sku_code: str
    location_id: int
    quantity: int  # delta change (positive or negative)
    note: Optional[str] = None

@router.post("/inventory/adjust", response_model=schemas.InventoryResponse)
def adjust_inventory(payload: InventoryAdjustInput, db: Session = Depends(get_db)):
    inv = db.query(models.Inventory).filter(
        models.Inventory.sku_code == payload.sku_code,
        models.Inventory.location_id == payload.location_id
    ).with_for_update().first()
    if not inv:
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

@router.post("/inventory/transfer")
def transfer_inventory(payload: InventoryTransferInput, db: Session = Depends(get_db)):
    if payload.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be positive")
    
    src = db.query(models.Inventory).filter(
        models.Inventory.sku_code == payload.sku_code,
        models.Inventory.location_id == payload.from_location_id
    ).with_for_update().first()
    if not src or (src.qty_on_hand - src.qty_reserved) < payload.quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock available for transfer")
        
    dest = db.query(models.Inventory).filter(
        models.Inventory.sku_code == payload.sku_code,
        models.Inventory.location_id == payload.to_location_id
    ).with_for_update().first()
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
