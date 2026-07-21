# Project: TopVNSport Inventory Refactoring

## Architecture Overview
System refactoring to migrate inventory (stock) management completely from PMI (Product Master Management) to WMS (Warehouse Management System). WMS becomes the single authoritative source of truth for stock availability across all warehouses and locations.

```
+--------------------+        +---------------------+        +--------------------+
|  PMI (Backend/FE)  |        | WMS (Backend/API)   |        | Web Storefront     |
| - Product master   |        | - Multi-loc stock   |        | - Catalog & Detail |
| - NO stock fields  |        | - GET /public/stock |        | - Live stock fetch |
+--------------------+        +---------------------+        +--------------------+
```

## Interface Contracts

### WMS Public Stock API Contract (R1)
- **Endpoint**: `GET /public/stock`
- **Authentication**: Unauthenticated / Public
- **Query Parameter**: `sku_codes` (comma-separated list of SKU strings, e.g. `?sku_codes=SKU-A,SKU-B`)
- **Response Format**:
```json
{
  "stock": {
    "SKU-A": 15,
    "SKU-B": 0
  }
}
```
Or array format:
```json
{
  "items": [
    {"sku_code": "SKU-A", "qty_available": 15, "qty_on_hand": 20, "qty_reserved": 5},
    {"sku_code": "SKU-B", "qty_available": 0, "qty_on_hand": 0, "qty_reserved": 0}
  ]
}
```
*Aggregation Logic*: For each SKU, `qty_available = SUM(qty_on_hand - qty_reserved)` across all active inventory locations in WMS.

### Storefront WMS Stock Contract (R2)
- **WMS Base URL**: `VITE_WMS_API_URL` (default: `http://localhost:18102`)
- **Integration**: On catalog load (`fetchAppData`) and detail mount (`ProductDetailPage`), fetch aggregated stock from WMS `GET /public/stock` and map onto products/variants.
- **UI Rules**: When `stock <= 0` for a variant, render option as out-of-stock (disabled, line-through styling, "Hết" badge). If all variants out of stock, disable "Thêm vào giỏ hàng" button and show banner "Sản phẩm này tạm hết hàng".

### PMI No-Stock Contract (R3)
- **Database Schema**: Column `stock` dropped from table `product_variants`.
- **Backend APIs**: All schemas (`ProductVariantCreate`, `ProductVariantResponse`, `ProductDetailResponse`, CSV export headers) MUST omit `stock`. Legacy `POST /service/sync-stock` returns HTTP 404.
- **Frontend UI**: Product forms (`ProductForm.tsx`, `ProductVariations.tsx`), table columns, variant matrix, and Zod validations MUST omit `stock`. Product creation & editing MUST succeed with payloads lacking stock.

## Code Layout
- `WMS/backend/`: FastAPI WMS service
  - `routers/inventory.py`: Public stock API implementation
  - `models.py`, `schemas/`: Inventory models & response schemas
- `web/`: React + Vite Storefront frontend
  - `src/services/sport-api/`: API client & mappers (`constants.ts`, `index.ts`, `productMappers.ts`)
  - `src/components/`: Storefront UI (`ProductDetailPage.tsx`, `ProductCard.tsx`, `product-detail/ProductPurchaseSection.tsx`)
- `PMI/`: Product Master backend & frontend
  - `backend/`: FastAPI PMI backend (`models.py`, `schemas/`, `routers/`, `services/`)
  - `frontend/src/`: React frontend (`components/`, `hooks/`, `validations/`)
- `e2e_tests/`: Integration & E2E Pytest suite
  - `tests/test_stock_from_wms.py`: WMS stock API & Storefront integration verification
  - `tests/test_pmi_no_stock.py`: PMI stock removal & creation without stock verification

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1_wms_stock_api | Implement `GET /public/stock` in WMS router with multi-SKU aggregation across locations | None | DONE |
| 2 | M2_storefront_integration | Update Storefront frontend to fetch stock from WMS, remove hardcoded 100 stock fallback, handle out-of-stock UI | M1 | DONE |
| 3 | M3_pmi_stock_removal | Remove `stock` from PMI DB, backend models/schemas/routers/services, and frontend components/hooks/validations | None | DONE |
| 4 | M4_test_coverage | Implement `test_stock_from_wms.py` and `test_pmi_no_stock.py`, verify full pytest test suite passes | M1, M2, M3 | DONE |
