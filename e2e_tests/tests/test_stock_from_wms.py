from __future__ import annotations

from uuid import uuid4
import httpx
import pytest

from e2e_tests.conftest import ApiClients
from e2e_tests.utils.api_helpers import PMIApi, WMSApi


def test_wms_public_stock_unauthenticated_multi_sku(api_clients: ApiClients, wms_api_url: str):
    """
    Verify WMS public stock endpoint (GET /public/stock?sku_codes=...) is accessible without
    authentication and correctly aggregates multi-SKU stock across locations.
    """
    run_id = uuid4().hex[:8]
    sku_a = f"SKU-PUB-A-{run_id}"
    sku_b = f"SKU-PUB-B-{run_id}"

    wms_admin = WMSApi(api_clients.wms)

    # 1. Setup master data (Warehouse & 2 Locations)
    wh = wms_admin.create_warehouse(code=f"WH-PUB-{run_id}", name=f"Public Stock WH {run_id}")
    loc1 = wms_admin.create_location(warehouse_id=wh.id, location_code=f"LOC-PUB1-{run_id}", location_type="STORAGE")
    loc2 = wms_admin.create_location(warehouse_id=wh.id, location_code=f"LOC-PUB2-{run_id}", location_type="PICK")

    # Add stock across locations: SKU A has 30 in LOC1, 20 in LOC2 (Total 50 on hand)
    api_clients.wms.post("/inventory/adjust", json={"sku_code": sku_a, "location_id": loc1.id, "quantity": 30, "note": "E2E add loc1"})
    api_clients.wms.post("/inventory/adjust", json={"sku_code": sku_a, "location_id": loc2.id, "quantity": 20, "note": "E2E add loc2"})

    # SKU B has 40 in LOC1
    api_clients.wms.post("/inventory/adjust", json={"sku_code": sku_b, "location_id": loc1.id, "quantity": 40, "note": "E2E add SKU B"})

    # 2. Query /public/stock with an unauthenticated client (no X-API-Key or Bearer token)
    with httpx.Client(base_url=wms_api_url, timeout=10.0) as unauth_client:
        # Test comma-separated multi-SKU query
        resp_comma = unauth_client.get(f"/public/stock?sku_codes={sku_a},{sku_b}")
        assert resp_comma.status_code == 200, f"Expected 200 OK unauthenticated, got {resp_comma.status_code}"

        data = resp_comma.json()
        assert "stock" in data
        assert "items" in data

        assert data["stock"].get(sku_a) == 50
        assert data["stock"].get(sku_b) == 40

        items_by_sku = {item["sku_code"]: item for item in data["items"]}
        assert items_by_sku[sku_a]["qty_available"] == 50
        assert items_by_sku[sku_a]["qty_on_hand"] == 50
        assert items_by_sku[sku_a]["qty_reserved"] == 0

        assert items_by_sku[sku_b]["qty_available"] == 40
        assert items_by_sku[sku_b]["qty_on_hand"] == 40
        assert items_by_sku[sku_b]["qty_reserved"] == 0

        # Test repeated parameter query (sku_codes=SKU_A&sku_codes=SKU_B)
        resp_repeat = unauth_client.get(f"/public/stock?sku_codes={sku_a}&sku_codes={sku_b}")
        assert resp_repeat.status_code == 200
        repeat_data = resp_repeat.json()
        assert repeat_data["stock"].get(sku_a) == 50
        assert repeat_data["stock"].get(sku_b) == 40


def test_wms_dynamic_stock_changes_across_locations(api_clients: ApiClients, wms_api_url: str):
    """
    Verify full lifecycle of dynamic stock changes in WMS:
    1. Zero stock initial state
    2. Inventory receipt / addition across multiple locations
    3. Order reservation (OMS confirm -> WMS reserve)
    4. Order cancellation / inventory adjustment (OMS cancel -> WMS unreserve)
    Verify qty_available = SUM(qty_on_hand - qty_reserved) across locations at every stage.
    """
    run_id = uuid4().hex[:8]
    sku = f"SKU-DYN-LIFECYCLE-{run_id}"
    wh_code = f"WH-DYN-{run_id}"

    wms_admin = WMSApi(api_clients.wms)

    # 1. Initial State: Zero stock / non-existent SKU
    with httpx.Client(base_url=wms_api_url, timeout=10.0) as unauth_client:
        init_resp = unauth_client.get(f"/public/stock?sku_codes={sku}")
        assert init_resp.status_code == 200
        init_data = init_resp.json()
        assert init_data["stock"].get(sku) == 0
        assert len(init_data["items"]) == 1
        item = init_data["items"][0]
        assert item["qty_available"] == 0
        assert item["qty_on_hand"] == 0
        assert item["qty_reserved"] == 0

    # 2. Inventory Addition across 2 locations in 2 warehouses
    wh1 = wms_admin.create_warehouse(code=wh_code, name=f"Dynamic WH 1 {run_id}")
    loc1 = wms_admin.create_location(warehouse_id=wh1.id, location_code=f"LOC-DYN1-{run_id}", location_type="STORAGE")

    wh2 = wms_admin.create_warehouse(code=f"WH-DYN2-{run_id}", name=f"Dynamic WH 2 {run_id}")
    loc2 = wms_admin.create_location(warehouse_id=wh2.id, location_code=f"LOC-DYN2-{run_id}", location_type="STORAGE")

    # Add 100 in loc1, 50 in loc2 -> Total on hand = 150
    api_clients.wms.post("/inventory/adjust", json={"sku_code": sku, "location_id": loc1.id, "quantity": 100, "note": "Initial receipt loc1"})
    api_clients.wms.post("/inventory/adjust", json={"sku_code": sku, "location_id": loc2.id, "quantity": 50, "note": "Initial receipt loc2"})

    with httpx.Client(base_url=wms_api_url, timeout=10.0) as unauth_client:
        post_add_resp = unauth_client.get(f"/public/stock?sku_codes={sku}")
        assert post_add_resp.status_code == 200
        post_add_data = post_add_resp.json()
        assert post_add_data["stock"].get(sku) == 150
        item = post_add_data["items"][0]
        assert item["qty_on_hand"] == 150
        assert item["qty_reserved"] == 0
        assert item["qty_available"] == 150

    # 3. Order Reservation via OMS Confirm -> WMS fulfillment & reservation
    pmi = PMIApi(api_clients.pmi)
    cat = pmi.create_category(name=f"Cat {run_id}", code=f"CAT-DYN-{run_id}")
    fam = pmi.create_attribute_family(name=f"Fam {run_id}", code=f"FAM-DYN-{run_id}")
    pmi.create_product_with_variants(
        product_code=f"PROD-DYN-{run_id}",
        name=f"Dynamic Product {run_id}",
        category_id=cat.id,
        family_id=fam.id,
        sku_code=sku,
        price=100000.0,
        stock=0,
    )

    phone = f"09{int(run_id[:6], 16) % 10**8:08d}"
    cust_resp = api_clients.oms.post(
        "/customers",
        json={"name": f"Customer {run_id}", "phone": phone, "email": f"cust_{run_id}@example.com", "address": "E2E Street"},
    )
    assert cust_resp.status_code in (200, 201)
    customer_id = cust_resp.json()["id"]

    chan_resp = api_clients.oms.get("/channels")
    raw_channels = chan_resp.json() if chan_resp.status_code == 200 else []
    if isinstance(raw_channels, dict) and "items" in raw_channels:
        channels = raw_channels["items"]
    elif isinstance(raw_channels, list):
        channels = raw_channels
    else:
        channels = []

    if channels:
        channel_id = channels[0]["id"]
    else:
        new_chan = api_clients.oms.post("/channels", json={"name": "E2E Channel", "code": f"CHAN-{run_id}"})
        channel_id = new_chan.json()["id"]

    oms_order_resp = api_clients.oms.post(
        "/orders",
        json={
            "order_number": f"OMS-ORD-{run_id}",
            "customer_id": customer_id,
            "channel_id": channel_id,
            "status": "PENDING",
            "shipping_address": "E2E Street",
            "total_amount": 3000000.0,
            "shipping_fee": 30000.0,
            "items": [{"sku_code": sku, "quantity": 30, "price": 100000.0}],
        },
    )
    assert oms_order_resp.status_code in (200, 201)
    oms_order = oms_order_resp.json()

    # Confirm OMS order -> triggers WMS fulfillment order creation & stock reservation
    confirm_resp = api_clients.oms.post(f"/orders/{oms_order['id']}/confirm")
    assert confirm_resp.status_code == 200, f"Order confirm failed: {confirm_resp.text}"

    # Verify WMS stock reservation: on_hand=150, reserved=30, available=120
    with httpx.Client(base_url=wms_api_url, timeout=10.0) as unauth_client:
        post_res_resp = unauth_client.get(f"/public/stock?sku_codes={sku}")
        assert post_res_resp.status_code == 200
        post_res_data = post_res_resp.json()
        assert post_res_data["stock"].get(sku) == 120
        item = post_res_data["items"][0]
        assert item["qty_on_hand"] == 150
        assert item["qty_reserved"] == 30
        assert item["qty_available"] == 120  # SUM(qty_on_hand - qty_reserved)

    # 4. Cancellation & Inventory Adjustment
    # Cancel OMS order -> cancels WMS fulfillment order & unreserves stock
    cancel_resp = api_clients.oms.post(f"/orders/{oms_order['id']}/cancel")
    assert cancel_resp.status_code == 200, f"Failed to cancel OMS order: {cancel_resp.text}"

    # Verify stock restored to available=150, reserved=0
    with httpx.Client(base_url=wms_api_url, timeout=10.0) as unauth_client:
        post_cancel_resp = unauth_client.get(f"/public/stock?sku_codes={sku}")
        assert post_cancel_resp.status_code == 200
        post_cancel_data = post_cancel_resp.json()
        assert post_cancel_data["stock"].get(sku) == 150
        item = post_cancel_data["items"][0]
        assert item["qty_on_hand"] == 150
        assert item["qty_reserved"] == 0
        assert item["qty_available"] == 150

    # Adjust stock: deduct 20 units from loc1 -> on_hand becomes 130
    adjust_resp = api_clients.wms.post("/inventory/adjust", json={"sku_code": sku, "location_id": loc1.id, "quantity": -20, "note": "Adjust down"})
    assert adjust_resp.status_code == 200

    with httpx.Client(base_url=wms_api_url, timeout=10.0) as unauth_client:
        final_resp = unauth_client.get(f"/public/stock?sku_codes={sku}")
        assert final_resp.status_code == 200
        final_data = final_resp.json()
        assert final_data["stock"].get(sku) == 130
        item = final_data["items"][0]
        assert item["qty_on_hand"] == 130
        assert item["qty_reserved"] == 0
        assert item["qty_available"] == 130


def test_wms_public_stock_edge_cases(api_clients: ApiClients, wms_api_url: str):
    """
    Test edge cases for WMS public stock endpoint:
    - Non-existent / unknown SKUs
    - Empty query string parameters
    """
    run_id = uuid4().hex[:8]
    unknown_sku = f"UNKNOWN-SKU-{run_id}"

    with httpx.Client(base_url=wms_api_url, timeout=10.0) as unauth_client:
        # Unknown SKU returns 0 stock without failing
        resp = unauth_client.get(f"/public/stock?sku_codes={unknown_sku}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["stock"].get(unknown_sku) == 0
        assert len(data["items"]) == 1
        item = data["items"][0]
        assert item["sku_code"] == unknown_sku
        assert item["qty_available"] == 0
        assert item["qty_on_hand"] == 0
        assert item["qty_reserved"] == 0

        # Empty parameters
        resp_empty = unauth_client.get("/public/stock")
        assert resp_empty.status_code == 200
        empty_data = resp_empty.json()
        assert "stock" in empty_data
        assert "items" in empty_data
