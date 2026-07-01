from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Numeric
from sqlalchemy.orm import relationship
from database import Base

def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)

class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    orders = relationship("Order", back_populates="customer")


class Channel(Base):
    __tablename__ = "channels"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)

    orders = relationship("Order", back_populates="channel")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String, unique=True, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    channel_id = Column(Integer, ForeignKey("channels.id"), nullable=False)
    status = Column(String, nullable=False)
    total_amount = Column(Numeric(10, 2), nullable=False)
    shipping_fee = Column(Numeric(10, 2), nullable=False)
    shipping_address = Column(Text, nullable=False)
    note = Column(Text, nullable=True)
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    customer = relationship("Customer", back_populates="orders")
    channel = relationship("Channel", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    fulfillment_orders = relationship("FulfillmentOrder", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    sku_code = Column(String, nullable=False)
    product_name = Column(String, nullable=False)
    variant_name = Column(String, nullable=True)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    subtotal = Column(Numeric(10, 2), nullable=False)
    image_url = Column(String, nullable=True)

    order = relationship("Order", back_populates="items")


class FulfillmentOrder(Base):
    __tablename__ = "fulfillment_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    fulfillment_number = Column(String, unique=True, index=True, nullable=False)
    warehouse_code = Column(String, nullable=False)
    status = Column(String, nullable=False)
    tracking_number = Column(String, nullable=True)
    carrier_name = Column(String, nullable=True)
    shipped_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    order = relationship("Order", back_populates="fulfillment_orders")
