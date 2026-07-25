from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from utils.auth import get_current_user, get_optional_user

router = APIRouter(prefix="/customers", tags=["Customers"])


@router.post("", response_model=schemas.CustomerOut, status_code=status.HTTP_201_CREATED)
def create_customer(
    customer: schemas.CustomerCreate,
    response: Response,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_optional_user)
):
    existing = db.query(models.Customer).filter(models.Customer.phone == customer.phone).first()
    if existing:
        response.status_code = status.HTTP_200_OK
        return existing

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
        existing = db.query(models.Customer).filter(models.Customer.phone == customer.phone).first()
        if existing:
            response.status_code = status.HTTP_200_OK
            return existing
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Customer creation failed."
        )


@router.get("", response_model=schemas.PaginatedCustomers)
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


@router.get("/{customer_id}", response_model=schemas.CustomerOut)
def retrieve_customer(customer_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    return customer


@router.put("/{customer_id}", response_model=schemas.CustomerOut)
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


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
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
