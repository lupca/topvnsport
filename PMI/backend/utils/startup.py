from sqlalchemy import text
from sqlalchemy.orm import Session
from database import engine, Base, get_db
import models
import minio_client

def run_migrations():
    # NOTE: Do NOT use Base.metadata.create_all() here!
    # It conflicts with alembic migrations and causes "table already exists" errors.
    # All schema changes should go through alembic migrations.

    # Legacy raw migrations for backward compatibility with old databases
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"))
            conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS slug VARCHAR(255)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_products_slug ON products (slug)"))
        except Exception as e:
            print(f"Migration error (created_at/slug): {e}")
        try:
            conn.execute(text("ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS barcode VARCHAR(255)"))
        except Exception as e:
            print(f"Migration error (product_variants barcode): {e}")
        try:
            conn.execute(text("ALTER TABLE attributes ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE attributes ADD COLUMN IF NOT EXISTS is_unique BOOLEAN DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE attributes ADD COLUMN IF NOT EXISTS is_locale_based BOOLEAN DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE attributes ADD COLUMN IF NOT EXISTS is_channel_based BOOLEAN DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE attributes ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"))
        except Exception as e:
            print(f"Migration error (attributes columns): {e}")
        try:
            conn.execute(text("ALTER TABLE attribute_groups ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"))
        except Exception as e:
            print(f"Migration error (attribute_groups columns): {e}")
        try:
            conn.execute(text("ALTER TABLE attribute_families ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"))
        except Exception as e:
            print(f"Migration error (attribute_families columns): {e}")
        try:
            conn.execute(text("ALTER TABLE categories ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"))
        except Exception as e:
            print(f"Migration error (categories columns): {e}")
        try:
            conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS family_id INTEGER"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_products_family_id ON products (family_id)"))
            conn.execute(text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint
                        WHERE conname = 'fk_products_family_id'
                    ) THEN
                        ALTER TABLE products
                        ADD CONSTRAINT fk_products_family_id
                        FOREIGN KEY (family_id) REFERENCES attribute_families(id) ON DELETE SET NULL;
                    END IF;
                END $$;
            """))
        except Exception as e:
            print(f"Migration error (products family_id): {e}")
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS attribute_family_attributes (
                    id SERIAL PRIMARY KEY,
                    family_id INTEGER NOT NULL REFERENCES attribute_families(id) ON DELETE CASCADE,
                    attribute_id INTEGER NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
                    display_order INTEGER NOT NULL DEFAULT 1,
                    CONSTRAINT uq_family_attribute UNIQUE (family_id, attribute_id)
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_attribute_family_attributes_family_id ON attribute_family_attributes (family_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_attribute_family_attributes_attribute_id ON attribute_family_attributes (attribute_id)"))
        except Exception as e:
            print(f"Migration error (attribute_family_attributes): {e}")
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS attribute_group_attributes (
                    id SERIAL PRIMARY KEY,
                    group_id INTEGER NOT NULL REFERENCES attribute_groups(id) ON DELETE CASCADE,
                    attribute_id INTEGER NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
                    display_order INTEGER NOT NULL DEFAULT 1,
                    CONSTRAINT uq_group_attribute UNIQUE (group_id, attribute_id)
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_attribute_group_attributes_group_id ON attribute_group_attributes (group_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_attribute_group_attributes_attribute_id ON attribute_group_attributes (attribute_id)"))
        except Exception as e:
            print(f"Migration error (attribute_group_attributes): {e}")
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS product_attribute_values (
                    id SERIAL PRIMARY KEY,
                    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                    attribute_id INTEGER NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
                    value_string VARCHAR(255),
                    value_decimal FLOAT,
                    CONSTRAINT uq_product_attribute_value UNIQUE (product_id, attribute_id)
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_product_attribute_values_product_id ON product_attribute_values (product_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_product_attribute_values_attribute_id ON product_attribute_values (attribute_id)"))
        except Exception as e:
            print(f"Migration error (product_attribute_values): {e}")

def _seed_channel_mappings(db: Session):
    shopee_channels = db.query(models.Channel).filter(models.Channel.code.in_(["shopee", "shopee_vn"])).all()
    tiktok_channels = db.query(models.Channel).filter(models.Channel.code.in_(["tiktok", "tiktok_shop"])).all()
    lazada_channels = db.query(models.Channel).filter(models.Channel.code.in_(["lazada", "lazada_vn"])).all()

    rackets_cat = db.query(models.Category).filter(models.Category.code == "rackets").first()
    shoes_cat = db.query(models.Category).filter(models.Category.code == "shoes").first()

    for chan in shopee_channels:
        if db.query(models.ChannelCategoryMapping).filter(models.ChannelCategoryMapping.channel_id == chan.id).count() == 0:
            print(f"Seeding Shopee category mappings for channel {chan.code}...")
            if rackets_cat:
                db.add(models.ChannelCategoryMapping(
                    channel_id=chan.id,
                    pim_category_id=rackets_cat.id,
                    channel_category_code="shopee_rackets_101",
                    channel_category_name="Thể thao > Vợt cầu lông"
                ))
            if shoes_cat:
                db.add(models.ChannelCategoryMapping(
                    channel_id=chan.id,
                    pim_category_id=shoes_cat.id,
                    channel_category_code="shopee_shoes_102",
                    channel_category_name="Giày nam > Sneaker"
                ))
            db.flush()

        shopee_attr_mappings = {
            "brand": (None, "shopee_brand", "Thương hiệu"),
            "balance": ("shopee_rackets_101", "shopee_balance", "Điểm cân bằng"),
            "stiffness": ("shopee_rackets_101", "shopee_stiffness", "Độ cứng"),
            "maxTension": ("shopee_rackets_101", "shopee_max_tension", "Sức căng tối đa"),
            "weightClass": ("shopee_rackets_101", "shopee_weight", "Trọng lượng"),
            "thickness": ("shopee_rackets_101", "shopee_thickness", "Đường kính cước"),
            "material": ("shopee_rackets_101", "shopee_material", "Chất liệu"),
            "size": ("shopee_shoes_102", "shopee_size", "Kích thước")
        }
        for attr_code, (cat_code, chan_code, chan_name) in shopee_attr_mappings.items():
            attr = db.query(models.Attribute).filter(models.Attribute.code == attr_code).first()
            if attr:
                exists = db.query(models.ChannelAttributeMapping).filter(
                    models.ChannelAttributeMapping.channel_id == chan.id,
                    models.ChannelAttributeMapping.pim_attribute_id == attr.id
                ).first()
                if not exists:
                    db.add(models.ChannelAttributeMapping(
                        channel_id=chan.id,
                        pim_attribute_id=attr.id,
                        channel_category_code=cat_code,
                        channel_attribute_code=chan_code,
                        channel_attribute_name=chan_name
                    ))

    for chan in tiktok_channels:
        if db.query(models.ChannelCategoryMapping).filter(models.ChannelCategoryMapping.channel_id == chan.id).count() == 0:
            print(f"Seeding TikTok category mappings for channel {chan.code}...")
            if rackets_cat:
                db.add(models.ChannelCategoryMapping(
                    channel_id=chan.id,
                    pim_category_id=rackets_cat.id,
                    channel_category_code="tiktok_rackets_201",
                    channel_category_name="Sports > Badminton > Rackets"
                ))
            if shoes_cat:
                db.add(models.ChannelCategoryMapping(
                    channel_id=chan.id,
                    pim_category_id=shoes_cat.id,
                    channel_category_code="tiktok_shoes_201",
                    channel_category_name="Shoes > Mens Shoes > Sneakers"
                ))
            db.flush()

        tiktok_attr_mappings = {
            "brand": (None, "tiktok_brand", "Brand"),
            "balance": ("tiktok_rackets_201", "tiktok_balance", "Balance Point"),
            "stiffness": ("tiktok_rackets_201", "tiktok_stiffness", "Stiffness"),
            "maxTension": ("tiktok_rackets_201", "tiktok_max_tension", "Max Tension"),
            "weightClass": ("tiktok_rackets_201", "tiktok_weight", "Weight Class"),
            "thickness": ("tiktok_rackets_201", "tiktok_thickness", "Grip Thickness"),
            "material": ("tiktok_rackets_201", "tiktok_material", "Material"),
            "size": ("tiktok_shoes_201", "tiktok_size", "Size")
        }
        for attr_code, (cat_code, chan_code, chan_name) in tiktok_attr_mappings.items():
            attr = db.query(models.Attribute).filter(models.Attribute.code == attr_code).first()
            if attr:
                exists = db.query(models.ChannelAttributeMapping).filter(
                    models.ChannelAttributeMapping.channel_id == chan.id,
                    models.ChannelAttributeMapping.pim_attribute_id == attr.id
                ).first()
                if not exists:
                    db.add(models.ChannelAttributeMapping(
                        channel_id=chan.id,
                        pim_attribute_id=attr.id,
                        channel_category_code=cat_code,
                        channel_attribute_code=chan_code,
                        channel_attribute_name=chan_name
                    ))

    for chan in lazada_channels:
        if db.query(models.ChannelCategoryMapping).filter(models.ChannelCategoryMapping.channel_id == chan.id).count() == 0:
            print(f"Seeding Lazada category mappings for channel {chan.code}...")
            if rackets_cat:
                db.add(models.ChannelCategoryMapping(
                    channel_id=chan.id,
                    pim_category_id=rackets_cat.id,
                    channel_category_code="lazada_rackets_302",
                    channel_category_name="Sports > Badminton > Rackets"
                ))
            if shoes_cat:
                db.add(models.ChannelCategoryMapping(
                    channel_id=chan.id,
                    pim_category_id=shoes_cat.id,
                    channel_category_code="lazada_shoes_305",
                    channel_category_name="Mens Shoes > Sneakers"
                ))
            db.flush()

        lazada_attr_mappings = {
            "brand": (None, "lazada_brand", "Brand"),
            "balance": ("lazada_rackets_302", "lazada_balance", "Balance"),
            "stiffness": ("lazada_rackets_302", "lazada_stiffness", "Flex"),
            "maxTension": ("lazada_rackets_302", "lazada_max_tension", "Max Tension"),
            "weightClass": ("lazada_rackets_302", "lazada_weight_class", "Weight Class"),
            "thickness": ("lazada_rackets_302", "lazada_thickness", "Gauge"),
            "material": ("lazada_rackets_302", "lazada_material", "Material"),
            "size": ("lazada_shoes_305", "lazada_size", "Size")
        }
        for attr_code, (cat_code, chan_code, chan_name) in lazada_attr_mappings.items():
            attr = db.query(models.Attribute).filter(models.Attribute.code == attr_code).first()
            if attr:
                exists = db.query(models.ChannelAttributeMapping).filter(
                    models.ChannelAttributeMapping.channel_id == chan.id,
                    models.ChannelAttributeMapping.pim_attribute_id == attr.id
                ).first()
                if not exists:
                    db.add(models.ChannelAttributeMapping(
                        channel_id=chan.id,
                        pim_attribute_id=attr.id,
                        channel_category_code=cat_code,
                        channel_attribute_code=chan_code,
                        channel_attribute_name=chan_name
                    ))


def startup_populate():
    minio_client.init_bucket()
    
    db = next(get_db())
    try:
        # Seed categories if database is empty
        if db.query(models.Category).count() == 0:
            print("Seeding category hierarchy...")
            equipment = models.Category(name="Thiết bị cầu lông", code="badminton_equipment")
            accessories = models.Category(name="Phụ kiện cầu lông", code="badminton_accessories")
            db.add_all([equipment, accessories])
            db.flush()

            db.add_all([
                models.Category(name="Vợt", code="rackets", parent_id=equipment.id),
                models.Category(name="Giày", code="shoes", parent_id=equipment.id),
                models.Category(name="Cước", code="strings", parent_id=accessories.id),
                models.Category(name="Túi xách", code="bags", parent_id=accessories.id),
                models.Category(name="Quả cầu", code="shuttlecocks", parent_id=accessories.id),
            ])
            db.flush()

        # Seed Locales
        if db.query(models.Locale).count() == 0:
            print("Seeding locales...")
            db.add_all([
                models.Locale(code="vi_VN", name="Tiếng Việt (Việt Nam)"),
                models.Locale(code="en_US", name="English (United States)")
            ])
            db.flush()

        # Seed Currencies
        if db.query(models.Currency).count() == 0:
            print("Seeding currencies...")
            db.add_all([
                models.Currency(code="VND", name="Việt Nam Đồng"),
                models.Currency(code="USD", name="US Dollar")
            ])
            db.flush()

        # Seed Channels
        print("Ensuring target channels are seeded...")
        target_channels = [
            {"code": "webstore", "name": "Default Webstore"},
            {"code": "shopee_vn", "name": "Shopee Vietnam"},
            {"code": "tiktok_shop", "name": "TikTok Shop"},
            {"code": "lazada_vn", "name": "Lazada Vietnam"}
        ]
        for tc in target_channels:
            exists = db.query(models.Channel).filter(models.Channel.code == tc["code"]).first()
            if not exists:
                db.add(models.Channel(code=tc["code"], name=tc["name"]))
        db.flush()

        # Seed Attribute Groups
        if db.query(models.AttributeGroup).count() == 0:
            print("Seeding attribute groups...")
            db.add_all([
                models.AttributeGroup(code="general", name="General Information"),
                models.AttributeGroup(code="logistics", name="Logistics & Shipping"),
                models.AttributeGroup(code="technical", name="Technical Specs")
            ])
            db.flush()

        # Seed Attribute Families
        existing_families = {f.code: f for f in db.query(models.AttributeFamily).all()}
        family_seed = [
            ("family_racket", "Bộ Vợt"),
            ("family_shoes", "Bộ Giày"),
            ("family_string", "Bộ Cước"),
        ]
        new_families = [
            models.AttributeFamily(code=code, name=name)
            for code, name in family_seed
            if code not in existing_families
        ]
        if new_families:
            print("Seeding attribute families...")
            db.add_all(new_families)
            db.flush()
            existing_families = {f.code: f for f in db.query(models.AttributeFamily).all()}

        # Seed Attributes
        existing_attrs = {a.code: a for a in db.query(models.Attribute).all()}
        attribute_seed = [
            ("brand", "Thương hiệu", "text", True),
            ("balance", "Điểm cân bằng", "decimal", False),
            ("stiffness", "Độ cứng", "text", False),
            ("maxTension", "Sức căng", "decimal", False),
            ("weightClass", "Trọng lượng", "text", False),
            ("thickness", "Đường kính cước", "text", False),
            ("material", "Chất liệu", "text", False),
            ("size", "Kích cỡ", "text", False),
        ]
        new_attrs = [
            models.Attribute(
                code=code,
                name=name,
                type=attr_type,
                is_required=is_required,
                is_unique=False,
                is_locale_based=False,
                is_channel_based=False,
            )
            for code, name, attr_type, is_required in attribute_seed
            if code not in existing_attrs
        ]
        if new_attrs:
            print("Seeding attributes...")
            db.add_all(new_attrs)
            db.flush()
            existing_attrs = {a.code: a for a in db.query(models.Attribute).all()}

        family_attribute_seed = {
            "family_racket": ["brand", "balance", "stiffness", "maxTension", "weightClass"],
            "family_shoes": ["brand", "size", "material"],
            "family_string": ["brand", "thickness"],
        }
        for fam_code, attr_codes in family_attribute_seed.items():
            family = existing_families.get(fam_code)
            if not family:
                continue
            for order, attr_code in enumerate(attr_codes, start=1):
                attribute = existing_attrs.get(attr_code)
                if not attribute:
                    continue
                exists = db.query(models.AttributeFamilyAttribute).filter(
                    models.AttributeFamilyAttribute.family_id == family.id,
                    models.AttributeFamilyAttribute.attribute_id == attribute.id,
                ).first()
                if not exists:
                    db.add(models.AttributeFamilyAttribute(
                        family_id=family.id,
                        attribute_id=attribute.id,
                        display_order=order,
                    ))

        # Seed Category & Attribute Mappings using extracted helper
        _seed_channel_mappings(db)
        db.flush()


        db.commit()
        print("PIM database seeding completed successfully.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()

