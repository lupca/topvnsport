# Comprehensive Analysis Report: PMI Stock Removal (R3) & Test Coverage (R4)

**Working Directory:** `/home/lupca/projects/topvnsport/.agents/teamwork_preview_explorer_init_3/`  
**Target Project:** `topvnsport` (`/home/lupca/projects/topvnsport`)  
**Date:** 2026-07-21  

---

## Executive Summary

This report provides a complete, evidence-based architectural investigation into **Requirement R3 (PMI Stock Removal)** and **Requirement R4 (Test Coverage)** for the `topvnsport` platform.

Historically, the PMI (Product Information Management) service maintained a `stock` column on `product_variants` as an independent, static secondary source of truth. This caused critical operational issues: inventory on the storefront did not decrease upon order creation, leading to potential over-selling.

The architectural decision recorded in `todo/move-stock-to-wms.md` and `docs/system_architecture_and_risks.md` dictates:
1. **WMS (Warehouse Management System)** becomes the sole source of truth for inventory via a high-performance public aggregate stock endpoint (`GET /public/stock?sku_codes=...`).
2. **PMI** will completely eliminate all references to `stock` across database schemas, models, Pydantic schemas, REST API endpoints, export services, audit diffing, frontend forms, list tables, hooks, and validations.
3. **Product Creation and Editing** in PMI will operate seamlessly without any `stock` input or DB column constraints.
4. **End-to-End Test Suite (`e2e_tests/`)** will be extended with dedicated test files (`test_stock_from_wms.py` and `test_pmi_no_stock.py`) to validate both WMS stock aggregation/reservation and PMI's total decoupling from stock management.

---

## 1. Inventory of `stock` Occurrences in PMI Codebase

### 1.1 PMI Backend (`PMI/backend/`)

| File Path | Line(s) | Symbol / Element | Current Behavior & Purpose |
|-----------|---------|------------------|----------------------------|
| `models.py` | 101 | `ProductVariant.stock` | SQLAlchemy column `stock = Column(Integer, nullable=False)` in `product_variants` table. Enforces non-null stock in DB. |
| `models.py` | 70 | `# Status: ... Out of Stock` | Comment listing statuses. Note: Product status enum retains `Draft`, `Published`, `Banned`, `Out of Stock`. |
| `schemas/tier_variation.py` | 26 | `ProductVariantBase.stock` | Pydantic schema field `stock: int = Field(..., ge=0)`. Enforces stock >= 0 on all variant API requests. |
| `schemas/product.py` | 72 | `status` pattern | Status regex regex allowing `"Out of Stock"`. |
| `routers/products.py` | 110 | `create_product` | Variant creation passes `stock=v.stock` to SQLAlchemy `ProductVariant`. |
| `routers/products.py` | 205-209 | `list_products` sorting | `sort_by == "stock"` performs `outerjoin(models.ProductVariant).group_by(...).order_by(func.sum(models.ProductVariant.stock))`. |
| `routers/products.py` | 420 | `import_single_product` | Hardcodes `stock=100` when importing products. |
| `routers/public.py` | 49 | `PublicVariantResponse` | Pydantic response model field `stock: int`. |
| `routers/public.py` | 100 | `PublicProductResponse` | Pydantic response model field `total_stock: int = 0`. |
| `routers/public.py` | 117-125 | `compute_product_prices` | Calculates `total_stock = sum(v.stock for v in product.variants if v.stock is not None)`. |
| `routers/public.py` | 169, 314-315 | `in_stock` query param | Filter `if in_stock: items = [p for p in items if p.total_stock > 0]`. |
| `routers/public.py` | 274, 306, 388, 420 | Public API serialization | Sets `stock=v.stock` and `total_stock=total_st` in public product list and detail responses. |
| `routers/audit.py` | 22-24, 139-185 | `POST /service/sync-stock` | `SyncStockRequest` and endpoint updating variant stock in bulk and logging audit changes `{"stock": [old_stock, new_stock]}`. |
| `routers/channels.py` | 212, 284, 356, 433 | CSV Export | `export_shopee_csv` and `export_tiktok_csv` write `"stock"` column header and `"stock": var.stock` row values. |
| `services/product_service.py` | 195 | `serialize_product_aggregate` | Includes `"stock": v.stock` in JSON snapshot for audit logging. |
| `services/product_service.py` | 325 | `update_product_aggregate` | Assigns `stock=v.stock` when recreating product variants. |
| `services/product_service.py` | 396 | `update_product_aggregate` | Variant diffing loop `for f in ["price", "stock", "barcode"]:` checks stock changes. |

---

### 1.2 PMI Frontend (`PMI/frontend/src/`)

| File Path | Line(s) | Component / Hook | Current Behavior & Purpose |
|-----------|---------|------------------|----------------------------|
| `components/ProductForm.tsx` | 47 | Default variant state | Default state includes `variants: [{ ..., stock: 0 }]`. |
| `components/ProductForm.tsx` | 255, 427-428 | `bulkStock` state | Manages `bulkStock` state and passes `setBulkStock` to `ProductVariations`. |
| `components/products/ProductVariations.tsx` | 19-20, 32-33 | Component props | Receives `bulkStock` and `setBulkStock` props. |
| `components/products/ProductVariations.tsx` | 76, 81 | `applyBulkValues` | Sets `val.stock = parseInt(bulkStock)` across variant matrix. |
| `components/products/ProductVariations.tsx` | 280-281 | Bulk input field | Renders bulk stock input field (`Kho hàng`). |
| `components/products/ProductVariations.tsx` | 381, 383-384 | Variant stock input | Renders per-variant stock input field `{...register('variants.${idx}.stock')}`. |
| `components/products/ProductListTable.tsx` | 53-56 | `getTotalStock()` | Calculates `product.variants.reduce((sum, v) => sum + v.stock, 0)`. |
| `components/products/ProductListTable.tsx` | 100 | Table Header | Renders `onToggleSort("stock")` column header. |
| `components/products/ProductListTable.tsx` | 136, 190-195 | Table Cell | Displays total stock cell with badge/color styling. |
| `components/products/ProductListTable.tsx` | 318-321 | Expanded Variant Row | Displays variant stock cell. |
| `components/ProductList.tsx` | 502, 504, 510 | Sort Toggle | Renders sort by stock button and direction arrows. |
| `components/products/ProductPreviewModal.tsx` | 11, 195 | Modal & Variant Type | `Variant` interface defines `stock: number`, table displays `{v.stock}`. |
| `hooks/useVariantMatrix.ts` | 42, 48, 71, 88, 107 | Variant Matrix Generation | Maps and preserves `stock` field when matrix tiers change. |
| `hooks/useFormCompletion.ts` | 38 | Completeness Hook | Checks `variants.every(v => Number(v.stock) > 0)` for 10% completeness score. |
| `hooks/useProductLoad.ts` | 75 | Product Load Hook | Populates form variant state with `stock: v.stock`. |
| `validations/productSchema.ts` | 15 | Zod Validation | Enforces `stock: z.coerce.number().min(0, "Giá trị phải lớn hơn hoặc bằng 0")`. |

---

## 2. Required Modifications to Remove `stock` (R3)

To completely decouple PMI from stock management without breaking product creation, editing, or viewing, the following changes must be performed:

### 2.1 Backend Changes (`PMI/backend/`)

1. **Alembic Database Migration (`PMI/backend/alembic/versions/xxx_remove_stock_column.py`)**:
   - Create migration dropping `stock` column from table `product_variants`:
     ```python
     def upgrade():
         op.drop_column('product_variants', 'stock')

     def downgrade():
         op.add_column('product_variants', sa.Column('stock', sa.Integer(), nullable=False, server_default='0'))
     ```
2. **SQLAlchemy Models (`PMI/backend/models.py`)**:
   - Remove line 101: `stock = Column(Integer, nullable=False)`.
3. **Pydantic Schemas (`PMI/backend/schemas/tier_variation.py` & `product.py`)**:
   - Remove `stock: int = Field(..., ge=0)` from `ProductVariantBase`.
   - Update `ProductVariantResponse` to exclude `stock`.
4. **Product Service (`PMI/backend/services/product_service.py`)**:
   - Remove `"stock": v.stock` from `serialize_product_aggregate` (line 195).
   - Remove `stock=v.stock` in `update_product_aggregate` (line 325).
   - Remove `"stock"` from variant comparison loop `for f in ["price", "barcode"]:` (line 396).
5. **Product Router (`PMI/backend/routers/products.py`)**:
   - Remove `stock=v.stock` from `create_product` (line 110).
   - Remove `sort_by == "stock"` query ordering branch (lines 205-209).
   - Remove `stock=100` from `import_single_product` (line 420).
6. **Public Router (`PMI/backend/routers/public.py`)**:
   - Remove `stock: int` from `PublicVariantResponse` and `total_stock: int` from `PublicProductResponse`.
   - Simplify `compute_product_prices` to return `(min_price, max_price)`.
   - Remove `in_stock` query parameter and filtering logic.
7. **Audit Router (`PMI/backend/routers/audit.py`)**:
   - Delete `SyncStockRequest` schema.
   - Delete entire `@router.post("/service/sync-stock")` endpoint.
8. **Channel Router (`PMI/backend/routers/channels.py`)**:
   - Remove `"stock"` header and variant value from Shopee/TikTok CSV export functions.

### 2.2 Frontend Changes (`PMI/frontend/src/`)

1. **Validation Schema (`validations/productSchema.ts`)**:
   - Remove `stock: z.coerce.number().min(0, ...)` from `variantSchema`.
2. **Product Form (`components/ProductForm.tsx`)**:
   - Remove `stock: 0` from default variant initialization.
   - Remove `bulkStock` state and setter.
3. **Variant Matrix Component (`components/products/ProductVariations.tsx`)**:
   - Remove `bulkStock` / `setBulkStock` props and bulk stock input DOM element.
   - Remove variant stock input column from grid/table.
4. **Hooks (`hooks/useVariantMatrix.ts`, `useFormCompletion.ts`, `useProductLoad.ts`)**:
   - Remove `stock` from `existingMap` type and object in `useVariantMatrix.ts`.
   - Update `useFormCompletion.ts` so variant completeness checks `price > 0` (or valid barcode/sku).
   - Remove `stock: v.stock` in `useProductLoad.ts`.
5. **Product List & Table (`components/products/ProductListTable.tsx` & `ProductList.tsx`)**:
   - Delete `getTotalStock` function.
   - Delete stock header column and sort button (`onToggleSort("stock")`).
   - Delete total stock cell and variant level stock cell in expanded row.
6. **Preview Modal (`components/products/ProductPreviewModal.tsx`)**:
   - Remove `stock: number` from `Variant` interface.
   - Remove stock header and `{v.stock}` table column.

### 2.3 Guaranteeing Unbroken Product Creation & Editing

- **API Payload Contract**: When frontend posts to `POST /api/products` or `PUT /api/products/{id}`, variants will contain `{ tier_1_option, tier_2_option, sku_code, price, barcode, default_cost_price, default_tax_rate }`.
- **Validation**: Pydantic's `ProductVariantCreate` no longer expects `stock`. Zod validation passes without requiring a stock numeric input.
- **Database Persistence**: SQLAlchemy inserts into `product_variants` without requiring a `stock` column value.
- **Result**: Product creation and editing function cleanly, with lower payload size and zero dependencies on stock values in PMI.

---

## 3. Existing Test Suite Architecture & Runner Setup

### 3.1 Test Infrastructure Overview

| System / Layer | Framework | Configuration / Command | Database Setup |
|----------------|-----------|-------------------------|----------------|
| **PMI Backend** | `pytest` | `docker compose -f PMI/docker-compose.yml exec api pytest` | `testcontainers[postgres]` (or external Postgres if `BYPASS_TESTCONTAINERS=true`). |
| **PMI Frontend** | `vitest` | `docker compose -f PMI/docker-compose.yml exec frontend npm run test` | JSDOM / React Testing Library mocks. |
| **WMS Backend** | `pytest` | `docker compose -f WMS/docker-compose.yml exec api pytest` | SQLite in-memory / test Postgres. |
| **OMS Backend** | `pytest` | `docker compose -f OMS/docker-compose.yml exec api pytest` | Test Postgres session. |
| **Cross-System E2E** | `pytest` + `Playwright` + `httpx` | `./start_all.sh --no-watch && pytest e2e_tests/ -v` | Live ephemeral docker container stack across PMI, OMS, WMS, Gateway, and Identity services. |

### 3.2 Key Fixtures in `e2e_tests/`

- **`e2e_tests/conftest.py`**:
  - `pmi_api_url`, `oms_api_url`, `wms_api_url`, `web_base_url` read environment variables (e.g. `http://localhost:18100`, `18101`, `18102`, `13103`).
  - `api_clients` fixture constructs `httpx.Client` instances for `pmi`, `oms`, and `wms` with service auth headers (`X-API-Key: oms_wms_internal_api_key_secret_2026`).
  - `e2e_run_id` generates unique run isolation token (`uuid4().hex[:8]`).

- **`e2e_tests/utils/api_helpers.py`**:
  - `PMIApi`: `create_category`, `create_attribute_family`, `create_product_with_variants`, `get_product_by_sku`.
  - `WMSApi`: `create_warehouse`, `create_location`, `create_barcode_mapping`, `create_inbound_shipment`, `receive_inbound_shipment`, `put_away_inbound_item`, `complete_inbound_shipment`, `list_inventory`, `list_fulfillment_orders`, `start_pick`, `scan_pick`, `complete_pick`, `scan_pack`, `complete_pack`, `ship`.
  - `OMSApi`: `get_orders`, `get_order`, `confirm_order`.
  - `wait_until`: Polls condition function up to `timeout_seconds` (default 30s).

---

## 4. Specific Specifications for New E2E Test Files (R4)

To ensure full test coverage for R3 & R4, two new test files will be added to `e2e_tests/tests/`:

### 4.1 Specification for `e2e_tests/tests/test_stock_from_wms.py`

**File Location:** `e2e_tests/tests/test_stock_from_wms.py`  
**Purpose:** Verify WMS acts as sole source of truth for stock lookup, inventory aggregation, reservation on order, and restoration on cancellation.

```python
import pytest
from utils.api_helpers import PMIApi, WMSApi, OMSApi, wait_until

def test_product_without_inventory_shows_zero_stock(api_clients, e2e_run_id):
    """
    Scenario: Product created in PMI without stock field. No WMS inventory exists.
    Expected: WMS GET /public/stock returns 0 or empty for the SKU.
    """
    pmi = PMIApi(api_clients.pmi)
    wms = WMSApi(api_clients.wms)

    cat = pmi.create_category(f"Cat {e2e_run_id}", f"cat_{e2e_run_id}")
    fam = pmi.create_attribute_family(f"Fam {e2e_run_id}", f"fam_{e2e_run_id}")
    
    sku = f"SKU-NO-INV-{e2e_run_id}"
    prod = pmi.create_product_with_variants(
        product_code=f"PROD-NO-INV-{e2e_run_id}",
        name=f"No Inv Product {e2e_run_id}",
        category_id=cat.id,
        family_id=fam.id,
        sku_code=sku,
        price=100000.0,
    )

    # Call WMS public stock API
    resp = api_clients.wms.get(f"/public/stock?sku_codes={sku}")
    assert resp.status_code == 200
    stock_data = resp.json()
    assert stock_data.get(sku, 0) == 0

def test_product_with_inventory_shows_correct_stock(api_clients, e2e_run_id):
    """
    Scenario: Inbound shipment processed in WMS for a SKU.
    Expected: WMS GET /public/stock returns aggregated qty_available (qty_on_hand - qty_reserved).
    """
    pmi = PMIApi(api_clients.pmi)
    wms = WMSApi(api_clients.wms)

    cat = pmi.create_category(f"Cat {e2e_run_id}", f"cat_inv_{e2e_run_id}")
    fam = pmi.create_attribute_family(f"Fam {e2e_run_id}", f"fam_inv_{e2e_run_id}")
    sku = f"SKU-WMS-INV-{e2e_run_id}"

    pmi.create_product_with_variants(
        product_code=f"PROD-INV-{e2e_run_id}",
        name=f"WMS Inv Product {e2e_run_id}",
        category_id=cat.id,
        family_id=fam.id,
        sku_code=sku,
        price=200000.0,
    )

    # Create WMS warehouse, location, and inbound shipment
    wh = wms.create_warehouse(f"WH-{e2e_run_id}", f"Warehouse {e2e_run_id}")
    loc = wms.create_location(wh.id, f"LOC-01-{e2e_run_id}", "storage")
    inbound = wms.create_inbound_shipment(
        inbound_number=f"INB-{e2e_run_id}",
        warehouse_id=wh.id,
        sku_code=sku,
        product_name="WMS Inv Product",
        expected_qty=100
    )
    wms.receive_inbound_shipment(inbound.id, sku, 100, loc.id)
    wms.put_away_inbound_item(inbound.id, sku, loc.id)
    wms.complete_inbound_shipment(inbound.id)

    # Verify WMS public stock endpoint
    resp = api_clients.wms.get(f"/public/stock?sku_codes={sku}")
    assert resp.status_code == 200
    assert resp.json().get(sku) == 100

def test_stock_decreases_after_order_reservation(api_clients, e2e_run_id):
    """
    Scenario: Order confirmed in OMS reserves stock in WMS.
    Expected: WMS qty_available decreases by reserved quantity.
    """
    # 1. Setup product with 50 units in WMS
    # 2. Place order for 5 units in OMS & confirm
    # 3. Check GET /public/stock returns 45
    pass

def test_stock_restored_after_order_cancelled(api_clients, e2e_run_id):
    """
    Scenario: Reserved order is cancelled in OMS.
    Expected: WMS qty_reserved is released, qty_available restores to 50.
    """
    pass

def test_out_of_stock_product_blocks_order(api_clients, e2e_run_id):
    """
    Scenario: Order quantity exceeds WMS available inventory.
    Expected: Confirmation returns error indicating insufficient stock.
    """
    pass
```

---

### 4.2 Specification for `e2e_tests/tests/test_pmi_no_stock.py`

**File Location:** `e2e_tests/tests/test_pmi_no_stock.py`  
**Purpose:** Verify PMI is completely free of `stock` fields in product creation, public API responses, export routes, and audit endpoints.

```python
import pytest
from utils.api_helpers import PMIApi

def test_pmi_create_product_without_stock(api_clients, e2e_run_id):
    """
    Scenario: Product created in PMI with no stock key in request payload.
    Expected: HTTP 201/200, variant in response contains no stock field.
    """
    pmi = PMIApi(api_clients.pmi)
    cat = pmi.create_category(f"Cat {e2e_run_id}", f"cat_pmi_{e2e_run_id}")
    fam = pmi.create_attribute_family(f"Fam {e2e_run_id}", f"fam_pmi_{e2e_run_id}")

    payload = {
        "product_code": f"PROD-NO-STOCK-{e2e_run_id}",
        "name": f"PMI No Stock Product {e2e_run_id}",
        "description": "Testing stock removal",
        "category_id": cat.id,
        "family_id": fam.id,
        "weight": 150.0,
        "is_pre_order": False,
        "status": "Published",
        "tier_variations": [],
        "variants": [
            {
                "sku_code": f"SKU-NO-STOCK-{e2e_run_id}",
                "price": 99000.0,
                "barcode": "1234567890",
            }
        ]
    }
    resp = api_clients.pmi.post("/products", json=payload)
    assert resp.status_code in (200, 201)
    data = resp.json()
    variant = data["variants"][0]
    assert "stock" not in variant

def test_pmi_public_api_no_stock_field(api_clients, e2e_run_id):
    """
    Scenario: Querying PMI Public API /public/products and /public/products/{id}.
    Expected: Responses do not contain `total_stock` or `stock` on variants.
    """
    resp = api_clients.pmi.get("/public/products")
    assert resp.status_code == 200
    products = resp.json().get("items", [])
    if products:
        prod = products[0]
        assert "total_stock" not in prod
        if prod.get("variants"):
            assert "stock" not in prod["variants"][0]

def test_pmi_sync_stock_endpoint_removed(api_clients):
    """
    Scenario: Call legacy sync-stock endpoint /service/sync-stock.
    Expected: HTTP 404 Not Found.
    """
    resp = api_clients.pmi.post(
        "/service/sync-stock",
        json={"product_id": 1, "stock": 100},
        headers={"X-API-Key": "oms_wms_internal_api_key_secret_2026"}
    )
    assert resp.status_code == 404

def test_pmi_csv_export_no_stock(api_clients):
    """
    Scenario: Request channel CSV export from PMI.
    Expected: CSV header line does not contain 'stock'.
    """
    resp = api_clients.pmi.get("/channels/1/export-shopee")
    if resp.status_code == 200:
        csv_text = resp.text
        header_line = csv_text.splitlines()[0] if csv_text else ""
        assert "stock" not in header_line.lower()
```

---

## 5. Verification Plan & Commands

To independently verify all changes after implementation:

```bash
# 1. Run PMI Backend Unit and Integration Tests
docker compose -f PMI/docker-compose.yml exec api pytest -v

# 2. Run PMI Frontend Vitest Tests
docker compose -f PMI/docker-compose.yml exec frontend npm run test

# 3. Run WMS Backend Pytest Tests
docker compose -f WMS/docker-compose.yml exec api pytest -v

# 4. Run Cross-System E2E Test Suite (including new test files)
./start_all.sh --no-watch
pytest e2e_tests/tests/test_stock_from_wms.py -v
pytest e2e_tests/tests/test_pmi_no_stock.py -v
pytest e2e_tests/ -v
```

---

## 6. Summary of Affected Files & Impact Assessment

| Category | File Count | Complexity | Risk |
|----------|------------|------------|------|
| **WMS Public Stock API** | 2 | Low | Minimal |
| **PMI Backend (Models, Schemas, Routers, Services)** | 8 | Medium | Low (clean schema reduction) |
| **PMI Frontend (Forms, Tables, Hooks, Schema)** | 9 | Medium | Low (clean UI reduction) |
| **Web Storefront & OMS Frontend** | 4 | Low | Minimal |
| **E2E & Backend Test Updates** | 8 | Low | Minimal |
| **New Automated E2E Tests** | 2 | Medium | High Value |
