def test_channels_crud(client, db):
    # 1. Create Channel
    payload = {
        "code": "TIKTOK_SHOP_VN",
        "name": "TikTok Shop VN",
        "is_active": True
    }
    resp = client.post("/channels", json=payload)
    assert resp.status_code == 201
    channel_data = resp.json()
    assert channel_data["code"] == "TIKTOK_SHOP_VN"
    channel_id = channel_data["id"]

    # 2. List Channels
    resp = client.get("/channels")
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1

    # 3. Retrieve Channel
    resp = client.get(f"/channels/{channel_id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "TikTok Shop VN"

    # 4. Update Channel
    resp = client.put(f"/channels/{channel_id}", json={"name": "TikTok Shop Vietnam"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "TikTok Shop Vietnam"

    # 5. Delete Channel
    resp = client.delete(f"/channels/{channel_id}")
    assert resp.status_code == 204

    # Confirm deleted
    resp = client.get(f"/channels/{channel_id}")
    assert resp.status_code == 404
