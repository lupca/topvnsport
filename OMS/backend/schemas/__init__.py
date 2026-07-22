from .common import (
    CustomerBase,
    CustomerCreate,
    CustomerUpdate,
    CustomerOut,
    ChannelBase,
    ChannelCreate,
    ChannelUpdate,
    ChannelOut,
    PaginatedCustomers,
    PaginatedChannels,
)
from .auth import (
    SmsConfigUpdate,
    SmsConfigOut,
    SendOtpRequest,
    VerifyOtpRequest,
    VerifyOtpResponse,
)
from .order import (
    OrderItemBase,
    OrderItemCreate,
    OrderItemOut,
    FulfillmentOrderBase,
    FulfillmentOrderCreate,
    FulfillmentOrderOut,
    OrderBase,
    OrderCreate,
    OrderOut,
    OrderItemInput,
    OrderCreateInput,
    OrderUpdateInput,
    OrderStatusUpdate,
    FulfillmentStatusUpdate,
)

from .promotion import (
    PromotionBase,
    PromotionCreate,
    PromotionUpdate,
    PromotionOut,
    ValidatePromotionInput,
    ValidatePromotionResult,
)

__all__ = [
    # Customer / Channel
    "CustomerBase",
    "CustomerCreate",
    "CustomerUpdate",
    "CustomerOut",
    "ChannelBase",
    "ChannelCreate",
    "ChannelUpdate",
    "ChannelOut",
    "PaginatedCustomers",
    "PaginatedChannels",
    # SMS / OTP
    "SmsConfigUpdate",
    "SmsConfigOut",
    "SendOtpRequest",
    "VerifyOtpRequest",
    "VerifyOtpResponse",
    # Order / Fulfillment
    "OrderItemBase",
    "OrderItemCreate",
    "OrderItemOut",
    "FulfillmentOrderBase",
    "FulfillmentOrderCreate",
    "FulfillmentOrderOut",
    "OrderBase",
    "OrderCreate",
    "OrderOut",
    "OrderItemInput",
    "OrderCreateInput",
    "OrderUpdateInput",
    "OrderStatusUpdate",
    "FulfillmentStatusUpdate",
    # Promotion
    "PromotionBase",
    "PromotionCreate",
    "PromotionUpdate",
    "PromotionOut",
    "ValidatePromotionInput",
    "ValidatePromotionResult",
]

