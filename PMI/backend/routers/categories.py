from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models
import schemas
from utils.audit import audit_action

router = APIRouter(tags=['Categories'])

@router.get("/categories", response_model=List[schemas.CategoryResponse])
def get_categories(db: Session = Depends(get_db)):
    categories = db.query(models.Category).all()
    cat_dict = {c.id: c for c in categories}
    
    response = []
    for cat in categories:
        path = []
        curr = cat
        visited = set()
        while curr and curr.id not in visited:
            visited.add(curr.id)
            path.insert(0, curr.name)
            curr = cat_dict.get(curr.parent_id) if curr.parent_id else None
        
        display_name = f"[root] / {' / '.join(path)}"
        
        response.append(schemas.CategoryResponse(
            id=cat.id,
            name=cat.name,
            code=cat.code,
            parent_id=cat.parent_id,
            created_at=cat.created_at,
            display_name=display_name
        ))
    return response

@router.get("/categories/{category_id}", response_model=schemas.CategoryResponse)
def get_category(category_id: int, db: Session = Depends(get_db)):
    cat = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    
    path = []
    curr = cat
    visited = set()
    while curr and curr.id not in visited:
        visited.add(curr.id)
        path.insert(0, curr.name)
        curr = db.query(models.Category).filter(models.Category.id == curr.parent_id).first() if curr.parent_id else None
    
    display_name = f"[root] / {' / '.join(path)}"
    
    return schemas.CategoryResponse(
        id=cat.id,
        name=cat.name,
        code=cat.code,
        parent_id=cat.parent_id,
        created_at=cat.created_at,
        display_name=display_name
    )

@router.post("/categories", response_model=schemas.CategoryResponse, status_code=status.HTTP_201_CREATED)
@audit_action(module="Category", action_type="CREATE")
def create_category(category: schemas.CategoryCreate, db: Session = Depends(get_db)):
    db_cat = db.query(models.Category).filter(models.Category.code == category.code).first()
    if db_cat:
        raise HTTPException(status_code=400, detail="Category code already exists.")
    
    new_cat = models.Category(
        name=category.name,
        code=category.code,
        parent_id=category.parent_id
    )
    db.add(new_cat)
    try:
        db.commit()
        db.refresh(new_cat)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database transaction failed: {str(e)}")
    
    path = []
    curr = new_cat
    visited = set()
    while curr and curr.id not in visited:
        visited.add(curr.id)
        path.insert(0, curr.name)
        curr = db.query(models.Category).filter(models.Category.id == curr.parent_id).first() if curr.parent_id else None
    
    display_name = f"[root] / {' / '.join(path)}"
    
    return schemas.CategoryResponse(
        id=new_cat.id,
        name=new_cat.name,
        code=new_cat.code,
        parent_id=new_cat.parent_id,
        created_at=new_cat.created_at,
        display_name=display_name
    )

@router.put("/categories/{category_id}", response_model=schemas.CategoryResponse)
@audit_action(module="Category", action_type="UPDATE")
def update_category(category_id: int, category_in: schemas.CategoryUpdate, db: Session = Depends(get_db)):
    db_cat = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not db_cat:
        raise HTTPException(status_code=404, detail="Category not found")
    
    if category_in.parent_id == category_id:
        raise HTTPException(status_code=400, detail="A category cannot be its own parent.")
        
    dup = db.query(models.Category).filter(models.Category.code == category_in.code, models.Category.id != category_id).first()
    if dup:
        raise HTTPException(status_code=400, detail="Category code already exists.")
        
    db_cat.name = category_in.name
    db_cat.code = category_in.code
    db_cat.parent_id = category_in.parent_id
    try:
        db.commit()
        db.refresh(db_cat)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database transaction failed: {str(e)}")
    
    path = []
    curr = db_cat
    visited = set()
    while curr and curr.id not in visited:
        visited.add(curr.id)
        path.insert(0, curr.name)
        curr = db.query(models.Category).filter(models.Category.id == curr.parent_id).first() if curr.parent_id else None
    
    display_name = f"[root] / {' / '.join(path)}"
    
    return schemas.CategoryResponse(
        id=db_cat.id,
        name=db_cat.name,
        code=db_cat.code,
        parent_id=db_cat.parent_id,
        created_at=db_cat.created_at,
        display_name=display_name
    )

@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
@audit_action(module="Category", action_type="DELETE")
def delete_category(category_id: int, db: Session = Depends(get_db)):
    db_cat = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not db_cat:
        raise HTTPException(status_code=404, detail="Category not found")
    try:
        db.delete(db_cat)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database transaction failed: {str(e)}")

