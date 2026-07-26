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


def test_delete_channel_with_active_orders_conflict(client, db):
    import models
    # 1. Create Channel & Customer
    channel = models.Channel(code="SHOPEE_VN", name="Shopee VN", is_active=True)
    cust = models.Customer(name="Channel Customer", phone="0911223344")
    db.add_all([channel, cust])
    db.commit()

    # 2. Create Active Order for Channel
    order = models.Order(
        order_number="ORD-CHAN-0001",
        customer_id=cust.id,
        channel_id=channel.id,
        status="CONFIRMED",
        total_amount=200.0,
        shipping_fee=15.0,
        shipping_address="456 Avenue"
    )
    db.add(order)
    db.commit()

    # 3. Attempt Delete Channel -> 409 Conflict
    resp = client.delete(f"/channels/{channel.id}")
    assert resp.status_code == 409
    assert "active orders" in resp.json()["detail"]

    # 4. Remove Order -> Delete Channel should succeed
    db.delete(order)
    db.commit()

    resp_after = client.delete(f"/channels/{channel.id}")
    assert resp_after.status_code == 204
    db_chan = db.query(models.Channel).filter(models.Channel.id == channel.id).first()
    assert db_chan is not None
    assert db_chan.is_active is False


def test_delete_channel_with_completed_orders_allowed(client, db):
    import models
    channel = models.Channel(code="LAZADA_VN", name="Lazada VN", is_active=True)
    cust = models.Customer(name="Lazada Customer", phone="0933445566")
    db.add_all([channel, cust])
    db.commit()

    order = models.Order(
        order_number="ORD-LAZ-0001",
        customer_id=cust.id,
        channel_id=channel.id,
        status="COMPLETED",
        total_amount=300.0,
        shipping_fee=20.0,
        shipping_address="789 Boulevard"
    )
    db.add(order)
    db.commit()

    # Deleting channel with COMPLETED order should succeed (204)
    resp = client.delete(f"/channels/{channel.id}")
    assert resp.status_code == 204
    db_chan = db.query(models.Channel).filter(models.Channel.id == channel.id).first()
    assert db_chan is not None
    assert db_chan.is_active is False

