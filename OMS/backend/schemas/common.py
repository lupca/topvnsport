from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict

# Customer Schemas
class CustomerBase(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    address: Optional[str] = None

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None

class CustomerOut(CustomerBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Channel Schemas
class ChannelBase(BaseModel):
    code: str
    name: str
    is_active: bool = True

class ChannelCreate(ChannelBase):
    pass

class ChannelUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    is_active: Optional[bool] = None

class ChannelOut(ChannelBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class PaginatedCustomers(BaseModel):
    items: List[CustomerOut]
    total: int
    page: int
    pages: int
    limit: int


class PaginatedChannels(BaseModel):
    items: List[ChannelOut]
    total: int
    page: int
    pages: int
    limit: int
