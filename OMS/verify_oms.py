import urllib.request
import urllib.error
import json
import sys
import time

API_URL = "http://localhost:8001"

def make_request(path, method="GET", data=None):
    url = f"{API_URL}{path}"
    headers = {"Content-Type": "application/json"}
    req_data = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            if response.status == 204:
                return None
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"HTTP Error {e.code}: {body}")
        raise e

def test_api():
    print("Testing root status endpoint...")
    status_resp = make_request("/")
    print("Root status response:", status_resp)
    assert status_resp.get("status") == "ok"
    
    # 1. Customer CRUD Test
    print("\n--- Testing Customer CRUD ---")
    
    # POST /customers
    cust_data = {
        "name": "John Doe",
        "phone": "+447123456789",
        "email": "john.doe@example.com",
        "address": "123 London St"
    }
    cust = make_request("/customers", method="POST", data=cust_data)
    print("Created Customer:", cust)
    assert cust["id"] is not None
    assert cust["phone"] == "+447123456789"
    cust_id = cust["id"]
    
    # GET /customers (list)
    customers = make_request("/customers")
    print(f"List Customers (found {len(customers)}):", customers)
    assert any(c["id"] == cust_id for c in customers)
    
    # GET /customers/{id}
    cust_ret = make_request(f"/customers/{cust_id}")
    print("Retrieved Customer:", cust_ret)
    assert cust_ret["name"] == "John Doe"
    
    # PUT /customers/{id}
    update_data = {"name": "John Smith"}
    cust_updated = make_request(f"/customers/{cust_id}", method="PUT", data=update_data)
    print("Updated Customer:", cust_updated)
    assert cust_updated["name"] == "John Smith"
    
    # DELETE /customers/{id}
    print("Deleting Customer...")
    make_request(f"/customers/{cust_id}", method="DELETE")
    
    # Verify Deleted
    try:
        make_request(f"/customers/{cust_id}")
        assert False, "Should have failed with 404"
    except urllib.error.HTTPError as e:
        assert e.code == 404
        print("Customer deletion verified (404 as expected).")

    # 2. Channel CRUD Test
    print("\n--- Testing Channel CRUD ---")
    
    # POST /channels
    chan_data = {
        "code": "SHOPIFY",
        "name": "Shopify Store",
        "is_active": True
    }
    chan = make_request("/channels", method="POST", data=chan_data)
    print("Created Channel:", chan)
    assert chan["id"] is not None
    assert chan["code"] == "SHOPIFY"
    chan_id = chan["id"]
    
    # GET /channels (list)
    channels = make_request("/channels")
    print(f"List Channels (found {len(channels)}):", channels)
    assert any(c["id"] == chan_id for c in channels)
    
    # GET /channels/{id}
    chan_ret = make_request(f"/channels/{chan_id}")
    print("Retrieved Channel:", chan_ret)
    assert chan_ret["name"] == "Shopify Store"
    
    # PUT /channels/{id}
    update_chan = {"is_active": False}
    chan_updated = make_request(f"/channels/{chan_id}", method="PUT", data=update_chan)
    print("Updated Channel:", chan_updated)
    assert chan_updated["is_active"] is False
    
    # DELETE /channels/{id}
    print("Deleting Channel...")
    make_request(f"/channels/{chan_id}", method="DELETE")
    
    # Verify Deleted
    try:
        make_request(f"/channels/{chan_id}")
        assert False, "Should have failed with 404"
    except urllib.error.HTTPError as e:
        assert e.code == 404
        print("Channel deletion verified (404 as expected).")
        
    print("\nAll tests passed successfully!")

if __name__ == "__main__":
    # Wait a few seconds for FastAPI to startup
    time.sleep(3)
    test_api()
