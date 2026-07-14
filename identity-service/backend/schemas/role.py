from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

class RoleBase(BaseModel):
    code: str = Field(..., min_length=2, max_length=50, pattern=r"^[a-z_]+$")
    name: str = Field(..., max_length=100, description="Display name of the role")
    description: Optional[str] = Field(None, max_length=500, description="Description of the role")
    permissions: List[str] = Field(default_factory=list, description="List of permissions associated with the role")

class RoleCreate(RoleBase):
    pass

class RoleUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    permissions: Optional[List[str]] = None

class RoleOut(RoleBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
