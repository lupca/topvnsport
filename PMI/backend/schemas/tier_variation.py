from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict

# Tier Variation Schemas
class TierVariationBase(BaseModel):
    tier_index: int = Field(..., ge=1, le=2)
    name: str = Field(..., max_length=100) # e.g. "Màu sắc", "Kích cỡ"
    options: List[str] = Field(..., min_length=1) # e.g. ["Đỏ", "Xanh"]

class TierVariationCreate(TierVariationBase):
    pass

class TierVariationResponse(TierVariationBase):
    id: int
    product_id: int
    model_config = ConfigDict(from_attributes=True)

# Product Variant (SKU) Schemas
class ProductVariantBase(BaseModel):
    tier_1_option: Optional[str] = Field(None, max_length=100)
    tier_2_option: Optional[str] = Field(None, max_length=100)
    sku_code: Optional[str] = Field(None, max_length=100)
    price: Decimal = Field(..., ge=0)
    barcode: Optional[str] = Field(None, max_length=255)
    stock: int = Field(..., ge=0)

class ProductVariantCreate(ProductVariantBase):
    pass

class ProductVariantResponse(ProductVariantBase):
    id: int
    product_id: int
    model_config = ConfigDict(from_attributes=True)
