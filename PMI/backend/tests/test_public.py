import pytest
import models
from fastapi.testclient import TestClient

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
