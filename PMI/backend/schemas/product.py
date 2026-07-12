from decimal import Decimal
from typing import List, Optional, Any
from pydantic import BaseModel, Field, conlist, field_validator, ConfigDict, ValidationInfo, model_validator

from .tier_variation import TierVariationCreate, TierVariationResponse, ProductVariantCreate, ProductVariantResponse
from .attribute import AttributeFamilyResponse
from .channel_config import ProductChannelListingCreate, ProductChannelListingResponse

# Product Media Schemas
class ProductMediaBase(BaseModel):
    image_url: str = Field(..., max_length=1024)
    is_cover: bool = False
    display_order: int = Field(1, ge=1)
    variant_tier_1_option: Optional[str] = None # Helper to link to a tier 1 option during creation

class ProductMediaCreate(ProductMediaBase):
    pass

class ProductMediaResponse(ProductMediaBase):
    id: int
    product_id: int
    variant_id: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)


class ProductAttributeInput(BaseModel):
    id: int
    value: str


class ProductAttributeMeta(BaseModel):
    id: int
    code: str
    name: str
    type: str

    model_config = ConfigDict(from_attributes=True)


class ProductAttributeValueResponse(BaseModel):
    id: int
    product_id: int
    attribute_id: int
    value_string: Optional[str] = None
    value_decimal: Optional[float] = None
    attribute: Optional[ProductAttributeMeta] = None

    model_config = ConfigDict(from_attributes=True)

# Product Schemas
class ProductBase(BaseModel):
    product_code: str = Field(..., max_length=100)
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    category_id: Optional[int] = None
    family_id: Optional[int] = None
    
    # Logistics
    weight: float = Field(..., ge=0, description="Weight in grams")
    length: Optional[float] = Field(None, ge=0)
    width: Optional[float] = Field(None, ge=0)
    height: Optional[float] = Field(None, ge=0)

    # Customs & Taxation
    hs_code: Optional[str] = Field(None, max_length=100)
    tax_code: Optional[str] = Field(None, max_length=100)

    # Pre-order
    is_pre_order: bool = False
    dts_days: Optional[int] = Field(7, ge=7, le=30)

    status: str = Field("Draft", pattern="^(Draft|Published|Banned|Out of Stock)$")

class ProductCreate(ProductBase):
    family_id: int = Field(..., ge=1)
    # Support up to 2 tier variations
    tier_variations: List[TierVariationCreate] = Field(default=[], max_length=2)
    # The actual combinations of variants
    variants: List[ProductVariantCreate] = Field(..., min_length=1)
    # Media list
    media: List[ProductMediaCreate] = Field(default=[])
    # Dynamic technical attributes based on selected family
    attributes: List[ProductAttributeInput] = Field(default=[])
    # Multi-channel listings
    channel_listings: List['ProductChannelListingCreate'] = Field(default=[])

    @model_validator(mode='after')
    def validate_media_limits(self) -> 'ProductCreate':
        valid_tier_1_options = set()
        for tv in self.tier_variations:
            if tv.tier_index == 1:
                valid_tier_1_options.update(tv.options)

        main_images_count = 0
        for m in self.media:
            if m.is_cover or m.variant_tier_1_option is None or m.variant_tier_1_option == "":
                main_images_count += 1
            elif m.variant_tier_1_option not in valid_tier_1_options:
                raise ValueError(f"Ảnh biến thể tham chiếu đến phân loại không hợp lệ: {m.variant_tier_1_option}")

        if main_images_count > 9:
            raise ValueError("Tối đa 9 ảnh chính")
        return self

    @field_validator('tier_variations')
    def validate_tier_indices(cls, v):
        indices = [tv.tier_index for tv in v]
        if len(indices) != len(set(indices)):
            raise ValueError("Tier indices must be unique (1 and/or 2)")
        if len(indices) == 2 and set(indices) != {1, 2}:
            raise ValueError("If two tiers are present, they must be tier 1 and tier 2")
        return v

    @field_validator('variants')
    def validate_variants_match_tiers(cls, v, info: ValidationInfo):
        tier_variations = info.data.get('tier_variations', [])
        
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
        sku_codes = [variant.sku_code for variant in v if variant.sku_code]
        if len(sku_codes) != len(set(sku_codes)):
            raise ValueError("SKU codes must be unique across all variants")

        return v

class ProductResponse(ProductBase):
    id: int
    slug: Optional[str] = None
    family: Optional['AttributeFamilyResponse'] = None
    tier_variations: List[TierVariationResponse] = []
    variants: List[ProductVariantResponse] = []
    media: List[ProductMediaResponse] = []
    attribute_values: List[ProductAttributeValueResponse] = []
    channel_listings: List['ProductChannelListingResponse'] = []

    model_config = ConfigDict(from_attributes=True)

class PaginatedProductResponse(BaseModel):
    items: List[ProductResponse]
    total: int
    page: int
    limit: int
    pages: int


class ProductUpdate(ProductCreate):
    pass

class BatchDeleteRequest(BaseModel):
    product_ids: List[int]

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

    model_config = ConfigDict(from_attributes=True)
