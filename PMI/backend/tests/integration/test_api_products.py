def _first_category_id(client) -> int:
    categories = client.get("/categories")
    assert categories.status_code == 200
    data = categories.json()
    assert data
    return data[0]["id"]


def _first_family_id(client) -> int:
    families = client.get("/attribute-families")
    assert families.status_code == 200
    data = families.json()
    assert data
    return data[0]["id"]


def _first_attribute_id(client) -> int:
    attrs = client.get("/attributes")
    assert attrs.status_code == 200
    data = attrs.json()
    assert data
    return data[0]["id"]


def _product_payload(category_id: int, family_id: int, attribute_id: int, parent_code: str = "PARENT-001"):
    return {
        "product_code": parent_code,
        "name": "Ao thun the thao cao cap",
        "description": "San pham danh cho tap luyen the thao hang ngay",
        "category_id": category_id,
        "family_id": family_id,
        "weight": 250,
        "length": 30,
        "width": 20,
        "height": 3,
        "is_pre_order": False,
        "dts_days": 7,
        "status": "Draft",
        "tier_variations": [
            {
                "tier_index": 1,
                "name": "Mau sac",
                "options": ["Do", "Xanh"],
            }
        ],
        "variants": [
            {
                "tier_1_option": "Do",
                "tier_2_option": None,
                "sku_code": f"{parent_code}-DO",
                "price": 149000,
            },
            {
                "tier_1_option": "Xanh",
                "tier_2_option": None,
                "sku_code": f"{parent_code}-XANH",
                "price": 159000,
            },
        ],
        "media": [
            {
                "image_url": "https://example.com/cover.jpg",
                "is_cover": True,
                "display_order": 1,
                "variant_tier_1_option": None,
            }
        ],
        "attributes": [
            {"id": attribute_id, "value": "Yonex"}
        ],
    }


def test_create_product_and_get_by_id(client):
    category_id = _first_category_id(client)
    family_id = _first_family_id(client)
    attribute_id = _first_attribute_id(client)
    payload = _product_payload(category_id, family_id, attribute_id)

    create_resp = client.post("/products", json=payload)

    assert create_resp.status_code == 201
    created = create_resp.json()
    assert created["product_code"] == payload["product_code"]
    assert len(created["variants"]) == 2

    get_resp = client.get(f"/products/{created['id']}")
    assert get_resp.status_code == 200
    fetched = get_resp.json()
    assert fetched["id"] == created["id"]
    assert fetched["name"] == payload["name"]


def test_list_products_with_search(client):
    category_id = _first_category_id(client)
    family_id = _first_family_id(client)
    attribute_id = _first_attribute_id(client)

    create_resp = client.post("/products", json=_product_payload(category_id, family_id, attribute_id, parent_code="SEARCH-001"))
    assert create_resp.status_code == 201

    list_resp = client.get("/products", params={"q": "SEARCH-001", "page": 1, "limit": 10})
    assert list_resp.status_code == 200

    body = list_resp.json()
    assert body["total"] >= 1
    assert any(item["product_code"] == "SEARCH-001" for item in body["items"])


def test_update_product_replaces_variants(client):
    category_id = _first_category_id(client)
    family_id = _first_family_id(client)
    attribute_id = _first_attribute_id(client)
    create_resp = client.post("/products", json=_product_payload(category_id, family_id, attribute_id, parent_code="UPD-001"))
    assert create_resp.status_code == 201
    product_id = create_resp.json()["id"]

    update_payload = {
        "product_code": "UPD-001",
        "name": "Ao tap cap nhat",
        "description": "Thong tin sau khi cap nhat",
        "category_id": category_id,
        "family_id": family_id,
        "weight": 280,
        "length": 31,
        "width": 21,
        "height": 4,
        "is_pre_order": False,
        "dts_days": 7,
        "status": "Published",
        "tier_variations": [],
        "variants": [
            {
                "tier_1_option": None,
                "tier_2_option": None,
                "sku_code": "UPD-001-BASE",
                "price": 199000,
            }
        ],
        "media": [],
        "attributes": [],
    }

    update_resp = client.put(f"/products/{product_id}", json=update_payload)

    assert update_resp.status_code == 200
    body = update_resp.json()
    assert body["name"] == "Ao tap cap nhat"
    assert body["status"] == "Published"
    assert len(body["variants"]) == 1
    assert body["variants"][0]["sku_code"] == "UPD-001-BASE"


def test_create_product_duplicate_parent_code_fails(client):
    category_id = _first_category_id(client)
    family_id = _first_family_id(client)
    attribute_id = _first_attribute_id(client)
    payload = _product_payload(category_id, family_id, attribute_id, parent_code="DUP-001")

    first = client.post("/products", json=payload)
    second = client.post("/products", json=payload)

    assert first.status_code == 201
    assert second.status_code == 400


def test_get_product_by_sku_returns_variant_info(client):
    category_id = _first_category_id(client)
    family_id = _first_family_id(client)
    attribute_id = _first_attribute_id(client)
    payload = _product_payload(category_id, family_id, attribute_id, parent_code="SKU-LOOKUP")

    create_resp = client.post("/products", json=payload)
    assert create_resp.status_code == 201

    sku_resp = client.get("/api/products/by-sku/SKU-LOOKUP-DO")
    assert sku_resp.status_code == 200
    body = sku_resp.json()
    assert body["sku_code"] == "SKU-LOOKUP-DO"
    assert body["product_name"] == payload["name"]


def test_upload_endpoint_uses_mocked_minio(client):
    files = {"file": ("sample.jpg", b"fake-image-bytes", "image/jpeg")}

    response = client.post("/upload", files=files)

    assert response.status_code == 200
    assert response.json()["image_url"].endswith("/pim-media/test-image.jpg")


def test_create_product_without_sku_code_auto_generates(client):
    category_id = _first_category_id(client)
    family_id = _first_family_id(client)
    attribute_id = _first_attribute_id(client)
    
    # Payload with sku_code set to None or missing
    payload = {
        "product_code": "AUTO-SKU-PARENT",
        "name": "Vot cau long Yonex",
        "description": "Vot cau long cao cap",
        "category_id": category_id,
        "family_id": family_id,
        "weight": 85,
        "status": "Draft",
        "tier_variations": [
            {
                "tier_index": 1,
                "name": "Mau sac",
                "options": ["Do", "Xanh Lam"],
            },
            {
                "tier_index": 2,
                "name": "Trong luong",
                "options": ["3U", "4U"],
            }
        ],
        "variants": [
            {
                "tier_1_option": "Do",
                "tier_2_option": "3U",
                "sku_code": None,  # test auto-generation
                "price": 1200000,
            },
            {
                "tier_1_option": "Do",
                "tier_2_option": "4U",
                "sku_code": "",  # test empty string handling
                "price": 1250000,
            },
            {
                "tier_1_option": "Xanh Lam",
                "tier_2_option": "3U",
                "sku_code": None,
                "price": 1200000,
            },
            {
                "tier_1_option": "Xanh Lam",
                "tier_2_option": "4U",
                "sku_code": None,
                "price": 1250000,
            }
        ],
        "media": [],
        "attributes": [],
    }

    resp = client.post("/products", json=payload)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert len(data["variants"]) == 4
    
    # Verify the auto-generated SKUs
    # Format should be: AUTO-SKU-PARENT-[TIER_1_OPTION]-[TIER_2_OPTION]
    expected_skus = {
        ("Do", "3U"): "AUTO-SKU-PARENT-DO-3U",
        ("Do", "4U"): "AUTO-SKU-PARENT-DO-4U",
        ("Xanh Lam", "3U"): "AUTO-SKU-PARENT-XANH-LAM-3U",
        ("Xanh Lam", "4U"): "AUTO-SKU-PARENT-XANH-LAM-4U",
    }
    
    for var in data["variants"]:
        key = (var["tier_1_option"], var["tier_2_option"])
        assert key in expected_skus
        assert var["sku_code"] == expected_skus[key]


def test_create_product_no_variations_auto_generates_default_sku(client):
    category_id = _first_category_id(client)
    family_id = _first_family_id(client)
    attribute_id = _first_attribute_id(client)
    
    payload = {
        "product_code": "AUTO-SKU-NOVAR",
        "name": "Balo don gian",
        "description": "Balo the thao",
        "category_id": category_id,
        "family_id": family_id,
        "weight": 300,
        "status": "Draft",
        "tier_variations": [],
        "variants": [
            {
                "tier_1_option": None,
                "tier_2_option": None,
                "sku_code": None,
                "price": 500000,
            }
        ],
        "media": [],
        "attributes": [],
    }
    
    resp = client.post("/products", json=payload)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert len(data["variants"]) == 1
    assert data["variants"][0]["sku_code"] == "AUTO-SKU-NOVAR-DEFAULT"


def test_create_product_with_12_images_succeeds(client):
    category_id = _first_category_id(client)
    family_id = _first_family_id(client)
    attribute_id = _first_attribute_id(client)
    
    payload = _product_payload(category_id, family_id, attribute_id, parent_code="MEDIA-12-OK")
    
    media = [
        {
            "image_url": "https://example.com/cover.jpg",
            "is_cover": True,
            "display_order": 1,
            "variant_tier_1_option": None,
        },
        {
            "image_url": "https://example.com/main2.jpg",
            "is_cover": False,
            "display_order": 2,
            "variant_tier_1_option": None,
        }
    ]
    for i in range(3, 13):
        option = "Do" if i % 2 == 0 else "Xanh"
        media.append({
            "image_url": f"https://example.com/variant-{i}.jpg",
            "is_cover": False,
            "display_order": i,
            "variant_tier_1_option": option,
        })
        
    payload["media"] = media
    
    resp = client.post("/products", json=payload)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert len(data["media"]) == 12


def test_create_product_with_10_main_images_fails(client):
    category_id = _first_category_id(client)
    family_id = _first_family_id(client)
    attribute_id = _first_attribute_id(client)
    
    payload = _product_payload(category_id, family_id, attribute_id, parent_code="MEDIA-10-MAIN-FAIL")
    
    media = []
    for i in range(1, 11):
        media.append({
            "image_url": f"https://example.com/main-{i}.jpg",
            "is_cover": i == 1,
            "display_order": i,
            "variant_tier_1_option": None,
        })
        
    payload["media"] = media
    
    resp = client.post("/products", json=payload)
    assert resp.status_code == 422
    data = resp.json()
    assert any(e["msg"] == "Tối đa 9 ảnh chính" for e in data["detail"])


def test_product_validation_vietnamese(client):
    category_id = _first_category_id(client)
    family_id = _first_family_id(client)
    attribute_id = _first_attribute_id(client)
    
    # 1. Missing name -> type == "missing"
    payload = _product_payload(category_id, family_id, attribute_id, parent_code="VAL-FAIL-1")
    payload.pop("name")
    resp = client.post("/products", json=payload)
    assert resp.status_code == 422
    errors = resp.json()["detail"]
    name_error = next(e for e in errors if "name" in e["loc"])
    assert name_error["msg"] == "Trường này là bắt buộc"
    assert name_error["type"] == "missing"

    # 2. Negative weight -> type == "greater_than_equal"
    payload = _product_payload(category_id, family_id, attribute_id, parent_code="VAL-FAIL-2")
    payload["weight"] = -5
    resp = client.post("/products", json=payload)
    assert resp.status_code == 422
    errors = resp.json()["detail"]
    weight_error = next(e for e in errors if "weight" in e["loc"])
    assert "Giá trị phải lớn hơn hoặc bằng" in weight_error["msg"]
    assert weight_error["type"] == "greater_than_equal"

    # 3. dts_days too large -> type == "less_than_equal"
    payload = _product_payload(category_id, family_id, attribute_id, parent_code="VAL-FAIL-3")
    payload["dts_days"] = 35
    resp = client.post("/products", json=payload)
    assert resp.status_code == 422
    errors = resp.json()["detail"]
    dts_error = next(e for e in errors if "dts_days" in e["loc"])
    assert "Giá trị phải nhỏ hơn hoặc bằng" in dts_error["msg"]
    assert dts_error["type"] == "less_than_equal"

