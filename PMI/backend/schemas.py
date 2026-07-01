from pydantic import BaseModel, Field, conlist, validator
from typing import List, Optional, Any

# Category Schemas
class CategoryBase(BaseModel):
    name: str = Field(..., max_length=255)
    code: str = Field(..., max_length=100)
    parent_id: Optional[int] = None

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(CategoryBase):
    pass

class CategoryResponse(CategoryBase):
    id: int
    created_at: Optional[Any] = None
    display_name: Optional[str] = None
    class Config:
        from_attributes = True

# Tier Variation Schemas
class TierVariationBase(BaseModel):
    tier_index: int = Field(..., ge=1, le=2)
    name: str = Field(..., max_length=100) # e.g. "Màu sắc", "Kích cỡ"
    options: List[str] = Field(..., min_items=1) # e.g. ["Đỏ", "Xanh"]

class TierVariationCreate(TierVariationBase):
    pass

class TierVariationResponse(TierVariationBase):
    id: int
    product_id: int
    class Config:
        from_attributes = True

# Product Variant (SKU) Schemas
class ProductVariantBase(BaseModel):
    tier_1_option: Optional[str] = Field(None, max_length=100)
    tier_2_option: Optional[str] = Field(None, max_length=100)
    sku_code: str = Field(..., max_length=100)
    price: float = Field(..., ge=0)
    stock: int = Field(..., ge=0)

class ProductVariantCreate(ProductVariantBase):
    pass

class ProductVariantResponse(ProductVariantBase):
    id: int
    product_id: int
    class Config:
        from_attributes = True

# Product Media Schemas
class ProductMediaBase(BaseModel):
    image_url: str = Field(..., max_length=1024)
    is_cover: bool = False
    display_order: int = Field(1, ge=1, le=9)
    variant_tier_1_option: Optional[str] = None # Helper to link to a tier 1 option during creation

class ProductMediaCreate(ProductMediaBase):
    pass

class ProductMediaResponse(ProductMediaBase):
    id: int
    product_id: int
    variant_id: Optional[int] = None
    class Config:
        from_attributes = True

# Product Schemas
class ProductBase(BaseModel):
    product_code: str = Field(..., max_length=100)
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    category_id: Optional[int] = None
    
    # Logistics
    weight: float = Field(..., ge=0, description="Weight in grams")
    length: Optional[float] = Field(None, ge=0)
    width: Optional[float] = Field(None, ge=0)
    height: Optional[float] = Field(None, ge=0)

    # Pre-order
    is_pre_order: bool = False
    dts_days: Optional[int] = Field(7, ge=7, le=30)

    status: str = Field("Draft", pattern="^(Draft|Published|Banned|Out of Stock)$")

class ProductCreate(ProductBase):
    # Support up to 2 tier variations
    tier_variations: List[TierVariationCreate] = Field(default=[], max_items=2)
    # The actual combinations of variants
    variants: List[ProductVariantCreate] = Field(..., min_items=1)
    # Media list
    media: List[ProductMediaCreate] = Field(default=[])

    @validator('tier_variations')
    def validate_tier_indices(cls, v):
        indices = [tv.tier_index for tv in v]
        if len(indices) != len(set(indices)):
            raise ValueError("Tier indices must be unique (1 and/or 2)")
        if len(indices) == 2 and set(indices) != {1, 2}:
            raise ValueError("If two tiers are present, they must be tier 1 and tier 2")
        return v

    @validator('variants')
    def validate_variants_match_tiers(cls, v, values):
        tier_variations = values.get('tier_variations', [])
        
        # If no tier variations, there should be exactly one variant with null tier options
        if not tier_variations:
            if len(v) != 1:
                raise ValueError("If there are no variations, exactly one base variant is required")
            if v[0].tier_1_option is not None or v[0].tier_2_option is not None:
                raise ValueError("Base variant tier options must be null")
            return v

        # Get the options for each tier
        tier_1 = next((tv for tv in tier_variations if tv.tier_index == 1), None)
        tier_2 = next((tv for tv in tier_variations if tv.tier_index == 2), None)

        t1_options = set(tier_1.options) if tier_1 else {None}
        t2_options = set(tier_2.options) if tier_2 else {None}

        # Calculate all expected combinations
        expected_combinations = set()
        for t1 in t1_options:
            for t2 in t2_options:
                expected_combinations.add((t1, t2))

        # Check that variants match exactly
        provided_combinations = set()
        for variant in v:
            provided_combinations.add((variant.tier_1_option, variant.tier_2_option))

        if provided_combinations != expected_combinations:
            raise ValueError(
                f"Provided variants do not match the expected combinations of tier variations. "
                f"Expected: {expected_combinations}, Got: {provided_combinations}"
            )

        # Ensure SKU codes are unique within the payload
        sku_codes = [variant.sku_code for variant in v]
        if len(sku_codes) != len(set(sku_codes)):
            raise ValueError("SKU codes must be unique across all variants")

        return v

class ProductResponse(ProductBase):
    id: int
    tier_variations: List[TierVariationResponse] = []
    variants: List[ProductVariantResponse] = []
    media: List[ProductMediaResponse] = []

    class Config:
        from_attributes = True

class PaginatedProductResponse(BaseModel):
    items: List[ProductResponse]
    total: int
    page: int
    limit: int
    pages: int


class ProductUpdate(ProductCreate):
    pass

class ActivityDataItem(BaseModel):
    date: str
    count: int

class DashboardStatsResponse(BaseModel):
    total_products: int
    active_products: int
    inactive_products: int
    total_categories: int
    total_attributes: int
    total_groups: int
    total_families: int
    total_locales: int
    total_currencies: int
    total_channels: int
    completeness_rate: float
    activity_data: List[ActivityDataItem]

# Attribute Schemas
class AttributeBase(BaseModel):
    code: str = Field(..., max_length=100)
    name: str = Field(..., max_length=255)
    type: str = Field("text", max_length=50)
    is_required: bool = False
    is_unique: bool = False
    is_locale_based: bool = False
    is_channel_based: bool = False

class AttributeCreate(AttributeBase):
    pass

class AttributeUpdate(AttributeBase):
    pass

class AttributeResponse(AttributeBase):
    id: int
    created_at: Optional[Any] = None
    class Config:
        from_attributes = True

# Attribute Group Schemas
class AttributeGroupBase(BaseModel):
    code: str = Field(..., max_length=100)
    name: str = Field(..., max_length=255)

class AttributeGroupCreate(AttributeGroupBase):
    pass

class AttributeGroupUpdate(AttributeGroupBase):
    pass

class AttributeGroupResponse(AttributeGroupBase):
    id: int
    created_at: Optional[Any] = None
    class Config:
        from_attributes = True

# Attribute Family Schemas
class AttributeFamilyBase(BaseModel):
    code: str = Field(..., max_length=100)
    name: str = Field(..., max_length=255)

class AttributeFamilyCreate(AttributeFamilyBase):
    pass

class AttributeFamilyUpdate(AttributeFamilyBase):
    pass

class AttributeFamilyResponse(AttributeFamilyBase):
    id: int
    created_at: Optional[Any] = None
    class Config:
        from_attributes = True

# Product by SKU response schema
class ProductBySkuResponse(BaseModel):
    product_name: str
    variant_name: Optional[str] = None
    sku_code: str
    price: float
    weight: float
    length: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    image_url: Optional[str] = None
    category: Optional[str] = None

    class Config:
        from_attributes = True
