import logging
from typing import Dict, List
import httpx
from fastapi import HTTPException

import models
from utils.api_utils import WMS_API_URL, PIM_API_KEY

logger = logging.getLogger("oms_backend")


def _fetch_inventory_snapshot(order_items: List[models.OrderItem]) -> tuple[Dict[str, Dict[str, int]], Dict[str, dict]]:
    warehouse_url = f"{WMS_API_URL}/warehouses?limit=100000"
    inventory_url = f"{WMS_API_URL}/inventory?limit=100000"
    locations_url = f"{WMS_API_URL}/locations?limit=100000"
    headers = {"X-API-Key": PIM_API_KEY}
    with httpx.Client(timeout=10.0, headers=headers) as client:
        warehouses_resp = client.get(warehouse_url)
        inventory_resp = client.get(inventory_url)
        locations_resp = client.get(locations_url)

    if warehouses_resp.is_error:
        raise HTTPException(status_code=warehouses_resp.status_code, detail="Failed to fetch WMS warehouses")
    if inventory_resp.is_error:
        raise HTTPException(status_code=inventory_resp.status_code, detail="Failed to fetch WMS inventory")
    if locations_resp.is_error:
        raise HTTPException(status_code=locations_resp.status_code, detail="Failed to fetch WMS locations")

    warehouses = warehouses_resp.json()
    inventories = inventory_resp.json()
    locations = locations_resp.json()
    if not isinstance(warehouses, list) or not isinstance(inventories, list) or not isinstance(locations, list):
        raise HTTPException(status_code=500, detail="Unexpected WMS payload format")

    warehouse_by_id = {
        item.get("id"): item.get("code")
        for item in warehouses
        if isinstance(item, dict)
    }
    location_to_warehouse = {
        item.get("id"): item.get("warehouse_id")
        for item in locations
        if isinstance(item, dict)
    }

    available_by_warehouse: Dict[str, Dict[str, int]] = {}
    for record in inventories:
        if not isinstance(record, dict):
            continue
        location_id = record.get("location_id")
        warehouse_id = location_to_warehouse.get(location_id)
        warehouse_code = warehouse_by_id.get(warehouse_id)
        sku_code = record.get("sku_code")
        if not warehouse_code or not sku_code:
            continue

        qty_on_hand = int(record.get("qty_on_hand") or 0)
        qty_reserved = int(record.get("qty_reserved") or 0)
        qty_available = int(record.get("qty_available") or (qty_on_hand - qty_reserved))
        qty_available = max(0, qty_available)

        wh_sku = available_by_warehouse.setdefault(warehouse_code, {})
        # Sum available qty across all locations in the same warehouse.
        wh_sku[sku_code] = wh_sku.get(sku_code, 0) + qty_available

    required_by_sku: Dict[str, dict] = {}
    for item in order_items:
        required = required_by_sku.setdefault(
            item.sku_code,
            {
                "sku_code": item.sku_code,
                "product_name": item.product_name,
                "quantity": 0,
            },
        )
        required["quantity"] += int(item.quantity)

    return available_by_warehouse, required_by_sku


def allocate_order_items(order_items: List[models.OrderItem]) -> List[dict]:
    try:
        available_by_warehouse, required_by_sku = _fetch_inventory_snapshot(order_items)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Unable to allocate order from WMS inventory: %s", e)
        raise HTTPException(status_code=500, detail="Unable to allocate inventory from WMS")

    if not required_by_sku:
        raise HTTPException(status_code=400, detail="Order has no items to allocate")

    # First try: allocate all items from one warehouse.
    for warehouse_code, sku_map in available_by_warehouse.items():
        if all(sku_map.get(sku_code, 0) >= req["quantity"] for sku_code, req in required_by_sku.items()):
            return [
                {
                    "warehouse_code": warehouse_code,
                    "items": [
                        {
                            "sku_code": req["sku_code"],
                            "product_name": req["product_name"],
                            "quantity": req["quantity"],
                        }
                        for req in required_by_sku.values()
                    ],
                }
            ]

    # Split allocation across multiple warehouses.
    remaining = {sku_code: req["quantity"] for sku_code, req in required_by_sku.items()}
    allocations: List[dict] = []

    sorted_warehouses = sorted(
        available_by_warehouse.items(),
        key=lambda wh: sum(wh[1].get(sku, 0) for sku in required_by_sku.keys()),
        reverse=True,
    )

    for warehouse_code, sku_map in sorted_warehouses:
        allocated_items = []
        for sku_code, req in required_by_sku.items():
            need = remaining.get(sku_code, 0)
            if need <= 0:
                continue
            take = min(need, int(sku_map.get(sku_code, 0)))
            if take <= 0:
                continue
            remaining[sku_code] = need - take
            allocated_items.append(
                {
                    "sku_code": sku_code,
                    "product_name": req["product_name"],
                    "quantity": take,
                }
            )

        if allocated_items:
            allocations.append({"warehouse_code": warehouse_code, "items": allocated_items})

        if all(qty <= 0 for qty in remaining.values()):
            break

    if any(qty > 0 for qty in remaining.values()):
        shortage_details = [
            f"{sku_code}: thiếu {qty}"
            for sku_code, qty in remaining.items()
            if qty > 0
        ]
        raise HTTPException(
            status_code=400,
            detail=f"Không đủ tồn kho để duyệt đơn. {'; '.join(shortage_details)}",
        )

    return allocations
