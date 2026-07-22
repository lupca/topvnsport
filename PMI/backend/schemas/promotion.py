from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict, model_validator, field_validator


class DiscountType(str, Enum):
    PERCENTAGE = "PERCENTAGE"
    FIXED_AMOUNT = "FIXED_AMOUNT"
    FIXED_PRICE = "FIXED_PRICE"


class PromotionStatus(str, Enum):
    DRAFT = "DRAFT"
    SCHEDULED = "SCHEDULED"
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    ENDED = "ENDED"


class ScopeType(str, Enum):
    ALL = "ALL"
    CATEGORY = "CATEGORY"
    PRODUCT = "PRODUCT"
    VARIANT = "VARIANT"


import re

def parse_iso_datetime(v):
    if v is None:
        return None
    if isinstance(v, datetime):
        return v
    if isinstance(v, (int, float)):
        raise ValueError("Numeric timestamp values are not valid ISO datetime strings")
    if isinstance(v, str):
        v_str = v.strip()
        if not v_str:
            raise ValueError("Empty string is not a valid ISO datetime string")
        if v_str.isdigit():
            raise ValueError("Pure numeric string is not a valid ISO datetime string")
        iso_str = v_str.replace('Z', '+00:00').replace('z', '+00:00')
        iso_str = re.sub(r'([+-]\d{2})(\d{2})$', r'\1:\2', iso_str)
        iso_str = re.sub(r'(\.\d{6})\d+', r'\1', iso_str)
        try:
            res = datetime.fromisoformat(iso_str)
            if not isinstance(res, datetime):
                raise ValueError(f"Invalid ISO datetime string format: {v}")
            return res
        except Exception as err:
            if isinstance(err, ValueError):
                raise
            raise ValueError(f"Invalid ISO datetime string format: {v}") from err
    raise ValueError(f"Invalid ISO datetime type: {type(v)}")


# ----------------------------------------------------------------------
# Promotion Scope Schema
# ----------------------------------------------------------------------
class PromotionScopeSchema(BaseModel):
    id: Optional[str] = None
    promotion_id: Optional[str] = None
    scope_type: ScopeType = Field(..., description="Target scope level: ALL, CATEGORY, PRODUCT, VARIANT")
    target_id: Optional[str] = Field(None, description="Category, Product, or Variant ID (null for ALL)")
    is_exclusion: bool = Field(False, description="True if this rule excludes targets from promotion")

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode='after')
    def validate_target_id_for_scope(self) -> 'PromotionScopeSchema':
        if self.scope_type != ScopeType.ALL and not self.target_id:
            raise ValueError(f"target_id is required when scope_type is {self.scope_type}")
        return self


# ----------------------------------------------------------------------
# Promotion Create Schema
# ----------------------------------------------------------------------
class PromotionCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=100, description="Unique promotional code (e.g. SUMMER2026)")
    name: str = Field(..., min_length=1, max_length=255, description="Human readable promotion name")
    description: Optional[str] = Field(None, description="Detailed description")
    discount_type: DiscountType = Field(..., description="PERCENTAGE, FIXED_AMOUNT, or FIXED_PRICE")
    discount_value: float = Field(..., ge=0, description="Discount amount or percentage rate")
    max_discount: Optional[float] = Field(None, ge=0, description="Cap for percentage discount")
    priority: int = Field(0, ge=0, description="Priority order (higher value applied first)")
    status: Optional[PromotionStatus] = Field(PromotionStatus.DRAFT, description="Initial promotion status")
    starts_at: Optional[datetime] = Field(None, description="Schedule start datetime (UTC)")
    ends_at: Optional[datetime] = Field(None, description="Schedule end datetime (UTC)")
    intent: Optional[str] = Field(None, description="Natural language prompt/intent statement")
    ai_reasoning: Optional[str] = Field(None, description="AI reasoning explanation if created via AI agent")
    created_by: Optional[str] = Field(None, description="User or AI agent identifier")
    scopes: List[PromotionScopeSchema] = Field(default_factory=list, description="Target scope & exclusion rules")

    @field_validator('starts_at', 'ends_at', mode='before')
    @classmethod
    def validate_iso_datetime(cls, v):
        return parse_iso_datetime(v)

    @model_validator(mode='after')
    def validate_dates_and_discount(self) -> 'PromotionCreate':
        if self.starts_at and self.ends_at and self.ends_at < self.starts_at:
            raise ValueError("ends_at must be greater than or equal to starts_at")
        
        if self.discount_type == DiscountType.PERCENTAGE:
            if self.discount_value < 0 or self.discount_value > 100:
                raise ValueError("Percentage discount_value must be between 0 and 100")
        return self


# ----------------------------------------------------------------------
# Promotion Preview Request Schema
# ----------------------------------------------------------------------
class PromotionPreviewRequest(BaseModel):
    code: Optional[str] = Field(None, max_length=100, description="Optional promotional code")
    name: Optional[str] = Field(None, max_length=255, description="Optional promotion name")
    description: Optional[str] = Field(None, description="Detailed description")
    discount_type: DiscountType = Field(..., description="PERCENTAGE, FIXED_AMOUNT, or FIXED_PRICE")
    discount_value: float = Field(..., ge=0, description="Discount amount or percentage rate")
    max_discount: Optional[float] = Field(None, ge=0, description="Cap for percentage discount")
    priority: int = Field(0, ge=0, description="Priority order")
    status: Optional[PromotionStatus] = Field(PromotionStatus.DRAFT, description="Initial promotion status")
    starts_at: Optional[datetime] = Field(None, description="Schedule start datetime (UTC)")
    ends_at: Optional[datetime] = Field(None, description="Schedule end datetime (UTC)")
    scopes: List[PromotionScopeSchema] = Field(default_factory=list, description="Target scope & exclusion rules")

    @field_validator('starts_at', 'ends_at', mode='before')
    @classmethod
    def validate_iso_datetime(cls, v):
        return parse_iso_datetime(v)


# ----------------------------------------------------------------------
# Promotion Update Schema
# ----------------------------------------------------------------------
class PromotionUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=100)
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    discount_type: Optional[DiscountType] = None
    discount_value: Optional[float] = Field(None, ge=0)
    max_discount: Optional[float] = Field(None, ge=0)
    priority: Optional[int] = Field(None, ge=0)
    status: Optional[PromotionStatus] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    intent: Optional[str] = None
    ai_reasoning: Optional[str] = None
    scopes: Optional[List[PromotionScopeSchema]] = None

    @field_validator('starts_at', 'ends_at', mode='before')
    @classmethod
    def validate_iso_datetime(cls, v):
        return parse_iso_datetime(v)

    @model_validator(mode='after')
    def validate_dates_if_both_present(self) -> 'PromotionUpdate':
        if self.starts_at and self.ends_at and self.ends_at < self.starts_at:
            raise ValueError("ends_at must be greater than or equal to starts_at")
        return self


# ----------------------------------------------------------------------
# Promotion Response Schema
# ----------------------------------------------------------------------
class PromotionResponse(BaseModel):
    id: str
    code: str
    name: str
    description: Optional[str] = None
    discount_type: DiscountType
    discount_value: float
    max_discount: Optional[float] = None
    priority: int
    status: PromotionStatus
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    intent: Optional[str] = None
    ai_reasoning: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    scopes: List[PromotionScopeSchema] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

    @field_validator('starts_at', 'ends_at', 'created_at', 'updated_at', mode='before')
    @classmethod
    def validate_iso_datetime(cls, v):
        return parse_iso_datetime(v)


# ----------------------------------------------------------------------
# Computed Price Response Schema
# ----------------------------------------------------------------------
class ComputedPriceResponse(BaseModel):
    id: Optional[str] = None
    variant_id: str
    promotion_id: Optional[str] = None
    original_price: float
    computed_price: float
    discount_amount: float
    percentage_discount: float
    has_active_promotion: bool = False
    promotion_code: Optional[str] = None
    promotion_name: Optional[str] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator('updated_at', mode='before')
    @classmethod
    def validate_iso_datetime(cls, v):
        return parse_iso_datetime(v)


# ----------------------------------------------------------------------
# Parse Intent Schemas (AI Agent Integration)
# ----------------------------------------------------------------------
class ParseIntentRequest(BaseModel):
    prompt: str = Field(..., min_length=1, description="Natural language prompt describing promotion goals")
    created_by: Optional[str] = Field("AI_AGENT", description="Identifier of requesting agent")


class ParseIntentResponse(BaseModel):
    code: Optional[str] = Field(None, description="Suggested promotion code")
    name: str = Field(..., description="Suggested promotion name")
    description: Optional[str] = Field(None, description="Generated description")
    discount_type: DiscountType = Field(..., description="Inferred discount type")
    discount_value: float = Field(..., description="Inferred discount value")
    max_discount: Optional[float] = Field(None, description="Inferred max discount cap")
    priority: int = Field(0, description="Suggested priority score")
    starts_at: Optional[datetime] = Field(None, description="Parsed start date")
    ends_at: Optional[datetime] = Field(None, description="Parsed end date")
    scopes: List[PromotionScopeSchema] = Field(default_factory=list, description="Inferred scope target rules")
    reasoning: str = Field(..., description="AI explanation of parsed fields and logic")
    confidence_score: float = Field(1.0, ge=0.0, le=1.0, description="Model confidence score (0.0 to 1.0)")

    @field_validator('starts_at', 'ends_at', mode='before')
    @classmethod
    def validate_iso_datetime(cls, v):
        return parse_iso_datetime(v)

