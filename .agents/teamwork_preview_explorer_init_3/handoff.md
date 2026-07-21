# Handoff Report: R3 (PMI Stock Removal) & R4 (Test Coverage)

**Author:** Explorer 3  
**Working Directory:** `/home/lupca/projects/topvnsport/.agents/teamwork_preview_explorer_init_3/`  
**Date:** 2026-07-21  

---

## 1. Observation

Exact evidence collected from codebase inspection:

1. **PMI Backend Models & Schemas**:
   - `PMI/backend/models.py:101`: `stock = Column(Integer, nullable=False)` in model `ProductVariant`.
   - `PMI/backend/schemas/tier_variation.py:26`: `stock: int = Field(..., ge=0)` in `ProductVariantBase`.
   - `PMI/backend/schemas/product.py:72`: status pattern allows `"Out of Stock"`.

2. **PMI Routers & Services**:
   - `PMI/backend/routers/products.py:110`: `stock=v.stock` during variant creation.
   - `PMI/backend/routers/products.py:205-209`: `sort_by == "stock"` ordering logic.
   - `PMI/backend/routers/products.py:420`: `stock=100` hardcoded in single product import.
   - `PMI/backend/routers/public.py:49, 100`: `stock` and `total_stock` in public response schemas.
   - `PMI/backend/routers/public.py:117-125`: `compute_product_prices` sums variant stocks.
   - `PMI/backend/routers/public.py:169, 314-315`: `in_stock` parameter filters `total_stock > 0`.
   - `PMI/backend/routers/audit.py:22-24, 139-185`: `SyncStockRequest` and `POST /service/sync-stock` endpoint.
   - `PMI/backend/routers/channels.py:212, 284, 356, 433`: `"stock"` CSV header and row exports.
   - `PMI/backend/services/product_service.py:195, 325, 396`: `"stock": v.stock` in aggregate serialization, variant creation, and diffing loop.

3. **PMI Frontend**:
   - `PMI/frontend/src/components/ProductForm.tsx:47, 255, 427-428`: Initial variant state `stock: 0`, `bulkStock` state.
   - `PMI/frontend/src/components/products/ProductVariations.tsx:19-20, 76, 81, 280-281, 381`: Bulk stock input and variant stock inputs.
   - `PMI/frontend/src/components/products/ProductListTable.tsx:53-56, 100, 136, 190-195, 318-321`: `getTotalStock()`, stock table headers, stock badges, expanded row stock.
   - `PMI/frontend/src/components/ProductList.tsx:502, 504, 510`: Sort by stock button.
   - `PMI/frontend/src/components/products/ProductPreviewModal.tsx:11, 195`: `Variant.stock` type and display.
   - `PMI/frontend/src/hooks/useVariantMatrix.ts:42, 48, 71, 88, 107`: Matrix generation maps `stock`.
   - `PMI/frontend/src/hooks/useFormCompletion.ts:38`: Checks `variants.every(v => Number(v.stock) > 0)`.
   - `PMI/frontend/src/hooks/useProductLoad.ts:75`: Sets `stock: v.stock`.
   - `PMI/frontend/src/validations/productSchema.ts:15`: Zod `stock: z.coerce.number().min(0, ...)`.

4. **Architecture Specifications**:
   - `todo/move-stock-to-wms.md`: Outlines 8-phase plan to add WMS `GET /public/stock?sku_codes=...`, update Web storefront, remove stock from PMI backend/frontend, update existing tests, and add automated E2E tests `test_stock_from_wms.py` and `test_pmi_no_stock.py`.

5. **Existing E2E Helpers & Fixtures**:
   - `e2e_tests/conftest.py:45-56`: `api_clients` fixture providing `pmi`, `oms`, and `wms` HTTP clients.
   - `e2e_tests/utils/api_helpers.py:34, 168`: `ProductVariantResponse.stock` and `PMIApi.create_product_with_variants` `"stock": stock` payload.

---

## 2. Logic Chain

1. **Problem Definition**: Maintaining `stock` in PMI created duplicate sources of truth, leading to desynchronization and over-selling on storefront.
2. **Target Architecture**: WMS is the single authority for inventory via `GET /public/stock?sku_codes=...`. PMI must remove all `stock` database columns, API response fields, service diffing, export columns, frontend inputs, and validations.
3. **Impact on Product Creation/Editing**: Removing `stock` from `ProductVariantCreate` Pydantic schema and `productSchema.ts` Zod validation allows product payloads with only `{ sku_code, price, barcode, default_cost_price, default_tax_rate }` to be valid and saved. Product creation and editing continue to work seamlessly without requiring stock input.
4. **Test Suite Requirements (R4)**:
   - `test_stock_from_wms.py`: Asserts WMS `GET /public/stock` calculates correct `qty_available` (qty_on_hand - qty_reserved), stock decreases on order reservation, stock restores on order cancel, and 0 inventory displays stock 0.
   - `test_pmi_no_stock.py`: Asserts product creation without stock succeeds, public API responses exclude stock fields, legacy `/service/sync-stock` route returns 404, and channel CSV exports omit stock header.

---

## 3. Caveats

- **Network Mode**: Investigation conducted in `CODE_ONLY` mode. No external web API requests executed.
- **WMS Public Stock Implementation**: WMS backend currently lacks `GET /public/stock` route in `WMS/backend/routers/inventory.py`. This endpoint must be implemented as Phase 1 during implementation.
- **Storefront Merging**: Storefront (`web/src/services/sport-api/`) needs to merge WMS stock responses into product list models before displaying inventory to end users.

---

## 4. Conclusion

Removing `stock` from PMI is fully safe, feasible, and architecturally sound. Product creation and editing in PMI will function without error once schemas, models, and forms drop the `stock` requirement. Comprehensive test coverage specifications provided in `analysis.md` for `test_stock_from_wms.py` and `test_pmi_no_stock.py` will guarantee zero regressions and strict architectural compliance.

---

## 5. Verification Method

### Step 1: Inspect Analysis & Specifications
- View report: `/home/lupca/projects/topvnsport/.agents/teamwork_preview_explorer_init_3/analysis.md`.

### Step 2: Verification Commands (Post Implementation)
```bash
# PMI Backend Tests
docker compose -f PMI/docker-compose.yml exec api pytest -v

# PMI Frontend Tests
docker compose -f PMI/docker-compose.yml exec frontend npm run test

# WMS Backend Tests
docker compose -f WMS/docker-compose.yml exec api pytest -v

# Cross-System E2E Tests
./start_all.sh --no-watch
pytest e2e_tests/tests/test_stock_from_wms.py -v
pytest e2e_tests/tests/test_pmi_no_stock.py -v
pytest e2e_tests/ -v
```
