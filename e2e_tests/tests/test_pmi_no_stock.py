from __future__ import annotations

import csv
import io
from uuid import uuid4
import httpx
import pytest

from e2e_tests.conftest import ApiClients
from e2e_tests.utils.api_helpers import PMIApi


def test_pmi_product_create_and_update_without_stock(api_clients: ApiClients):
    """
    Verify creating and updating products/variations in PMI backend using payloads with NO stock field.
    """
    run_id = uuid4().hex[:8]
    pmi = PMIApi(api_clients.pmi)

    category = pmi.create_category(name=f"NoStock Cat {run_id}", code=f"CAT-NS-{run_id}")
    family = pmi.create_attribute_family(name=f"NoStock Fam {run_id}", code=f"FAM-NS-{run_id}")

    product_code = f"PROD-NS-{run_id}"
    sku_code = f"SKU-NS-{run_id}"

    # 1. Create product with NO stock field in variant payload
    create_payload = {
        "product_code": product_code,
        "name": f"Product No Stock {run_id}",
        "description": "E2E product created without stock field",
        "category_id": category.id,
        "family_id": family.id,
        "weight": 120.0,
        "length": 30.0,
        "width": 15.0,
        "height": 5.0,
        "is_pre_order": False,
        "dts_days": 7,
        "status": "Published",
        "tier_variations": [],
        "variants": [
            {
                "tier_1_option": None,
                "tier_2_option": None,
                "sku_code": sku_code,
                "price": 450000.0,
                "default_cost_price": 250000.0,
                "default_tax_rate": 8.0,
                "barcode": f"893{run_id[:9]}",
                # Note: 'stock' field is explicitly omitted!
            }
        ],
        "media": [],
        "attributes": [],
    }

    create_resp = api_clients.pmi.post("/products", json=create_payload)
    assert create_resp.status_code in (200, 201), f"Failed creating product without stock: {create_resp.text}"
    created_product = create_resp.json()
    product_id = created_product["id"]

    # 2. Update product with updated name and price, omitting stock field
    update_payload = {
        "product_code": product_code,
        "name": f"Product No Stock Updated {run_id}",
        "description": "Updated E2E product without stock field",
        "category_id": category.id,
        "family_id": family.id,
        "weight": 125.0,
        "length": 30.0,
        "width": 15.0,
        "height": 5.0,
        "is_pre_order": False,
        "dts_days": 7,
        "status": "Published",
        "tier_variations": [],
        "variants": [
            {
                "tier_1_option": None,
                "tier_2_option": None,
                "sku_code": sku_code,
                "price": 490000.0,
                "default_cost_price": 260000.0,
                "default_tax_rate": 8.0,
                "barcode": f"893{run_id[:9]}",
                # 'stock' field is omitted during update
            }
        ],
        "media": [],
        "attributes": [],
    }

    update_resp = api_clients.pmi.put(f"/products/{product_id}", json=update_payload)
    assert update_resp.status_code == 200, f"Failed updating product without stock: {update_resp.text}"
    updated_product = update_resp.json()
    assert updated_product["name"] == f"Product No Stock Updated {run_id}"


def test_pmi_product_responses_exclude_stock_field(api_clients: ApiClients):
    """
    Verify that all PMI product responses (product list, product detail, variant schemas)
    completely exclude the legacy 'stock' field.
    """
    run_id = uuid4().hex[:8]
    pmi = PMIApi(api_clients.pmi)

    category = pmi.create_category(name=f"NoStock Exclude Cat {run_id}", code=f"CAT-EX-{run_id}")
    family = pmi.create_attribute_family(name=f"NoStock Exclude Fam {run_id}", code=f"FAM-EX-{run_id}")

    product_code = f"PROD-EX-{run_id}"
    sku_code = f"SKU-EX-{run_id}"

    product = pmi.create_product_with_variants(
        product_code=product_code,
        name=f"Product Exclude Stock {run_id}",
        category_id=category.id,
        family_id=family.id,
        sku_code=sku_code,
        price=100000.0,
        stock=0,
    )

    # 1. Product Detail (GET /products/{id})
    detail_resp = api_clients.pmi.get(f"/products/{product.id}")
    assert detail_resp.status_code == 200
    detail_data = detail_resp.json()
    assert "stock" not in detail_data, "Product detail response should not contain 'stock' field"
    for variant in detail_data.get("variants", []):
        assert "stock" not in variant, "Variant response should not contain 'stock' field"

    # 2. Product List (GET /products)
    list_resp = api_clients.pmi.get("/products")
    assert list_resp.status_code == 200
    list_data = list_resp.json()
    items = list_data.get("items", list_data) if isinstance(list_data, dict) else list_data
    assert len(items) > 0
    for prod in items:
        assert "stock" not in prod, "Product in list response should not contain 'stock' field"
        for var in prod.get("variants", []):
            assert "stock" not in var, "Variant in list response should not contain 'stock' field"

    # 3. Get Product By SKU (GET /api/products/by-sku/{sku})
    by_sku_resp = api_clients.pmi.get(f"/api/products/by-sku/{sku_code}")
    if by_sku_resp.status_code == 404:
        by_sku_resp = api_clients.pmi.get(f"/products/by-sku/{sku_code}")
    assert by_sku_resp.status_code == 200
    by_sku_data = by_sku_resp.json()
    assert "stock" not in by_sku_data, "By-SKU response should not contain 'stock' field"


def test_pmi_legacy_sync_stock_returns_404(api_clients: ApiClients, pmi_api_url: str):
    """
    Verify that legacy POST /service/sync-stock and POST /api/service/sync-stock endpoints
    return HTTP 404 (Endpoint deprecated).
    """
    # 1. Using authenticated client
    resp1 = api_clients.pmi.post("/service/sync-stock", json={"product_id": 1, "stock": 100})
    assert resp1.status_code == 404, f"Expected 404 for /service/sync-stock, got {resp1.status_code}"

    resp2 = api_clients.pmi.post("/api/service/sync-stock", json={"product_id": 1, "stock": 100})
    assert resp2.status_code == 404, f"Expected 404 for /api/service/sync-stock, got {resp2.status_code}"

    # 2. Using unauthenticated client
    with httpx.Client(base_url=pmi_api_url, timeout=10.0) as unauth_client:
        unauth_resp1 = unauth_client.post("/service/sync-stock", json={"product_id": 1, "stock": 100})
        assert unauth_resp1.status_code == 404

        unauth_resp2 = unauth_client.post("/api/service/sync-stock", json={"product_id": 1, "stock": 100})
        assert unauth_resp2.status_code == 404


def test_pmi_csv_channel_export_omits_stock_column(api_clients: ApiClients):
    """
    Verify that CSV channel export endpoints omit the legacy 'stock' header and column.
    """
    # 1. Shopee CSV Export
    shopee_resp = api_clients.pmi.get("/export/shopee?status=Published")
    if shopee_resp.status_code == 404:
        shopee_resp = api_clients.pmi.get("/api/export/shopee?status=Published")
    assert shopee_resp.status_code == 200, f"Shopee export failed: {shopee_resp.text}"

    csv_text = shopee_resp.text
    reader = csv.reader(io.StringIO(csv_text))
    headers = next(reader, [])
    assert "stock" not in headers, f"'stock' column should not be in Shopee CSV headers: {headers}"
    assert "qty_on_hand" not in headers, f"'qty_on_hand' column should not be in Shopee CSV headers: {headers}"

    # 2. TikTok CSV Export
    tiktok_resp = api_clients.pmi.get("/export/tiktok?status=Published")
    if tiktok_resp.status_code == 404:
        tiktok_resp = api_clients.pmi.get("/api/export/tiktok?status=Published")
    assert tiktok_resp.status_code == 200, f"TikTok export failed: {tiktok_resp.text}"

    tiktok_csv_text = tiktok_resp.text
    tiktok_reader = csv.reader(io.StringIO(tiktok_csv_text))
    tiktok_headers = next(tiktok_reader, [])
    assert "stock" not in tiktok_headers, f"'stock' column should not be in TikTok CSV headers: {tiktok_headers}"
    assert "qty_on_hand" not in tiktok_headers, f"'qty_on_hand' column should not be in TikTok CSV headers: {tiktok_headers}"
