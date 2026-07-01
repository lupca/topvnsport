from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict

# --- Warehouse Schemas ---
class WarehouseBase(BaseModel):
    code: str
    name: str
    address: Optional[str] = None
    is_active: Optional[bool] = True

class WarehouseCreate(WarehouseBase):
    pass

class WarehouseResponse(WarehouseBase):
    id: int
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

# --- Location Schemas ---
class LocationBase(BaseModel):
    warehouse_id: int
    location_code: str
    zone: Optional[str] = None
    aisle: Optional[str] = None
    rack: Optional[str] = None
    shelf: Optional[str] = None
    type: Optional[str] = None
    is_active: Optional[bool] = True

class LocationCreate(LocationBase):
    pass

class LocationResponse(LocationBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

# --- Inventory Schemas ---
class InventoryBase(BaseModel):
    sku_code: str
    product_name: str
    location_id: int
    qty_on_hand: int = 0
    qty_reserved: int = 0

class InventoryCreate(InventoryBase):
    pass

class InventoryResponse(InventoryBase):
    id: int
    updated_at: datetime
    qty_available: int = 0
    model_config = ConfigDict(from_attributes=True)

# --- BarcodeMapping Schemas ---
class BarcodeMappingBase(BaseModel):
    barcode: str
    barcode_type: Optional[str] = None
    sku_code: str
    product_name: str
    variant_name: Optional[str] = None
    image_url: Optional[str] = None

class BarcodeMappingCreate(BarcodeMappingBase):
    pass

class BarcodeMappingResponse(BarcodeMappingBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# --- InboundItem Schemas ---
class InboundItemBase(BaseModel):
    sku_code: str
    product_name: str
    expected_qty: int
    received_qty: Optional[int] = 0
    location_id: Optional[int] = None
    status: Optional[str] = "pending"

class InboundItemCreate(InboundItemBase):
    pass

class InboundItemResponse(InboundItemBase):
    id: int
    inbound_shipment_id: int
    model_config = ConfigDict(from_attributes=True)

# --- InboundShipment Schemas ---
class InboundShipmentBase(BaseModel):
    inbound_number: str
    warehouse_id: int
    supplier_name: Optional[str] = None
    status: Optional[str] = "pending"
    note: Optional[str] = None
    created_by: Optional[str] = None
    expected_date: Optional[datetime] = None
    received_date: Optional[datetime] = None

class InboundShipmentCreate(InboundShipmentBase):
    items: List[InboundItemCreate] = []

class InboundShipmentResponse(InboundShipmentBase):
    id: int
    created_at: datetime
    items: List[InboundItemResponse] = []
    model_config = ConfigDict(from_attributes=True)

# --- PickListItem Schemas ---
class PickListItemBase(BaseModel):
    sku_code: str
    product_name: str
    location_id: Optional[int] = None
    quantity: int
    picked_qty: Optional[int] = 0
    status: Optional[str] = "pending"

class PickListItemCreate(PickListItemBase):
    pass

class PickListItemResponse(PickListItemBase):
    id: int
    fulfillment_order_id: int
    model_config = ConfigDict(from_attributes=True)

# --- PackingSession Schemas ---
class PackingSessionBase(BaseModel):
    status: Optional[str] = "pending"
    tracking_number: Optional[str] = None
    carrier_name: Optional[str] = None
    packed_by: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

class PackingSessionCreate(PackingSessionBase):
    pass

class PackingSessionResponse(PackingSessionBase):
    id: int
    fulfillment_order_id: int
    model_config = ConfigDict(from_attributes=True)

# --- FulfillmentOrder_WMS Schemas ---
class FulfillmentOrderWMSBase(BaseModel):
    fulfillment_number: str
    oms_order_id: Optional[int] = None
    oms_order_number: Optional[str] = None
    status: Optional[str] = "pending"
    assigned_to: Optional[str] = None
    completed_at: Optional[datetime] = None

class FulfillmentOrderWMSCreate(FulfillmentOrderWMSBase):
    pick_list_items: List[PickListItemCreate] = []

class FulfillmentOrderWMSResponse(FulfillmentOrderWMSBase):
    id: int
    created_at: datetime
    pick_list_items: List[PickListItemResponse] = []
    packing_sessions: List[PackingSessionResponse] = []
    model_config = ConfigDict(from_attributes=True)


class FulfillmentOrderItemInput(BaseModel):
    sku_code: str
    product_name: str
    quantity: int
    location_suggestion: Optional[str] = None


class FulfillmentOrderCreateInput(BaseModel):
    fulfillment_number: str
    oms_order_id: int
    oms_order_number: str
    warehouse_code: str
    status: Optional[str] = "PENDING"
    items: List[FulfillmentOrderItemInput]


class FulfillmentOrderCancelInput(BaseModel):
    fulfillment_number: Optional[str] = None
    oms_order_id: Optional[int] = None


class StockTransactionBase(BaseModel):
    sku_code: str
    location_id: int
    transaction_type: str
    quantity: int
    note: Optional[str] = None

class StockTransactionResponse(StockTransactionBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

