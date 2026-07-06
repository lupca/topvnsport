def _first_category_id(client) -> int:
    categories = client.get("/categories")
    assert categories.status_code == 200
    data = categories.json()
    assert data
    return data[0]["id"]


def _product_payload(category_id: int, parent_code: str = "PARENT-001"):
    return {
        "product_code": parent_code,
        "name": "Ao thun the thao cao cap",
        "description": "San pham danh cho tap luyen the thao hang ngay",
        "category_id": category_id,
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
                "stock": 12,
            },
            {
                "tier_1_option": "Xanh",
                "tier_2_option": None,
                "sku_code": f"{parent_code}-XANH",
                "price": 159000,
                "stock": 8,
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
    }


def test_create_product_and_get_by_id(client):
    category_id = _first_category_id(client)
    payload = _product_payload(category_id)

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

    create_resp = client.post("/products", json=_product_payload(category_id, parent_code="SEARCH-001"))
    assert create_resp.status_code == 201

    list_resp = client.get("/products", params={"q": "SEARCH-001", "page": 1, "limit": 10})
    assert list_resp.status_code == 200

    body = list_resp.json()
    assert body["total"] >= 1
    assert any(item["product_code"] == "SEARCH-001" for item in body["items"])


def test_update_product_replaces_variants(client):
    category_id = _first_category_id(client)
    create_resp = client.post("/products", json=_product_payload(category_id, parent_code="UPD-001"))
    assert create_resp.status_code == 201
    product_id = create_resp.json()["id"]

    update_payload = {
        "product_code": "UPD-001",
        "name": "Ao tap cap nhat",
        "description": "Thong tin sau khi cap nhat",
        "category_id": category_id,
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
                "stock": 5,
            }
        ],
        "media": [],
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
    payload = _product_payload(category_id, parent_code="DUP-001")

    first = client.post("/products", json=payload)
    second = client.post("/products", json=payload)

    assert first.status_code == 201
    assert second.status_code == 400


def test_get_product_by_sku_returns_variant_info(client):
    category_id = _first_category_id(client)
    payload = _product_payload(category_id, parent_code="SKU-LOOKUP")

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
