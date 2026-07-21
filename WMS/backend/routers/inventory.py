from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
import models
import schemas
from utils.helpers import log_stock_transaction

router = APIRouter(tags=['Inventory'])
public_router = APIRouter(tags=['Public Inventory'])

def _calculate_public_stock(db: Session, raw_skus: Optional[List[str]]) -> dict:
    requested_skus: List[str] = []
    if raw_skus:
        for item in raw_skus:
            if item:
                for part in str(item).split(","):
                    cleaned = part.strip()
                    if cleaned and cleaned not in requested_skus:
                        requested_skus.append(cleaned)

    query = db.query(
        models.Inventory.sku_code,
        func.sum(models.Inventory.qty_on_hand).label("total_on_hand"),
        func.sum(models.Inventory.qty_reserved).label("total_reserved"),
        func.sum(models.Inventory.qty_on_hand - models.Inventory.qty_reserved).label("total_available")
    )

    if requested_skus:
        query = query.filter(models.Inventory.sku_code.in_(requested_skus))

    results = query.group_by(models.Inventory.sku_code).all()

    stock_map = {}
    items_map = {}
    for row in results:
        on_hand = int(row.total_on_hand or 0)
        reserved = int(row.total_reserved or 0)
        available = max(0, int(row.total_available or 0))
        stock_map[row.sku_code] = available
        items_map[row.sku_code] = {
            "sku_code": row.sku_code,
            "qty_available": available,
            "qty_on_hand": on_hand,
            "qty_reserved": reserved
        }

    stock_result = {}
    items_result = []

    if requested_skus:
        for sku in requested_skus:
            if sku in items_map:
                stock_result[sku] = stock_map[sku]
                items_result.append(items_map[sku])
            else:
                stock_result[sku] = 0
                items_result.append({
                    "sku_code": sku,
                    "qty_available": 0,
                    "qty_on_hand": 0,
                    "qty_reserved": 0
                })
    else:
        for sku, item in items_map.items():
            stock_result[sku] = stock_map[sku]
            items_result.append(item)

    return {
        "stock": stock_result,
        "items": items_result
    }

@public_router.get("/public/stock", response_model=schemas.PublicStockResponse)
def get_public_stock(
    sku_codes: Optional[List[str]] = Query(None, description="SKU codes (single, comma-separated, or list)"),
    db: Session = Depends(get_db)
):
    return _calculate_public_stock(db, sku_codes)

@public_router.post("/public/stock", response_model=schemas.PublicStockResponse)
def post_public_stock(
    payload: Optional[schemas.PublicStockRequest] = None,
    db: Session = Depends(get_db)
):
    raw_skus = payload.sku_codes if payload and payload.sku_codes is not None else None
    return _calculate_public_stock(db, raw_skus)

@router.get("/inventory", response_model=List[schemas.InventoryResponse])
def list_inventory(skip: int = 0, limit: Optional[int] = Query(None), db: Session = Depends(get_db)):
    query = db.query(models.Inventory).offset(skip)
    if limit is not None:
        query = query.limit(limit)
    return query.all()

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
