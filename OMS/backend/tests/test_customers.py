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
