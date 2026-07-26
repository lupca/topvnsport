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
    assert "is_deleted" not in channel_data
    assert "deleted_at" not in channel_data
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

    # Confirm soft deleted (404 via API)
    resp = client.get(f"/channels/{channel_id}")
    assert resp.status_code == 404


def test_channel_toggle_is_active_does_not_hide_channel(client, db):
    import models

    # 1. Create Channel with is_active = True
    payload = {
        "code": "TIKTOK_ACTIVE_TOGGLE",
        "name": "TikTok Active Toggle",
        "is_active": True
    }
    resp = client.post("/channels", json=payload)
    assert resp.status_code == 201
    chan_id = resp.json()["id"]

    # 2. Toggle is_active to False via PUT
    resp_update = client.put(f"/channels/{chan_id}", json={"is_active": False})
    assert resp_update.status_code == 200
    assert resp_update.json()["is_active"] is False

    # 3. Channel should STILL appear in GET /channels and GET /channels/{id}
    resp_list = client.get("/channels")
    assert resp_list.status_code == 200
    items = resp_list.json()["items"]
    found = [c for c in items if c["id"] == chan_id]
    assert len(found) == 1
    assert found[0]["is_active"] is False

    resp_get = client.get(f"/channels/{chan_id}")
    assert resp_get.status_code == 200
    assert resp_get.json()["is_active"] is False

    # 4. Verify order creation with inactive channel is rejected with 400
    cust = models.Customer(name="Active Cust", phone="0912345678")
    db.add(cust)
    db.commit()

    order_payload = {
        "customer_id": cust.id,
        "channel_id": chan_id,
        "shipping_fee": 10.0,
        "shipping_address": "123 Street",
        "items": [{"sku_code": "SKU-TEST-001", "quantity": 1}]
    }
    resp_order = client.post("/orders", json=order_payload)
    assert resp_order.status_code == 400
    assert "inactive" in resp_order.json()["detail"].lower()


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
    assert db_chan.is_deleted is True
    assert db_chan.deleted_at is not None


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
    assert db_chan.is_deleted is True
    assert db_chan.deleted_at is not None


def test_manual_transition_to_cancellation_pending_forbidden(client, db):
    import models
    cust = models.Customer(name="Trans Customer", phone="0977665544")
    chan = models.Channel(code="TRANS_CHAN", name="Trans Channel", is_active=True)
    db.add_all([cust, chan])
    db.commit()

    order = models.Order(
        order_number="ORD-TRANS-001",
        customer_id=cust.id,
        channel_id=chan.id,
        status="PROCESSING",
        total_amount=100.0,
        shipping_fee=10.0,
        shipping_address="123 St"
    )
    db.add(order)
    db.commit()

    # Try setting status to CANCELLATION_PENDING manually via status endpoint -> Should fail (400)
    resp = client.patch(f"/orders/{order.id}/status", json={"status": "CANCELLATION_PENDING"})
    assert resp.status_code == 400
    assert "Illegal transition" in resp.json()["detail"] or "Invalid status" in resp.json()["detail"]


def test_create_channel_resurrect_returns_200(client, db):
    import models

    # 1. First call creates channel -> 201 Created
    payload = {
        "code": "RESURRECT_CHAN",
        "name": "Resurrect Channel Initial",
        "is_active": True
    }
    resp1 = client.post("/channels", json=payload)
    assert resp1.status_code == 201
    chan_id = resp1.json()["id"]

    # 2. Delete the channel -> soft deleted (204)
    resp_del = client.delete(f"/channels/{chan_id}")
    assert resp_del.status_code == 204

    db_chan = db.query(models.Channel).filter(models.Channel.id == chan_id).first()
    assert db_chan.is_deleted is True

    # 3. Post creation with same channel code -> resurrects soft-deleted channel and returns 200 OK
    payload_resurrect = {
        "code": "RESURRECT_CHAN",
        "name": "Resurrect Channel Restored",
        "is_active": True
    }
    resp2 = client.post("/channels", json=payload_resurrect)
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["id"] == chan_id
    assert data2["name"] == "Resurrect Channel Restored"
    assert "is_deleted" not in data2

    db.refresh(db_chan)
    assert db_chan.is_deleted is False
    assert db_chan.deleted_at is None

