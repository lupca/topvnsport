import pytest
from fastapi.testclient import TestClient
from integration.test_api_products import _first_category_id, _first_family_id, _first_attribute_id

def test_create_product_with_cost_tax(client: TestClient):
    """Tạo product với variant có cost và tax"""
    cat_id = _first_category_id(client)
    fam_id = _first_family_id(client)
    attr_id = _first_attribute_id(client)

    payload = {
        "product_code": "TEST-COST-TAX-1",
        "name": "Test Product",
        "category_id": cat_id,
        "family_id": fam_id,
        "weight": 100.0,
        "variants": [{
            "tier_1_option": None,
            "tier_2_option": None,
            "sku_code": "TEST-COST-TAX-1-VAR",
            "price": 100000.0,
            "barcode": "8934567890123",
            "default_cost_price": 50000.0,
            "default_tax_rate": 10.0
        }],
        "attributes": [{"id": attr_id, "value": "TestValue"}]
    }
    res = client.post("/products", json=payload)
    assert res.status_code == 201
    data = res.json()
    variant = data["variants"][0]
    assert float(variant["default_cost_price"]) == 50000.0
    assert float(variant["default_tax_rate"]) == 10.0

def test_update_variant_cost_tax(client: TestClient):
    """Update cost/tax của variant"""
    cat_id = _first_category_id(client)
    fam_id = _first_family_id(client)
    attr_id = _first_attribute_id(client)

    payload = {
        "product_code": "TEST-COST-TAX-2",
        "name": "Test Product 2",
        "category_id": cat_id,
        "family_id": fam_id,
        "weight": 100.0,
        "variants": [{
            "tier_1_option": None,
            "tier_2_option": None,
            "sku_code": "TEST-COST-TAX-2-VAR",
            "price": 100000.0,
            "barcode": "8934567890123",
            "default_cost_price": 50000.0,
            "default_tax_rate": 10.0
        }],
        "attributes": [{"id": attr_id, "value": "TestValue"}]
    }
    # Create product
    res = client.post("/products", json=payload)
    assert res.status_code == 201
    created_product = res.json()
    product_id = created_product["id"]
    variant_id = created_product["variants"][0]["id"]
    
    # Update cost and tax
    update_payload = {
        "product_code": "TEST-COST-TAX-2",
        "name": "Test Product 2 Updated",
        "category_id": cat_id,
        "family_id": fam_id,
        "weight": 100.0,
        "variants": [{
            "id": variant_id,
            "tier_1_option": None,
            "tier_2_option": None,
            "sku_code": "TEST-COST-TAX-2-VAR",
            "price": 100000.0,
            "barcode": "8934567890123",
            "default_cost_price": 60000.0,  # Updated
            "default_tax_rate": 8.0         # Updated
        }],
        "attributes": [{"id": attr_id, "value": "TestValue"}]
    }
    
    res = client.put(f"/products/{product_id}", json=update_payload)
    assert res.status_code == 200
    res_variant = res.json()["variants"][0]
    assert float(res_variant["default_cost_price"]) == 60000.0
    assert float(res_variant["default_tax_rate"]) == 8.0

def test_public_api_returns_cost_tax(client: TestClient):
    """Public API trả về cost/tax cho WMS sync"""
    cat_id = _first_category_id(client)
    fam_id = _first_family_id(client)
    attr_id = _first_attribute_id(client)

    payload = {
        "product_code": "TEST-COST-TAX-3",
        "name": "Test Product 3",
        "category_id": cat_id,
        "family_id": fam_id,
        "weight": 100.0,
        "status": "Published",
        "variants": [{
            "tier_1_option": None,
            "tier_2_option": None,
            "sku_code": "TEST-COST-TAX-3-VAR",
            "price": 100000.0,
            "barcode": "8934567890123",
            "default_cost_price": 50000.0,
            "default_tax_rate": 10.0
        }],
        "attributes": [{"id": attr_id, "value": "TestValue"}]
    }
    res = client.post("/products", json=payload)
    assert res.status_code == 201
    created_product = res.json()
    product_id = created_product["id"]

    # Retrieve public products
    res = client.get("/public/products")
    assert res.status_code == 200
    products = res.json()["items"]
    
    # Find our test product
    product_data = next(p for p in products if p["id"] == product_id)
    variant_data = product_data["variants"][0]
    
    assert "default_cost_price" in variant_data
    assert "default_tax_rate" in variant_data
    assert variant_data["default_cost_price"] == 50000.0
    assert variant_data["default_tax_rate"] == 10.0
