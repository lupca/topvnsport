import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
import models

def test_crud_channels(client: TestClient, db_session: Session):
    # 1. List channels (pre-seeded on startup)
    response = client.get("/api/channels")
    assert response.status_code == 200
    channels = response.json()
    assert len(channels) >= 4
    
    # 2. Create new channel (use unique code to avoid pre-seeded ones)
    new_chan_payload = {"code": "lazada_vn_test", "name": "Lazada VN Test"}
    response = client.post("/api/channels", json=new_chan_payload)
    assert response.status_code == 201
    created = response.json()
    assert created["code"] == "lazada_vn_test"
    assert created["name"] == "Lazada VN Test"
    assert "id" in created
    
    chan_id = created["id"]
    
    # 3. Read specific channel
    response = client.get(f"/api/channels/{chan_id}")
    assert response.status_code == 200
    assert response.json()["code"] == "lazada_vn_test"
    
    # 4. Update channel
    response = client.put(f"/api/channels/{chan_id}", json={"code": "lazada_vn_test", "name": "Lazada Vietnam Test"})
    assert response.status_code == 200
    assert response.json()["name"] == "Lazada Vietnam Test"
    
    # 5. Delete channel
    response = client.delete(f"/api/channels/{chan_id}")
    assert response.status_code == 204
    
    # Confirm deletion
    response = client.get(f"/api/channels/{chan_id}")
    assert response.status_code == 404

def test_channel_config(client: TestClient, db_session: Session):
    # Get pre-seeded shopee_vn channel
    chan = db_session.query(models.Channel).filter(models.Channel.code == "shopee_vn").first()
    assert chan is not None
    
    # Get config (should yield defaults or created config)
    response = client.get(f"/api/channels/{chan.id}/config")
    assert response.status_code == 200
    config = response.json()
    assert config["channel_id"] == chan.id
    
    # Update config with a very long token to check Text type safety (Issue 4)
    long_token = "a" * 2048
    update_payload = {
        "app_key": "my_app_key",
        "app_secret": "my_app_secret",
        "access_token": long_token,
        "refresh_token": "refresh_token_123",
        "is_active": True
    }
    response = client.put(f"/api/channels/{chan.id}/config", json=update_payload)
    assert response.status_code == 200
    updated_config = response.json()
    assert updated_config["app_key"] == "my_app_key"
    assert updated_config["access_token"] == long_token

def test_category_mappings_duplicate_validation(client: TestClient, db_session: Session):
    # Seed a channel
    chan = db_session.query(models.Channel).filter(models.Channel.code == "shopee_vn").first()
    
    # Valid category bulk mappings
    payload = [
        {"pim_category_id": 1, "channel_category_code": "CAT-1", "channel_category_name": "Shopee Cat 1"},
        {"pim_category_id": 2, "channel_category_code": "CAT-2", "channel_category_name": "Shopee Cat 2"}
    ]
    response = client.post(f"/api/channels/{chan.id}/category-mappings", json=payload)
    assert response.status_code == 200
    assert len(response.json()) == 2
    
    # Invalid mappings with duplicate pim_category_id (Issue 3 validation check)
    bad_payload = [
        {"pim_category_id": 1, "channel_category_code": "CAT-1", "channel_category_name": "Shopee Cat 1"},
        {"pim_category_id": 1, "channel_category_code": "CAT-3", "channel_category_name": "Shopee Cat 3"}
    ]
    response = client.post(f"/api/channels/{chan.id}/category-mappings", json=bad_payload)
    assert response.status_code == 400
    assert "Duplicate mapping" in response.json()["detail"]

def test_attribute_mappings_duplicate_validation(client: TestClient, db_session: Session):
    chan = db_session.query(models.Channel).filter(models.Channel.code == "shopee_vn").first()
    
    # Valid attribute bulk mappings
    payload = [
        {"pim_attribute_id": 1, "channel_category_code": None, "channel_attribute_code": "brand", "channel_attribute_name": "Brand"},
        {"pim_attribute_id": 2, "channel_category_code": "CAT-1", "channel_attribute_code": "material", "channel_attribute_name": "Material"}
    ]
    response = client.post(f"/api/channels/{chan.id}/attribute-mappings", json=payload)
    assert response.status_code == 200
    assert len(response.json()) == 2
    
    # Duplicate mapping check (Issue 3 validation check)
    bad_payload = [
        {"pim_attribute_id": 1, "channel_category_code": None, "channel_attribute_code": "brand", "channel_attribute_name": "Brand"},
        {"pim_attribute_id": 1, "channel_category_code": None, "channel_attribute_code": "brand", "channel_attribute_name": "Brand Copy"}
    ]
    response = client.post(f"/api/channels/{chan.id}/attribute-mappings", json=bad_payload)
    assert response.status_code == 400
    assert "Duplicate mapping" in response.json()["detail"]

def test_product_creation_and_export(client: TestClient, db_session: Session):
    # 1. Seed category
    cat = models.Category(name="Tennis", code="TENNIS")
    db_session.add(cat)
    db_session.commit()
    
    # Query pre-seeded attribute and family
    families_resp = client.get("/attribute-families")
    assert families_resp.status_code == 200
    family_id = families_resp.json()[0]["id"]
    
    attrs_resp = client.get("/attributes")
    assert attrs_resp.status_code == 200
    pim_attr_id = attrs_resp.json()[0]["id"]
    
    chan = db_session.query(models.Channel).filter(models.Channel.code == "shopee_vn").first()
    
    # 2. Add mapping for dynamic attribute values using valid PIM attribute
    attr_mapping = models.ChannelAttributeMapping(
        channel_id=chan.id,
        pim_attribute_id=pim_attr_id,
        channel_category_code=None,
        channel_attribute_code="shopee_color",
        channel_attribute_name="Màu sắc Shopee"
    )
    db_session.add(attr_mapping)
    
    # Category mapping
    cat_mapping = models.ChannelCategoryMapping(
        channel_id=chan.id,
        pim_category_id=cat.id,
        channel_category_code="SH-TENNIS",
        channel_category_name="Vợt tennis Shopee"
    )
    db_session.add(cat_mapping)
    db_session.commit()
    
    # 3. Create product with channel listings
    product_payload = {
        "product_code": "TEN-P01",
        "name": "Vợt Tennis Pro 2026",
        "description": "Vợt tennis chuyên nghiệp dành cho vận động viên phong trào.",
        "category_id": cat.id,
        "family_id": family_id,
        "weight": 300,
        "length": 68,
        "width": 27,
        "height": 3,
        "hs_code": "9506.51.00",
        "tax_code": "TAX-9999",
        "status": "Published",
        "tier_variations": [],
        "variants": [
            {
                "tier_1_option": None,
                "tier_2_option": None,
                "sku_code": "TEN-P01-STD",
                "price": 2500000.0,
                "stock": 10,
                "barcode": "893000123456"
            }
        ],
        "channel_listings": [
            {
                "channel_code": "shopee_vn",
                "status": "Published",
                "title_override": "Vợt Tennis Pro 2026 Siêu Nhẹ Chính Hãng",
                "description_override": "Mô tả ghi đè cho vợt tennis shopee.",
                "channel_product_id": "shopee-12345",
                "attribute_values": [
                    {
                        "attribute_mapping_id": attr_mapping.id,
                        "value_string": "Xanh Neon rất dài để test Text " * 20, # String length exceeds 255 to test Issue 5
                        "value_decimal": None
                    }
                ],
                "variant_overrides": [
                    {
                        "sku_code": "TEN-P01-STD",
                        "price_override": 2400000.0,
                        "channel_variant_id": "shopee-v-123"
                    }
                ]
            }
        ]
    }
    
    response = client.post("/products", json=product_payload)
    assert response.status_code == 201
    prod_data = response.json()
    assert prod_data["product_code"] == "TEN-P01"
    assert prod_data["hs_code"] == "9506.51.00"
    
    # 4. Read back product and verify eager loads (avoiding N+1)
    response = client.get(f"/products/{prod_data['id']}")
    assert response.status_code == 200
    prod_detail = response.json()
    assert len(prod_detail["channel_listings"]) == 1
    listing = prod_detail["channel_listings"][0]
    assert listing["channel_code"] == "shopee_vn"
    assert listing["title_override"] == "Vợt Tennis Pro 2026 Siêu Nhẹ Chính Hãng"
    assert len(listing["variant_overrides"]) == 1
    assert float(listing["variant_overrides"][0]["price_override"]) == 2400000.0
    assert len(listing["attribute_values"]) == 1
    assert "Xanh Neon" in listing["attribute_values"][0]["value_string"]
    
    # 5. Verify CSV export endpoints
    response = client.get("/api/export/shopee?status=Published")
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/csv; charset=utf-8"
    csv_content = response.text
    assert "Vợt Tennis Pro 2026 Siêu Nhẹ Chính Hãng" in csv_content
    assert "shopee_color" in csv_content

def test_detailed_export_with_filtering_and_logistics(client: TestClient, db_session: Session):
    # 1. Setup channel, category, family, and mappings
    cat = models.Category(name="Badminton", code="BADMINTON")
    db_session.add(cat)
    db_session.commit()
    
    families_resp = client.get("/attribute-families")
    family_id = families_resp.json()[0]["id"]
    
    shopee_chan = db_session.query(models.Channel).filter(models.Channel.code == "shopee_vn").first()
    tiktok_chan = db_session.query(models.Channel).filter(models.Channel.code == "tiktok_shop").first()
    
    # 2. Create products with different shipping configs and barcodes
    product1_payload = {
        "product_code": "PROD-EXP-01",
        "name": "Vợt Cầu Lông Astrox 88D Play",
        "description": "Vợt cầu lông thiên công.",
        "category_id": cat.id,
        "family_id": family_id,
        "weight": 83,
        "length": 67,
        "width": 20,
        "height": 2,
        "hs_code": "9506.51.10",
        "tax_code": "TAX-VAT-8",
        "status": "Published",
        "tier_variations": [],
        "variants": [
            {
                "tier_1_option": None,
                "tier_2_option": None,
                "sku_code": "ASTROX-88D-PLAY-STD",
                "price": 1250000.0,
                "stock": 15,
                "barcode": "893123456001"
            }
        ],
        "channel_listings": [
            {
                "channel_code": "shopee_vn",
                "status": "Published",
                "title_override": "Vợt Yonex Astrox 88D Play Chính Hãng",
                "shipping_config": {
                    "channel_id_10001": {"enabled": True},
                    "channel_id_10002": {"enabled": False}
                }
            },
            {
                "channel_code": "tiktok_shop",
                "status": "Published",
                "title_override": "Yonex Astrox 88D Play Badminton Racket",
                "shipping_config": {
                    "channel_id_10001": True
                }
            }
        ]
    }
    
    product2_payload = {
        "product_code": "PROD-EXP-02",
        "name": "Giày Cầu Lông Yonex 65Z3",
        "description": "Giày cầu lông cao cấp.",
        "category_id": cat.id,
        "family_id": family_id,
        "weight": 310,
        "length": 30,
        "width": 18,
        "height": 11,
        "hs_code": "6404.11.00",
        "tax_code": "TAX-VAT-10",
        "status": "Published",
        "tier_variations": [],
        "variants": [
            {
                "tier_1_option": None,
                "tier_2_option": None,
                "sku_code": "YONEX-65Z3-WHITE-41",
                "price": 2850000.0,
                "stock": 8,
                "barcode": "893123456002"
            }
        ],
        "channel_listings": [
            {
                "channel_code": "shopee_vn",
                "status": "Published",
                "title_override": "Giày Yonex 65Z3 Trắng 2026",
                "shipping_config": {
                    "channel_id_10001": {"enabled": False},
                    "channel_id_10002": {"enabled": True}
                }
            }
        ]
    }
    
    r1 = client.post("/products", json=product1_payload)
    assert r1.status_code == 201
    p1 = r1.json()
    
    r2 = client.post("/products", json=product2_payload)
    assert r2.status_code == 201
    p2 = r2.json()
    
    # 3. Test Shopee export ALL
    response = client.get("/api/export/shopee?status=Published")
    assert response.status_code == 200
    csv_text = response.text
    # Check headers
    assert "barcode" in csv_text
    assert "hs_code" in csv_text
    assert "tax_code" in csv_text
    assert "channel_id_10001" in csv_text
    assert "channel_id_10002" in csv_text
    
    # Check data content
    assert "Vợt Yonex Astrox 88D Play Chính Hãng" in csv_text
    assert "Giày Yonex 65Z3 Trắng 2026" in csv_text
    assert "893123456001" in csv_text
    assert "9506.51.10" in csv_text
    assert "TAX-VAT-8" in csv_text
    
    # 4. Test Shopee export FILTER BY ID (only export product 1)
    response_filter = client.get(f"/api/export/shopee?status=Published&product_ids={p1['id']}")
    assert response_filter.status_code == 200
    csv_filtered_text = response_filter.text
    assert "Vợt Yonex Astrox 88D Play Chính Hãng" in csv_filtered_text
    assert "Giày Yonex 65Z3 Trắng 2026" not in csv_filtered_text
    
    # 5. Test TikTok export FILTER BY ID
    response_tiktok = client.get(f"/api/export/tiktok?status=Published&product_ids={p1['id']}")
    assert response_tiktok.status_code == 200
    csv_tiktok_text = response_tiktok.text
    assert "Yonex Astrox 88D Play Badminton Racket" in csv_tiktok_text
    assert "product_name" in csv_tiktok_text
    assert "893123456001" in csv_tiktok_text
    assert "TAX-VAT-8" in csv_tiktok_text
    # Should exclude product 2 since it does not have a published TikTok listing
    assert "Giày Yonex 65Z3 Trắng 2026" not in csv_tiktok_text


def test_update_product_preserves_channel_ids(client: TestClient, db_session: Session):
    cat = models.Category(name="Tennis Update", code="TENNIS-UPDATE")
    db_session.add(cat)
    db_session.commit()

    families_resp = client.get("/attribute-families")
    family_id = families_resp.json()[0]["id"]

    product_payload = {
        "product_code": "PROD-UPD-01",
        "name": "Vợt Tennis Astrox 99",
        "description": "Vợt tennis cao cấp.",
        "category_id": cat.id,
        "family_id": family_id,
        "weight": 300,
        "length": 68,
        "width": 27,
        "height": 3,
        "hs_code": "9506.51.00",
        "tax_code": "TAX-9999",
        "status": "Published",
        "tier_variations": [],
        "variants": [
            {
                "tier_1_option": None,
                "tier_2_option": None,
                "sku_code": "ASTROX-99-STD",
                "price": 3200000.0,
                "stock": 5,
                "barcode": "893123999"
            }
        ],
        "channel_listings": [
            {
                "channel_code": "shopee_vn",
                "status": "Published",
                "title_override": "Vợt Yonex Astrox 99 Chính Hãng",
                "channel_product_id": "shopee-prod-99999",
                "variant_overrides": [
                    {
                        "sku_code": "ASTROX-99-STD",
                        "price_override": 3100000.0,
                        "channel_variant_id": "shopee-var-88888"
                    }
                ]
            }
        ]
    }
    
    r1 = client.post("/products", json=product_payload)
    assert r1.status_code == 201
    prod_data = r1.json()
    prod_id = prod_data["id"]

    update_payload = {
        "product_code": "PROD-UPD-01",
        "name": "Vợt Tennis Astrox 99 Pro New",
        "description": "Mô tả cập nhật.",
        "category_id": cat.id,
        "family_id": family_id,
        "weight": 305,
        "length": 68,
        "width": 27,
        "height": 3,
        "hs_code": "9506.51.00",
        "tax_code": "TAX-9999",
        "status": "Published",
        "tier_variations": [],
        "variants": [
            {
                "tier_1_option": None,
                "tier_2_option": None,
                "sku_code": "ASTROX-99-STD",
                "price": 3250000.0,
                "stock": 4,
                "barcode": "893123999"
            }
        ],
        "channel_listings": [
            {
                "channel_code": "shopee_vn",
                "status": "Published",
                "title_override": "Vợt Yonex Astrox 99 Pro Bản Mới 2026",
                "variant_overrides": [
                    {
                        "sku_code": "ASTROX-99-STD",
                        "price_override": 3150000.0
                    }
                ]
            }
        ]
    }

    r2 = client.put(f"/products/{prod_id}", json=update_payload)
    assert r2.status_code == 200

    r3 = client.get(f"/products/{prod_id}")
    assert r3.status_code == 200
    updated_prod = r3.json()
    assert len(updated_prod["channel_listings"]) == 1
    listing = updated_prod["channel_listings"][0]
    assert listing["title_override"] == "Vợt Yonex Astrox 99 Pro Bản Mới 2026"
    assert listing["channel_product_id"] == "shopee-prod-99999"
    assert len(listing["variant_overrides"]) == 1
    assert float(listing["variant_overrides"][0]["price_override"]) == 3150000.0
    assert listing["variant_overrides"][0]["channel_variant_id"] == "shopee-var-88888"


def test_delete_channel_with_active_listings_blocks(client: TestClient, db_session: Session):
    cat = models.Category(name="Tennis Delete", code="TENNIS-DELETE")
    db_session.add(cat)
    db_session.commit()

    families_resp = client.get("/attribute-families")
    family_id = families_resp.json()[0]["id"]

    new_chan = models.Channel(code="tmp_chan_del", name="Temporary Channel for Deletion")
    db_session.add(new_chan)
    db_session.commit()

    product_payload = {
        "product_code": "PROD-DEL-01",
        "name": "Sản phẩm test xóa kênh",
        "category_id": cat.id,
        "family_id": family_id,
        "weight": 100,
        "status": "Published",
        "variants": [
            {
                "sku_code": "SKU-DEL-01",
                "price": 100000.0,
                "stock": 5
            }
        ],
        "channel_listings": [
            {
                "channel_code": "tmp_chan_del",
                "status": "Published"
            }
        ]
    }
    r = client.post("/products", json=product_payload)
    assert r.status_code == 201

    response = client.delete(f"/api/channels/{new_chan.id}")
    assert response.status_code == 400
    assert "active listings" in response.json()["detail"].lower()


def test_export_fallback_empty_category(client: TestClient, db_session: Session):
    cat = models.Category(name="Tennis No Map", code="TENNIS-NO-MAP")
    db_session.add(cat)
    db_session.commit()

    families_resp = client.get("/attribute-families")
    family_id = families_resp.json()[0]["id"]

    product_payload = {
        "product_code": "PROD-NOMAP-01",
        "name": "Giày Không Map Danh Mục",
        "category_id": cat.id,
        "family_id": family_id,
        "weight": 350,
        "status": "Published",
        "variants": [
            {
                "sku_code": "NOMAP-SKU-01",
                "price": 1500000.0,
                "stock": 12
            }
        ],
        "channel_listings": [
            {
                "channel_code": "shopee_vn",
                "status": "Published"
            }
        ]
    }
    r = client.post("/products", json=product_payload)
    assert r.status_code == 201
    prod = r.json()

    response = client.get(f"/api/export/shopee?status=Published&product_ids={prod['id']}")
    assert response.status_code == 200
    csv_text = response.text
    assert "Giày Không Map Danh Mục" in csv_text


