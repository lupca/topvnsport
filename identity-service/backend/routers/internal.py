from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from database import get_db
from models import Seller, Tenant
from utils.service_auth import require_internal_service

router = APIRouter(
    prefix="/internal",
    tags=["internal"],
    dependencies=[Depends(require_internal_service)],
)


@router.get("/sellers/{seller_id}")
def seller_membership(
    seller_id: UUID,
    tenant_id: UUID = Query(...),
    db: Session = Depends(get_db),
):
    """Seller-membership check used by PMI (``IDENTITY_SELLER_VALIDATION_URL``).

    Returns 404 unless the seller exists and belongs to ``tenant_id``.
    """
    seller = (
        db.query(Seller)
        .join(Tenant, Tenant.id == Seller.tenant_id)
        .filter(Seller.id == seller_id, Seller.tenant_id == tenant_id)
        .first()
    )
    if seller is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Seller not found")
    return {
        "seller_id": str(seller.id),
        "tenant_id": str(seller.tenant_id),
        "active": bool(seller.is_active and seller.tenant.is_active),
    }
