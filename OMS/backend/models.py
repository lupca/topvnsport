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


import os
from sqlalchemy.types import TypeDecorator, String as SqlString
from cryptography.fernet import Fernet

class EncryptedString(TypeDecorator):
    """
    Encrypts a string value at rest using Fernet.
    """
    impl = SqlString
    cache_ok = True

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        key = os.getenv("FERNET_KEY")
        if not key:
            key = "lz_K8Z8d1d-0iO-4yN2Vb11234567890abcdefghijk="
        self.fernet = Fernet(key.encode() if isinstance(key, str) else key)

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return self.fernet.encrypt(value.encode()).decode()

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        try:
            return self.fernet.decrypt(value.encode()).decode()
        except Exception as e:
            raise ValueError(f"Decryption failed: {e}")


class SystemConfig(Base):
    __tablename__ = "system_configs"

    id = Column(Integer, primary_key=True, index=True)
    config_key = Column(String(100), unique=True, nullable=False, index=True)
    config_value = Column(EncryptedString(500), nullable=True)  # Fernet encrypted
    description = Column(String(255), nullable=True)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


class OtpVerification(Base):
    __tablename__ = "otp_verifications"

    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String(20), nullable=False, index=True)
    otp_hash = Column(String(255), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    
    # Lifecycle Timestamps
    verified_at = Column(DateTime, nullable=True)
    used_at = Column(DateTime, nullable=True)
    status = Column(String(50), nullable=True)  # e.g. 'CONSUMED'
    
    # Verification Token
    verification_token = Column(String(255), nullable=True, unique=True, index=True)
    verification_expires_at = Column(DateTime, nullable=True)
    
    # SMS Provider Metadata
    provider_status = Column(String(50), nullable=True)
    provider_response = Column(Text, nullable=True)
    failed_reason = Column(String(255), nullable=True)
    sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)


class SmsRateLimit(Base):
    __tablename__ = "sms_rate_limits"

    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String(20), nullable=False, index=True)
    action_type = Column(String(50), nullable=False)  # 'send' or 'verify'
    attempt_count = Column(Integer, default=1)
    last_attempt_at = Column(DateTime, default=utcnow)
    lockout_until = Column(DateTime, nullable=True)
