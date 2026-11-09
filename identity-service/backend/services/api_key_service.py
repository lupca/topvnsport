import datetime
import logging
import os
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from models import ApiKey, Seller, StaffAccount, Tenant
from schemas.api_key import ApiKeyCreate
from utils.api_keys import (
    canonical_path,
    generate_api_key,
    hash_api_key,
    is_well_formed,
    key_prefix,
    route_scope,
)

logger = logging.getLogger("identity.api_keys")

INVALID_KEY_DETAIL = "API key không hợp lệ, đã bị thu hồi hoặc đã hết hạn"


def _utcnow() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)


def _last_used_throttle() -> datetime.timedelta:
    seconds = int(os.getenv("API_KEY_LAST_USED_THROTTLE_SECONDS", "60"))
    return datetime.timedelta(seconds=max(seconds, 0))


def _with_relations(query):
    return query.options(
        joinedload(ApiKey.seller), joinedload(ApiKey.creator)
    )


def create_api_key(
    db: Session, admin: StaffAccount, payload: ApiKeyCreate
) -> tuple[ApiKey, str]:
    seller = (
        db.query(Seller)
        .filter(
            Seller.id == payload.seller_id,
            Seller.tenant_id == admin.tenant_id,
        )
        .first()
    )
    if seller is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy nhà bán hàng thuộc tenant của bạn",
        )
    if not seller.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nhà bán hàng đang bị khóa, không thể tạo API key",
        )
    if payload.expires_at is not None and payload.expires_at <= _utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Thời điểm hết hạn phải ở tương lai",
        )

    raw_key = generate_api_key()
    api_key = ApiKey(
        name=payload.name,
        key_hash=hash_api_key(raw_key),
        prefix=key_prefix(raw_key),
        last4=raw_key[-4:],
        tenant_id=admin.tenant_id,
        seller_id=seller.id,
        scopes=list(payload.scopes),
        created_by=admin.id,
        created_at=_utcnow(),
        expires_at=payload.expires_at,
    )
    db.add(api_key)
    db.commit()
    db.refresh(api_key)
    logger.info(
        "API key %s (%s) created by staff %s for seller %s scopes=%s",
        api_key.id, api_key.prefix, admin.id, seller.id, api_key.scopes,
    )
    return api_key, raw_key


def list_api_keys(db: Session, tenant_id: UUID) -> List[ApiKey]:
    return (
        _with_relations(db.query(ApiKey))
        .filter(ApiKey.tenant_id == tenant_id)
        .order_by(ApiKey.created_at.desc())
        .all()
    )


def revoke_api_key(db: Session, tenant_id: UUID, key_id: UUID, actor_id: int) -> ApiKey:
    api_key = (
        _with_relations(db.query(ApiKey))
        .filter(ApiKey.id == key_id, ApiKey.tenant_id == tenant_id)
        .first()
    )
    if api_key is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy API key",
        )
    if api_key.revoked_at is None:
        api_key.revoked_at = _utcnow()
        db.commit()
        db.refresh(api_key)
        logger.info("API key %s (%s) revoked by staff %s", api_key.id, api_key.prefix, actor_id)
    return api_key


def _unauthorized(detail: str = INVALID_KEY_DETAIL) -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


def _forbidden(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def _touch_last_used(db: Session, api_key: ApiKey, now: datetime.datetime) -> None:
    """Record usage at most once per throttle window (default 60s)."""
    throttle = _last_used_throttle()
    if api_key.last_used_at is not None and now - api_key.last_used_at < throttle:
        return
    threshold = now - throttle
    try:
        (
            db.query(ApiKey)
            .filter(
                ApiKey.id == api_key.id,
                or_(ApiKey.last_used_at.is_(None), ApiKey.last_used_at <= threshold),
            )
            .update({ApiKey.last_used_at: now}, synchronize_session=False)
        )
        db.commit()
    except Exception:  # usage tracking must never block a valid request
        db.rollback()
        logger.exception("Could not update last_used_at for API key %s", api_key.id)


def authenticate_api_key(
    db: Session,
    raw_key: str,
    *,
    method: Optional[str],
    original_uri: Optional[str],
    requested_seller: Optional[str],
) -> ApiKey:
    """Authenticate + authorise one gateway request made with an API key.

    401: malformed / unknown / revoked / expired key, or inactive tenant/seller.
    403: X-Seller-Id differs from the key's seller, the path+method is outside
         the API-key allowlist, or the key lacks the scope for it.
    """
    if not is_well_formed(raw_key):
        raise _unauthorized()

    api_key = (
        db.query(ApiKey)
        .options(joinedload(ApiKey.tenant), joinedload(ApiKey.seller))
        .filter(ApiKey.key_hash == hash_api_key(raw_key))
        .first()
    )
    now = _utcnow()
    if api_key is None or api_key.status_at(now) != "active":
        raise _unauthorized()
    tenant: Tenant = api_key.tenant
    seller: Seller = api_key.seller
    if (
        tenant is None
        or not tenant.is_active
        or seller is None
        or not seller.is_active
        or seller.tenant_id != api_key.tenant_id
    ):
        raise _unauthorized()

    if requested_seller:
        try:
            matches = UUID(requested_seller.strip()) == api_key.seller_id
        except ValueError:
            matches = False
        if not matches:
            raise _forbidden("X-Seller-Id không khớp với nhà bán hàng của API key")

    path = canonical_path(original_uri)
    granting = route_scope(method, path)
    if granting is None:
        raise _forbidden("API key không được phép gọi đường dẫn này")
    if not granting.intersection(api_key.scopes or []):
        raise _forbidden("API key thiếu phạm vi quyền cho thao tác này")

    _touch_last_used(db, api_key, now)
    return api_key
