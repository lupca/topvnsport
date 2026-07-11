from sqlalchemy import Column, Integer, String, Boolean, Float, ForeignKey, JSON, Text, DateTime, UniqueConstraint, Numeric
from sqlalchemy.orm import relationship, backref
from sqlalchemy.ext.associationproxy import association_proxy
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
    children = relationship("Category", backref=backref("parent", remote_side=[id]))
    products = relationship("Product", back_populates="category")

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    product_code = Column(String(100), unique=True, nullable=False, index=True) # ps_sku_parent_short
    slug = Column(String(255), unique=True, nullable=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True)
    family_id = Column(Integer, ForeignKey("attribute_families.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    
    # Logistics
    weight = Column(Float, nullable=False) # grams
    length = Column(Float, nullable=True) # cm
    width = Column(Float, nullable=True) # cm
    height = Column(Float, nullable=True) # cm

    # Customs & Taxation
    hs_code = Column(String(100), nullable=True)
    tax_code = Column(String(100), nullable=True)

    # Pre-order
    is_pre_order = Column(Boolean, default=False, nullable=False)
    dts_days = Column(Integer, default=7, nullable=True) # days to ship (7-30 days)

    # Status: Draft, Published, Banned, Out of Stock
    status = Column(String(50), default="Draft", nullable=False)

    category = relationship("Category", back_populates="products")
    family = relationship("AttributeFamily", back_populates="products")
    tier_variations = relationship("TierVariation", back_populates="product", cascade="all, delete-orphan")
    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")
    media = relationship("ProductMedia", back_populates="product", cascade="all, delete-orphan")
    attribute_values = relationship("ProductAttributeValue", back_populates="product", cascade="all, delete-orphan")

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
    price = Column(Numeric(12, 2), nullable=False)
    barcode = Column(String(255), nullable=True)
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

    family_links = relationship("AttributeFamilyAttribute", back_populates="attribute", cascade="all, delete-orphan")
    group_links = relationship("AttributeGroupAttribute", back_populates="attribute", cascade="all, delete-orphan")
    product_values = relationship("ProductAttributeValue", back_populates="attribute", cascade="all, delete-orphan")

class AttributeGroup(Base):
    __tablename__ = "attribute_groups"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    group_attributes = relationship("AttributeGroupAttribute", back_populates="group", cascade="all, delete-orphan")
    attributes = association_proxy("group_attributes", "attribute")

class AttributeFamily(Base):
    __tablename__ = "attribute_families"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    products = relationship("Product", back_populates="family")
    family_attributes = relationship("AttributeFamilyAttribute", back_populates="family", cascade="all, delete-orphan")
    attributes = association_proxy("family_attributes", "attribute")


class AttributeFamilyAttribute(Base):
    __tablename__ = "attribute_family_attributes"
    __table_args__ = (
        UniqueConstraint("family_id", "attribute_id", name="uq_family_attribute"),
    )

    id = Column(Integer, primary_key=True, index=True)
    family_id = Column(Integer, ForeignKey("attribute_families.id", ondelete="CASCADE"), nullable=False, index=True)
    attribute_id = Column(Integer, ForeignKey("attributes.id", ondelete="CASCADE"), nullable=False, index=True)
    display_order = Column(Integer, default=1, nullable=False)

    family = relationship("AttributeFamily", back_populates="family_attributes")
    attribute = relationship("Attribute", back_populates="family_links")


class AttributeGroupAttribute(Base):
    __tablename__ = "attribute_group_attributes"
    __table_args__ = (
        UniqueConstraint("group_id", "attribute_id", name="uq_group_attribute"),
    )

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("attribute_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    attribute_id = Column(Integer, ForeignKey("attributes.id", ondelete="CASCADE"), nullable=False, index=True)
    display_order = Column(Integer, default=1, nullable=False)

    group = relationship("AttributeGroup", back_populates="group_attributes")
    attribute = relationship("Attribute", back_populates="group_links")


class ProductAttributeValue(Base):
    __tablename__ = "product_attribute_values"
    __table_args__ = (
        UniqueConstraint("product_id", "attribute_id", name="uq_product_attribute_value"),
    )

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    attribute_id = Column(Integer, ForeignKey("attributes.id", ondelete="CASCADE"), nullable=False, index=True)
    value_string = Column(String(255), nullable=True)
    value_decimal = Column(Float, nullable=True)

    product = relationship("Product", back_populates="attribute_values")
    attribute = relationship("Attribute", back_populates="product_values")

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


class ChannelCategoryMapping(Base):
    __tablename__ = "channel_category_mappings"
    __table_args__ = (
        UniqueConstraint("channel_id", "pim_category_id", name="uq_channel_pim_category"),
    )

    id = Column(Integer, primary_key=True, index=True)
    channel_id = Column(Integer, ForeignKey("channels.id", ondelete="CASCADE"), nullable=False, index=True)
    pim_category_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=False, index=True)
    channel_category_code = Column(String(255), nullable=False)
    channel_category_name = Column(String(255), nullable=False)

    channel = relationship("Channel")
    pim_category = relationship("Category")


class ChannelAttributeMapping(Base):
    __tablename__ = "channel_attribute_mappings"
    __table_args__ = (
        UniqueConstraint("channel_id", "pim_attribute_id", "channel_category_code", name="uq_channel_pim_attribute_cat"),
    )

    id = Column(Integer, primary_key=True, index=True)
    channel_id = Column(Integer, ForeignKey("channels.id", ondelete="CASCADE"), nullable=False, index=True)
    pim_attribute_id = Column(Integer, ForeignKey("attributes.id", ondelete="CASCADE"), nullable=False, index=True)
    channel_category_code = Column(String(255), nullable=True) # Nullable
    channel_attribute_code = Column(String(255), nullable=False)
    channel_attribute_name = Column(String(255), nullable=False)

    channel = relationship("Channel")
    pim_attribute = relationship("Attribute")


class ProductChannelListing(Base):
    __tablename__ = "product_channel_listings"
    __table_args__ = (
        UniqueConstraint("product_id", "channel_id", name="uq_product_channel_listing"),
    )

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    channel_id = Column(Integer, ForeignKey("channels.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(50), default="Draft", nullable=False, index=True) # Published, Draft, Hidden
    title_override = Column(String(255), nullable=True)
    description_override = Column(Text, nullable=True)
    shipping_config = Column(JSON, nullable=True)
    channel_product_id = Column(String(255), nullable=True)

    product = relationship("Product", backref=backref("channel_listings", cascade="all, delete-orphan"))
    channel = relationship("Channel")

    @property
    def channel_code(self):
        return self.channel.code if self.channel else None

    attribute_values = relationship(
        "ProductChannelAttributeValue",
        back_populates="listing",
        cascade="all, delete-orphan"
    )

    variant_overrides = relationship(
        "VariantChannelListing",
        back_populates="listing",
        cascade="all, delete-orphan"
    )


class VariantChannelListing(Base):
    __tablename__ = "variant_channel_listings"
    __table_args__ = (
        UniqueConstraint("variant_id", "channel_id", name="uq_variant_channel_listing"),
    )

    id = Column(Integer, primary_key=True, index=True)
    listing_id = Column(Integer, ForeignKey("product_channel_listings.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_id = Column(Integer, ForeignKey("product_variants.id", ondelete="CASCADE"), nullable=False, index=True)
    channel_id = Column(Integer, ForeignKey("channels.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=True, index=True)
    price_override = Column(Numeric(12, 2), nullable=True)
    channel_variant_id = Column(String(255), nullable=True)

    variant = relationship("ProductVariant", backref=backref("channel_listings", cascade="all, delete-orphan"))
    channel = relationship("Channel")
    listing = relationship("ProductChannelListing", back_populates="variant_overrides")


class ProductChannelAttributeValue(Base):
    __tablename__ = "product_channel_attribute_values"
    __table_args__ = (
        UniqueConstraint("product_id", "channel_id", "attribute_mapping_id", name="uq_prod_chan_attr_val"),
    )

    id = Column(Integer, primary_key=True, index=True)
    listing_id = Column(Integer, ForeignKey("product_channel_listings.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    channel_id = Column(Integer, ForeignKey("channels.id", ondelete="CASCADE"), nullable=False, index=True)
    attribute_mapping_id = Column(Integer, ForeignKey("channel_attribute_mappings.id", ondelete="CASCADE"), nullable=False, index=True)
    value_string = Column(Text, nullable=True)
    value_decimal = Column(Numeric(12, 2), nullable=True)

    product = relationship("Product", backref=backref("channel_attribute_values", cascade="all, delete-orphan"))
    channel = relationship("Channel")
    attribute_mapping = relationship("ChannelAttributeMapping")
    listing = relationship("ProductChannelListing", back_populates="attribute_values")


class ChannelConfig(Base):
    __tablename__ = "channel_configs"

    id = Column(Integer, primary_key=True, index=True)
    channel_id = Column(Integer, ForeignKey("channels.id", ondelete="CASCADE"), nullable=False, index=True, unique=True)
    app_key = Column(String(255), nullable=True)
    app_secret = Column(String(255), nullable=True)
    access_token = Column(Text, nullable=True)
    refresh_token = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    channel = relationship("Channel", backref=backref("config", uselist=False, cascade="all, delete-orphan"))


