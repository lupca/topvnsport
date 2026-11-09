import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from utils.api_keys import normalize_scopes


class ApiKeyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    seller_id: UUID
    scopes: List[str] = Field(..., min_length=1)
    expires_at: Optional[datetime.datetime] = None

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Tên API key là bắt buộc")
        return value

    @field_validator("scopes")
    @classmethod
    def _validate_scopes(cls, value: List[str]) -> List[str]:
        scopes = normalize_scopes(value)
        if not scopes:
            raise ValueError("Phải chọn ít nhất một phạm vi quyền")
        return scopes

    @field_validator("expires_at")
    @classmethod
    def _to_naive_utc(
        cls, value: Optional[datetime.datetime]
    ) -> Optional[datetime.datetime]:
        if value is not None and value.tzinfo is not None:
            value = value.astimezone(datetime.timezone.utc).replace(tzinfo=None)
        return value


class ApiKeyOut(BaseModel):
    id: UUID
    name: str
    prefix: str
    last4: str
    tenant_id: UUID
    seller_id: UUID
    seller_name: Optional[str] = None
    scopes: List[str]
    created_by: Optional[int] = None
    created_by_username: Optional[str] = None
    created_at: datetime.datetime
    last_used_at: Optional[datetime.datetime] = None
    revoked_at: Optional[datetime.datetime] = None
    expires_at: Optional[datetime.datetime] = None
    status: str

    model_config = ConfigDict(from_attributes=True)


class ApiKeyCreated(ApiKeyOut):
    key: str = Field(
        ...,
        description="Full API key. Returned only once, at creation time.",
    )


class SellerOut(BaseModel):
    id: UUID
    tenant_id: UUID
    tax_code: str
    name: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)
