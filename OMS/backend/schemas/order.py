from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_serializer

from .common import CustomerOut, ChannelOut

# OrderItem Schemas
class OrderItemBase(BaseModel):
    sku_code: str
    product_name: str
    variant_name: Optional[str] = None
    quantity: int = Field(..., ge=1, le=9999)
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


# Order statuses. RETURNED = delivered (SHIPPED/COMPLETED) then returned by the buyer.
ORDER_STATUSES = (
    "DRAFT",
    "CONFIRMED",
    "PROCESSING",
    "PICKING",
    "PACKED",
    "SHIPPED",
    "COMPLETED",
    "CANCELLATION_PENDING",
    "CANCELLED",
    "RETURNED",
)


# Order Schemas
class OrderBase(BaseModel):
    order_number: str
    customer_id: int
    channel_id: int
    status: str
    total_amount: Decimal
    shipping_fee: Decimal = Field(..., ge=0)
    shipping_address: str
    note: Optional[str] = None
    payment_status: Optional[str] = "PENDING"
    payment_method: Optional[str] = None
    sepay_order_id: Optional[str] = None
    paid_at: Optional[datetime] = None
    created_by: Optional[str] = None
    # Finance fields (see docs/architecture_oms.md "Finance fields & RETURNED")
    discount_amount: Decimal = Decimal("0")
    seller_shipping_cost: Decimal = Decimal("0")
    platform_fee: Optional[Decimal] = None
    returned_at: Optional[datetime] = None

class OrderCreate(OrderBase):
    items: List[OrderItemCreate] = Field(..., min_length=1)

class OrderOut(OrderBase):
    id: int
    channel_code: Optional[str] = None
    channel_order_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    customer: Optional[CustomerOut] = None
    channel: Optional[ChannelOut] = None
    items: List[OrderItemOut] = Field(default_factory=list)
    fulfillment_orders: List[FulfillmentOrderOut] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


def _money_as_number(value: Optional[Decimal]) -> Optional[float]:
    return float(value) if value is not None else None


class OrderListItemLineOut(OrderItemOut):
    """Order line in the list endpoint; money is serialized as JSON numbers."""

    @field_serializer("unit_price", "subtotal", when_used="json")
    def _serialize_money(self, value: Optional[Decimal]) -> Optional[float]:
        return _money_as_number(value)


class OrderListItemOut(OrderOut):
    """Order in ``GET /orders``.

    Money is serialized as JSON numbers (the pre-schema list endpoint returned
    floats via FastAPI's default encoder; keep that wire format). Timestamps
    are optional so one legacy row with NULL timestamps cannot fail a page.
    """

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    items: List[OrderListItemLineOut] = Field(default_factory=list)

    @field_serializer(
        "total_amount",
        "shipping_fee",
        "discount_amount",
        "seller_shipping_cost",
        "platform_fee",
        when_used="json",
    )
    def _serialize_money(self, value: Optional[Decimal]) -> Optional[float]:
        return _money_as_number(value)


class PaginatedOrders(BaseModel):
    items: List[OrderListItemOut]
    total: int
    page: int
    pages: int
    limit: int


class OrderItemInput(BaseModel):
    sku_code: str
    quantity: int = Field(..., ge=1, le=9999)


class OrderCreateInput(BaseModel):
    order_number: Optional[str] = None
    customer_id: int
    channel_id: int
    shipping_fee: Decimal = Field(..., ge=0)
    shipping_address: str
    note: Optional[str] = None
    created_by: Optional[str] = None
    items: List[OrderItemInput] = Field(..., min_length=1)
    verification_token: Optional[str] = None
    # Seller-funded discount; reduces total_amount (total = items + shipping - discount).
    discount_amount: Decimal = Field(Decimal("0"), ge=0)
    seller_shipping_cost: Decimal = Field(Decimal("0"), ge=0)
    platform_fee: Optional[Decimal] = Field(None, ge=0)


class OrderUpdateInput(BaseModel):
    customer_id: Optional[int] = None
    channel_id: Optional[int] = None
    shipping_fee: Optional[Decimal] = Field(None, ge=0)
    shipping_address: Optional[str] = None
    note: Optional[str] = None
    items: Optional[List[OrderItemInput]] = Field(None, min_length=1)
    discount_amount: Optional[Decimal] = Field(None, ge=0)
    seller_shipping_cost: Optional[Decimal] = Field(None, ge=0)
    platform_fee: Optional[Decimal] = Field(None, ge=0)


class OrderStatusUpdate(BaseModel):
    status: str


class OrderFinanceUpdate(BaseModel):
    """Costs that become known after an order leaves DRAFT (shipping, settlement)."""

    seller_shipping_cost: Optional[Decimal] = Field(None, ge=0)
    platform_fee: Optional[Decimal] = Field(None, ge=0)


class OrderReturnInput(BaseModel):
    returned_at: Optional[datetime] = None
    # Return shipping paid by the shop; added to seller_shipping_cost.
    return_shipping_cost: Optional[Decimal] = Field(None, ge=0)
    reason: Optional[str] = None


class FulfillmentStatusUpdate(BaseModel):
    status: str
