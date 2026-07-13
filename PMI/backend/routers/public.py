"""
Public API endpoints for web storefront.
These endpoints do NOT require authentication.
Only expose read-only data safe for public consumption.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload
from typing import Optional, List
from database import get_db
import models
from pydantic import BaseModel, ConfigDict
from datetime import datetime

router = APIRouter(prefix="/public", tags=["Public API"])


# ============================================
# Pydantic Schemas for Public API
# ============================================

class PublicCategoryResponse(BaseModel):
    id: int
    name: str
    code: str
    parent_id: Optional[int] = None
    display_name: str
    model_config = ConfigDict(from_attributes=True)


class PublicMediaResponse(BaseModel):
    id: int
    product_id: int
    variant_id: Optional[int] = None
    image_url: str
    is_cover: bool
    display_order: int
    model_config = ConfigDict(from_attributes=True)


class PublicVariantResponse(BaseModel):
    id: int
    product_id: int
    tier_1_option: Optional[str] = None
    tier_2_option: Optional[str] = None
    sku_code: str
    price: float
    barcode: Optional[str] = None
    stock: int
    model_config = ConfigDict(from_attributes=True)


class PublicTierVariationResponse(BaseModel):
    id: int
    product_id: int
    tier_index: int
    name: str
    options: List[str]
    model_config = ConfigDict(from_attributes=True)


class PublicAttributeMeta(BaseModel):
    id: int
    code: str
    name: str
    type: str
    model_config = ConfigDict(from_attributes=True)


class PublicAttributeValueResponse(BaseModel):
    id: int
    product_id: int
    attribute_id: int
    value_string: Optional[str] = None
    value_decimal: Optional[float] = None
    attribute: Optional[PublicAttributeMeta] = None
    model_config = ConfigDict(from_attributes=True)


class PublicProductResponse(BaseModel):
    id: int
    product_code: str
    slug: Optional[str] = None
    name: str
    description: Optional[str] = None
    category_id: Optional[int] = None
    family_id: Optional[int] = None
    weight: float
    status: str
    tier_variations: List[PublicTierVariationResponse] = []
    variants: List[PublicVariantResponse] = []
    media: List[PublicMediaResponse] = []
    attribute_values: List[PublicAttributeValueResponse] = []
    
    # Pre-calculated values to help client
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    total_stock: int = 0
    model_config = ConfigDict(from_attributes=True)


class PublicProductListResponse(BaseModel):
    items: List[PublicProductResponse]
    total: int
    page: int
    limit: int
    pages: int


# ============================================
# Helper Functions
# ============================================

def compute_product_prices(product: models.Product) -> tuple:
    """Calculate min/max price and total stock from variants"""
    prices = [float(v.price) for v in product.variants if v.price is not None]
    stocks = [v.stock for v in product.variants if v.stock is not None]
    
    min_price = min(prices) if prices else None
    max_price = max(prices) if prices else None
    total_stock = sum(stocks) if stocks else 0
    
    return min_price, max_price, total_stock


# ============================================
# Public Endpoints
# ============================================

@router.get("/categories", response_model=List[PublicCategoryResponse])
def get_public_categories(db: Session = Depends(get_db)):
    """Get all categories with display_name calculated."""
    categories = db.query(models.Category).order_by(
        models.Category.id.asc()
    ).all()
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
        
        response.append(PublicCategoryResponse(
            id=cat.id,
            name=cat.name,
            code=cat.code,
            parent_id=cat.parent_id,
            display_name=display_name
        ))
    return response


@router.get("/products", response_model=PublicProductListResponse)
def get_public_products(
    q: Optional[str] = None,
    category_id: Optional[int] = None,
    category_code: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    in_stock: Optional[bool] = None,
    sort_by: str = "newest",  # newest, price_asc, price_desc, name
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """
    Get paginated list of ACTIVE products for storefront.
    Only returns products with status='Published' or 'Out of Stock'.
    """
    # Validate pagination
    if page < 1:
        page = 1
    if limit < 1 or limit > 100:
        limit = 20
    
    # Base query - only published or out of stock products
    query = db.query(models.Product).options(
        selectinload(models.Product.category),
        selectinload(models.Product.tier_variations),
        selectinload(models.Product.variants),
        selectinload(models.Product.media),
        selectinload(models.Product.attribute_values).selectinload(
            models.ProductAttributeValue.attribute
        ),
    ).filter(models.Product.status.in_(["Published", "Out of Stock"]))
    
    # Filter by category
    if category_id:
        query = query.filter(models.Product.category_id == category_id)
    elif category_code:
        category = db.query(models.Category).filter(
            models.Category.code == category_code
        ).first()
        if category:
            query = query.filter(models.Product.category_id == category.id)
    
    # Search by name/code
    if q:
        search_term = f"%{q}%"
        query = query.filter(
            (models.Product.name.ilike(search_term)) |
            (models.Product.product_code.ilike(search_term))
        )
    
    # Get total before pagination
    total = query.count()
    
    # Sorting
    from sqlalchemy import func
    if sort_by == "price_asc":
        query = query.outerjoin(models.ProductVariant).group_by(
            models.Product.id
        ).order_by(func.min(models.ProductVariant.price).asc())
    elif sort_by == "price_desc":
        query = query.outerjoin(models.ProductVariant).group_by(
            models.Product.id
        ).order_by(func.min(models.ProductVariant.price).desc())
    elif sort_by == "name":
        query = query.order_by(models.Product.name.asc())
    else:  # newest (default)
        query = query.order_by(models.Product.id.desc())
    
    # Pagination
    import math
    offset = (page - 1) * limit
    products = query.offset(offset).limit(limit).all()
    pages = math.ceil(total / limit) if total > 0 else 1
    
    # Load all categories once for fast path calculations
    all_categories = db.query(models.Category).all()
    cat_dict = {c.id: c for c in all_categories}
    
    # Convert to response format and attach pre-calculated properties
    items = []
    for p in products:
        min_p, max_p, total_st = compute_product_prices(p)
        items.append(PublicProductResponse(
            id=p.id,
            product_code=p.product_code,
            slug=p.slug,
            name=p.name,
            description=p.description,
            category_id=p.category_id,
            family_id=p.family_id,
            weight=p.weight,
            status=p.status,
            tier_variations=[
                PublicTierVariationResponse(
                    id=tv.id,
                    product_id=tv.product_id,
                    tier_index=tv.tier_index,
                    name=tv.name,
                    options=tv.options
                ) for tv in p.tier_variations
            ],
            variants=[
                PublicVariantResponse(
                    id=v.id,
                    product_id=v.product_id,
                    tier_1_option=v.tier_1_option,
                    tier_2_option=v.tier_2_option,
                    sku_code=v.sku_code,
                    price=float(v.price),
                    barcode=v.barcode,
                    stock=v.stock
                ) for v in p.variants
            ],
            media=[
                PublicMediaResponse(
                    id=m.id,
                    product_id=m.product_id,
                    variant_id=m.variant_id,
                    image_url=m.image_url,
                    is_cover=m.is_cover,
                    display_order=m.display_order
                ) for m in p.media
            ],
            attribute_values=[
                PublicAttributeValueResponse(
                    id=av.id,
                    product_id=av.product_id,
                    attribute_id=av.attribute_id,
                    value_string=av.value_string,
                    value_decimal=av.value_decimal,
                    attribute=PublicAttributeMeta(
                        id=av.attribute.id,
                        code=av.attribute.code,
                        name=av.attribute.name,
                        type=av.attribute.type
                    ) if av.attribute else None
                ) for av in p.attribute_values
            ],
            min_price=min_p,
            max_price=max_p,
            total_stock=total_st
        ))
    
    # Post-filter by price/stock if requested
    if min_price is not None:
        items = [p for p in items if p.min_price is not None and p.min_price >= min_price]
    if max_price is not None:
        items = [p for p in items if p.max_price is not None and p.max_price <= max_price]
    if in_stock:
        items = [p for p in items if p.total_stock > 0]
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": pages
    }


@router.get("/products/{identifier}", response_model=PublicProductResponse)
def get_public_product(
    identifier: str,
    db: Session = Depends(get_db)
):
    """
    Get single product by ID or slug.
    Only returns if status is 'Published' or 'Out of Stock'.
    """
    query = db.query(models.Product).options(
        selectinload(models.Product.category),
        selectinload(models.Product.tier_variations),
        selectinload(models.Product.variants),
        selectinload(models.Product.media),
        selectinload(models.Product.attribute_values).selectinload(
            models.ProductAttributeValue.attribute
        ),
    ).filter(models.Product.status.in_(["Published", "Out of Stock"]))
    
    product = None
    if identifier.isdigit():
        product = query.filter(models.Product.id == int(identifier)).first()
    
    if not product:
        product = query.filter(models.Product.slug == identifier).first()
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    min_p, max_p, total_st = compute_product_prices(product)
    
    return PublicProductResponse(
        id=product.id,
        product_code=product.product_code,
        slug=product.slug,
        name=product.name,
        description=product.description,
        category_id=product.category_id,
        family_id=product.family_id,
        weight=product.weight,
        status=product.status,
        tier_variations=[
            PublicTierVariationResponse(
                id=tv.id,
                product_id=tv.product_id,
                tier_index=tv.tier_index,
                name=tv.name,
                options=tv.options
            ) for tv in product.tier_variations
        ],
        variants=[
            PublicVariantResponse(
                id=v.id,
                product_id=v.product_id,
                tier_1_option=v.tier_1_option,
                tier_2_option=v.tier_2_option,
                sku_code=v.sku_code,
                price=float(v.price),
                barcode=v.barcode,
                stock=v.stock
            ) for v in product.variants
        ],
        media=[
            PublicMediaResponse(
                id=m.id,
                product_id=m.product_id,
                variant_id=m.variant_id,
                image_url=m.image_url,
                is_cover=m.is_cover,
                display_order=m.display_order
            ) for m in product.media
        ],
        attribute_values=[
            PublicAttributeValueResponse(
                id=av.id,
                product_id=av.product_id,
                attribute_id=av.attribute_id,
                value_string=av.value_string,
                value_decimal=av.value_decimal,
                attribute=PublicAttributeMeta(
                    id=av.attribute.id,
                    code=av.attribute.code,
                    name=av.attribute.name,
                    type=av.attribute.type
                ) if av.attribute else None
            ) for av in product.attribute_values
        ],
        min_price=min_p,
        max_price=max_p,
        total_stock=total_st
    )


@router.get("/categories/{identifier}", response_model=PublicCategoryResponse)
def get_public_category(
    identifier: str,
    db: Session = Depends(get_db)
):
    """Get single category by ID or code/slug."""
    category = None
    
    if identifier.isdigit():
        category = db.query(models.Category).filter(
            models.Category.id == int(identifier)
        ).first()
    
    if not category:
        category = db.query(models.Category).filter(
            models.Category.code == identifier
        ).first()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )
        
    # Calculate display_name
    categories = db.query(models.Category).all()
    cat_dict = {c.id: c for c in categories}
    
    path = []
    curr = category
    visited = set()
    while curr and curr.id not in visited:
        visited.add(curr.id)
        path.insert(0, curr.name)
        curr = cat_dict.get(curr.parent_id) if curr.parent_id else None
    
    display_name = f"[root] / {' / '.join(path)}"
    
    return PublicCategoryResponse(
        id=category.id,
        name=category.name,
        code=category.code,
        parent_id=category.parent_id,
        display_name=display_name
    )
