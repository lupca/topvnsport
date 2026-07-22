from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict

class PromotionBase(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    discount_type: str  # "PERCENTAGE" | "FIXED_AMOUNT"
    discount_value: Decimal
    min_order_value: Optional[Decimal] = None
    max_discount: Optional[Decimal] = None
    usage_limit: Optional[int] = None
    starts_at: datetime
    expires_at: datetime
    is_active: bool = True

class PromotionCreate(PromotionBase):
    pass

class PromotionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    discount_type: Optional[str] = None
    discount_value: Optional[Decimal] = None
    min_order_value: Optional[Decimal] = None
    max_discount: Optional[Decimal] = None
    usage_limit: Optional[int] = None
    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    is_active: Optional[bool] = None

class PromotionOut(PromotionBase):
    id: int
    used_count: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ValidatePromotionInput(BaseModel):
    code: str
    order_subtotal: Decimal

class ValidatePromotionResult(BaseModel):
    valid: bool
    promotion_name: Optional[str] = None
    discount_type: Optional[str] = None
    discount_value: Optional[Decimal] = None
    discount_amount: Optional[Decimal] = Decimal("0")
    max_discount: Optional[Decimal] = None
    min_order_value: Optional[Decimal] = None
    error_message: Optional[str] = None
