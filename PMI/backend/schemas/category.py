from typing import Optional, Any
from pydantic import BaseModel, Field, ConfigDict

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
