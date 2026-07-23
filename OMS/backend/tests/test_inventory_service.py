import pytest
from unittest.mock import MagicMock
from services.inventory_service import allocate_order_items
import models


def test_allocate_order_items_single_warehouse(monkeypatch):
    order_items = [
        models.OrderItem(sku_code="SKU-001", product_name="Shoes", quantity=2)
    ]

    mock_snapshot = (
        {
            "WH-MAIN": {"SKU-001": 10}
        },
        {
            "SKU-001": {"sku_code": "SKU-001", "product_name": "Shoes", "quantity": 2}
        }
    )

    monkeypatch.setattr(
        "services.inventory_service._fetch_inventory_snapshot",
        lambda items: mock_snapshot
    )

    allocations = allocate_order_items(order_items)
    assert len(allocations) == 1
    assert allocations[0]["warehouse_code"] == "WH-MAIN"
    assert allocations[0]["items"][0]["quantity"] == 2
