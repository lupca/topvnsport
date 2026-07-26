import models


def test_customers_crud(client, db):
    # 1. Create Customer
    payload = {
        "name": "Nguyen Van A",
        "phone": "0912345678",
        "email": "nva@example.com",
        "address": "123 Le Loi, District 1"
    }
    resp = client.post("/customers", json=payload)
    assert resp.status_code == 201
    cust_data = resp.json()
    assert cust_data["name"] == "Nguyen Van A"
    cust_id = cust_data["id"]

    # 2. List Customers
    resp = client.get("/customers")
    assert resp.status_code == 200
    assert resp.json()["total"] == 1

    # 3. Retrieve Customer
    resp = client.get(f"/customers/{cust_id}")
    assert resp.status_code == 200
    assert resp.json()["phone"] == "0912345678"

    # 4. Update Customer
    resp = client.put(f"/customers/{cust_id}", json={"address": "456 Tran Hung Dao"})
    assert resp.status_code == 200
    assert resp.json()["address"] == "456 Tran Hung Dao"

    # 5. Delete Customer
    resp = client.delete(f"/customers/{cust_id}")
    assert resp.status_code == 204

    # Confirm soft deleted (404 via API)
    resp = client.get(f"/customers/{cust_id}")
    assert resp.status_code == 404

    # Verify directly in DB that record is soft deleted (not hard deleted)
    db_cust = db.query(models.Customer).filter(models.Customer.id == cust_id).first()
    assert db_cust is not None
    assert db_cust.is_deleted is True
    assert db_cust.deleted_at is not None


def test_create_customer_idempotent(client, db):
    payload = {
        "name": "Nguyen Van B",
        "phone": "0382426669",
        "email": "nvb@example.com",
        "address": "789 Nguyen Hue"
    }

    # 1. First call creates customer -> returns 201 with customer id
    resp1 = client.post("/customers", json=payload)
    assert resp1.status_code == 201
    data1 = resp1.json()
    assert "id" in data1
    cust_id = data1["id"]

    # 2. Second call with same phone -> returns 200 with existing customer id
    payload_existing = {
        "name": "Nguyen Van B Updated Name",
        "phone": "0382426669",
        "email": "nvb_new@example.com",
        "address": "789 Nguyen Hue"
    }
    resp2 = client.post("/customers", json=payload_existing)
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["id"] == cust_id


def test_delete_customer_with_active_orders_conflict(client, db):
    # 1. Create Customer
    cust = models.Customer(name="Active Customer", phone="0988776655")
    channel = models.Channel(code="ONLINE_TEST", name="Online Test", is_active=True)
    db.add_all([cust, channel])
    db.commit()

    # 2. Create Active Order for Customer
    order = models.Order(
        order_number="ORD-TEST-0001",
        customer_id=cust.id,
        channel_id=channel.id,
        status="DRAFT",
        total_amount=100.0,
        shipping_fee=10.0,
        shipping_address="123 Street"
    )
    db.add(order)
    db.commit()

    # 3. Attempt Delete Customer -> 409 Conflict
    resp = client.delete(f"/customers/{cust.id}")
    assert resp.status_code == 409
    assert "active orders" in resp.json()["detail"]

    # 4. Cancel Order -> Delete Customer should succeed
    order.status = "CANCELLED"
    db.commit()

    resp_after = client.delete(f"/customers/{cust.id}")
    assert resp_after.status_code == 204
    db_cust = db.query(models.Customer).filter(models.Customer.id == cust.id).first()
    assert db_cust.is_deleted is True

