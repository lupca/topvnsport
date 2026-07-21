# Handoff Report: Requirement R1 - WMS Public API for Stock Investigation

## 1. Observation

### Codebase Locations & Artifacts Verified
- **WMS Models**: `/home/lupca/projects/topvnsport/WMS/backend/models.py`
  - `Warehouse` (lines 6-17): `id`, `code`, `name`, `address`, `is_active`.
  - `Location` (lines 20-36): `id`, `warehouse_id`, `location_code`, `zone`, `aisle`, `rack`, `shelf`, `type`, `is_active`.
  - `Inventory` (lines 39-57): `id`, `sku_code`, `product_name`, `location_id`, `qty_on_hand`, `qty_reserved`, `updated_at`, `qty_available` property. Unique constraint `uq_inventory_sku_location`.
  - `StockTransaction` (lines 166-177): Log of inventory adjustments, transfers, reservations, shipments.
- **Existing Inventory Routers**: `/home/lupca/projects/topvnsport/WMS/backend/routers/inventory.py`
  - `GET /inventory` (lines 11-13): Returns `db.query(models.Inventory).all()`.
  - `POST /inventory/adjust` (lines 21-50): Modifies `qty_on_hand` for a location.
  - `POST /inventory/transfer` (lines 59-92): Moves `qty_on_hand` between locations.
- **Main App & Auth**: `/home/lupca/projects/topvnsport/WMS/backend/main.py`
  - All routers currently registered with `dependencies=[Depends(get_current_user)]` (lines 87-92).
  - Auth helper `/home/lupca/projects/topvnsport/WMS/backend/utils/auth.py`: Provides `get_current_user` (strict 401) and `get_optional_user` (returns None on unauth).
- **OMS Consumer Code**: `/home/lupca/projects/topvnsport/OMS/backend/main.py`
  - `_fetch_inventory_snapshot` (lines 164-230): Fetches `GET /warehouses`, `GET /inventory`, `GET /locations` and aggregates stock per warehouse in Python code.

---

## 2. Logic Chain

1. **Storage Structure**: Stock is modeled in `models.Inventory` at the per-`(sku_code, location_id)` level. `Location` is linked to `Warehouse`.
2. **Current Metric Calculation**: `qty_available` is defined dynamically per record as `qty_on_hand - qty_reserved`.
3. **Current Aggregation**: Aggregation across locations or warehouses does not exist in WMS DB queries. Aggregating stock currently requires loading all location inventory rows and summing `qty_available` for each SKU.
4. **Current API Limitations**:
   - `GET /inventory` returns all un-aggregated inventory rows across all locations without filtering (`sku_code` filter parameter does not exist).
   - Global auth dependency `get_current_user` blocks public/unauthenticated access to `/inventory`.
5. **Requirement Gap (R1)**:
   - External clients (e-commerce channels, OMS, storefronts) require an endpoint to query aggregated available stock by SKU (multi-SKU query) across all locations without mandatory user authentication.
   - Introducing `GET /public/stock` or `POST /public/stock/query` with server-side SQL `GROUP BY sku_code` solves performance overhead, eliminates $O(N)$ DB dumps, and provides a public stock API.

---

## 3. Caveats
- No code changes were made to source files (investigation was read-only).
- Existing automated test suite in `WMS/backend/test_main.py` requires setting `DATABASE_URL` (SQLite) and providing auth headers (or disabling router auth in test fixtures) to execute cleanly.
- PMI/OMS integration points will need updating once the implementer adds the new `/public/stock` route.

---

## 4. Conclusion
- Current WMS backend has **no public stock query endpoint** and **no aggregated stock query endpoint**.
- Stock availability is stored granularly per location (`Inventory.qty_on_hand - Inventory.qty_reserved`).
- A new endpoint (`GET /public/stock` or `POST /public/stock/query`) is needed to support multi-SKU queries aggregated across locations/warehouses with public/optional-user authentication.

---

## 5. Verification Method

To independently verify these findings:
1. Inspect `WMS/backend/models.py` lines 39-57 using `view_file` to confirm `Inventory` schema and `@property def qty_available`.
2. Inspect `WMS/backend/routers/inventory.py` lines 11-13 to confirm `GET /inventory` lacks filtering parameters and return aggregation.
3. Inspect `WMS/backend/main.py` lines 87-92 to confirm all inventory routes require `Depends(get_current_user)`.
4. Inspect `OMS/backend/main.py` lines 164-230 to confirm OMS currently pulls the full database via `GET /inventory` and aggregates in memory.
5. Comprehensive analysis report is documented at `/home/lupca/projects/topvnsport/.agents/teamwork_preview_explorer_init_1/analysis.md`.
