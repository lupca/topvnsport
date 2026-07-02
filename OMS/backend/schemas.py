from datetime import datetime
from decimal import Decimal
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


# OrderItem Schemas
class OrderItemBase(BaseModel):
    sku_code: str
    product_name: str
    variant_name: Optional[str] = None
    quantity: int
    unit_price: Decimal
    subtotal: Decimal
    image_url: Optional[str] = None

class OrderItemCreate(OrderItemBase):
    pass

class OrderItemOut(OrderItemBase):
    id: int
    order_id: int

    model_config = ConfigDict(from_attributes=True)


# FulfillmentOrder Schemas
class FulfillmentOrderBase(BaseModel):
    fulfillment_number: str
    warehouse_code: str
    status: str
    tracking_number: Optional[str] = None
    carrier_name: Optional[str] = None
    shipped_at: Optional[datetime] = None

class FulfillmentOrderCreate(FulfillmentOrderBase):
    pass

class FulfillmentOrderOut(FulfillmentOrderBase):
    id: int
    order_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Order Schemas
class OrderBase(BaseModel):
    order_number: str
    customer_id: int
    channel_id: int
    status: str
    total_amount: Decimal
    shipping_fee: Decimal
    shipping_address: str
    note: Optional[str] = None
    created_by: Optional[str] = None

class OrderCreate(OrderBase):
    items: List[OrderItemCreate]

class OrderOut(OrderBase):
    id: int
    created_at: datetime
    updated_at: datetime
    customer: Optional[CustomerOut] = None
    channel: Optional[ChannelOut] = None
    items: List[OrderItemOut] = []
    fulfillment_orders: List[FulfillmentOrderOut] = []

    model_config = ConfigDict(from_attributes=True)


class OrderItemInput(BaseModel):
    sku_code: str
    quantity: int


class OrderCreateInput(BaseModel):
    order_number: Optional[str] = None
    customer_id: int
    channel_id: int
    shipping_fee: Decimal
    shipping_address: str
    note: Optional[str] = None
    created_by: Optional[str] = None
    items: List[OrderItemInput]


class OrderUpdateInput(BaseModel):
    customer_id: Optional[int] = None
    channel_id: Optional[int] = None
    shipping_fee: Optional[Decimal] = None
    shipping_address: Optional[str] = None
    note: Optional[str] = None
    items: Optional[List[OrderItemInput]] = None


class OrderStatusUpdate(BaseModel):
    status: str


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

