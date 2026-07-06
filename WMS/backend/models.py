from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from database import Base

class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    address = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    locations = relationship("Location", back_populates="warehouse", cascade="all, delete-orphan")
    inbound_shipments = relationship("InboundShipment", back_populates="warehouse")


class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    location_code = Column(String, unique=True, nullable=False, index=True)
    zone = Column(String, nullable=True)
    aisle = Column(String, nullable=True)
    rack = Column(String, nullable=True)
    shelf = Column(String, nullable=True)
    type = Column(String, nullable=True)  # e.g., pick, reserve, stage
    is_active = Column(Boolean, default=True)

    warehouse = relationship("Warehouse", back_populates="locations")
    inventories = relationship("Inventory", back_populates="location", cascade="all, delete-orphan")
    inbound_items = relationship("InboundItem", back_populates="location")
    pick_list_items = relationship("PickListItem", back_populates="location")


class Inventory(Base):
    __tablename__ = "inventories"
    __table_args__ = (
        UniqueConstraint("sku_code", "location_id", name="uq_inventory_sku_location"),
    )

    id = Column(Integer, primary_key=True, index=True)
    sku_code = Column(String, nullable=False, index=True)
    product_name = Column(String, nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    qty_on_hand = Column(Integer, default=0, nullable=False)
    qty_reserved = Column(Integer, default=0, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    location = relationship("Location", back_populates="inventories")

    @property
    def qty_available(self):
        return self.qty_on_hand - self.qty_reserved


class BarcodeMapping(Base):
    __tablename__ = "barcode_mappings"

    id = Column(Integer, primary_key=True, index=True)
    barcode = Column(String, unique=True, nullable=False, index=True)
    barcode_type = Column(String, nullable=True)  # e.g., EAN-13, UPC
    sku_code = Column(String, nullable=False, index=True)
    product_name = Column(String, nullable=False)
    variant_name = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class InboundShipment(Base):
    __tablename__ = "inbound_shipments"

    id = Column(Integer, primary_key=True, index=True)
    inbound_number = Column(String, unique=True, nullable=False, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    supplier_name = Column(String, nullable=True)
    status = Column(String, default="pending", nullable=False)
    note = Column(String, nullable=True)
    created_by = Column(String, nullable=True)
    expected_date = Column(DateTime, nullable=True)
    received_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    warehouse = relationship("Warehouse", back_populates="inbound_shipments")
    items = relationship("InboundItem", back_populates="inbound_shipment", cascade="all, delete-orphan")


class InboundItem(Base):
    __tablename__ = "inbound_items"

    id = Column(Integer, primary_key=True, index=True)
    inbound_shipment_id = Column(Integer, ForeignKey("inbound_shipments.id"), nullable=False)
    sku_code = Column(String, nullable=False, index=True)
    product_name = Column(String, nullable=False)
    expected_qty = Column(Integer, nullable=False)
    received_qty = Column(Integer, default=0, nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    status = Column(String, default="pending", nullable=False)

    inbound_shipment = relationship("InboundShipment", back_populates="items")
    location = relationship("Location", back_populates="inbound_items")


class FulfillmentOrder_WMS(Base):
    __tablename__ = "fulfillment_orders_wms"

    id = Column(Integer, primary_key=True, index=True)
    fulfillment_number = Column(String, unique=True, nullable=False, index=True)
    oms_order_id = Column(Integer, nullable=True)
    oms_order_number = Column(String, nullable=True)
    status = Column(String, default="pending", nullable=False)
    assigned_to = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    pick_list_items = relationship("PickListItem", back_populates="fulfillment_order", cascade="all, delete-orphan")
    packing_sessions = relationship("PackingSession", back_populates="fulfillment_order", cascade="all, delete-orphan")


class PickListItem(Base):
    __tablename__ = "pick_list_items"

    id = Column(Integer, primary_key=True, index=True)
    fulfillment_order_id = Column(Integer, ForeignKey("fulfillment_orders_wms.id"), nullable=False)
    sku_code = Column(String, nullable=False, index=True)
    product_name = Column(String, nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    quantity = Column(Integer, nullable=False)
    picked_qty = Column(Integer, default=0, nullable=False)
    status = Column(String, default="pending", nullable=False)

    fulfillment_order = relationship("FulfillmentOrder_WMS", back_populates="pick_list_items")
    location = relationship("Location", back_populates="pick_list_items")


class PackingSession(Base):
    __tablename__ = "packing_sessions"

    id = Column(Integer, primary_key=True, index=True)
    fulfillment_order_id = Column(Integer, ForeignKey("fulfillment_orders_wms.id"), nullable=False)
    status = Column(String, default="pending", nullable=False)
    tracking_number = Column(String, nullable=True)
    carrier_name = Column(String, nullable=True)
    packed_by = Column(String, nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    fulfillment_order = relationship("FulfillmentOrder_WMS", back_populates="packing_sessions")


class StockTransaction(Base):
    __tablename__ = "stock_transactions"

    id = Column(Integer, primary_key=True, index=True)
    sku_code = Column(String, nullable=False, index=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    transaction_type = Column(String, nullable=False) # INBOUND, OUTBOUND, RESERVE, UNRESERVE, ADJUST, TRANSFER
    quantity = Column(Integer, nullable=False) # Change amount (positive or negative)
    note = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    location = relationship("Location")
