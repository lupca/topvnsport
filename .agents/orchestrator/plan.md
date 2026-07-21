# Refactoring Execution Plan

## Milestone M1: WMS Public Stock API (Requirement R1)
- **Goal**: Expose an unauthenticated public API endpoint `GET /public/stock` in WMS that aggregates stock availability across all locations for one or multiple SKUs.
- **Key Tasks**:
  1. Add schema `StockQueryResponse` / `SKUStockInfo` in `WMS/backend/schemas/inventory.py` or router.
  2. Implement `GET /public/stock` endpoint in `WMS/backend/routers/inventory.py` (or a dedicated public router) without auth dependency (`get_current_user`).
  3. Query `models.Inventory` grouped by `sku_code`, aggregating `SUM(qty_on_hand - qty_reserved)` per SKU. Handle cases with no inventory (return 0).
  4. Write/update unit/integration tests in `WMS/backend/test_main.py`.
- **Target Files**: `WMS/backend/routers/inventory.py`, `WMS/backend/main.py`, `WMS/backend/schemas/`

## Milestone M2: Web Storefront Integration (Requirement R2)
- **Goal**: Update web storefront to fetch stock directly from WMS public API (R1) instead of relying on PMI stock, and fix fallback bug.
- **Key Tasks**:
  1. Add `VITE_WMS_API_URL` to `web/src/services/sport-api/constants.ts` (defaulting to `http://localhost:18102`).
  2. Create WMS stock API client helper in `web/src/services/sport-api/wmsStockApi.ts` (or `index.ts`) calling `GET /public/stock?sku_codes=...`.
  3. Remove hardcoded `stock: 100` fallback bug in `web/src/services/sport-api/productMappers.ts:168`.
  4. Update product fetching logic in `web/src/services/sport-api/index.ts` to merge live WMS stock data into catalog products and variants.
  5. Ensure UI components (`ProductDetailPage.tsx`, `ProductPurchaseSection.tsx`, `ProductCard.tsx`) properly display stock and disable out-of-stock options/buttons.
- **Target Files**: `web/src/services/sport-api/constants.ts`, `index.ts`, `productMappers.ts`, `web/src/components/ProductDetailPage.tsx`, `web/src/components/product-detail/ProductPurchaseSection.tsx`

## Milestone M3: PMI Stock Removal (Requirement R3)
- **Goal**: Completely remove `stock` field and legacy sync logic from PMI database, backend models/schemas/routers/services, and frontend forms/tables/views.
- **Key Tasks**:
  1. Alembic DB migration to drop `stock` column from `product_variants` table in `PMI/backend/alembic/versions/`.
  2. Remove `stock` column from `ProductVariant` model in `PMI/backend/models.py`.
  3. Remove `stock` from Pydantic schemas in `PMI/backend/schemas/tier_variation.py` & `product.py`.
  4. Clean up `stock` references in `PMI/backend/routers/products.py`, `public.py`, `channels.py`, `services/product_service.py`. Make `POST /service/sync-stock` in `audit.py` return 404.
  5. Remove `stock` inputs, state, matrix mapping, and validations from PMI frontend (`ProductForm.tsx`, `ProductVariations.tsx`, `ProductListTable.tsx`, `ProductPreviewModal.tsx`, `useVariantMatrix.ts`, `useFormCompletion.ts`, `productSchema.ts`).
  6. Verify product creation and editing in PMI work 100% without stock input.
- **Target Files**: `PMI/backend/models.py`, `schemas/`, `routers/`, `services/`, `PMI/frontend/src/`

## Milestone M4: Test Coverage & E2E Verification (Requirement R4)
- **Goal**: Write and pass E2E tests `test_stock_from_wms.py` and `test_pmi_no_stock.py`, and ensure all existing unit/E2E test suites pass.
- **Key Tasks**:
  1. Implement `e2e_tests/tests/test_stock_from_wms.py` covering:
     - WMS public stock aggregation API queries.
     - Stock changes: 0 inventory -> inventory receipt -> order reservation -> order cancellation -> out-of-stock storefront behavior.
  2. Implement `e2e_tests/tests/test_pmi_no_stock.py` covering:
     - Product creation & editing in PMI without stock field.
     - PMI API responses excluding stock fields.
     - Legacy `/service/sync-stock` returning 404.
     - Channel export CSV omitting stock column.
  3. Execute full E2E test suite and individual milestone verification.
- **Target Files**: `e2e_tests/tests/test_stock_from_wms.py`, `e2e_tests/tests/test_pmi_no_stock.py`
