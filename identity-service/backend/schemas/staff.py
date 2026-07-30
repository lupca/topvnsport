from typing import Optional
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field

class StaffBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=100, pattern=r"^[a-zA-Z0-9_-]+$")
    email: EmailStr = Field(..., max_length=255)
    full_name: Optional[str] = Field(None, max_length=255)
    role_id: int
    tenant_id: Optional[UUID] = None

class StaffCreate(StaffBase):
    tenant_id: UUID
    password: str = Field(..., min_length=8, max_length=128)

class StaffUpdate(BaseModel):
    email: Optional[EmailStr] = Field(None, max_length=255)
    full_name: Optional[str] = Field(None, max_length=255)
    role_id: Optional[int] = None
    tenant_id: Optional[UUID] = None
    is_active: Optional[bool] = None

class StaffOut(StaffBase):
    id: int
    is_active: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None
    role_code: str
    role_name: str
    tenant_code: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
