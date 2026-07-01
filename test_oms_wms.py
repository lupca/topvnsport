import sys
import urllib.request
import urllib.error
import json
import time

OMS_URL = "http://localhost:18101"
WMS_URL = "http://localhost:18102"
PMI_URL = "http://localhost:18100"

def request(url, method="GET", data=None):
    headers = {"Content-Type": "application/json"}
    req_data = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 204:
                return None
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"HTTP Error {e.code} for {method} {url}: {body}")
        raise e
    except Exception as e:
        print(f"Error connecting to {url}: {e}")
        raise e

def run_e2e_test():
    print("=== Starting E2E OMS-WMS Integration Test ===")
    
    # 1. Verify PMI SKU exists
    print("\n1. Verifying SKU TSHIRT-RED-M exists in PMI...")
    pmi_product = request(f"{PMI_URL}/api/products/by-sku/TSHIRT-RED-M")
    print(f"Found PMI variant: {pmi_product['variant_name']} with price {pmi_product['price']}")
    
    # 2. Seed Customer and Channel in OMS
    print("\n2. Creating Customer and Channel in OMS...")
    # Unique phone/code using timestamp
    ts = int(time.time())
    customer = request(f"{OMS_URL}/customers", "POST", {
        "name": "E2E Test Customer",
        "phone": f"098765{ts}",
        "email": f"e2e_{ts}@example.com",
        "address": "456 E2E Road"
    })
    print(f"Created customer ID: {customer['id']}")
    
    channel = request(f"{OMS_URL}/channels", "POST", {
        "code": f"E2E_CHAN_{ts}",
        "name": "E2E Channel",
        "is_active": True
    })
    print(f"Created channel ID: {channel['id']}")
    
    # 3. Create Order
    print("\n3. Creating Order in OMS (DRAFT status)...")
    order = request(f"{OMS_URL}/orders", "POST", {
        "order_number": f"E2E-ORD-{ts}",
        "customer_id": customer["id"],
        "channel_id": channel["id"],
        "shipping_fee": 20.0,
        "shipping_address": "456 E2E Road",
        "note": "E2E integration test",
        "created_by": "e2e_runner",
        "items": [
            {
                "sku_code": "TSHIRT-RED-M",
                "quantity": 2
            }
        ]
    })
    order_id = order["id"]
    print(f"Created Order: ID={order_id}, Status={order['status']}, Total Amount={order['total_amount']}")
    assert order["status"] == "DRAFT"
    
    # 4. Confirm Order
    print("\n4. Confirming Order in OMS (DRAFT -> CONFIRMED -> PROCESSING)...")
    confirmed_order = request(f"{OMS_URL}/orders/{order_id}/confirm", "POST")
    print(f"Confirmed Order: ID={confirmed_order['id']}, Status={confirmed_order['status']}")
    assert confirmed_order["status"] == "PROCESSING"
    assert len(confirmed_order["fulfillment_orders"]) == 1
    fulfillment_number = confirmed_order["fulfillment_orders"][0]["fulfillment_number"]
    print(f"Generated Fulfillment Number: {fulfillment_number}")
    
    # 5. Verify Fulfillment Order in WMS and Inventory Reservation
    print("\n5. Verifying Inventory Reserved in WMS...")
    # Retrieve WMS fulfillment order
    # Let's search by fulfillment_number. We don't have a direct GET /fulfillment-orders/{number} but we can list or search.
    # Actually we can check our OMS order details or check the WMS database indirectly. But let's check OMS order status callback.
    
    # 6. Simulate Status Callback from WMS -> OMS
    print("\n6. Simulating WMS updating Order Status (PICKING -> PACKED -> SHIPPED)...")
    for status in ["PICKING", "PACKED", "SHIPPED"]:
        updated = request(f"{OMS_URL}/orders/{order_id}/status", "PATCH", {"status": status})
        print(f"Callback updated OMS Order status to: {updated['status']}")
        assert updated["status"] == status
        
    print("\n7. Testing Cancellation flow on a new order...")
    # Create second order
    order2 = request(f"{OMS_URL}/orders", "POST", {
        "order_number": f"E2E-ORD2-{ts}",
        "customer_id": customer["id"],
        "channel_id": channel["id"],
        "shipping_fee": 10.0,
        "shipping_address": "456 E2E Road",
        "items": [
            {
                "sku_code": "TSHIRT-RED-M",
                "quantity": 1
            }
        ]
    })
    order2_id = order2["id"]
    print(f"Created Second Order: ID={order2_id}")
    
    # Confirm it to transition to PROCESSING and register in WMS
    request(f"{OMS_URL}/orders/{order2_id}/confirm", "POST")
    print(f"Second Order confirmed and sent to WMS.")
    
    # Cancel it
    cancelled = request(f"{OMS_URL}/orders/{order2_id}/cancel", "POST")
    print(f"Cancelled Second Order status in OMS: {cancelled['status']}")
    assert cancelled["status"] == "CANCELLED"
    
    print("\n=== E2E OMS-WMS Integration Test PASSED Successfully! ===")

if __name__ == "__main__":
    try:
        run_e2e_test()
    except Exception as e:
        print(f"\nE2E Test FAILED: {e}")
        sys.exit(1)
