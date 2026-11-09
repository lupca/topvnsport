from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from database import get_db
from models import Seller, StaffAccount
from routers.staff import require_admin_privileges
from schemas.api_key import ApiKeyCreate, ApiKeyCreated, ApiKeyOut, SellerOut
import services.api_key_service as api_key_service

router = APIRouter(prefix="/api-keys", tags=["api-keys"])
sellers_router = APIRouter(prefix="/sellers", tags=["sellers"])


@router.get("/", response_model=List[ApiKeyOut])
def list_api_keys(
    db: Session = Depends(get_db),
    admin: StaffAccount = Depends(require_admin_privileges),
):
    """List the API keys of the admin's tenant. Secrets are never returned."""
    return api_key_service.list_api_keys(db, admin.tenant_id)


@router.post("/", response_model=ApiKeyCreated, status_code=status.HTTP_201_CREATED)
def create_api_key(
    payload: ApiKeyCreate,
    db: Session = Depends(get_db),
    admin: StaffAccount = Depends(require_admin_privileges),
):
    """Create a key for one seller of the admin's tenant.

    The full key is only present in this response; store it immediately.
    """
    api_key, raw_key = api_key_service.create_api_key(db, admin, payload)
    out = ApiKeyOut.model_validate(api_key).model_dump()
    return ApiKeyCreated(**out, key=raw_key)


@router.post("/{key_id}/revoke", response_model=ApiKeyOut)
def revoke_api_key(
    key_id: UUID,
    db: Session = Depends(get_db),
    admin: StaffAccount = Depends(require_admin_privileges),
):
    """Revoke a key immediately (idempotent)."""
    return api_key_service.revoke_api_key(db, admin.tenant_id, key_id, admin.id)


@sellers_router.get("/", response_model=List[SellerOut])
def list_sellers(
    db: Session = Depends(get_db),
    admin: StaffAccount = Depends(require_admin_privileges),
):
    """Sellers of the admin's tenant (used to pick the seller of an API key)."""
    return (
        db.query(Seller)
        .filter(Seller.tenant_id == admin.tenant_id)
        .order_by(Seller.name.asc())
        .all()
    )
