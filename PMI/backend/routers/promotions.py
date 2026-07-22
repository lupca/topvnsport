import datetime
import math
import uuid
import time
import logging
from typing import List, Optional, Dict, Any

logger = logging.getLogger(__name__)
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.orm.exc import StaleDataError
from sqlalchemy.exc import OperationalError
from sqlalchemy import or_

from database import get_db
import models
from models import Promotion, PromotionScope, PromotionComputedPrice, PromotionStatus, ScopeType
import schemas
from schemas.promotion import (
    PromotionCreate,
    PromotionPreviewRequest,
    PromotionUpdate,
    PromotionResponse,
    PromotionScopeSchema,
    ComputedPriceResponse,
    ParseIntentRequest,
    ParseIntentResponse,
)
from services.promotion_service import (
    recompute_promotion_prices,
    recompute_variant_prices,
    get_variant_computed_price,
    get_bulk_computed_prices,
    evaluate_promotion_preview,
    parse_promotion_intent,
)
from utils.audit import audit_action
from utils.dependency import get_current_identity

router = APIRouter(tags=["Promotions"])


# ----------------------------------------------------------------------
# 1. Promotion CRUD Endpoints (Protected by Identity)
# ----------------------------------------------------------------------

@router.get(
    "/api/promotions",
    response_model=dict,
    dependencies=[Depends(get_current_identity)]
)
def list_promotions(
    status: Optional[PromotionStatus] = Query(None, description="Filter by promotion status"),
    search: Optional[str] = Query(None, description="Search by code or name"),
    page: int = Query(1, ge=1, description="Page index"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db)
):
    """
    List promotions with status filtering, keyword search, and pagination.
    """
    query = db.query(Promotion).options(joinedload(Promotion.scopes)).populate_existing()

    if status:
        query = query.filter(Promotion.status == status)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Promotion.code.ilike(term),
                Promotion.name.ilike(term)
            )
        )

    total = query.count()
    offset = (page - 1) * limit
    items = query.order_by(Promotion.created_at.desc()).offset(offset).limit(limit).all()

    pages = math.ceil(total / limit) if total > 0 else 1

    return {
        "items": [PromotionResponse.model_validate(p) for p in items],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": pages
    }


@router.post(
    "/api/promotions",
    response_model=PromotionResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_identity)]
)
@audit_action(module="Promotion", action_type="CREATE")
def create_promotion(
    payload: PromotionCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new promotion with scope rules.
    """
    max_retries = 3
    for attempt in range(max_retries):
        try:
            db.expire_on_commit = False
            existing = db.query(Promotion).filter(Promotion.code == payload.code).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Promotion code already exists"
                )

            now = datetime.datetime.now(datetime.timezone.utc)
            promo_id = str(uuid.uuid4())

            promo = Promotion(
                id=promo_id,
                code=payload.code,
                name=payload.name,
                description=payload.description,
                discount_type=payload.discount_type,
                discount_value=payload.discount_value,
                max_discount=payload.max_discount,
                priority=payload.priority,
                status=payload.status or PromotionStatus.DRAFT,
                starts_at=payload.starts_at,
                ends_at=payload.ends_at,
                intent=payload.intent,
                ai_reasoning=payload.ai_reasoning,
                created_by=payload.created_by,
                created_at=now,
                updated_at=now
            )
            db.add(promo)

            for scope_data in payload.scopes:
                st_val = scope_data.scope_type.value if hasattr(scope_data.scope_type, 'value') else str(scope_data.scope_type)
                try:
                    st_enum = ScopeType(st_val.upper())
                except ValueError:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid scope_type: {st_val}"
                    )
                if st_enum != ScopeType.ALL and not scope_data.target_id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"target_id is required for scope_type {st_val}"
                    )

                scope_record = PromotionScope(
                    id=str(uuid.uuid4()),
                    promotion_id=promo_id,
                    scope_type=st_enum,
                    target_id=str(scope_data.target_id) if scope_data.target_id is not None else None,
                    is_exclusion=scope_data.is_exclusion
                )
                db.add(scope_record)

            is_active = (promo.status == PromotionStatus.ACTIVE)

            if is_active:
                recompute_promotion_prices(db, promo_id)

            db.commit()

            promo_refreshed = db.query(Promotion).options(joinedload(Promotion.scopes)).populate_existing().filter(Promotion.id == promo_id).first()
            if not promo_refreshed:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promotion not found")

            return PromotionResponse.model_validate(promo_refreshed)
        except (StaleDataError, OperationalError):
            db.rollback()
            if attempt == max_retries - 1:
                raise
            time.sleep(0.05)
        except Exception:
            db.rollback()
            raise


@router.get(
    "/api/promotions/preview",
    response_model=dict,
    dependencies=[Depends(get_current_identity)]
)
@router.post(
    "/api/promotions/preview",
    response_model=dict,
    dependencies=[Depends(get_current_identity)]
)
def preview_promotion(
    payload: PromotionPreviewRequest,
    db: Session = Depends(get_db)
):
    """
    Dry-run calculation of a promotion proposal against catalog variants.
    """
    return evaluate_promotion_preview(db, payload)


@router.post(
    "/api/promotions/parse-intent",
    response_model=ParseIntentResponse,
    dependencies=[Depends(get_current_identity)]
)
def parse_intent(
    payload: ParseIntentRequest
):
    """
    Process natural language prompt into structured promotion fields.
    """
    return parse_promotion_intent(payload.prompt, payload.created_by)


@router.get(
    "/api/promotions/{id}",
    response_model=dict,
    dependencies=[Depends(get_current_identity)]
)
def get_promotion_detail(
    id: str,
    db: Session = Depends(get_db)
):
    """
    Retrieve promotion by ID with scope details and affected variants summary count.
    """
    promo = db.query(Promotion).options(joinedload(Promotion.scopes)).populate_existing().filter(Promotion.id == id).first()
    if not promo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Promotion not found"
        )

    affected_count = db.query(PromotionComputedPrice).filter(PromotionComputedPrice.promotion_id == id).count()
    response_dict = PromotionResponse.model_validate(promo).model_dump(mode="json")
    response_dict["affected_variants_count"] = affected_count

    return response_dict


@router.put(
    "/api/promotions/{id}",
    response_model=PromotionResponse,
    dependencies=[Depends(get_current_identity)]
)
@audit_action(module="Promotion", action_type="UPDATE")
def update_promotion(
    id: str,
    payload: PromotionUpdate,
    db: Session = Depends(get_db)
):
    """
    Update an existing promotion's basic fields and/or target scopes.
    """
    max_retries = 3
    for attempt in range(max_retries):
        try:
            promo = db.query(Promotion).options(joinedload(Promotion.scopes)).populate_existing().filter(Promotion.id == id).first()
            if not promo:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Promotion not found"
                )

            if promo.status == PromotionStatus.ENDED:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot update an ended promotion"
                )

            if payload.code and payload.code != promo.code:
                dup = db.query(Promotion).filter(Promotion.code == payload.code, Promotion.id != id).first()
                if dup:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Promotion code already exists"
                    )
                promo.code = payload.code

            if payload.name is not None:
                promo.name = payload.name
            if payload.description is not None:
                promo.description = payload.description
            if payload.discount_type is not None:
                promo.discount_type = payload.discount_type
            if payload.discount_value is not None:
                promo.discount_value = payload.discount_value
            if payload.max_discount is not None:
                promo.max_discount = payload.max_discount
            if payload.priority is not None:
                promo.priority = payload.priority
            if payload.status is not None:
                promo.status = payload.status
            if payload.starts_at is not None:
                promo.starts_at = payload.starts_at
            if payload.ends_at is not None:
                promo.ends_at = payload.ends_at
            if payload.intent is not None:
                promo.intent = payload.intent
            if payload.ai_reasoning is not None:
                promo.ai_reasoning = payload.ai_reasoning

            if payload.scopes is not None:
                from sqlalchemy import delete
                db.execute(delete(PromotionScope).where(PromotionScope.promotion_id == id))
                for scope_data in payload.scopes:
                    st_val = scope_data.scope_type.value if hasattr(scope_data.scope_type, 'value') else str(scope_data.scope_type)
                    try:
                        st_enum = ScopeType(st_val.upper())
                    except ValueError:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Invalid scope_type: {st_val}"
                        )
                    if st_enum != ScopeType.ALL and not scope_data.target_id:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"target_id is required for scope_type {st_val}"
                        )

                    scope_record = PromotionScope(
                        id=str(uuid.uuid4()),
                        promotion_id=id,
                        scope_type=st_enum,
                        target_id=str(scope_data.target_id) if scope_data.target_id is not None else None,
                        is_exclusion=scope_data.is_exclusion
                    )
                    db.add(scope_record)

            promo.updated_at = datetime.datetime.now(datetime.timezone.utc)

            recompute_promotion_prices(db, id)

            db.commit()

            promo_refreshed = db.query(Promotion).options(joinedload(Promotion.scopes)).populate_existing().filter(Promotion.id == id).first()
            if not promo_refreshed:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promotion not found")

            return PromotionResponse.model_validate(promo_refreshed)
        except StaleDataError:
            db.rollback()
            if attempt == max_retries - 1:
                raise
            time.sleep(0.05)
        except Exception:
            db.rollback()
            raise


@router.delete(
    "/api/promotions/{id}",
    response_model=dict,
    dependencies=[Depends(get_current_identity)]
)
@audit_action(module="Promotion", action_type="DELETE")
def delete_promotion(
    id: str,
    db: Session = Depends(get_db)
):
    """
    Delete a promotion record.
    """
    max_retries = 3
    for attempt in range(max_retries):
        try:
            promo = db.query(Promotion).populate_existing().filter(Promotion.id == id).first()
            if not promo:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Promotion not found"
                )

            if promo.status == PromotionStatus.ACTIVE:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot delete an active promotion"
                )

            was_active = (promo.status == PromotionStatus.ACTIVE)
            db.delete(promo)

            if was_active:
                recompute_variant_prices(db)

            db.commit()

            return {"message": "Promotion deleted successfully"}
        except StaleDataError:
            db.rollback()
            if attempt == max_retries - 1:
                raise
            time.sleep(0.05)
        except Exception:
            db.rollback()
            raise


# ----------------------------------------------------------------------
# 2. Lifecycle Endpoints (Protected by Identity)
# ----------------------------------------------------------------------

@router.post(
    "/api/promotions/{id}/activate",
    response_model=PromotionResponse,
    dependencies=[Depends(get_current_identity)]
)
@audit_action(module="Promotion", action_type="ACTIVATE")
def activate_promotion(
    id: str,
    db: Session = Depends(get_db)
):
    """
    Activate a promotion (DRAFT/PAUSED -> ACTIVE or SCHEDULED).
    """
    max_retries = 3
    for attempt in range(max_retries):
        try:
            db.expire_on_commit = False
            promo = db.query(Promotion).options(joinedload(Promotion.scopes)).populate_existing().filter(Promotion.id == id).first()
            if not promo:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Promotion not found"
                )

            if promo.status == PromotionStatus.ENDED:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot activate an ended promotion"
                )

            now = datetime.datetime.now(datetime.timezone.utc)
            starts_at = promo.starts_at
            if starts_at is not None:
                if starts_at.tzinfo is None:
                    starts_at = starts_at.replace(tzinfo=datetime.timezone.utc)
                if starts_at > now:
                    promo.status = PromotionStatus.SCHEDULED
                else:
                    promo.status = PromotionStatus.ACTIVE
            else:
                promo.status = PromotionStatus.ACTIVE

            is_active = (promo.status == PromotionStatus.ACTIVE)
            promo.updated_at = now

            if is_active:
                recompute_promotion_prices(db, id)

            db.commit()

            promo_refreshed = db.query(Promotion).options(joinedload(Promotion.scopes)).populate_existing().filter(Promotion.id == id).first()
            if not promo_refreshed:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promotion not found")

            return PromotionResponse.model_validate(promo_refreshed)
        except StaleDataError:
            db.rollback()
            if attempt == max_retries - 1:
                raise
            time.sleep(0.05)
        except Exception:
            db.rollback()
            raise


@router.post(
    "/api/promotions/{id}/pause",
    response_model=PromotionResponse,
    dependencies=[Depends(get_current_identity)]
)
@audit_action(module="Promotion", action_type="PAUSE")
def pause_promotion(
    id: str,
    db: Session = Depends(get_db)
):
    """
    Pause an ACTIVE or SCHEDULED promotion.
    """
    max_retries = 3
    for attempt in range(max_retries):
        try:
            db.expire_on_commit = False
            promo = db.query(Promotion).options(joinedload(Promotion.scopes)).populate_existing().filter(Promotion.id == id).first()
            if not promo:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Promotion not found"
                )

            if promo.status not in (PromotionStatus.ACTIVE, PromotionStatus.SCHEDULED):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Only active or scheduled promotions can be paused"
                )

            promo.status = PromotionStatus.PAUSED
            promo.updated_at = datetime.datetime.now(datetime.timezone.utc)

            recompute_promotion_prices(db, id)

            db.commit()

            promo_refreshed = db.query(Promotion).options(joinedload(Promotion.scopes)).populate_existing().filter(Promotion.id == id).first()
            if not promo_refreshed:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promotion not found")

            return PromotionResponse.model_validate(promo_refreshed)
        except StaleDataError:
            db.rollback()
            if attempt == max_retries - 1:
                raise
            time.sleep(0.05)
        except Exception:
            db.rollback()
            raise


@router.post(
    "/api/promotions/{id}/resume",
    response_model=PromotionResponse,
    dependencies=[Depends(get_current_identity)]
)
@audit_action(module="Promotion", action_type="RESUME")
def resume_promotion(
    id: str,
    db: Session = Depends(get_db)
):
    """
    Resume a PAUSED promotion.
    """
    max_retries = 3
    for attempt in range(max_retries):
        try:
            db.expire_on_commit = False
            promo = db.query(Promotion).options(joinedload(Promotion.scopes)).populate_existing().filter(Promotion.id == id).first()
            if not promo:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Promotion not found"
                )

            if promo.status != PromotionStatus.PAUSED:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Only paused promotions can be resumed"
                )

            now = datetime.datetime.now(datetime.timezone.utc)
            starts_at = promo.starts_at
            if starts_at is not None:
                if starts_at.tzinfo is None:
                    starts_at = starts_at.replace(tzinfo=datetime.timezone.utc)
                if starts_at > now:
                    promo.status = PromotionStatus.SCHEDULED
                else:
                    promo.status = PromotionStatus.ACTIVE
            else:
                promo.status = PromotionStatus.ACTIVE

            is_active = (promo.status == PromotionStatus.ACTIVE)
            promo.updated_at = now

            if is_active:
                recompute_promotion_prices(db, id)

            db.commit()

            promo_refreshed = db.query(Promotion).options(joinedload(Promotion.scopes)).populate_existing().filter(Promotion.id == id).first()
            if not promo_refreshed:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promotion not found")

            return PromotionResponse.model_validate(promo_refreshed)
        except StaleDataError:
            db.rollback()
            if attempt == max_retries - 1:
                raise
            time.sleep(0.05)
        except Exception:
            db.rollback()
            raise


@router.post(
    "/api/promotions/{id}/end",
    response_model=PromotionResponse,
    dependencies=[Depends(get_current_identity)]
)
@audit_action(module="Promotion", action_type="END")
def end_promotion(
    id: str,
    db: Session = Depends(get_db)
):
    """
    End a promotion.
    """
    max_retries = 3
    for attempt in range(max_retries):
        try:
            db.expire_on_commit = False
            promo = db.query(Promotion).options(joinedload(Promotion.scopes)).populate_existing().filter(Promotion.id == id).first()
            if not promo:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Promotion not found"
                )

            if promo.status == PromotionStatus.ENDED:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Promotion is already ended"
                )

            promo.status = PromotionStatus.ENDED
            promo.updated_at = datetime.datetime.now(datetime.timezone.utc)

            recompute_promotion_prices(db, id)

            db.commit()

            promo_refreshed = db.query(Promotion).options(joinedload(Promotion.scopes)).populate_existing().filter(Promotion.id == id).first()
            if not promo_refreshed:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promotion not found")

            return PromotionResponse.model_validate(promo_refreshed)
        except StaleDataError:
            db.rollback()
            if attempt == max_retries - 1:
                raise
            time.sleep(0.05)
        except Exception:
            db.rollback()
            raise


# ----------------------------------------------------------------------
# 3. Storefront Computed Price Endpoints (Unauthenticated / Public)
# ----------------------------------------------------------------------

@router.get(
    "/api/variants/{id}/computed-price",
    response_model=ComputedPriceResponse
)
def get_variant_price(
    id: str,
    db: Session = Depends(get_db)
):
    """
    Retrieve current computed price for a single variant.
    """
    res = get_variant_computed_price(db, id)
    if not res:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Variant not found"
        )
    return res


@router.post(
    "/api/computed-prices/bulk",
    response_model=dict
)
def get_bulk_prices(
    payload: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """
    Fetch bulk computed prices for list of variant IDs.
    """
    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request payload must be a dictionary"
        )
    variant_ids = payload.get("variant_ids")
    if variant_ids is None or not isinstance(variant_ids, list):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="variant_ids must be a list"
        )
    if len(variant_ids) > 500:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bulk calculation exceeds maximum batch size of 500 variants"
        )
    return get_bulk_computed_prices(db, variant_ids)
