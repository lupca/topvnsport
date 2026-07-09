def test_get_categories_returns_seeded_data(client):
    response = client.get("/categories")

    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 3
    assert all("display_name" in item for item in data)


def test_create_category_success(client):
    payload = {
        "name": "Phụ kiện thể thao",
        "code": "sports_accessories",
        "parent_id": None,
    }

    response = client.post("/categories", json=payload)

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == payload["name"]
    assert body["code"] == payload["code"]
    assert body["display_name"] == "[root] / Phụ kiện thể thao"


def test_create_category_duplicate_code_fails(client):
    payload = {
        "name": "Danh mục A",
        "code": "duplicate_code",
        "parent_id": None,
    }

    first = client.post("/categories", json=payload)
    second = client.post("/categories", json=payload)

    assert first.status_code == 201
    assert second.status_code == 400
    assert second.json()["detail"] == "Category code already exists."


def test_update_category_success(client):
    create_resp = client.post(
        "/categories",
        json={"name": "Danh mục gốc", "code": "root_cat", "parent_id": None},
    )
    assert create_resp.status_code == 201
    category_id = create_resp.json()["id"]

    update_payload = {
        "name": "Danh mục đã đổi tên",
        "code": "root_cat_updated",
        "parent_id": None,
    }
    update_resp = client.put(f"/categories/{category_id}", json=update_payload)

    assert update_resp.status_code == 200
    updated = update_resp.json()
    assert updated["name"] == update_payload["name"]
    assert updated["code"] == update_payload["code"]


def test_delete_category_success(client):
    create_resp = client.post(
        "/categories",
        json={"name": "Danh mục sẽ xóa", "code": "to_delete", "parent_id": None},
    )
    assert create_resp.status_code == 201
    category_id = create_resp.json()["id"]

    delete_resp = client.delete(f"/categories/{category_id}")
    get_resp = client.get(f"/categories/{category_id}")

    assert delete_resp.status_code == 204
    assert get_resp.status_code == 404
