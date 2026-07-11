from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload
from typing import List, Optional
import unicodedata
import re
from database import get_db
import models
import schemas
from services.product_service import _upsert_product_attribute_values, _save_product_channel_listings

router = APIRouter(tags=['Products'])

def slugify(text: str) -> str:
    if not text:
        return ""
    text = text.replace('đ', 'd').replace('Đ', 'd')
    text = unicodedata.normalize('NFKD', text)
    text = text.encode('ascii', 'ignore').decode('ascii')
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')

@router.post("/products", response_model=schemas.ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(product_in: schemas.ProductCreate, db: Session = Depends(get_db)):
    try:
        # Generate slug
        slug_name = slugify(product_in.name)[:150]
        slug_code = slugify(product_in.product_code)
        product_slug = f"{slug_name}-{slug_code}".strip('-')

        # 1. Create the parent product
        db_product = models.Product(
            product_code=product_in.product_code,
            slug=product_slug,
            name=product_in.name,
            description=product_in.description,
            category_id=product_in.category_id,
            family_id=product_in.family_id,
            weight=product_in.weight,
            length=product_in.length,
            width=product_in.width,
            height=product_in.height,
            hs_code=product_in.hs_code,
            tax_code=product_in.tax_code,
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
                barcode=v.barcode,
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

        # 5. Save Channel Listings
        _save_product_channel_listings(db, db_product.id, product_in.channel_listings, db_variants)

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

@router.get("/products", response_model=schemas.PaginatedProductResponse)
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
    query = db.query(models.Product).options(
        selectinload(models.Product.family),
        selectinload(models.Product.channel_listings).selectinload(models.ProductChannelListing.attribute_values),
        selectinload(models.Product.channel_listings).selectinload(models.ProductChannelListing.variant_overrides),
        selectinload(models.Product.channel_listings).selectinload(models.ProductChannelListing.channel)
    )
    
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

@router.get("/products/{product_id}", response_model=schemas.ProductResponse)
def get_product(product_id: int, db: Session = Depends(get_db)):
    db_product = db.query(models.Product).options(
        selectinload(models.Product.family),
        selectinload(models.Product.channel_listings).selectinload(models.ProductChannelListing.attribute_values),
        selectinload(models.Product.channel_listings).selectinload(models.ProductChannelListing.variant_overrides),
        selectinload(models.Product.channel_listings).selectinload(models.ProductChannelListing.channel)
    ).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    return db_product

@router.put("/products/{product_id}", response_model=schemas.ProductResponse)
def update_product(product_id: int, product_in: schemas.ProductUpdate, db: Session = Depends(get_db)):
    db_product = db.query(models.Product).options(
        selectinload(models.Product.family),
        selectinload(models.Product.channel_listings).selectinload(models.ProductChannelListing.attribute_values),
        selectinload(models.Product.channel_listings).selectinload(models.ProductChannelListing.variant_overrides),
        selectinload(models.Product.channel_listings).selectinload(models.ProductChannelListing.channel)
    ).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    try:
        # Pre-load existing variant overrides map before they are cleared
        existing_vos = db.query(models.VariantChannelListing).filter(
            models.VariantChannelListing.product_id == product_id
        ).all()
        existing_vo_map = {}
        for vo in existing_vos:
            if vo.variant and vo.variant.sku_code:
                existing_vo_map[(vo.channel_id, vo.variant.sku_code)] = vo.channel_variant_id

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
        db_product.hs_code = product_in.hs_code
        db_product.tax_code = product_in.tax_code
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
        db_variants = []
        for v in product_in.variants:
            db_var = models.ProductVariant(
                product_id=product_id,
                tier_1_option=v.tier_1_option,
                tier_2_option=v.tier_2_option,
                sku_code=v.sku_code,
                price=v.price,
                barcode=v.barcode,
                stock=v.stock
            )
            db_product.variants.append(db_var)
            db_variants.append(db_var)
        
        db.flush() # Populate variants IDs for media mapping
        
        # 5. Save new Media
        for m in product_in.media:
            variant_id = None
            if m.variant_tier_1_option:
                for db_var in db_variants:
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
            
        # Save new channel listings
        _save_product_channel_listings(db, product_id, product_in.channel_listings, db_variants, existing_vo_map)

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

@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
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

@router.post("/products/batch-delete", status_code=status.HTTP_204_NO_CONTENT)
def batch_delete_products(request: schemas.BatchDeleteRequest, db: Session = Depends(get_db)):
    try:
        products = db.query(models.Product).filter(models.Product.id.in_(request.product_ids)).all()
        for product in products:
            db.delete(product)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database transaction failed: {str(e)}")

@router.get("/api/products/by-sku/{sku_code}", response_model=schemas.ProductBySkuResponse)
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

