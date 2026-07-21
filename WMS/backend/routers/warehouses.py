from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
import models
import schemas

router = APIRouter(tags=['Warehouses'])

@router.post("/warehouses", response_model=schemas.WarehouseResponse, status_code=status.HTTP_201_CREATED)
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

@router.get("/warehouses", response_model=List[schemas.WarehouseResponse])
def list_warehouses(skip: int = 0, limit: Optional[int] = Query(None), db: Session = Depends(get_db)):
    query = db.query(models.Warehouse).offset(skip)
    if limit is not None:
        query = query.limit(limit)
    return query.all()

@router.get("/warehouses/{warehouse_id}", response_model=schemas.WarehouseResponse)
def get_warehouse(warehouse_id: int, db: Session = Depends(get_db)):
    db_warehouse = db.query(models.Warehouse).filter(models.Warehouse.id == warehouse_id).first()
    if not db_warehouse:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Warehouse with ID {warehouse_id} not found."
        )
    return db_warehouse

@router.get("/warehouses/code/{code}", response_model=schemas.WarehouseResponse)
def get_warehouse_by_code(code: str, db: Session = Depends(get_db)):
    db_warehouse = db.query(models.Warehouse).filter(models.Warehouse.code == code).first()
    if not db_warehouse:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Warehouse with code {code} not found."
        )
    return db_warehouse

@router.put("/warehouses/{warehouse_id}", response_model=schemas.WarehouseResponse)
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

@router.delete("/warehouses/{warehouse_id}", status_code=status.HTTP_204_NO_CONTENT)
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

@router.get("/locations", response_model=List[schemas.LocationResponse])
def list_locations(db: Session = Depends(get_db)):
    return db.query(models.Location).all()

@router.get("/warehouses/{id}/locations", response_model=List[schemas.LocationResponse])
def get_warehouse_locations(id: int, db: Session = Depends(get_db)):
    wh = db.query(models.Warehouse).filter(models.Warehouse.id == id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    return db.query(models.Location).filter(models.Location.warehouse_id == id).all()

@router.get("/locations/code/{code}", response_model=schemas.LocationResponse)
def get_location_by_code_route(code: str, db: Session = Depends(get_db)):
    loc = db.query(models.Location).filter(models.Location.location_code == code).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    return loc

@router.get("/locations/{id_or_code}", response_model=schemas.LocationResponse)
def get_location(id_or_code: str, db: Session = Depends(get_db)):
    loc = None
    if id_or_code.isdigit():
        loc = db.query(models.Location).filter(models.Location.id == int(id_or_code)).first()
    if not loc:
        loc = db.query(models.Location).filter(models.Location.location_code == id_or_code).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    return loc

@router.post("/locations", response_model=schemas.LocationResponse, status_code=201)
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

@router.put("/locations/{id}", response_model=schemas.LocationResponse)
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

@router.delete("/locations/{id}", status_code=204)
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
