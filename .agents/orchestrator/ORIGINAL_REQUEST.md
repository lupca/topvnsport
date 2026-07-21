# Original User Request

## 2026-07-21T15:28:24+07:00

Refactor the system to move inventory (stock) management completely from PMI to WMS, preventing over-selling by ensuring the storefront fetches live stock from WMS.

Working directory: /home/lupca/projects/topvnsport
Integrity mode: development

## Requirements

### R1. WMS Public API for Stock
WMS must expose a public API endpoint to check aggregated stock availability by SKU across all locations.

### R2. Web Storefront Integration
The frontend web storefront must be updated to fetch stock directly from WMS instead of relying on PMI, and gracefully handle out-of-stock scenarios.

### R3. PMI Stock Removal
The `stock` field and related logic must be completely removed from the PMI backend (database schemas, API responses, exports, services) and PMI frontend (forms, tables, views).

### R4. Test Coverage
Ensure E2E tests, WMS integration tests, and PMI unit tests are updated or newly written to verify stock aggregation and the removal of legacy stock logic.

## Acceptance Criteria

### Objective Verification
- [ ] Calling the WMS public stock API with multiple SKUs returns the correct aggregated available stock.
- [ ] Web storefront correctly displays live stock from WMS and disables variants when out of stock.
- [ ] Creating and editing products in PMI succeeds without any stock field input.
- [ ] Running `pytest e2e_tests/tests/test_stock_from_wms.py` and `test_pmi_no_stock.py` passes successfully.
