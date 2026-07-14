from __future__ import annotations

import os
from dataclasses import dataclass
from uuid import uuid4

import httpx
import pytest


@dataclass
class ApiBundle:
    oms: httpx.Client
    wms: httpx.Client
    pmi: httpx.Client

    def close(self) -> None:
        self.oms.close()
        self.wms.close()
        self.pmi.close()


@pytest.fixture(scope="module")
def api_bundle() -> ApiBundle:
    oms_url = os.getenv("OMS_API_URL", os.getenv("E2E_OMS_API_URL", "http://localhost:18101"))
    wms_url = os.getenv("WMS_API_URL", os.getenv("E2E_WMS_API_URL", "http://localhost:18102"))
    pmi_url = os.getenv("PMI_API_URL", os.getenv("E2E_PMI_API_URL", "http://localhost:18100"))

    pmi_headers = {"X-API-Key": "oms_wms_internal_api_key_secret_2026"}
    bundle = ApiBundle(
        oms=httpx.Client(base_url=oms_url, timeout=30.0),
        wms=httpx.Client(base_url=wms_url, timeout=30.0),
        pmi=httpx.Client(base_url=pmi_url, headers=pmi_headers, timeout=30.0),
    )
    try:
        yield bundle
    finally:
        bundle.close()


def _raise_for_status(resp: httpx.Response) -> dict | list:
    resp.raise_for_status()
    if not resp.content:
        return {}
    return resp.json()


def _create_minimal_product(bundle: ApiBundle, run_id: str, sku_code: str, product_name: str) -> None:
    category = _raise_for_status(
        bundle.pmi.post(
            "/categories",
            json={"name": f"E2E Category {run_id}", "code": f"CAT-E2E-{run_id}"},
        )
    )
    family = _raise_for_status(
        bundle.pmi.post(
            "/attribute-families",
            json={"name": f"E2E Family {run_id}", "code": f"FAM-E2E-{run_id}"},
        )
    )
    _raise_for_status(
        bundle.pmi.post(
            "/products",
            json={
                "product_code": f"PROD-E2E-{sku_code}-{run_id}",
                "name": product_name,
                "description": "E2E split order product",
                "category_id": category["id"],
                "family_id": family["id"],
                "weight": 100.0,
                "length": 10.0,
                "width": 10.0,
                "height": 10.0,
                "is_pre_order": False,
                "dts_days": 7,
                "status": "Published",
                "tier_variations": [],
                "variants": [
                    {
                        "tier_1_option": None,
                        "tier_2_option": None,
                        "sku_code": sku_code,
                        "price": 100000,
                        "stock": 999,
                    }
                ],
                "media": [
                    {
                        "image_url": "https://placehold.co/200x200/png?text=E2E",
                        "is_cover": True,
                        "display_order": 1,
                    }
                ],
                "attributes": [],
            },
        )
    )


def _get_or_create_manual_channel(bundle: ApiBundle) -> int:
    channels = _raise_for_status(bundle.oms.get("/channels?limit=200"))["items"]
    for channel in channels:
        if channel["code"] == "MANUAL":
            return channel["id"]

    created = _raise_for_status(
        bundle.oms.post(
            "/channels",
            json={"code": "MANUAL", "name": "Manual", "is_active": True},
        )
    )
    return created["id"]


def _create_customer(bundle: ApiBundle, run_id: str) -> int:
    customer = _raise_for_status(
        bundle.oms.post(
            "/customers",
            json={
                "name": f"Split Test {run_id}",
                "phone": f"09{int(run_id, 16) % 10**8:08d}",
                "email": f"split-{run_id}@example.com",
                "address": f"{run_id} Test Street",
            },
        )
    )
    return customer["id"]


def _create_warehouse_with_location(bundle: ApiBundle, code: str) -> tuple[int, int]:
    warehouse = _raise_for_status(
        bundle.wms.post(
            "/warehouses",
            json={"code": code, "name": code, "address": "E2E warehouse", "is_active": True},
        )
    )
    location = _raise_for_status(
        bundle.wms.post(
            "/locations",
            json={
                "warehouse_id": warehouse["id"],
                "location_code": f"LOC-{code}",
                "zone": "E2E",
                "aisle": "A",
                "rack": "1",
                "shelf": "1",
                "type": "STORAGE",
                "is_active": True,
            },
        )
    )
    return warehouse["id"], location["id"]


def _adjust_inventory(bundle: ApiBundle, sku_code: str, location_id: int, quantity: int) -> None:
    _raise_for_status(
        bundle.wms.post(
            "/inventory/adjust",
            json={
                "sku_code": sku_code,
                "location_id": location_id,
                "quantity": quantity,
                "note": "e2e split setup",
            },
        )
    )


def _create_order(bundle: ApiBundle, *, order_number: str, customer_id: int, channel_id: int, items: list[dict]) -> dict:
    return _raise_for_status(
        bundle.oms.post(
            "/orders",
            json={
                "order_number": order_number,
                "customer_id": customer_id,
                "channel_id": channel_id,
                "shipping_fee": 0,
                "shipping_address": "Split Test Address",
                "note": "Split order E2E",
                "created_by": "pytest",
                "items": items,
            },
        )
    )


def _fulfillments_for_order_number(bundle: ApiBundle, order_number: str) -> list[dict]:
    all_fulfillments = _raise_for_status(bundle.wms.get("/fulfillment-orders"))
    return [f for f in all_fulfillments if f.get("oms_order_number") == order_number]


def _inventory_rows_by_sku(bundle: ApiBundle, sku_code: str) -> list[dict]:
    rows = _raise_for_status(bundle.wms.get("/inventory"))
    return [row for row in rows if row.get("sku_code") == sku_code]


@pytest.fixture(scope="module")
def split_order_context(api_bundle: ApiBundle) -> dict:
    run_id = uuid4().hex[:8]
    sku_a = f"SKU-A-{run_id}"
    sku_b = f"SKU-B-{run_id}"

    _create_minimal_product(api_bundle, run_id, sku_a, f"Split Product A {run_id}")
    _create_minimal_product(api_bundle, f"{run_id}b", sku_b, f"Split Product B {run_id}")

    _, loc_1 = _create_warehouse_with_location(api_bundle, f"WH-SPLIT-1-{run_id}")
    _, loc_2 = _create_warehouse_with_location(api_bundle, f"WH-SPLIT-2-{run_id}")

    # SKU A only in warehouse 1, SKU B only in warehouse 2.
    _adjust_inventory(api_bundle, sku_a, loc_1, 10)
    _adjust_inventory(api_bundle, sku_b, loc_2, 10)

    channel_id = _get_or_create_manual_channel(api_bundle)
    customer_id = _create_customer(api_bundle, run_id)

    order = _create_order(
        api_bundle,
        order_number=f"ORD-SPLIT-{run_id}",
        customer_id=customer_id,
        channel_id=channel_id,
        items=[
            {"sku_code": sku_a, "quantity": 1},
            {"sku_code": sku_b, "quantity": 1},
        ],
    )

    confirm_resp = api_bundle.oms.post(f"/orders/{order['id']}/confirm")
    confirmed = _raise_for_status(confirm_resp)

    return {
        "run_id": run_id,
        "sku_a": sku_a,
        "sku_b": sku_b,
        "order_id": order["id"],
        "order_number": order["order_number"],
        "confirmed": confirmed,
    }


def test_split_fulfillment_success(split_order_context: dict, api_bundle: ApiBundle):
    confirmed = split_order_context["confirmed"]
    order_id = split_order_context["order_id"]
    order_number = split_order_context["order_number"]

    assert confirmed["status"] == "PROCESSING"

    order_detail = _raise_for_status(api_bundle.oms.get(f"/orders/{order_id}"))
    assert order_detail["status"] == "PROCESSING"
    assert len(order_detail.get("fulfillment_orders", [])) == 2

    oms_fo_numbers = sorted(fo["fulfillment_number"] for fo in order_detail["fulfillment_orders"])
    assert oms_fo_numbers == [f"FM-{order_number}-1", f"FM-{order_number}-2"]

    wms_fulfillments = _fulfillments_for_order_number(api_bundle, order_number)
    assert len(wms_fulfillments) == 2
    assert sorted(fo["fulfillment_number"] for fo in wms_fulfillments) == oms_fo_numbers
    assert all(fo["status"] == "PENDING" for fo in wms_fulfillments)


def test_cancel_multi_fulfillment(split_order_context: dict, api_bundle: ApiBundle):
    order_id = split_order_context["order_id"]
    order_number = split_order_context["order_number"]
    sku_a = split_order_context["sku_a"]
    sku_b = split_order_context["sku_b"]

    cancel_resp = api_bundle.oms.post(f"/orders/{order_id}/cancel")
    cancelled = _raise_for_status(cancel_resp)
    assert cancelled["status"] == "CANCELLED"

    order_detail = _raise_for_status(api_bundle.oms.get(f"/orders/{order_id}"))
    assert order_detail["status"] == "CANCELLED"

    wms_fulfillments = _fulfillments_for_order_number(api_bundle, order_number)
    assert len(wms_fulfillments) == 2
    assert all(fo["status"] == "CANCELLED" for fo in wms_fulfillments)

    inv_a = _inventory_rows_by_sku(api_bundle, sku_a)
    inv_b = _inventory_rows_by_sku(api_bundle, sku_b)
    assert sum(row["qty_reserved"] for row in inv_a) == 0
    assert sum(row["qty_reserved"] for row in inv_b) == 0


def test_confirm_blocked_when_insufficient_stock(api_bundle: ApiBundle):
    run_id = uuid4().hex[:8]
    sku_c = f"SKU-C-{run_id}"

    _create_minimal_product(api_bundle, run_id, sku_c, f"Split Product C {run_id}")

    channel_id = _get_or_create_manual_channel(api_bundle)
    customer_id = _create_customer(api_bundle, run_id)

    order = _create_order(
        api_bundle,
        order_number=f"ORD-NOSTOCK-{run_id}",
        customer_id=customer_id,
        channel_id=channel_id,
        items=[{"sku_code": sku_c, "quantity": 999}],
    )

    confirm_resp = api_bundle.oms.post(f"/orders/{order['id']}/confirm")
    assert confirm_resp.status_code == 400
    assert "Không đủ tồn kho" in confirm_resp.text

    order_detail = _raise_for_status(api_bundle.oms.get(f"/orders/{order['id']}"))
    assert order_detail["status"] == "DRAFT"

    wms_fulfillments = _fulfillments_for_order_number(api_bundle, order["order_number"])
    assert wms_fulfillments == []
