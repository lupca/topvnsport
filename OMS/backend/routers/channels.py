from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from utils.api_utils import utcnow
from utils.auth import get_current_user, get_optional_user

router = APIRouter(prefix="/channels", tags=["Channels"])


@router.post("", response_model=schemas.ChannelOut, status_code=status.HTTP_201_CREATED)
def create_channel(
    channel: schemas.ChannelCreate,
    response: Response,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    existing = db.query(models.Channel).filter(models.Channel.code == channel.code).first()
    if existing:
        if existing.is_deleted:
            existing.is_deleted = False
            existing.deleted_at = None
            existing.name = channel.name
            existing.is_active = channel.is_active
            db.commit()
            db.refresh(existing)
            response.status_code = status.HTTP_200_OK
            return existing
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Channel with this code already exists."
        )

    db_channel = models.Channel(
        code=channel.code,
        name=channel.name,
        is_active=channel.is_active
    )
    db.add(db_channel)
    try:
        db.commit()
        db.refresh(db_channel)
        return db_channel
    except IntegrityError:
        db.rollback()
        existing = db.query(models.Channel).filter(models.Channel.code == channel.code).first()
        if existing and existing.is_deleted:
            existing.is_deleted = False
            existing.deleted_at = None
            existing.name = channel.name
            existing.is_active = channel.is_active
            db.commit()
            db.refresh(existing)
            response.status_code = status.HTTP_200_OK
            return existing
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Channel with this code already exists."
        )


@router.get("", response_model=schemas.PaginatedChannels)
def list_channels(
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    db: Session = Depends(get_db), current_user: Optional[dict] = Depends(get_optional_user)):
    query = db.query(models.Channel).filter(models.Channel.is_deleted == False)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (models.Channel.name.ilike(search_filter)) |
            (models.Channel.code.ilike(search_filter))
        )
    
    total_count = query.count()
    pages = (total_count + limit - 1) // limit if limit > 0 else 0
    
    skip = (page - 1) * limit
    items = query.order_by(models.Channel.id.desc()).offset(skip).limit(limit).all()
    
    return {
        "items": items,
        "total": total_count,
        "page": page,
        "pages": pages,
        "limit": limit
    }


@router.get("/{channel_id}", response_model=schemas.ChannelOut)
def retrieve_channel(channel_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    channel = db.query(models.Channel).filter(models.Channel.id == channel_id, models.Channel.is_deleted == False).first()
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
    return channel


@router.put("/{channel_id}", response_model=schemas.ChannelOut)
def update_channel(channel_id: int, channel_data: schemas.ChannelUpdate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    channel = db.query(models.Channel).filter(models.Channel.id == channel_id, models.Channel.is_deleted == False).first()
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
    
    update_data = channel_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(channel, key, value)
        
    try:
        db.commit()
        db.refresh(channel)
        return channel
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Update failed. Code might already be in use."
        )


@router.delete("/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_channel(channel_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    channel = db.query(models.Channel).filter(models.Channel.id == channel_id, models.Channel.is_deleted == False).first()
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
    
    active_orders_count = db.query(models.Order).filter(
        models.Order.channel_id == channel_id,
        models.Order.status.notin_(["CANCELLED", "COMPLETED"])
    ).count()

    if active_orders_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete channel with {active_orders_count} active orders"
        )

    channel.is_deleted = True
    channel.deleted_at = utcnow()
    db.commit()
    return
