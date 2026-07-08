from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models
import schemas

router = APIRouter(tags=['Attributes'])

@router.get("/attributes", response_model=List[schemas.AttributeResponse])
def get_attributes(db: Session = Depends(get_db)):
    return db.query(models.Attribute).order_by(models.Attribute.created_at.desc()).all()

@router.get("/attributes/{attribute_id}", response_model=schemas.AttributeResponse)
def get_attribute(attribute_id: int, db: Session = Depends(get_db)):
    attr = db.query(models.Attribute).filter(models.Attribute.id == attribute_id).first()
    if not attr:
        raise HTTPException(status_code=404, detail="Attribute not found")
    return attr

@router.post("/attributes", response_model=schemas.AttributeResponse, status_code=status.HTTP_201_CREATED)
def create_attribute(attribute: schemas.AttributeCreate, db: Session = Depends(get_db)):
    db_attr = db.query(models.Attribute).filter(models.Attribute.code == attribute.code).first()
    if db_attr:
        raise HTTPException(status_code=400, detail="Attribute code already exists.")
    
    new_attr = models.Attribute(
        code=attribute.code,
        name=attribute.name,
        type=attribute.type,
        is_required=attribute.is_required,
        is_unique=attribute.is_unique,
        is_locale_based=attribute.is_locale_based,
        is_channel_based=attribute.is_channel_based
    )
    db.add(new_attr)
    try:
        db.commit()
        db.refresh(new_attr)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database transaction failed: {str(e)}")
    return new_attr

@router.put("/attributes/{attribute_id}", response_model=schemas.AttributeResponse)
def update_attribute(attribute_id: int, attribute_in: schemas.AttributeUpdate, db: Session = Depends(get_db)):
    db_attr = db.query(models.Attribute).filter(models.Attribute.id == attribute_id).first()
    if not db_attr:
        raise HTTPException(status_code=404, detail="Attribute not found")
        
    dup = db.query(models.Attribute).filter(models.Attribute.code == attribute_in.code, models.Attribute.id != attribute_id).first()
    if dup:
        raise HTTPException(status_code=400, detail="Attribute code already exists.")
        
    db_attr.code = attribute_in.code
    db_attr.name = attribute_in.name
    db_attr.type = attribute_in.type
    db_attr.is_required = attribute_in.is_required
    db_attr.is_unique = attribute_in.is_unique
    db_attr.is_locale_based = attribute_in.is_locale_based
    db_attr.is_channel_based = attribute_in.is_channel_based
    
    try:
        db.commit()
        db.refresh(db_attr)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database transaction failed: {str(e)}")
    return db_attr

@router.delete("/attributes/{attribute_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attribute(attribute_id: int, db: Session = Depends(get_db)):
    db_attr = db.query(models.Attribute).filter(models.Attribute.id == attribute_id).first()
    if not db_attr:
        raise HTTPException(status_code=404, detail="Attribute not found")
    try:
        db.delete(db_attr)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database transaction failed: {str(e)}")

# Attribute Group Endpoints
@router.get("/attribute-groups", response_model=List[schemas.AttributeGroupResponse])
def get_attribute_groups(db: Session = Depends(get_db)):
    return db.query(models.AttributeGroup).order_by(models.AttributeGroup.created_at.desc()).all()

@router.get("/attribute-groups/{group_id}", response_model=schemas.AttributeGroupResponse)
def get_attribute_group(group_id: int, db: Session = Depends(get_db)):
    grp = db.query(models.AttributeGroup).filter(models.AttributeGroup.id == group_id).first()
    if not grp:
        raise HTTPException(status_code=404, detail="Attribute Group not found")
    return grp

@router.post("/attribute-groups", response_model=schemas.AttributeGroupResponse, status_code=status.HTTP_201_CREATED)
def create_attribute_group(group: schemas.AttributeGroupCreate, db: Session = Depends(get_db)):
    db_grp = db.query(models.AttributeGroup).filter(models.AttributeGroup.code == group.code).first()
    if db_grp:
        raise HTTPException(status_code=400, detail="Attribute Group code already exists.")
    
    new_grp = models.AttributeGroup(
        code=group.code,
        name=group.name
    )
    db.add(new_grp)
    try:
        db.commit()
        db.refresh(new_grp)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database transaction failed: {str(e)}")
    return new_grp

@router.put("/attribute-groups/{group_id}", response_model=schemas.AttributeGroupResponse)
def update_attribute_group(group_id: int, group_in: schemas.AttributeGroupUpdate, db: Session = Depends(get_db)):
    db_grp = db.query(models.AttributeGroup).filter(models.AttributeGroup.id == group_id).first()
    if not db_grp:
        raise HTTPException(status_code=404, detail="Attribute Group not found")
        
    dup = db.query(models.AttributeGroup).filter(models.AttributeGroup.code == group_in.code, models.AttributeGroup.id != group_id).first()
    if dup:
        raise HTTPException(status_code=400, detail="Attribute Group code already exists.")
        
    db_grp.code = group_in.code
    db_grp.name = group_in.name
    
    try:
        db.commit()
        db.refresh(db_grp)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database transaction failed: {str(e)}")
    return db_grp

@router.delete("/attribute-groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attribute_group(group_id: int, db: Session = Depends(get_db)):
    db_grp = db.query(models.AttributeGroup).filter(models.AttributeGroup.id == group_id).first()
    if not db_grp:
        raise HTTPException(status_code=404, detail="Attribute Group not found")
    try:
        db.delete(db_grp)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database transaction failed: {str(e)}")

# Attribute Family Endpoints
@router.get("/attribute-families", response_model=List[schemas.AttributeFamilyResponse])
def get_attribute_families(db: Session = Depends(get_db)):
    return db.query(models.AttributeFamily).order_by(models.AttributeFamily.created_at.desc()).all()

@router.get("/attribute-families/{family_id}", response_model=schemas.AttributeFamilyResponse)
def get_attribute_family(family_id: int, db: Session = Depends(get_db)):
    fam = db.query(models.AttributeFamily).filter(models.AttributeFamily.id == family_id).first()
    if not fam:
        raise HTTPException(status_code=404, detail="Attribute Family not found")
    return fam


@router.get("/attribute-families/{family_id}/attributes", response_model=List[schemas.AttributeResponse])
def get_attributes_by_family(family_id: int, db: Session = Depends(get_db)):
    fam = db.query(models.AttributeFamily).filter(models.AttributeFamily.id == family_id).first()
    if not fam:
        raise HTTPException(status_code=404, detail="Attribute Family not found")

    family_attrs = (
        db.query(models.Attribute)
        .join(models.AttributeFamilyAttribute, models.AttributeFamilyAttribute.attribute_id == models.Attribute.id)
        .filter(models.AttributeFamilyAttribute.family_id == family_id)
        .order_by(models.AttributeFamilyAttribute.display_order.asc(), models.Attribute.id.asc())
        .all()
    )
    return family_attrs

@router.post("/attribute-families/{family_id}/attributes", response_model=schemas.AttributeResponse, status_code=status.HTTP_201_CREATED)
def link_attribute_to_family(family_id: int, payload: schemas.AttributeFamilyLinkCreate, db: Session = Depends(get_db)):
    fam = db.query(models.AttributeFamily).filter(models.AttributeFamily.id == family_id).first()
    if not fam:
        raise HTTPException(status_code=404, detail="Attribute Family not found")
        
    attr = db.query(models.Attribute).filter(models.Attribute.id == payload.attribute_id).first()
    if not attr:
        raise HTTPException(status_code=404, detail="Attribute not found")
        
    # Check if already linked
    existing_link = db.query(models.AttributeFamilyAttribute).filter(
        models.AttributeFamilyAttribute.family_id == family_id,
        models.AttributeFamilyAttribute.attribute_id == payload.attribute_id
    ).first()
    if existing_link:
        return attr # Already linked, just return it

    # Get max display_order
    max_order = db.query(models.func.max(models.AttributeFamilyAttribute.display_order)).filter(
        models.AttributeFamilyAttribute.family_id == family_id
    ).scalar() or 0
    
    new_link = models.AttributeFamilyAttribute(
        family_id=family_id,
        attribute_id=payload.attribute_id,
        display_order=max_order + 1
    )
    db.add(new_link)
    db.commit()
    
    return attr

@router.post("/attribute-families", response_model=schemas.AttributeFamilyResponse, status_code=status.HTTP_201_CREATED)
def create_attribute_family(family: schemas.AttributeFamilyCreate, db: Session = Depends(get_db)):
    db_fam = db.query(models.AttributeFamily).filter(models.AttributeFamily.code == family.code).first()
    if db_fam:
        raise HTTPException(status_code=400, detail="Attribute Family code already exists.")
    
    new_fam = models.AttributeFamily(
        code=family.code,
        name=family.name
    )
    db.add(new_fam)
    try:
        db.commit()
        db.refresh(new_fam)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database transaction failed: {str(e)}")
    return new_fam

@router.put("/attribute-families/{family_id}", response_model=schemas.AttributeFamilyResponse)
def update_attribute_family(family_id: int, family_in: schemas.AttributeFamilyUpdate, db: Session = Depends(get_db)):
    db_fam = db.query(models.AttributeFamily).filter(models.AttributeFamily.id == family_id).first()
    if not db_fam:
        raise HTTPException(status_code=404, detail="Attribute Family not found")
        
    dup = db.query(models.AttributeFamily).filter(models.AttributeFamily.code == family_in.code, models.AttributeFamily.id != family_id).first()
    if dup:
        raise HTTPException(status_code=400, detail="Attribute Family code already exists.")
        
    db_fam.code = family_in.code
    db_fam.name = family_in.name
    
    try:
        db.commit()
        db.refresh(db_fam)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database transaction failed: {str(e)}")
    return db_fam

@router.delete("/attribute-families/{family_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attribute_family(family_id: int, db: Session = Depends(get_db)):
    db_fam = db.query(models.AttributeFamily).filter(models.AttributeFamily.id == family_id).first()
    if not db_fam:
        raise HTTPException(status_code=404, detail="Attribute Family not found")
    try:
        db.delete(db_fam)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database transaction failed: {str(e)}")
