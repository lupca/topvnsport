from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Optional, TypeVar
import time

import httpx
from pydantic import BaseModel, ConfigDict


T = TypeVar("T", bound=BaseModel)


class ApiModel(BaseModel):
    model_config = ConfigDict(extra="ignore")


class CategoryResponse(ApiModel):
    id: int
    code: str
    name: str


class AttributeFamilyResponse(ApiModel):
    id: int
    code: str
    name: str


class ProductVariantResponse(ApiModel):
    id: int
    sku_code: str
    price: float
    stock: int
    tier_1_option: Optional[str] = None
    tier_2_option: Optional[str] = None


class ProductResponse(ApiModel):
    id: int
    product_code: str
    name: str
    variants: list[ProductVariantResponse] = []


class WarehouseResponse(ApiModel):
    id: int
    code: str
    name: str


class LocationResponse(ApiModel):
    id: int
    warehouse_id: int
    location_code: str
    type: Optional[str] = None


class InventoryResponse(ApiModel):
    id: int
    sku_code: str
    product_name: str
    location_id: int
    qty_on_hand: int
    qty_reserved: int
    qty_available: int = 0


class InboundShipmentResponse(ApiModel):
    id: int
    inbound_number: str
    warehouse_id: int
    status: str


class FulfillmentOrderResponse(ApiModel):
    id: int
    fulfillment_number: str
    oms_order_id: Optional[int] = None
    oms_order_number: Optional[str] = None
    status: str


class OrderItemResponse(ApiModel):
    id: int
    order_id: int
    sku_code: str
    quantity: int


class FulfillmentOrderDetail(ApiModel):
    id: int
    fulfillment_number: str
    status: str
    oms_order_id: Optional[int] = None
    oms_order_number: Optional[str] = None
    pick_list_items: list[dict[str, Any]] = []
    packing_sessions: list[dict[str, Any]] = []


class OrderResponse(ApiModel):
    id: int
    order_number: str
    customer_id: int
    channel_id: int
    status: str
    shipping_address: str
    total_amount: float
    shipping_fee: float
    note: Optional[str] = None
    items: list[OrderItemResponse] = []
    fulfillment_orders: list[dict[str, Any]] = []


class PaginatedOrders(ApiModel):
    items: list[OrderResponse] = []
    total: int = 0


@dataclass
class PMIApi:
    client: httpx.Client

    def create_category(self, name: str, code: str, parent_id: Optional[int] = None) -> CategoryResponse:
        payload = {"name": name, "code": code, "parent_id": parent_id}
        return self._request_model("POST", "/categories", payload, CategoryResponse)

    def create_attribute_family(self, name: str, code: str) -> AttributeFamilyResponse:
        payload = {"name": name, "code": code}
        return self._request_model("POST", "/attribute-families", payload, AttributeFamilyResponse)

    def create_product_with_variants(
        self,
        *,
        product_code: str,
        name: str,
        category_id: int,
        family_id: int,
        sku_code: str,
        price: float,
        stock: int,
        image_url: str,
        description: str = "E2E generated product",
    ) -> ProductResponse:
        payload = {
            "product_code": product_code,
            "name": name,
            "description": description,
            "category_id": category_id,
            "family_id": family_id,
            "weight": 100.0,
            "length": 68.0,
            "width": 23.0,
            "height": 3.0,
            "is_pre_order": False,
            "dts_days": 7,
            "status": "Published",
            "tier_variations": [],
            "variants": [
                {
                    "tier_1_option": None,
                    "tier_2_option": None,
                    "sku_code": sku_code,
                    "price": price,
                    "stock": stock,
                }
            ],
            "media": [
                {
                    "image_url": image_url,
                    "is_cover": True,
                    "display_order": 1,
                }
            ],
            "attributes": [],
        }
        return self._request_model("POST", "/products", payload, ProductResponse)

    def get_product_by_sku(self, sku_code: str) -> dict[str, Any]:
        return self._request_json("GET", f"/api/products/by-sku/{sku_code}")

    def _request_json(
        self,
        method: str,
        path: str,
        payload: Optional[dict[str, Any]] = None,
        params: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any] | list[Any]:
        response = self.client.request(method, path, json=payload, params=params)
        response.raise_for_status()
        if response.status_code == 204 or not response.content:
            return {}
        return response.json()

    def _request_model(
        self,
        method: str,
        path: str,
        payload: Optional[dict[str, Any]],
        model: type[T],
    ) -> T:
        data = self._request_json(method, path, payload)
        return model.model_validate(data)


@dataclass
class WMSApi:
    client: httpx.Client

    def create_warehouse(self, code: str, name: str, address: str = "E2E warehouse") -> WarehouseResponse:
        payload = {"code": code, "name": name, "address": address, "is_active": True}
        return self._request_model("POST", "/warehouses", payload, WarehouseResponse)

    def create_location(self, warehouse_id: int, location_code: str, location_type: str) -> LocationResponse:
        payload = {
            "warehouse_id": warehouse_id,
            "location_code": location_code,
            "zone": "E2E",
            "aisle": "A",
            "rack": "1",
            "shelf": "1",
            "type": location_type,
            "is_active": True,
        }
        return self._request_model("POST", "/locations", payload, LocationResponse)

    def create_barcode_mapping(self, barcode: str, sku_code: str, product_name: str, variant_name: str) -> dict[str, Any]:
        payload = {
            "barcode": barcode,
            "barcode_type": "EAN-13",
            "sku_code": sku_code,
            "product_name": product_name,
            "variant_name": variant_name,
            "image_url": None,
        }
        return self._request_json("POST", "/barcode-mappings", payload)

    def create_inbound_shipment(
        self,
        *,
        inbound_number: str,
        warehouse_id: int,
        sku_code: str,
        product_name: str,
        expected_qty: int,
    ) -> InboundShipmentResponse:
        payload = {
            "inbound_number": inbound_number,
            "warehouse_id": warehouse_id,
            "supplier_name": "E2E Supplier",
            "status": "pending",
            "note": "Generated by E2E suite",
            "created_by": "pytest-e2e",
            "items": [
                {
                    "sku_code": sku_code,
                    "product_name": product_name,
                    "expected_qty": expected_qty,
                    "received_qty": 0,
                    "location_id": None,
                    "status": "pending",
                }
            ],
        }
        return self._request_model("POST", "/inbound-shipments", payload, InboundShipmentResponse)

    def receive_inbound_shipment(self, shipment_id: int, sku_code: str, received_qty: int, location_id: int) -> dict[str, Any]:
        payload = {"items": [{"sku_code": sku_code, "received_qty": received_qty, "location_id": location_id}]}
        return self._request_json("POST", f"/inbound-shipments/{shipment_id}/receive", payload)

    def put_away_inbound_item(self, shipment_id: int, sku_code: str, location_id: int) -> dict[str, Any]:
        payload = {"sku_code": sku_code, "location_id": location_id}
        return self._request_json("POST", f"/inbound/{shipment_id}/put-away", payload)

    def complete_inbound_shipment(self, shipment_id: int) -> dict[str, Any]:
        return self._request_json("POST", f"/inbound/{shipment_id}/complete")

    def list_inventory(self) -> list[InventoryResponse]:
        data = self._request_json("GET", "/inventory")
        return [InventoryResponse.model_validate(item) for item in data]

    def get_inventory_record(self, sku_code: str, location_id: int) -> Optional[InventoryResponse]:
        for record in self.list_inventory():
            if record.sku_code == sku_code and record.location_id == location_id:
                return record
        return None

    def list_fulfillment_orders(self) -> list[FulfillmentOrderResponse]:
        data = self._request_json("GET", "/fulfillment-orders")
        return [FulfillmentOrderResponse.model_validate(item) for item in data]

    def get_fulfillment_order(self, identifier: str) -> FulfillmentOrderDetail:
        data = self._request_json("GET", f"/fulfillment-orders/{identifier}")
        return FulfillmentOrderDetail.model_validate(data)

    def start_pick(self, identifier: str) -> dict[str, Any]:
        return self._request_json("POST", f"/fulfillment-orders/{identifier}/start-pick")

    def scan_pick(self, identifier: str, barcode: str, quantity: int = 1) -> dict[str, Any]:
        return self._request_json("POST", f"/fulfillment-orders/{identifier}/scan-pick", {"barcode": barcode, "quantity": quantity})

    def complete_pick(self, identifier: str) -> dict[str, Any]:
        return self._request_json("POST", f"/fulfillment-orders/{identifier}/complete-pick")

    def scan_pack(self, identifier: str, tracking_number: str, carrier_name: str = "E2E Carrier") -> dict[str, Any]:
        payload = {"tracking_number": tracking_number, "carrier_name": carrier_name}
        return self._request_json("POST", f"/fulfillment-orders/{identifier}/scan-pack", payload)

    def complete_pack(self, identifier: str) -> dict[str, Any]:
        return self._request_json("POST", f"/fulfillment-orders/{identifier}/complete-pack")

    def ship(self, identifier: str) -> dict[str, Any]:
        return self._request_json("POST", f"/fulfillment-orders/{identifier}/ship")

    def _request_json(
        self,
        method: str,
        path: str,
        payload: Optional[dict[str, Any]] = None,
        params: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any] | list[Any]:
        response = self.client.request(method, path, json=payload, params=params)
        response.raise_for_status()
        if response.status_code == 204 or not response.content:
            return {}
        return response.json()

    def _request_model(
        self,
        method: str,
        path: str,
        payload: Optional[dict[str, Any]],
        model: type[T],
    ) -> T:
        data = self._request_json(method, path, payload)
        return model.model_validate(data)


@dataclass
class OMSApi:
    client: httpx.Client

    def get_orders(self, search: Optional[str] = None, status: Optional[str] = None) -> PaginatedOrders:
        params: dict[str, Any] = {"page": 1, "limit": 100}
        if search:
            params["search"] = search
        if status:
            params["status"] = status
        data = self._request_json("GET", "/orders", params=params)
        return PaginatedOrders.model_validate(data)

    def get_order(self, order_id: int) -> OrderResponse:
        data = self._request_json("GET", f"/orders/{order_id}")
        return OrderResponse.model_validate(data)

    def confirm_order(self, order_id: int) -> OrderResponse:
        data = self._request_json("POST", f"/orders/{order_id}/confirm")
        return OrderResponse.model_validate(data)

    def _request_json(
        self,
        method: str,
        path: str,
        payload: Optional[dict[str, Any]] = None,
        params: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any] | list[Any]:
        response = self.client.request(method, path, json=payload, params=params)
        response.raise_for_status()
        if response.status_code == 204 or not response.content:
            return {}
        return response.json()


def wait_until(condition: Callable[[], Any], timeout_seconds: int = 30, interval_seconds: float = 1.0) -> Any:
    deadline = time.monotonic() + timeout_seconds
    last_error: Exception | None = None
    while time.monotonic() < deadline:
        try:
            result = condition()
            if result:
                return result
        except Exception as exc:  # pragma: no cover - only used during polling
            last_error = exc
        time.sleep(interval_seconds)
    if last_error:
        raise TimeoutError(f"Condition not met within {timeout_seconds}s: {last_error}") from last_error
    raise TimeoutError(f"Condition not met within {timeout_seconds}s")
