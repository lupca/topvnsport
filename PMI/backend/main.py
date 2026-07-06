import uuid
from fastapi import FastAPI, Depends, HTTPException, File, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional

from database import engine, Base, get_db
import models
import schemas
import minio_client

from sqlalchemy import text
# Create database tables
Base.metadata.create_all(bind=engine)

# Run raw migrations to ensure columns exist in existing database schemas
with engine.begin() as conn:
    try:
        conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"))
    except Exception as e:
        print(f"Migration error (created_at): {e}")
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

app = FastAPI(title="PIM API Microservice")

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _parse_attribute_storage_value(raw_value: str, attr_type: str):
    text_value = (raw_value or "").strip()
    if text_value == "":
        return None, None

    if attr_type in {"decimal", "number", "float", "integer"}:
        try:
            return None, float(text_value)
        except ValueError:
            # Keep non-normalized values (e.g. "0.68mm") as text.
            return text_value, None

    return text_value, None


def _upsert_product_attribute_values(db: Session, product_id: int, incoming_attributes: List[schemas.ProductAttributeInput]):
    db.query(models.ProductAttributeValue).filter(
        models.ProductAttributeValue.product_id == product_id
    ).delete(synchronize_session=False)

    if not incoming_attributes:
        return

    attribute_ids = [a.id for a in incoming_attributes]
    attribute_map = {
        a.id: a
        for a in db.query(models.Attribute).filter(models.Attribute.id.in_(attribute_ids)).all()
    }

    for item in incoming_attributes:
        attribute = attribute_map.get(item.id)
        if not attribute:
            continue
        value_string, value_decimal = _parse_attribute_storage_value(item.value, attribute.type)
        if value_string is None and value_decimal is None:
            continue
        db.add(models.ProductAttributeValue(
            product_id=product_id,
            attribute_id=attribute.id,
            value_string=value_string,
            value_decimal=value_decimal,
        ))


# Startup hook to initialize MinIO bucket and seed Categories & PIM metadata
@app.on_event("startup")
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
        if db.query(models.Channel).count() == 0:
            print("Seeding channels...")
            db.add_all([
                models.Channel(code="webstore", name="Default Webstore"),
                models.Channel(code="shopee", name="Shopee Vietnam"),
                models.Channel(code="lazada", name="Lazada Vietnam")
            ])
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

        db.commit()
        print("PIM database seeding completed successfully.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()

# Dashboard Endpoint
@app.get("/dashboard/stats", response_model=schemas.DashboardStatsResponse)
def get_dashboard_stats(db: Session = Depends(get_db)):
    try:
        # 1. Standard counts
        total_products = db.query(models.Product).count()
        active_products = db.query(models.Product).filter(models.Product.status == "Published").count()
        inactive_products = db.query(models.Product).filter(models.Product.status != "Published").count()
        
        total_categories = db.query(models.Category).count()
        total_attributes = db.query(models.Attribute).count()
        total_groups = db.query(models.AttributeGroup).count()
        total_families = db.query(models.AttributeFamily).count()
        total_locales = db.query(models.Locale).count()
        total_currencies = db.query(models.Currency).count()
        total_channels = db.query(models.Channel).count()

        # 2. Completeness rate
        products = db.query(models.Product).all()
        if not products:
            completeness_rate = 0.0
        else:
            total_score = 0.0
            for p in products:
                score = 0
                if p.description and p.description.strip():
                    score += 25
                if p.media:
                    score += 25
                if p.weight and p.weight > 0:
                    score += 25
                if p.variants:
                    score += 25
                total_score += score
            completeness_rate = round(total_score / len(products), 2)

        # 3. Activity data (last 7 days)
        import datetime
        today = datetime.date.today()
        activity_data = []
        for i in range(6, -1, -1):
            day = today - datetime.timedelta(days=i)
            day_str = day.strftime("%Y-%m-%d")
            
            # Count products registered on this day
            start_datetime = datetime.datetime.combine(day, datetime.time.min)
            end_datetime = datetime.datetime.combine(day, datetime.time.max)
            count = db.query(models.Product).filter(
                models.Product.created_at >= start_datetime,
                models.Product.created_at <= end_datetime
            ).count()
            
            activity_data.append({
                "date": day_str,
                "count": count
            })

        return {
            "total_products": total_products,
            "active_products": active_products,
            "inactive_products": inactive_products,
            "total_categories": total_categories,
            "total_attributes": total_attributes,
            "total_groups": total_groups,
            "total_families": total_families,
            "total_locales": total_locales,
            "total_currencies": total_currencies,
            "total_channels": total_channels,
            "completeness_rate": completeness_rate,
            "activity_data": activity_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load dashboard stats: {str(e)}")


# Category Endpoints
@app.get("/categories", response_model=List[schemas.CategoryResponse])
def get_categories(db: Session = Depends(get_db)):
    categories = db.query(models.Category).all()
    cat_dict = {c.id: c for c in categories}
    
    response = []
    for cat in categories:
        path = []
        curr = cat
        visited = set()
        while curr and curr.id not in visited:
            visited.add(curr.id)
            path.insert(0, curr.name)
            curr = cat_dict.get(curr.parent_id) if curr.parent_id else None
        
        display_name = f"[root] / {' / '.join(path)}"
        
        response.append(schemas.CategoryResponse(
            id=cat.id,
            name=cat.name,
            code=cat.code,
            parent_id=cat.parent_id,
            created_at=cat.created_at,
            display_name=display_name
        ))
    return response

@app.get("/categories/{category_id}", response_model=schemas.CategoryResponse)
def get_category(category_id: int, db: Session = Depends(get_db)):
    cat = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    
    path = []
    curr = cat
    visited = set()
    while curr and curr.id not in visited:
        visited.add(curr.id)
        path.insert(0, curr.name)
        curr = db.query(models.Category).filter(models.Category.id == curr.parent_id).first() if curr.parent_id else None
    
    display_name = f"[root] / {' / '.join(path)}"
    
    return schemas.CategoryResponse(
        id=cat.id,
        name=cat.name,
        code=cat.code,
        parent_id=cat.parent_id,
        created_at=cat.created_at,
        display_name=display_name
    )

@app.post("/categories", response_model=schemas.CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(category: schemas.CategoryCreate, db: Session = Depends(get_db)):
    db_cat = db.query(models.Category).filter(models.Category.code == category.code).first()
    if db_cat:
        raise HTTPException(status_code=400, detail="Category code already exists.")
    
    new_cat = models.Category(
        name=category.name,
        code=category.code,
        parent_id=category.parent_id
    )
    db.add(new_cat)
    db.commit()
    db.refresh(new_cat)
    
    path = []
    curr = new_cat
    visited = set()
    while curr and curr.id not in visited:
        visited.add(curr.id)
        path.insert(0, curr.name)
        curr = db.query(models.Category).filter(models.Category.id == curr.parent_id).first() if curr.parent_id else None
    
    display_name = f"[root] / {' / '.join(path)}"
    
    return schemas.CategoryResponse(
        id=new_cat.id,
        name=new_cat.name,
        code=new_cat.code,
        parent_id=new_cat.parent_id,
        created_at=new_cat.created_at,
        display_name=display_name
    )

@app.put("/categories/{category_id}", response_model=schemas.CategoryResponse)
def update_category(category_id: int, category_in: schemas.CategoryUpdate, db: Session = Depends(get_db)):
    db_cat = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not db_cat:
        raise HTTPException(status_code=404, detail="Category not found")
    
    if category_in.parent_id == category_id:
        raise HTTPException(status_code=400, detail="A category cannot be its own parent.")
        
    dup = db.query(models.Category).filter(models.Category.code == category_in.code, models.Category.id != category_id).first()
    if dup:
        raise HTTPException(status_code=400, detail="Category code already exists.")
        
    db_cat.name = category_in.name
    db_cat.code = category_in.code
    db_cat.parent_id = category_in.parent_id
    db.commit()
    db.refresh(db_cat)
    
    path = []
    curr = db_cat
    visited = set()
    while curr and curr.id not in visited:
        visited.add(curr.id)
        path.insert(0, curr.name)
        curr = db.query(models.Category).filter(models.Category.id == curr.parent_id).first() if curr.parent_id else None
    
    display_name = f"[root] / {' / '.join(path)}"
    
    return schemas.CategoryResponse(
        id=db_cat.id,
        name=db_cat.name,
        code=db_cat.code,
        parent_id=db_cat.parent_id,
        created_at=db_cat.created_at,
        display_name=display_name
    )

@app.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    db_cat = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not db_cat:
        raise HTTPException(status_code=404, detail="Category not found")
    try:
        db.delete(db_cat)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database transaction failed: {str(e)}")

# Product Endpoints
@app.post("/products", response_model=schemas.ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(product_in: schemas.ProductCreate, db: Session = Depends(get_db)):
    try:
        # 1. Create the parent product
        db_product = models.Product(
            product_code=product_in.product_code,
            name=product_in.name,
            description=product_in.description,
            category_id=product_in.category_id,
            family_id=product_in.family_id,
            weight=product_in.weight,
            length=product_in.length,
            width=product_in.width,
            height=product_in.height,
            is_pre_order=product_in.is_pre_order,
            dts_days=product_in.dts_days,
            status=product_in.status
        )
        db.add(db_product)
        db.flush() # This populates db_product.id

        # 2. Save Tier Variations
        for tv in product_in.tier_variations:
            db_tv = models.TierVariation(
                product_id=db_product.id,
                tier_index=tv.tier_index,
                name=tv.name,
                options=tv.options
            )
            db.add(db_tv)
        
        # 3. Save Product Variants / SKUs
        db_variants = []
        for v in product_in.variants:
            db_var = models.ProductVariant(
                product_id=db_product.id,
                tier_1_option=v.tier_1_option,
                tier_2_option=v.tier_2_option,
                sku_code=v.sku_code,
                price=v.price,
                stock=v.stock
            )
            db.add(db_var)
            db_variants.append(db_var)
        
        db.flush() # Populate variants IDs for media mapping

        # 4. Save Product Media & Link to Tier 1 Option if required
        for m in product_in.media:
            variant_id = None
            if m.variant_tier_1_option:
                # Find the variant with this tier_1_option
                for db_var in db_variants:
                    if db_var.tier_1_option == m.variant_tier_1_option:
                        variant_id = db_var.id
                        break
            
            db_media = models.ProductMedia(
                product_id=db_product.id,
                variant_id=variant_id,
                image_url=m.image_url,
                is_cover=m.is_cover,
                display_order=m.display_order
            )
            db.add(db_media)

        _upsert_product_attribute_values(db, db_product.id, product_in.attributes)

        db.commit()
        db.refresh(db_product)
        return db_product

    except Exception as e:
        db.rollback()
        # Handle unique constraint violations gracefully
        error_msg = str(e)
        if "unique constraint" in error_msg.lower() or "already exists" in error_msg.lower():
            if "product_code" in error_msg or "products_product_code_key" in error_msg:
                raise HTTPException(status_code=400, detail="Product parent code (SKU parent) already exists.")
            elif "sku_code" in error_msg or "product_variants_sku_code_key" in error_msg:
                raise HTTPException(status_code=400, detail="Variant SKU code already exists.")
            else:
                raise HTTPException(status_code=400, detail="Unique constraint violation: duplicate identifier detected.")
        
        raise HTTPException(status_code=500, detail=f"Database transaction failed: {error_msg}")

@app.get("/products", response_model=schemas.PaginatedProductResponse)
def list_products(
    q: Optional[str] = None,
    status: Optional[str] = None,
    category_id: Optional[int] = None,
    sort_by: str = "id",
    sort_order: str = "desc",
    page: int = 1,
    limit: int = 10,
    db: Session = Depends(get_db)
):
    query = db.query(models.Product)
    
    if status:
        query = query.filter(models.Product.status == status)
        
    if category_id:
        query = query.filter(models.Product.category_id == category_id)
        
    if q:
        # Search by product name, product code, or variant SKU code
        query = query.outerjoin(models.ProductVariant).filter(
            (models.Product.name.ilike(f"%{q}%")) |
            (models.Product.product_code.ilike(f"%{q}%")) |
            (models.ProductVariant.sku_code.ilike(f"%{q}%"))
        )
        # Ensure distinct parents
        query = query.distinct()

    # Get total count before pagination limit
    total_count = query.count()

    # Apply sorting
    from sqlalchemy import func
    if sort_by == "price":
        if sort_order == "desc":
            query = query.outerjoin(models.ProductVariant).group_by(models.Product.id).order_by(func.min(models.ProductVariant.price).desc())
        else:
            query = query.outerjoin(models.ProductVariant).group_by(models.Product.id).order_by(func.min(models.ProductVariant.price).asc())
    elif sort_by == "stock":
        if sort_order == "desc":
            query = query.outerjoin(models.ProductVariant).group_by(models.Product.id).order_by(func.sum(models.ProductVariant.stock).desc())
        else:
            query = query.outerjoin(models.ProductVariant).group_by(models.Product.id).order_by(func.sum(models.ProductVariant.stock).asc())
    elif sort_by == "name":
        if sort_order == "desc":
            query = query.order_by(models.Product.name.desc())
        else:
            query = query.order_by(models.Product.name.asc())
    else: # default ID
        if sort_order == "desc":
            query = query.order_by(models.Product.id.desc())
        else:
            query = query.order_by(models.Product.id.asc())

    # Offset and Limit pagination
    offset = (page - 1) * limit
    items = query.offset(offset).limit(limit).all()

    import math
    pages = math.ceil(total_count / limit) if total_count > 0 else 1

    return {
        "items": items,
        "total": total_count,
        "page": page,
        "limit": limit,
        "pages": pages
    }

@app.get("/products/{product_id}", response_model=schemas.ProductResponse)
def get_product(product_id: int, db: Session = Depends(get_db)):
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    return db_product

@app.put("/products/{product_id}", response_model=schemas.ProductResponse)
def update_product(product_id: int, product_in: schemas.ProductUpdate, db: Session = Depends(get_db)):
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    try:
        # 1. Update basic fields
        db_product.product_code = product_in.product_code
        db_product.name = product_in.name
        db_product.description = product_in.description
        db_product.category_id = product_in.category_id
        db_product.family_id = product_in.family_id
        db_product.weight = product_in.weight
        db_product.length = product_in.length
        db_product.width = product_in.width
        db_product.height = product_in.height
        db_product.is_pre_order = product_in.is_pre_order
        db_product.dts_days = product_in.dts_days
        db_product.status = product_in.status

        # 2. Clear lists to delete orphans
        db_product.tier_variations.clear()
        db_product.variants.clear()
        db_product.media.clear()
        db.flush()
        
        # 3. Save new Tier Variations
        for tv in product_in.tier_variations:
            db_tv = models.TierVariation(
                product_id=product_id,
                tier_index=tv.tier_index,
                name=tv.name,
                options=tv.options
            )
            db_product.tier_variations.append(db_tv)
            
        # 4. Save new Product Variants
        for v in product_in.variants:
            db_var = models.ProductVariant(
                product_id=product_id,
                tier_1_option=v.tier_1_option,
                tier_2_option=v.tier_2_option,
                sku_code=v.sku_code,
                price=v.price,
                stock=v.stock
            )
            db_product.variants.append(db_var)
        
        db.flush() # Populate variants IDs for media mapping
        
        # 5. Save new Media
        for m in product_in.media:
            variant_id = None
            if m.variant_tier_1_option:
                for db_var in db_product.variants:
                    if db_var.tier_1_option == m.variant_tier_1_option:
                        variant_id = db_var.id
                        break
            
            db_media = models.ProductMedia(
                product_id=product_id,
                variant_id=variant_id,
                image_url=m.image_url,
                is_cover=m.is_cover,
                display_order=m.display_order
            )
            db_product.media.append(db_media)

        _upsert_product_attribute_values(db, product_id, product_in.attributes)
            
        db.commit()
        db.refresh(db_product)
        return db_product
        
    except Exception as e:
        db.rollback()
        error_msg = str(e)
        if "unique constraint" in error_msg.lower() or "already exists" in error_msg.lower():
            if "product_code" in error_msg or "products_product_code_key" in error_msg:
                raise HTTPException(status_code=400, detail="Product parent code (SKU parent) already exists.")
            elif "sku_code" in error_msg or "product_variants_sku_code_key" in error_msg:
                raise HTTPException(status_code=400, detail="Variant SKU code already exists.")
            else:
                raise HTTPException(status_code=400, detail="Unique constraint violation: duplicate identifier detected.")
        raise HTTPException(status_code=500, detail=f"Database transaction failed: {error_msg}")

@app.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    try:
        db.delete(db_product)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database transaction failed: {str(e)}")

@app.get("/api/products/by-sku/{sku_code}", response_model=schemas.ProductBySkuResponse)
def get_product_by_sku(sku_code: str, db: Session = Depends(get_db)):
    variant = db.query(models.ProductVariant).filter(models.ProductVariant.sku_code == sku_code).first()
    if not variant:
        raise HTTPException(status_code=404, detail="Product variant not found")
    
    product = variant.product
    
    # Construct variant_name from tier_1_option and tier_2_option
    parts = []
    if variant.tier_1_option:
        # Determine name of tier 1 if available
        t1_name = ""
        t1_var = db.query(models.TierVariation).filter(
            models.TierVariation.product_id == product.id,
            models.TierVariation.tier_index == 1
        ).first()
        if t1_var:
            t1_name = f"{t1_var.name} "
        parts.append(f"{t1_name}{variant.tier_1_option}")
        
    if variant.tier_2_option:
        t2_name = ""
        t2_var = db.query(models.TierVariation).filter(
            models.TierVariation.product_id == product.id,
            models.TierVariation.tier_index == 2
        ).first()
        if t2_var:
            t2_name = f"{t2_var.name} "
        parts.append(f"{t2_name}{variant.tier_2_option}")
        
    variant_name = " / ".join(parts) if parts else None
    
    # image_url rules:
    # 1. First cover image from ProductMedia
    # 2. Or first media URL for this variant
    # 3. Or first media URL for this product
    image_url = None
    
    # Try cover image first
    cover_media = db.query(models.ProductMedia).filter(
        models.ProductMedia.product_id == product.id,
        models.ProductMedia.is_cover == True
    ).order_by(models.ProductMedia.display_order.asc()).first()
    
    if cover_media:
        image_url = cover_media.image_url
    else:
        # Try variant media next
        variant_media = db.query(models.ProductMedia).filter(
            models.ProductMedia.variant_id == variant.id
        ).order_by(models.ProductMedia.display_order.asc()).first()
        
        if variant_media:
            image_url = variant_media.image_url
        else:
            # Try any media for this product
            product_media = db.query(models.ProductMedia).filter(
                models.ProductMedia.product_id == product.id
            ).order_by(models.ProductMedia.display_order.asc()).first()
            if product_media:
                image_url = product_media.image_url

    return schemas.ProductBySkuResponse(
        product_name=product.name,
        variant_name=variant_name,
        sku_code=variant.sku_code,
        price=variant.price,
        weight=product.weight,
        length=product.length,
        width=product.width,
        height=product.height,
        image_url=image_url,
        category=product.category.name if product.category else None
    )

# File Upload Endpoint
@app.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    try:
        content = await file.read()
        file_ext = file.filename.split(".")[-1]
        unique_filename = f"{uuid.uuid4()}.{file_ext}"
        
        # Upload using the minio helper
        image_url = minio_client.upload_file(
            file_data=content,
            file_name=unique_filename,
            content_type=file.content_type
        )
        return {"image_url": image_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image upload failed: {str(e)}")

# Attribute Endpoints
@app.get("/attributes", response_model=List[schemas.AttributeResponse])
def get_attributes(db: Session = Depends(get_db)):
    return db.query(models.Attribute).order_by(models.Attribute.created_at.desc()).all()

@app.get("/attributes/{attribute_id}", response_model=schemas.AttributeResponse)
def get_attribute(attribute_id: int, db: Session = Depends(get_db)):
    attr = db.query(models.Attribute).filter(models.Attribute.id == attribute_id).first()
    if not attr:
        raise HTTPException(status_code=404, detail="Attribute not found")
    return attr

@app.post("/attributes", response_model=schemas.AttributeResponse, status_code=status.HTTP_201_CREATED)
def create_attribute(attribute: schemas.AttributeCreate, db: Session = Depends(get_db)):
    db_attr = db.query(models.Attribute).filter(models.Attribute.code == attribute.code).first()
    if db_attr:
        raise HTTPException(status_code=400, detail="Attribute code already exists.")
    
    new_attr = models.Attribute(
        code=attribute.code,
        name=attribute.name,
        type=attribute.type,
        is_required=attribute.is_required,
        is_unique=attribute.is_unique,
        is_locale_based=attribute.is_locale_based,
        is_channel_based=attribute.is_channel_based
    )
    db.add(new_attr)
    db.commit()
    db.refresh(new_attr)
    return new_attr

@app.put("/attributes/{attribute_id}", response_model=schemas.AttributeResponse)
def update_attribute(attribute_id: int, attribute_in: schemas.AttributeUpdate, db: Session = Depends(get_db)):
    db_attr = db.query(models.Attribute).filter(models.Attribute.id == attribute_id).first()
    if not db_attr:
        raise HTTPException(status_code=404, detail="Attribute not found")
        
    dup = db.query(models.Attribute).filter(models.Attribute.code == attribute_in.code, models.Attribute.id != attribute_id).first()
    if dup:
        raise HTTPException(status_code=400, detail="Attribute code already exists.")
        
    db_attr.code = attribute_in.code
    db_attr.name = attribute_in.name
    db_attr.type = attribute_in.type
    db_attr.is_required = attribute_in.is_required
    db_attr.is_unique = attribute_in.is_unique
    db_attr.is_locale_based = attribute_in.is_locale_based
    db_attr.is_channel_based = attribute_in.is_channel_based
    
    db.commit()
    db.refresh(db_attr)
    return db_attr

@app.delete("/attributes/{attribute_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attribute(attribute_id: int, db: Session = Depends(get_db)):
    db_attr = db.query(models.Attribute).filter(models.Attribute.id == attribute_id).first()
    if not db_attr:
        raise HTTPException(status_code=404, detail="Attribute not found")
    try:
        db.delete(db_attr)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database transaction failed: {str(e)}")

# Attribute Group Endpoints
@app.get("/attribute-groups", response_model=List[schemas.AttributeGroupResponse])
def get_attribute_groups(db: Session = Depends(get_db)):
    return db.query(models.AttributeGroup).order_by(models.AttributeGroup.created_at.desc()).all()

@app.get("/attribute-groups/{group_id}", response_model=schemas.AttributeGroupResponse)
def get_attribute_group(group_id: int, db: Session = Depends(get_db)):
    grp = db.query(models.AttributeGroup).filter(models.AttributeGroup.id == group_id).first()
    if not grp:
        raise HTTPException(status_code=404, detail="Attribute Group not found")
    return grp

@app.post("/attribute-groups", response_model=schemas.AttributeGroupResponse, status_code=status.HTTP_201_CREATED)
def create_attribute_group(group: schemas.AttributeGroupCreate, db: Session = Depends(get_db)):
    db_grp = db.query(models.AttributeGroup).filter(models.AttributeGroup.code == group.code).first()
    if db_grp:
        raise HTTPException(status_code=400, detail="Attribute Group code already exists.")
    
    new_grp = models.AttributeGroup(
        code=group.code,
        name=group.name
    )
    db.add(new_grp)
    db.commit()
    db.refresh(new_grp)
    return new_grp

@app.put("/attribute-groups/{group_id}", response_model=schemas.AttributeGroupResponse)
def update_attribute_group(group_id: int, group_in: schemas.AttributeGroupUpdate, db: Session = Depends(get_db)):
    db_grp = db.query(models.AttributeGroup).filter(models.AttributeGroup.id == group_id).first()
    if not db_grp:
        raise HTTPException(status_code=404, detail="Attribute Group not found")
        
    dup = db.query(models.AttributeGroup).filter(models.AttributeGroup.code == group_in.code, models.AttributeGroup.id != group_id).first()
    if dup:
        raise HTTPException(status_code=400, detail="Attribute Group code already exists.")
        
    db_grp.code = group_in.code
    db_grp.name = group_in.name
    
    db.commit()
    db.refresh(db_grp)
    return db_grp

@app.delete("/attribute-groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attribute_group(group_id: int, db: Session = Depends(get_db)):
    db_grp = db.query(models.AttributeGroup).filter(models.AttributeGroup.id == group_id).first()
    if not db_grp:
        raise HTTPException(status_code=404, detail="Attribute Group not found")
    try:
        db.delete(db_grp)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database transaction failed: {str(e)}")

# Attribute Family Endpoints
@app.get("/attribute-families", response_model=List[schemas.AttributeFamilyResponse])
def get_attribute_families(db: Session = Depends(get_db)):
    return db.query(models.AttributeFamily).order_by(models.AttributeFamily.created_at.desc()).all()

@app.get("/attribute-families/{family_id}", response_model=schemas.AttributeFamilyResponse)
def get_attribute_family(family_id: int, db: Session = Depends(get_db)):
    fam = db.query(models.AttributeFamily).filter(models.AttributeFamily.id == family_id).first()
    if not fam:
        raise HTTPException(status_code=404, detail="Attribute Family not found")
    return fam


@app.get("/attribute-families/{family_id}/attributes", response_model=List[schemas.AttributeResponse])
def get_attributes_by_family(family_id: int, db: Session = Depends(get_db)):
    fam = db.query(models.AttributeFamily).filter(models.AttributeFamily.id == family_id).first()
    if not fam:
        raise HTTPException(status_code=404, detail="Attribute Family not found")

    family_attrs = (
        db.query(models.Attribute)
        .join(models.AttributeFamilyAttribute, models.AttributeFamilyAttribute.attribute_id == models.Attribute.id)
        .filter(models.AttributeFamilyAttribute.family_id == family_id)
        .order_by(models.AttributeFamilyAttribute.display_order.asc(), models.Attribute.id.asc())
        .all()
    )
    return family_attrs

@app.post("/attribute-families", response_model=schemas.AttributeFamilyResponse, status_code=status.HTTP_201_CREATED)
def create_attribute_family(family: schemas.AttributeFamilyCreate, db: Session = Depends(get_db)):
    db_fam = db.query(models.AttributeFamily).filter(models.AttributeFamily.code == family.code).first()
    if db_fam:
        raise HTTPException(status_code=400, detail="Attribute Family code already exists.")
    
    new_fam = models.AttributeFamily(
        code=family.code,
        name=family.name
    )
    db.add(new_fam)
    db.commit()
    db.refresh(new_fam)
    return new_fam

@app.put("/attribute-families/{family_id}", response_model=schemas.AttributeFamilyResponse)
def update_attribute_family(family_id: int, family_in: schemas.AttributeFamilyUpdate, db: Session = Depends(get_db)):
    db_fam = db.query(models.AttributeFamily).filter(models.AttributeFamily.id == family_id).first()
    if not db_fam:
        raise HTTPException(status_code=404, detail="Attribute Family not found")
        
    dup = db.query(models.AttributeFamily).filter(models.AttributeFamily.code == family_in.code, models.AttributeFamily.id != family_id).first()
    if dup:
        raise HTTPException(status_code=400, detail="Attribute Family code already exists.")
        
    db_fam.code = family_in.code
    db_fam.name = family_in.name
    
    db.commit()
    db.refresh(db_fam)
    return db_fam

@app.delete("/attribute-families/{family_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attribute_family(family_id: int, db: Session = Depends(get_db)):
    db_fam = db.query(models.AttributeFamily).filter(models.AttributeFamily.id == family_id).first()
    if not db_fam:
        raise HTTPException(status_code=404, detail="Attribute Family not found")
    try:
        db.delete(db_fam)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database transaction failed: {str(e)}")

