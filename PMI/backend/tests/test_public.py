import importlib
import pytest
import uuid
import models
from fastapi.testclient import TestClient
from services.promotion_service import recompute_variant_prices

def test_get_public_categories(client, db_session):
    # Create test categories
    parent = models.Category(name="Sportswear", code="sportswear")
    db_session.add(parent)
    db_session.commit()
    
    child = models.Category(name="Shirts", code="shirts", parent_id=parent.id)
    db_session.add(child)
    db_session.commit()
    
    resp = client.get("/public/categories")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 2
    
    # Check display_name calculation
    shirt_cat = next((c for c in data if c["code"] == "shirts"), None)
    assert shirt_cat is not None
    assert shirt_cat["display_name"] == "[root] / Sportswear / Shirts"


def test_get_public_products_status_filtering(client, db_session):
    # Clean products
    db_session.query(models.ProductVariant).delete()
    db_session.query(models.Product).delete()
    db_session.commit()
    
    # Create category
    cat = models.Category(name="Badminton", code="badminton")
    db_session.add(cat)
    db_session.commit()
    
    # Create active/published product
    prod_published = models.Product(
        product_code="PUB-1",
        name="Published Product",
        status="Published",
        category_id=cat.id,
        weight=85.0
    )
    # Create draft product
    prod_draft = models.Product(
        product_code="DRF-1",
        name="Draft Product",
        status="Draft",
        category_id=cat.id,
        weight=85.0
    )
    # Create out of stock product
    prod_oos = models.Product(
        product_code="OOS-1",
        name="OOS Product",
        status="Out of Stock",
        category_id=cat.id,
        weight=85.0
    )
    
    db_session.add(prod_published)
    db_session.add(prod_draft)
    db_session.add(prod_oos)
    db_session.commit()
    
    # Fetch public products
    resp = client.get("/public/products")
    assert resp.status_code == 200
    data = resp.json()
    
    items = data["items"]
    assert len(items) == 2
    
    codes = [item["product_code"] for item in items]
    assert "PUB-1" in codes
    assert "OOS-1" in codes
    assert "DRF-1" not in codes


def test_get_public_product_detail(client, db_session):
    # Clean products
    db_session.query(models.ProductVariant).delete()
    db_session.query(models.Product).delete()
    db_session.commit()
    
    # Create category
    cat = models.Category(name="Badminton", code="badminton")
    db_session.add(cat)
    db_session.commit()
    
    # Create product
    prod = models.Product(
        product_code="PROD-DET",
        name="Detailed Product",
        status="Published",
        category_id=cat.id,
        weight=80.0
    )
    db_session.add(prod)
    db_session.commit()
    
    # Create a variant
    variant = models.ProductVariant(
        product_id=prod.id,
        sku_code="PROD-DET-VAR",
        price=150000.0
    )
    db_session.add(variant)
    db_session.commit()
    
    # 1. Fetch by ID
    resp = client.get(f"/public/products/{prod.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Detailed Product"
    assert len(data["variants"]) == 1
    assert data["variants"][0]["sku_code"] == "PROD-DET-VAR"
    assert data["min_price"] == 150000.0
    
    # 2. Fetch non-existent returns 404
    resp = client.get("/public/products/999999")
    assert resp.status_code == 404


def test_public_products_include_active_all_products_promotion(client, db_session, mocker):
    cat = models.Category(
        name="Promotion Test Category",
        code=f"PROMO_PUBLIC_{uuid.uuid4().hex[:8]}"
    )
    db_session.add(cat)
    db_session.flush()

    product = models.Product(
        product_code=f"PROMO-PUBLIC-{uuid.uuid4().hex[:8]}",
        slug=f"promo-public-{uuid.uuid4().hex[:8]}",
        name="Public Promotion Product",
        status="Published",
        category_id=cat.id,
        weight=100.0,
    )
    db_session.add(product)
    db_session.flush()

    variants = [
        models.ProductVariant(
            product_id=product.id,
            sku_code=f"PROMO-PUBLIC-V1-{uuid.uuid4().hex[:8]}",
            price=100000.0,
        ),
        models.ProductVariant(
            product_id=product.id,
            sku_code=f"PROMO-PUBLIC-V2-{uuid.uuid4().hex[:8]}",
            price=250000.0,
        ),
    ]
    db_session.add_all(variants)
    db_session.flush()

    promotion = models.Promotion(
        id=str(uuid.uuid4()),
        code=f"PUBLIC_ALL_{uuid.uuid4().hex[:8]}",
        name="Public All Products Promotion",
        discount_type=models.DiscountType.PERCENTAGE,
        discount_value=20.0,
        status=models.PromotionStatus.ACTIVE,
    )
    promotion.scopes.append(
        models.PromotionScope(
            id=str(uuid.uuid4()),
            scope_type=models.ScopeType.ALL,
        )
    )
    db_session.add(promotion)
    db_session.flush()
    recompute_variant_prices(db_session, [str(variant.id) for variant in variants])
    public_router = importlib.import_module("routers.public")
    bulk_price_spy = mocker.spy(public_router.promotion_service, "get_bulk_computed_prices")

    list_response = client.get("/public/products", params={"q": product.name})
    assert list_response.status_code == 200
    list_product = next(item for item in list_response.json()["items"] if item["id"] == product.id)
    assert bulk_price_spy.call_count == 1
    assert bulk_price_spy.call_args.args[1] == [variant.id for variant in variants]

    detail_response = client.get(f"/public/products/{product.slug}")
    assert detail_response.status_code == 200
    detail_product = detail_response.json()
    assert bulk_price_spy.call_count == 2
    assert bulk_price_spy.call_args.args[1] == [variant.id for variant in variants]

    for response_product in (list_product, detail_product):
        response_variants = {
            variant["id"]: variant for variant in response_product["variants"]
        }
        assert response_variants[variants[0].id]["computed_price"] == 80000.0
        assert response_variants[variants[0].id]["original_price"] == 100000.0
        assert response_variants[variants[0].id]["percentage_discount"] == 20.0
        assert response_variants[variants[0].id]["has_active_promotion"] is True
        assert response_variants[variants[1].id]["computed_price"] == 200000.0
        assert response_variants[variants[1].id]["has_active_promotion"] is True
