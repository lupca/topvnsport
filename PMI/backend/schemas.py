from decimal import Decimal
from pydantic import BaseModel, Field, conlist, field_validator, ConfigDict, ValidationInfo
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
    model_config = ConfigDict(from_attributes=True)

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
    sku_code: str = Field(..., max_length=100)
    price: Decimal = Field(..., ge=0)
    barcode: Optional[str] = Field(None, max_length=255)
    stock: int = Field(..., ge=0)

class ProductVariantCreate(ProductVariantBase):
    pass

class ProductVariantResponse(ProductVariantBase):
    id: int
    product_id: int
    model_config = ConfigDict(from_attributes=True)

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
        sku_codes = [variant.sku_code for variant in v]
        if len(sku_codes) != len(set(sku_codes)):
            raise ValueError("SKU codes must be unique across all variants")

        return v

class ProductResponse(ProductBase):
    id: int
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
    model_config = ConfigDict(from_attributes=True)

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
    model_config = ConfigDict(from_attributes=True)

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
    model_config = ConfigDict(from_attributes=True)

class AttributeFamilyLinkCreate(BaseModel):
    attribute_id: int

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


# Channel Schemas
class ChannelBase(BaseModel):
    code: str = Field(..., max_length=100)
    name: str = Field(..., max_length=255)

class ChannelCreate(ChannelBase):
    pass

class ChannelUpdate(ChannelBase):
    pass

class ChannelResponse(ChannelBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


# Channel Config Schemas
class ChannelConfigBase(BaseModel):
    app_key: Optional[str] = Field(None, max_length=255)
    app_secret: Optional[str] = Field(None, max_length=255)
    access_token: Optional[str] = Field(None)
    refresh_token: Optional[str] = Field(None)
    is_active: bool = True

class ChannelConfigCreate(ChannelConfigBase):
    pass

class ChannelConfigUpdate(ChannelConfigBase):
    pass

class ChannelConfigResponse(ChannelConfigBase):
    id: int
    channel_id: int
    model_config = ConfigDict(from_attributes=True)


# Channel Category Mapping Schemas
class ChannelCategoryMappingBase(BaseModel):
    pim_category_id: int
    channel_category_code: str = Field(..., max_length=255)
    channel_category_name: str = Field(..., max_length=255)

class ChannelCategoryMappingCreate(ChannelCategoryMappingBase):
    pass

class ChannelCategoryMappingUpdate(ChannelCategoryMappingBase):
    pass

class ChannelCategoryMappingResponse(ChannelCategoryMappingBase):
    id: int
    channel_id: int
    model_config = ConfigDict(from_attributes=True)


# Channel Attribute Mapping Schemas
class ChannelAttributeMappingBase(BaseModel):
    pim_attribute_id: int
    channel_category_code: Optional[str] = Field(None, max_length=255)
    channel_attribute_code: str = Field(..., max_length=255)
    channel_attribute_name: str = Field(..., max_length=255)

class ChannelAttributeMappingCreate(ChannelAttributeMappingBase):
    pass

class ChannelAttributeMappingUpdate(ChannelAttributeMappingBase):
    pass

class ChannelAttributeMappingResponse(ChannelAttributeMappingBase):
    id: int
    channel_id: int
    model_config = ConfigDict(from_attributes=True)


# Product Channel Attribute Value Schemas
class ProductChannelAttributeValueBase(BaseModel):
    attribute_mapping_id: int
    value_string: Optional[str] = Field(None)
    value_decimal: Optional[float] = None

class ProductChannelAttributeValueCreate(ProductChannelAttributeValueBase):
    pass

class ProductChannelAttributeValueResponse(ProductChannelAttributeValueBase):
    id: int
    product_id: int
    channel_id: int
    model_config = ConfigDict(from_attributes=True)


# Variant Channel Listing Schemas
class VariantChannelListingCreate(BaseModel):
    sku_code: str = Field(..., max_length=100)
    price_override: Optional[Decimal] = Field(None, ge=0)
    channel_variant_id: Optional[str] = Field(None, max_length=255)

class VariantChannelListingResponse(BaseModel):
    id: int
    variant_id: int
    channel_id: int
    price_override: Optional[Decimal] = None
    channel_variant_id: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# Product Channel Listing Schemas
class ProductChannelListingCreate(BaseModel):
    channel_code: str = Field(..., max_length=100)
    status: str = Field("Draft", pattern="^(Published|Draft|Hidden)$")
    title_override: Optional[str] = Field(None, max_length=255)
    description_override: Optional[str] = None
    shipping_config: Optional[dict] = None
    channel_product_id: Optional[str] = Field(None, max_length=255)
    attribute_values: List[ProductChannelAttributeValueCreate] = Field(default=[])
    variant_overrides: List[VariantChannelListingCreate] = Field(default=[])

class ProductChannelListingResponse(BaseModel):
    id: int
    channel_id: int
    channel_code: Optional[str] = None
    status: str
    title_override: Optional[str] = None
    description_override: Optional[str] = None
    shipping_config: Optional[dict] = None
    channel_product_id: Optional[str] = None
    attribute_values: List[ProductChannelAttributeValueResponse] = []
    variant_overrides: List[VariantChannelListingResponse] = []

    model_config = ConfigDict(from_attributes=True)


ProductCreate.model_rebuild()
ProductResponse.model_rebuild()
