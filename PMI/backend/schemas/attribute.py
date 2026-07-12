from typing import List, Optional, Any
from pydantic import BaseModel, Field, ConfigDict

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
    attributes: List[AttributeResponse] = []
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
    attributes: List[AttributeResponse] = []
    created_at: Optional[Any] = None
    model_config = ConfigDict(from_attributes=True)

class AttributeSyncRequest(BaseModel):
    attribute_ids: List[int]

class AttributeFamilyLinkCreate(BaseModel):
    attribute_id: int
