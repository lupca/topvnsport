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

    # Confirm deleted
    resp = client.get(f"/customers/{cust_id}")
    assert resp.status_code == 404


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

