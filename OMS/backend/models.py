from datetime import datetime, timezone
import logging
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Numeric, JSON, Index, UniqueConstraint, Uuid
from sqlalchemy.orm import relationship
from database import Base

def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class TenantSellerOwned:
    """Marker mixin used by the scoped SQLAlchemy session."""

    tenant_id = Column(Uuid(as_uuid=True), nullable=False, index=True)
    seller_id = Column(Uuid(as_uuid=True), nullable=False, index=True)


class Customer(TenantSellerOwned, Base):
    __tablename__ = "customers"
    __table_args__ = (
        UniqueConstraint("seller_id", "phone", name="uq_customers_seller_phone"),
        Index("ix_customers_tenant_seller", "tenant_id", "seller_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, index=True, nullable=False)
    email = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime, nullable=True)

    orders = relationship("Order", back_populates="customer")


class Channel(TenantSellerOwned, Base):
    __tablename__ = "channels"
    __table_args__ = (
        UniqueConstraint("seller_id", "code", name="uq_channels_seller_code"),
        Index("ix_channels_tenant_seller", "tenant_id", "seller_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, index=True, nullable=False)
    name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime, nullable=True)

    orders = relationship("Order", back_populates="channel")


class Order(TenantSellerOwned, Base):
    __tablename__ = "orders"
    __table_args__ = (
        UniqueConstraint(
            "seller_id", "order_number", name="uq_orders_seller_order_number"
        ),
        Index("ix_orders_tenant_seller", "tenant_id", "seller_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    channel_id = Column(Integer, ForeignKey("channels.id"), nullable=False)
    status = Column(String, nullable=False)
    total_amount = Column(Numeric(10, 2), nullable=False)
    shipping_fee = Column(Numeric(10, 2), nullable=False)
    shipping_address = Column(Text, nullable=False)
    note = Column(Text, nullable=True)
    channel_code = Column(String(20), default="WEB", index=True)
    channel_order_id = Column(String(100), nullable=True)
    channel_metadata = Column(JSON, default=dict)
    payment_status = Column(String(20), default="PENDING", index=True)
    payment_method = Column(String(20), nullable=True)
    sepay_order_id = Column(String(100), nullable=True, index=True)
    paid_at = Column(DateTime, nullable=True)
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    customer = relationship("Customer", back_populates="orders")
    channel = relationship("Channel", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    fulfillment_orders = relationship("FulfillmentOrder", back_populates="order", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="order", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="order", cascade="all, delete-orphan")
    order_events = relationship("OrderEvent", back_populates="order", cascade="all, delete-orphan")


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


class FulfillmentOrder(TenantSellerOwned, Base):
    __tablename__ = "fulfillment_orders"
    __table_args__ = (
        UniqueConstraint(
            "seller_id",
            "fulfillment_number",
            name="uq_fulfillment_orders_seller_number",
        ),
        Index("ix_fulfillment_orders_tenant_seller", "tenant_id", "seller_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    fulfillment_number = Column(String, index=True, nullable=False)
    warehouse_code = Column(String, nullable=False)
    status = Column(String, nullable=False)
    tracking_number = Column(String, nullable=True)
    carrier_name = Column(String, nullable=True)
    shipped_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    order = relationship("Order", back_populates="fulfillment_orders")


import os
from sqlalchemy.types import TypeDecorator
from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)

class EncryptedString(TypeDecorator):
    """
    Encrypts a string value at rest using Fernet.
    """
    impl = Text
    cache_ok = True

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        key = os.getenv("FERNET_KEY")
        if not key:
            raise RuntimeError(
                "FERNET_KEY environment variable is required to initialize encrypted configuration storage"
            )
        try:
            self.fernet = Fernet(key.encode() if isinstance(key, str) else key)
        except (TypeError, ValueError) as exc:
            raise RuntimeError("FERNET_KEY must be a valid Fernet key") from exc

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return self.fernet.encrypt(value.encode()).decode()

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        try:
            return self.fernet.decrypt(value.encode()).decode()
        except Exception as exc:
            logger.exception("Failed to decrypt an encrypted system configuration value")
            raise ValueError("Fernet decryption failed for an encrypted system configuration value") from exc


class SystemConfig(Base):
    __tablename__ = "system_configs"

    id = Column(Integer, primary_key=True, index=True)
    config_key = Column(String(100), unique=True, nullable=False, index=True)
    config_value = Column(EncryptedString(), nullable=True)  # Fernet encrypted (unbounded: ciphertext ~4/3 of plaintext + 57B, can exceed 500)
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
    
    # OTP Provider Metadata
    zalo_message_id = Column(String(100), nullable=True, index=True)
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


class Payment(TenantSellerOwned, Base):
    __tablename__ = "payments"
    __table_args__ = (
        UniqueConstraint("provider", "provider_txn_id", name="uq_payments_provider_txn"),
        Index("ix_payments_tenant_seller", "tenant_id", "seller_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    provider = Column(String(20), nullable=False, index=True)  # SEPAY, VNPAY, MOMO, COD
    provider_txn_id = Column(String(100), nullable=True)
    amount = Column(Numeric(15, 2), nullable=False)
    status = Column(String(20), nullable=False, default="PENDING", index=True)
    reconciled_at = Column(DateTime, nullable=True)
    raw_data = Column(JSON, default=dict)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    order = relationship("Order", back_populates="payments")
    ledger_entries = relationship("PaymentLedger", back_populates="payment", cascade="all, delete-orphan")


class PaymentLedger(Base):
    __tablename__ = "payment_ledger"

    id = Column(Integer, primary_key=True, index=True)
    payment_id = Column(Integer, ForeignKey("payments.id"), nullable=False, index=True)
    entry_type = Column(String(20), nullable=False)  # CREDIT, DEBIT, REFUND
    amount = Column(Numeric(15, 2), nullable=False)
    running_balance = Column(Numeric(15, 2), nullable=True)
    metadata_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=utcnow)

    payment = relationship("Payment", back_populates="ledger_entries")


class Invoice(Base):
    __tablename__ = "invoices"
    __table_args__ = (UniqueConstraint("provider", "invoice_number", name="uq_invoices_provider_num"),)

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    provider = Column(String(20), nullable=False, index=True)  # VNPT, VIETTEL, MEINVOICE
    invoice_number = Column(String(50), nullable=True)
    invoice_date = Column(DateTime, nullable=True)
    status = Column(String(20), nullable=False, default="PENDING", index=True)
    pdf_url = Column(String(500), nullable=True)
    raw_response = Column(JSON, default=dict)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    order = relationship("Order", back_populates="invoices")


class OrderEvent(TenantSellerOwned, Base):
    __tablename__ = "order_events"
    __table_args__ = (
        Index("ix_order_events_tenant_seller", "tenant_id", "seller_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    event_type = Column(String(50), nullable=False, index=True)
    payload = Column(JSON, nullable=False)
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=utcnow)

    order = relationship("Order", back_populates="order_events")
