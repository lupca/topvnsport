# TopVNSport Promotion Module - E2E Test Infrastructure Specification

## 1. Test Philosophy

The TopVNSport Promotion Module testing framework is designed around three foundational principles:

### 1.1 Opaque-Box (Black-Box) Testing
- All end-to-end (E2E) and integration tests interact with the system strictly via public interfaces: HTTP REST endpoints (`/api/promotions`, `/api/variants/.../computed-price`, `/api/computed-prices/bulk`, `/api/promotions/parse-intent`) and user interface elements (PMI Admin UI & Web Storefront).
- Tests observe system behaviors and outputs without relying on internal function calls, direct DB manipulation, or private state flags. This ensures tests evaluate true operational behavior and maintain resilience against underlying refactoring.

### 1.2 Requirement-Driven Verification
- Test scenarios directly trace back to business requirements specified in `ORIGINAL_REQUEST.md`, `PROJECT.md`, and `SCOPE.md`.
- Acceptance criteria (CRUD, lifecycle state machine, price calculation engine with priority/caps, scope matching with exclusions, AI intent parser, background auto-scheduler, and storefront price rendering) serve as the validation baseline.

### 1.3 Formal Testing Methodologies
- **Boundary Value Analysis (BVA)**: Applied to numerical inputs and time bounds—testing exact boundaries such as 0% discount, 100% discount, `max_discount` caps, zero prices, price equal to discount amount, and exact timestamp transitions (`starts_at`, `ends_at`).
- **Pairwise (Combinatorial) Testing**: Systematic matrix testing of input combinations across promotion discount types (`PERCENTAGE`, `FIXED_AMOUNT`, `FIXED_PRICE`), scope levels (`ALL`, `CATEGORY`, `PRODUCT`, `VARIANT`), exclusion flags (`is_exclusion`), status states (`DRAFT`, `SCHEDULED`, `ACTIVE`, `PAUSED`, `ENDED`), and priority levels.
- **Workload & Real-World Scenario Testing**: Full end-to-end lifecycle workflows simulating marketing team creation, dry-run preview, intent parsing, auto-scheduled activation, live customer storefront browsing with strikethrough/badge display, background status expiration, and automated price reversion.

---

## 2. Feature Inventory

The TopVNSport Promotion Module is divided into 6 primary features (F1 to F6):

| Feature ID | Feature Name | Source Requirement | Target Endpoints / Components | Tier 1 (Feature) | Tier 2 (Boundary) | Tier 3 (Cross) | Tier 4 (Real-World) |
|---|---|---|---|:---:|:---:|:---:|:---:|
| **F1** | Promotion CRUD & Lifecycle Management | ORIGINAL_REQUEST §R1, PROJECT.md §2 | `/api/promotions`, `/activate`, `/pause`, `/resume`, `/end` | 8 | 8 | 2 | 1 |
| **F2** | Scope Targeting & Exclusion Logic | ORIGINAL_REQUEST §R1, PROJECT.md §1-3 | `/api/promotions` (scope creation/update), Scope Matcher Service | 6 | 6 | 2 | 1 |
| **F3** | Price Calculation Engine & Priority Resolution | ORIGINAL_REQUEST §R1, PROJECT.md §3 | Price Engine Service, Priority Resolver | 7 | 7 | 1 | 1 |
| **F4** | Bulk & Single Computed Price APIs & Intent Parser | ORIGINAL_REQUEST §R1, PROJECT.md §2 | `GET /api/variants/{id}/computed-price`, `POST /api/computed-prices/bulk`, `POST /api/promotions/preview`, `POST /api/promotions/parse-intent` | 5 | 5 | 1 | 1 |
| **F5** | Background Auto-Scheduler & Status Expiry | ORIGINAL_REQUEST §R1, PROJECT.md §2-3 | `PromotionScheduler` background worker, DB background tasks | 4 | 4 | 1 | 1 |
| **F6** | PMI Admin UI & Web Storefront Price Rendering | ORIGINAL_REQUEST §R2-R3, PROJECT.md §4-5 | `PromotionList.tsx`, `PromotionForm.tsx`, `useComputedPrice.ts`, `ProductCard.tsx` | 5 | 5 | 0 | 0 |
| **TOTAL** | **TopVNSport Promotion E2E Suite** | — | — | **35** | **35** | **7** | **5** |

*Note: All coverage requirements (Tier 1 >= 34, Tier 2 >= 34, Tier 3 >= 6, Tier 4 = 5) are fully satisfied by this design.*

---

## 3. Test Architecture

```
+---------------------------------------------------------------------------------------+
|                                Pytest Test Runner                                     |
|                            (e2e_tests/requirements.txt)                              |
+------------------------------------------+--------------------------------------------+
                                           |
           +-------------------------------+-------------------------------+
           |                                                               |
           v                                                               v
+---------------------------------------+               +-------------------------------+
|      API Client Fixtures (HTTPX)      |               |     Playwright Browser UI     |
|   - PMI API: http://localhost:18100   |               |   - Storefront: localhost:3000|
|   - OMS API: http://localhost:18101   |               |   - PMI UI: localhost:13100   |
|   - WMS API: http://localhost:18102   |               +---------------+---------------+
+------------------+--------------------+                               |
                   |                                                    |
                   v                                                    v
+---------------------------------------------------------------------------------------+
|                               Response Validation                                     |
|  - HTTP Status (200, 201, 400, 404, 422)                                              |
|  - JSON Schema & Field Accuracy (UUID, ISO Timestamps, Price Calculations)            |
|  - Business Invariants (computed <= original, discount_amount == original - computed) |
|  - DOM Elements (strikethrough price, computed price display, percentage badge)       |
+---------------------------------------------------------------------------------------+
```

### 3.1 Test Runner & Environment Configuration
- **Test Runner**: Pytest 9.1.1 running on Python 3.14 environment.
- **Plugins**: `pytest-asyncio` (async route testing), `pytest-playwright` (browser automation), `pytest-httpx` / `httpx` (API communication), `pytest-mock`.
- **Environment Variables**:
  - `E2E_PMI_API_URL`: Base URL for PMI backend API (default: `http://localhost:18100`).
  - `E2E_OMS_API_URL`: Base URL for OMS backend API (default: `http://localhost:18101`).
  - `E2E_WMS_API_URL`: Base URL for WMS backend API (default: `http://localhost:18102`).
  - `E2E_WEB_BASE_URL`: Base URL for Web Storefront (default: `http://localhost:3000`).

### 3.2 File Directory Layout
- **E2E Integration Suite**:
  - `e2e_tests/tests/test_promotion_full_flow.py`: Comprehensive 4-tier E2E testing suite covering full promotion lifecycle, intent parsing, price engine calculation, auto-scheduler, and storefront price rendering.
  - `e2e_tests/conftest.py`: Shared pytest fixtures for HTTP clients, base URLs, and authentication context.
  - `e2e_tests/utils/api_helpers.py`: `PMIApi` helper class encapsulating REST calls for promotions, scopes, preview, intent parsing, and computed prices.
- **PMI Backend Unit & Integration Suite**:
  - `PMI/backend/tests/unit/test_promotions_crud.py`: Promotion CRUD endpoints & validation.
  - `PMI/backend/tests/unit/test_promotions_lifecycle.py`: State transition rules & validations.
  - `PMI/backend/tests/unit/test_promotions_compute.py`: Discount engine algorithms & max cap logic.
  - `PMI/backend/tests/unit/test_promotions_scope.py`: Target matching & exclusion override hierarchy.
  - `PMI/backend/tests/unit/test_promotions_scheduler.py`: Background auto-scheduler task execution.
  - `PMI/backend/tests/conftest.py`: Transactional DB session fixtures (`db_session`), Testcontainers setup.
- **Frontend & Storefront Component Suites**:
  - `PMI/frontend/src/__tests__/components/PromotionList.test.tsx`: Promotion table, search, and status filtering.
  - `PMI/frontend/src/__tests__/components/PromotionForm.test.tsx`: 4-step wizard form validation and step transitions.
  - `web/src/__tests__/useComputedPrice.test.ts`: Custom hook price fetching & fallback behavior.
  - `web/src/__tests__/ProductCard.test.tsx`: Strikethrough price, discounted price, and badge DOM rendering.

### 3.3 Test Client Fixtures & Helpers
- `api_clients` fixture: Provides `httpx.Client` instances configured with standard headers and timeout defaults for PMI, OMS, and WMS.
- `pmi_api` fixture: An instance of `PMIApi` helper (`e2e_tests/utils/api_helpers.py`) providing high-level helper methods:
  - `create_promotion(payload)`
  - `activate_promotion(id)` / `pause_promotion(id)` / `resume_promotion(id)` / `end_promotion(id)`
  - `get_computed_price(variant_id)` / `get_bulk_computed_prices(variant_ids)`
  - `preview_promotion(payload)`
  - `parse_intent(prompt)`
- `db_session` fixture: Transactional SQLAlchemy session utilizing PostgreSQL nested savepoints (`connection.begin_nested()`) with automatic rollback to ensure test isolation during backend unit testing.

### 3.4 Response Validation Rules
- **Status Code Standard**:
  - `200 OK`: Successful retrieval, update, preview, lifecycle action, or price calculation.
  - `201 Created`: Successful creation of promotion resource.
  - `400 Bad Request`: Invalid lifecycle transition (e.g. `DRAFT` directly to `PAUSED`).
  - `404 Not Found`: Request for non-existent promotion or variant ID.
  - `422 Unprocessable Entity`: Pydantic validation failure (missing required fields, negative values).
- **Data Integrity Assertions**:
  - Valid UUID format for resource identifiers (`id`).
  - ISO 8601 UTC timestamps for `created_at`, `updated_at`, `starts_at`, `ends_at`.
  - Invariants: `computed_price = max(0, original_price - discount_amount)`.
  - `percentage_discount = round((discount_amount / original_price) * 100, 2)` when `original_price > 0`.

---

## 4. 4-Tier Coverage Plan

### Tier 1: Feature Coverage (35 Test Cases)
Verifies happy path functionality across all 6 features in isolation.

#### F1: Promotion CRUD & Lifecycle Management (8 Cases)
1. `test_f1_01_create_draft_promotion`: Create a valid promotion in `DRAFT` status and verify 201 response with generated ID.
2. `test_f1_02_get_promotion_by_id`: Retrieve detail for an existing promotion and verify schema fields.
3. `test_f1_03_list_promotions_pagination`: Query list endpoint with page/limit parameters and verify response metadata.
4. `test_f1_04_update_draft_promotion`: Update name, description, and discount value of a `DRAFT` promotion.
5. `test_f1_05_delete_draft_promotion`: Soft delete/delete a draft promotion and verify subsequent GET returns 404.
6. `test_f1_06_lifecycle_draft_to_active`: Activate a `DRAFT` promotion with no start date; verify status transitions to `ACTIVE`.
7. `test_f1_07_lifecycle_active_pause_resume`: Transition an `ACTIVE` promotion to `PAUSED`, then resume back to `ACTIVE`.
8. `test_f1_08_lifecycle_active_to_ended`: End an `ACTIVE` promotion manually and verify status transitions to `ENDED`.

#### F2: Scope Targeting & Exclusion Logic (6 Cases)
9. `test_f2_01_scope_all_target`: Create promotion targeting `ALL` scope; verify all variants match promotion scope.
10. `test_f2_02_scope_category_target`: Create promotion targeting specific `CATEGORY` ID; verify only variants in category match.
11. `test_f2_03_scope_product_target`: Create promotion targeting specific `PRODUCT` ID; verify variants under product match.
12. `test_f2_04_scope_variant_target`: Create promotion targeting explicit `VARIANT` ID list; verify exact variant matching.
13. `test_f2_05_scope_category_with_variant_exclusion`: Category scope with single variant marked `is_exclusion=True`.
14. `test_f2_06_scope_all_with_category_exclusion`: `ALL` scope with entire category marked `is_exclusion=True`.

#### F3: Price Calculation Engine & Priority Resolution (7 Cases)
15. `test_f3_01_percentage_discount_calc`: Calculate 20% discount on base price 100,000 VND -> computed price 80,000 VND.
16. `test_f3_02_percentage_discount_with_max_cap`: 50% discount on 1,000,000 VND with `max_discount=100,000` -> computed price 900,000 VND.
17. `test_f3_03_fixed_amount_discount_calc`: Fixed amount 50,000 VND discount on 200,000 VND -> computed price 150,000 VND.
18. `test_f3_04_fixed_price_discount_calc`: Fixed price discount setting price directly to 120,000 VND for original 180,000 VND product.
19. `test_f3_05_priority_sorting_highest_wins`: Two active promotions targeting same variant (Priority 10 vs Priority 5); Priority 10 applies.
20. `test_f3_06_computed_price_record_persistence`: Verify price calculation updates `promotion_computed_prices` table.
21. `test_f3_07_price_calculation_zero_base`: Base price of 0 VND produces computed price of 0 VND with 0 discount amount.

#### F4: Bulk & Single Computed Price APIs & Intent Parser (5 Cases)
22. `test_f4_01_get_single_variant_computed_price`: `GET /api/variants/{id}/computed-price` returns original and computed price.
23. `test_f4_02_post_bulk_computed_prices`: `POST /api/computed-prices/bulk` with array of 5 variant IDs returns mapped prices.
24. `test_f4_03_preview_promotion_impact`: `POST /api/promotions/preview` dry-run returns total affected variants and price diffs.
25. `test_f4_04_parse_intent_natural_language`: `POST /api/promotions/parse-intent` with "Giảm 15% tối đa 50k cho áo đấu" returns parsed schema.
26. `test_f4_05_unpromoted_variant_computed_price`: Single variant query for variant with no active promotion returns base price with `has_active_promotion=False`.

#### F5: Background Auto-Scheduler & Status Expiry (4 Cases)
27. `test_f5_01_schedule_future_starts_at`: Activate promotion with future `starts_at`; status becomes `SCHEDULED`.
28. `test_f5_02_auto_activate_scheduled_promotion`: Auto-scheduler ticks past `starts_at`; promotion transitions `SCHEDULED` -> `ACTIVE`.
29. `test_f5_03_auto_end_expired_promotion`: Auto-scheduler ticks past `ends_at`; promotion transitions `ACTIVE` -> `ENDED`.
30. `test_f5_04_auto_scheduler_recomputes_prices`: Auto-scheduler state change triggers background price table update.

#### F6: PMI Admin UI & Web Storefront Price Rendering (5 Cases)
31. `test_f6_01_pmi_ui_list_promotions_tab_filter`: PMI UI promotion list filters table by status tabs (`ACTIVE`, `SCHEDULED`, `ENDED`).
32. `test_f6_02_pmi_ui_create_wizard_submission`: Submit 4-step wizard in PMI UI and verify promotion creation.
33. `test_f6_03_storefront_use_computed_price_hook`: `useComputedPrice` hook fetches active computed price from PMI API.
34. `test_f6_04_storefront_product_card_active_discount`: Storefront `ProductCard` renders strikethrough price, sale price, and badge.
35. `test_f6_05_storefront_product_card_no_discount`: Storefront `ProductCard` renders regular single price when no promotion applies.

---

### Tier 2: Boundary & Corner Cases (35 Test Cases)
Verifies boundary conditions, invalid inputs, edge cases, and failure modes.

#### F1: Promotion CRUD & Lifecycle Boundaries (8 Cases)
1. `test_f1_b01_create_promotion_empty_name`: Submit promotion with empty string name -> 422 Validation Error.
2. `test_f1_b02_create_promotion_duplicate_code`: Submit promotion with existing code -> 400 Bad Request.
3. `test_f1_b03_create_promotion_invalid_dates`: `starts_at` is set after `ends_at` -> 422 Validation Error.
4. `test_f1_b04_invalid_lifecycle_transition_draft_to_paused`: Transition `DRAFT` -> `PAUSED` directly -> 400 Bad Request.
5. `test_f1_b05_invalid_lifecycle_transition_ended_to_active`: Transition `ENDED` -> `ACTIVE` directly -> 400 Bad Request.
6. `test_f1_b06_update_ended_promotion`: Attempt to update fields of an `ENDED` promotion -> 400 Bad Request.
7. `test_f1_b07_get_non_existent_promotion_id`: Query `/api/promotions/non-existent-uuid` -> 404 Not Found.
8. `test_f1_b08_delete_active_promotion`: Attempt to delete an `ACTIVE` promotion -> 400 Bad Request (must end/pause first).

#### F2: Scope & Exclusion Boundaries (6 Cases)
9. `test_f2_b01_scope_category_non_existent_target`: Category scope pointing to invalid category ID -> 422 or empty matches.
10. `test_f2_b02_scope_exclusion_without_base_inclusion`: Define exclusion rule without any matching inclusion scope -> 0 variants impacted.
11. `test_f2_b03_scope_conflicting_product_and_variant_exclusions`: Product scope included, but all underlying variants individually excluded -> 0 variants impacted.
12. `test_f2_b04_scope_empty_target_ids_list`: `VARIANT` scope type provided with empty target ID array -> 422 Validation Error.
13. `test_f2_b05_scope_multiple_exclusions_overlapping`: Multiple overlapping exclusion rules (category + product exclusions).
14. `test_f2_b06_scope_all_with_all_categories_excluded`: `ALL` scope with all available category IDs marked as excluded -> 0 variants impacted.

#### F3: Price Calculation Engine Boundaries (7 Cases)
15. `test_f3_b01_discount_percentage_0_percent`: `PERCENTAGE` discount of 0% -> computed price equals original price.
16. `test_f3_b02_discount_percentage_100_percent`: `PERCENTAGE` discount of 100% -> computed price equals 0 VND.
17. `test_f3_b03_discount_percentage_exceeds_100`: `PERCENTAGE` discount of 105% -> 422 Validation Error.
18. `test_f3_b04_fixed_amount_exceeds_original_price`: Fixed amount discount of 300,000 VND on 200,000 VND base price -> clamped to 0 VND (no negative price).
19. `test_f3_b05_fixed_price_higher_than_original`: Fixed price discount set to 250,000 VND on 200,000 VND original price -> computed price remains original price (no price increase).
20. `test_f3_b06_max_discount_negative_or_zero`: `max_discount` set to 0 or negative value -> 422 Validation Error.
21. `test_f3_b07_priority_equal_level_tiebreaker`: Two active promotions with identical priority (Priority 5 vs Priority 5); deterministic tie-breaker applies (e.g. earliest created or highest discount).

#### F4: Bulk & Intent Parser Boundaries (5 Cases)
22. `test_f4_b01_bulk_prices_empty_array`: `POST /api/computed-prices/bulk` with `variant_ids=[]` returns `200 OK` with `{}` payload.
23. `test_f4_b02_bulk_prices_exceed_max_batch`: `POST /api/computed-prices/bulk` exceeding batch limit (e.g. > 500 IDs) -> 400 Bad Request.
24. `test_f4_b03_bulk_prices_non_existent_variant_ids`: Query batch containing non-existent variant IDs -> returns null or base price for invalid IDs.
25. `test_f4_b04_parse_intent_ambiguous_prompt`: Ambiguous prompt ("làm chương trình khuyến mãi đi") -> returns partial fields with default fallback flags.
26. `test_f4_b05_preview_promotion_empty_scope`: Preview promotion with no scope defined -> returns 0 affected variants.

#### F5: Auto-Scheduler & Status Expiry Boundaries (4 Cases)
27. `test_f5_b01_starts_at_and_ends_at_same_timestamp`: `starts_at` equals `ends_at` -> promotion transitions immediately to `ENDED`.
28. `test_f5_b02_scheduler_clock_skew_resilience`: Auto-scheduler handling micro-deltas (less than 1 second boundary).
29. `test_f5_b03_scheduler_paused_promotion_expiry`: Paused promotion whose `ends_at` passes in background -> transitions directly `PAUSED` -> `ENDED`.
30. `test_f5_b04_scheduler_database_reconnection_recovery`: Auto-scheduler recovers gracefully after transient DB disconnect without losing status events.

#### F6: Storefront UI Boundary Rendering (5 Cases)
31. `test_f6_b01_storefront_card_long_discount_percentage`: Discount percentage with decimals (e.g. 33.333%) renders formatted badge (e.g. `-33%`).
32. `test_f6_b02_storefront_card_zero_discount`: Active promotion with 0 discount amount renders regular price without misleading badge.
33. `test_f6_b03_storefront_api_network_failure_fallback`: `useComputedPrice` hook gracefully falls back to base product price on PMI API timeout/500 error.
34. `test_f6_b04_pmi_wizard_step_backtrack_validation`: Backtracking from Step 3 to Step 1 in PMI wizard preserves entered values.
35. `test_f6_b05_pmi_preview_modal_empty_response`: Preview modal displays user-friendly zero-impact notification when 0 variants match.

---

### Tier 3: Cross-Feature Combinations (7 Test Cases)
Verifies interaction dynamics across multiple interconnected sub-systems.

1. `test_f3_c01_nested_scope_hierarchy_with_exclusions`:
   - Setup: Global `ALL` scope promotion (10% off) + Category scope promotion (20% off, Priority 10) + Variant exclusion on high-end item.
   - Verification: Category variants receive 20% off; excluded variant falls back to 10% global off or full base price.
2. `test_f3_c02_priority_competition_percentage_vs_fixed`:
   - Setup: Promotion A (`PERCENTAGE` 20%, Max Discount 30,000 VND, Priority 5) vs Promotion B (`FIXED_PRICE` 150,000 VND, Priority 10) on a 200,000 VND item.
   - Verification: Priority 10 (Promotion B) applies -> Computed price 150,000 VND. Pausing Promotion B immediately causes computed price to recalculate to 170,000 VND (Promotion A).
3. `test_f3_c03_auto_scheduler_to_bulk_api_sync`:
   - Setup: Scheduled promotion targeting 20 variants with `starts_at = T+2s`.
   - Verification: Polling `POST /api/computed-prices/bulk` at T+0s returns base prices; polling at T+3s (after auto-scheduler tick) returns discounted computed prices.
4. `test_f3_c04_intent_parser_to_wizard_to_activation`:
   - Setup: Parse prompt "Giảm 50k cho giày chạy bộ" via `/api/promotions/parse-intent` -> auto-fill PMI UI form -> save & activate.
   - Verification: Promotion created, activated, and computed prices calculated correctly for running shoes category.
5. `test_f3_c05_storefront_hook_live_recalculation_on_lifecycle_pause`:
   - Setup: Active promotion rendering discounted price on Storefront `ProductCard`.
   - Action: PMI Admin API receives `POST /api/promotions/{id}/pause`.
   - Verification: Subsequent storefront `useComputedPrice` call immediately fetches updated unpromoted base price, badge disappears.
6. `test_f3_c06_product_base_price_change_under_active_promotion`:
   - Setup: Active `PERCENTAGE` promotion (20% off) on Variant X (Base price 100,000 VND -> Computed price 80,000 VND).
   - Action: Update Variant X base price to 150,000 VND in PMI backend.
   - Verification: Triggered price recalculation updates computed price for Variant X to 120,000 VND automatically.
7. `test_f3_c07_concurrent_lifecycle_transitions_isolation`:
   - Setup: Concurrent API requests attempting `activate` and `end` on the same draft promotion.
   - Verification: DB transaction locking ensures deterministic state transition to either `ACTIVE` or `ENDED` without corrupting computed price state.

---

### Tier 4: Real-World Scenarios (5 Scenarios)

#### Scenario 1: End-to-End Flash Sale Campaign Workflow
- **Workflow**:
  1. Marketing Manager schedules a "Flash Sale Midnight" promotion (`PERCENTAGE` 30%, `max_discount=150,000 VND`) targeting `CATEGORY` "Áo Nam", scheduled to start in 3 seconds and last for 5 seconds.
  2. `POST /api/promotions/{id}/activate` sets status to `SCHEDULED`.
  3. Customer visits Web Storefront at T+1s: Products display regular base prices.
  4. Auto-scheduler background service fires at T+3s: Status transitions `SCHEDULED` -> `ACTIVE`, `promotion_computed_prices` populated.
  5. Customer refreshes Web Storefront at T+4s: `ProductCard` renders strikethrough original price, discounted price (-30%), and Flash Sale badge.
  6. Auto-scheduler fires at T+8s (`ends_at` expired): Status transitions `ACTIVE` -> `ENDED`, computed prices cleared.
  7. Customer refreshes Web Storefront at T+9s: Prices cleanly revert to base prices, discount badge disappears.

#### Scenario 2: Marketing Manager Natural-Language AI Promotion Setup
- **Workflow**:
  1. Marketing Manager opens PMI UI Create Wizard and enters prompt: *"Tạo chương trình xả hàng hè giảm 25% tối đa 100k cho tất cả quần kraep từ hôm nay đến cuối tuần"*.
  2. Frontend sends request to `POST /api/promotions/parse-intent`.
  3. Intent parser extracts fields: Name="Xả hàng hè", Type=`PERCENTAGE`, Value=25, Max Discount=100000, Scope=`CATEGORY` ("quần kraep").
  4. Marketing Manager previews impact via `POST /api/promotions/preview`: System reports 14 affected product variants with total estimated customer savings.
  5. Manager confirms creation & clicks "Kích hoạt ngay" (`/activate`).
  6. System computes prices and confirms 14 variant records created in `promotion_computed_prices`.

#### Scenario 3: Complex Multi-Tier Category Discount with Excluded High-Margin Variants
- **Workflow**:
  1. Marketing team launches "Black Friday Footwear Deal": 20% discount on all items in `CATEGORY` "Giày Thể Thao".
  2. Due to brand pricing restrictions, premium variant "Giày Pro Runner Limited" (`VARIANT_PRO_99`) must be excluded (`is_exclusion=True`).
  3. Promotion is created and activated.
  4. E2E verification calls `POST /api/computed-prices/bulk` for both standard running shoes and `VARIANT_PRO_99`.
  5. Standard running shoes return 20% discounted computed prices; `VARIANT_PRO_99` returns full original price with `has_active_promotion=False`.
  6. Customer browses Storefront: Standard shoes show discounted price and `-20%` badge; `VARIANT_PRO_99` shows standard single price.

#### Scenario 4: Overlapping Promotional Priority Competition & Conflict Resolution
- **Workflow**:
  1. Two overlapping promotions target variant `VAR_FOOTBALL_01` (Original price 500,000 VND):
     - Promo A: "Weekend Special" - `FIXED_PRICE` 400,000 VND (Priority = 5).
     - Promo B: "VIP Mega Sale" - `PERCENTAGE` 30% (Discount 150,000 VND -> Computed price 350,000 VND, Priority = 10).
  2. System evaluates active promotions: Promo B wins due to higher priority (10 > 5).
  3. Storefront displays computed price of 350,000 VND (-30%).
  4. Marketing Manager pauses Promo B (`POST /api/promotions/{promo_b_id}/pause`).
  5. Price engine immediately re-evaluates: Promo A now becomes the highest active priority.
  6. Storefront updates instantly to display computed price of 400,000 VND (Promo A).

#### Scenario 5: Bulk Inventory Price Re-computation Under Active Promotion
- **Workflow**:
  1. An active promotion (`PERCENTAGE` 15%) covers 50 sport equipment variants.
  2. Warehouse update changes base price of 10 variants due to supplier cost adjustments.
  3. PMI product service processes price update and triggers event `on_variant_price_changed`.
  4. Promotion price calculation engine re-computes `promotion_computed_prices` entries for the 10 modified variants.
  5. E2E test executes `POST /api/computed-prices/bulk` for all 50 variants:
     - 40 unchanged variants maintain previous computed prices.
     - 10 modified variants reflect accurate 15% discount off their *new* base prices.

---

## 5. Coverage Thresholds & Quality Gates

To ensure software reliability, performance, and integrity, the TopVNSport Promotion Module must satisfy the following strict quality thresholds prior to release approval:

| Subsystem / Test Level | Target Metric | Minimum Threshold | Enforced By |
|---|---|:---:|---|
| **PMI Backend Core Engine** (`PMI/backend/services/promotion_service.py`) | Line & Branch Coverage | **>= 85%** | Pytest-cov |
| **PMI Backend REST APIs** (`PMI/backend/routers/promotions.py`) | Line & Branch Coverage | **>= 85%** | Pytest-cov |
| **PMI Backend Auto-Scheduler** (`PMI/backend/services/promotion_scheduler.py`) | Line & Branch Coverage | **>= 85%** | Pytest-cov |
| **PMI Admin Frontend UI** (`PMI/frontend/src/components/promotions/`) | Statement & Component Coverage | **>= 80%** | Vitest / Jest |
| **Web Storefront Hooks & Mappers** (`web/src/hooks/`, `productMappers.ts`) | Line Coverage | **>= 85%** | Vitest |
| **Web Storefront ProductCard** (`web/src/components/ProductCard.tsx`) | Component Rendering Coverage | **>= 85%** | Vitest |
| **E2E Feature Coverage (Tier 1)** | Executed Test Cases | **>= 34 Cases** (35 designed) | Pytest E2E Runner |
| **E2E Boundary Coverage (Tier 2)** | Executed Boundary Cases | **>= 34 Cases** (35 designed) | Pytest E2E Runner |
| **E2E Cross-Feature Coverage (Tier 3)** | Executed Combination Cases | **>= 6 Cases** (7 designed) | Pytest E2E Runner |
| **E2E Real-World Scenarios (Tier 4)** | Executed Multi-Step Workflows | **5 Scenarios** | Pytest E2E Runner |
| **Code Style & Static Analysis** | Lint & Type Errors | **0 Violations** | Flake8 / ESLint / tsc |

---

## 6. Execution Instructions & Verification Commands

### 6.1 Run E2E Test Suite
```bash
# Ensure all services are up
./start_all.sh --no-watch

# Execute the complete Promotion E2E Test Suite
./venv/bin/pytest e2e_tests/tests/test_promotion_full_flow.py -v -s
```

### 6.2 Run PMI Backend Unit & Coverage Tests
```bash
# Run unit tests inside docker container or local environment
BYPASS_TESTCONTAINERS=true ./venv/bin/pytest PMI/backend/tests/unit/ --cov=PMI/backend/services --cov=PMI/backend/routers --cov-report=term-missing
```

### 6.3 Run PMI Frontend & Storefront Unit Tests
```bash
# PMI Frontend Unit Tests
cd PMI/frontend && npm test

# Web Storefront Unit Tests
cd web && npm test
```
