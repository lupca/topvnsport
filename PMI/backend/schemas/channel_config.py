from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict

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
