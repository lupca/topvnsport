from sqlalchemy import Column, Integer, String, Boolean, Float, ForeignKey, JSON, Text, Index, DateTime
from sqlalchemy.orm import relationship
from database import Base
import datetime

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    parent_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=True)
    name = Column(String(255), nullable=False)
    code = Column(String(100), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    # Self-referencing relationship for category tree hierarchy
    children = relationship("Category", backref="parent", remote_side=[id])
    products = relationship("Product", back_populates="category")

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    product_code = Column(String(100), unique=True, nullable=False, index=True) # ps_sku_parent_short
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    
    # Logistics
    weight = Column(Float, nullable=False) # grams
    length = Column(Float, nullable=True) # cm
    width = Column(Float, nullable=True) # cm
    height = Column(Float, nullable=True) # cm

    # Pre-order
    is_pre_order = Column(Boolean, default=False, nullable=False)
    dts_days = Column(Integer, default=7, nullable=True) # days to ship (7-30 days)

    # Status: Draft, Published, Banned, Out of Stock
    status = Column(String(50), default="Draft", nullable=False)

    category = relationship("Category", back_populates="products")
    tier_variations = relationship("TierVariation", back_populates="product", cascade="all, delete-orphan")
    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")
    media = relationship("ProductMedia", back_populates="product", cascade="all, delete-orphan")

class TierVariation(Base):
    __tablename__ = "tier_variations"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    tier_index = Column(Integer, nullable=False) # 1 or 2
    name = Column(String(100), nullable=False) # e.g., "Màu sắc", "Kích cỡ"
    options = Column(JSON, nullable=False) # JSON array: e.g. ["Đỏ", "Xanh", "Vàng"]

    product = relationship("Product", back_populates="tier_variations")

class ProductVariant(Base):
    __tablename__ = "product_variants"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    tier_1_option = Column(String(100), nullable=True) # e.g. "Đỏ"
    tier_2_option = Column(String(100), nullable=True) # e.g. "Size M"
    sku_code = Column(String(100), unique=True, nullable=False, index=True) # ps_sku_short
    price = Column(Float, nullable=False)
    stock = Column(Integer, nullable=False)

    product = relationship("Product", back_populates="variants")
    media = relationship("ProductMedia", back_populates="variant", cascade="all, delete-orphan")

class ProductMedia(Base):
    __tablename__ = "product_media"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    variant_id = Column(Integer, ForeignKey("product_variants.id", ondelete="SET NULL"), nullable=True)
    image_url = Column(String(1024), nullable=False)
    is_cover = Column(Boolean, default=False, nullable=False)
    display_order = Column(Integer, default=1, nullable=False)

    product = relationship("Product", back_populates="media")
    variant = relationship("ProductVariant", back_populates="media")

class Attribute(Base):
    __tablename__ = "attributes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    type = Column(String(50), default="text", nullable=False)
    is_required = Column(Boolean, default=False, nullable=False)
    is_unique = Column(Boolean, default=False, nullable=False)
    is_locale_based = Column(Boolean, default=False, nullable=False)
    is_channel_based = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

class AttributeGroup(Base):
    __tablename__ = "attribute_groups"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

class AttributeFamily(Base):
    __tablename__ = "attribute_families"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

class Channel(Base):
    __tablename__ = "channels"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)

class Locale(Base):
    __tablename__ = "locales"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)

class Currency(Base):
    __tablename__ = "currencies"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)

