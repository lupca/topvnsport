def test_create_attribute_success(client):
    payload = {
        "name": "Test Attribute",
        "code": "test_attr",
        "type": "text",
        "is_required": False,
        "is_unique": False,
        "is_locale_based": False,
        "is_channel_based": False
    }
    response = client.post("/attributes", json=payload)
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == payload["name"]
    assert body["code"] == payload["code"]

def test_get_attributes(client):
    response = client.get("/attributes")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1

def test_create_attribute_group(client):
    payload = {
        "name": "Test Group",
        "code": "test_group"
    }
    response = client.post("/attribute-groups", json=payload)
    assert response.status_code == 201
    assert response.json()["name"] == "Test Group"

def test_get_attribute_groups(client):
    response = client.get("/attribute-groups")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_create_attribute_family(client):
    payload = {
        "name": "Test Family",
        "code": "test_family"
    }
    response = client.post("/attribute-families", json=payload)
    assert response.status_code == 201
    assert response.json()["name"] == "Test Family"

def test_get_attribute_families(client):
    response = client.get("/attribute-families")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_delete_attribute(client):
    payload = {
        "name": "To Delete Attr",
        "code": "del_attr",
        "type": "text",
        "is_required": False
    }
    create_resp = client.post("/attributes", json=payload)
    attr_id = create_resp.json()["id"]

    del_resp = client.delete(f"/attributes/{attr_id}")
    assert del_resp.status_code == 204

    get_resp = client.get(f"/attributes/{attr_id}")
    assert get_resp.status_code == 404
