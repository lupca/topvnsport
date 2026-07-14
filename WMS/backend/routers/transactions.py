from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
import models
import schemas

router = APIRouter(tags=['Transactions'])

@router.get("/stock-transactions", response_model=List[schemas.StockTransactionResponse])
def list_stock_transactions(sku_code: Optional[str] = None, location_id: Optional[int] = None, transaction_type: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.StockTransaction)
    if sku_code:
        query = query.filter(models.StockTransaction.sku_code == sku_code)
    if location_id:
        query = query.filter(models.StockTransaction.location_id == location_id)
    if transaction_type:
        query = query.filter(models.StockTransaction.transaction_type == transaction_type)
    return query.order_by(models.StockTransaction.created_at.desc()).all()
