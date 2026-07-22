# Project: TopVNSport Promotion Module

## Architecture Overview
Product-level Promotion Module in PMI (Backend FastAPI & Frontend React) and Web Storefront for TopVNSport.
PMI serves as the source of truth for promotion definitions, scope targeting, and price calculation engine.
Computed promotion prices are exposed via FastAPI REST endpoints and consumed by the Web Storefront to render discounted pricing, strikethrough original prices, and promotional badges.

```
+------------------------------------+          +------------------------------+
| PMI Admin UI (React)               |          | Web Storefront (React)       |
| - Promotions List & Filters        |          | - useComputedPrice hook      |
| - 4-step Create/Edit Wizard        |          | - ProductCard display        |
| - Detail Page & Lifecycle Actions  |          | - productMappers integration |
+-----------------+------------------+          +--------------+---------------+
                  |                                            |
                  v                                            v
+------------------------------------------------------------------------------+
| PMI Backend (FastAPI)                                                        |
| - REST APIs: /api/promotions (CRUD, /activate, /pause, /resume, /end)       |
| - Computed price APIs: /api/variants/{id}/computed-price, /bulk              |
| - Intent Parser: /api/promotions/parse-intent                                |
| - Price Calculation Engine (PERCENTAGE, FIXED_AMOUNT, FIXED_PRICE, priority) |
| - Background Auto-Scheduler Service (Scheduled -> Active -> Ended)           |
+--------------------------------------+---------------------------------------+
                                       |
                                       v
+------------------------------------------------------------------------------+
| PostgreSQL Database                                                          |
| - promotions, promotion_scope, promotion_computed_prices, promotion_usage_log|
+------------------------------------------------------------------------------+
```

## Interface Contracts

### 1. Database Schema (`PMI/backend/models.py`)
- **Table `promotions`**:
  - `id`: String/UUID (PK)
  - `code`: String, unique, indexed
  - `name`: String, required
  - `description`: Text, optional
  - `discount_type`: Enum (`PERCENTAGE`, `FIXED_AMOUNT`, `FIXED_PRICE`)
  - `discount_value`: Float/Numeric
  - `max_discount`: Float/Numeric, optional (cap for percentage discounts)
  - `priority`: Integer, default 0 (higher = applied first)
  - `status`: Enum (`DRAFT`, `SCHEDULED`, `ACTIVE`, `PAUSED`, `ENDED`)
  - `starts_at`: DateTime(timezone=True), optional
  - `ends_at`: DateTime(timezone=True), optional
  - `intent`: Text, optional (AI agent description)
  - `ai_reasoning`: Text, optional (AI agent rationale)
  - `created_by`: String, optional (user or AI agent identifier)
  - `created_at`, `updated_at`: DateTime

- **Table `promotion_scope`**:
  - `id`: String/UUID (PK)
  - `promotion_id`: Foreign Key -> `promotions.id` (CASCADE)
  - `scope_type`: Enum (`ALL`, `CATEGORY`, `PRODUCT`, `VARIANT`)
  - `target_id`: String (Category ID, Product ID, Variant ID; null for ALL)
  - `is_exclusion`: Boolean, default False

- **Table `promotion_computed_prices`**:
  - `id`: String/UUID (PK)
  - `variant_id`: String (FK -> `product_variants.id`), indexed
  - `promotion_id`: String (FK -> `promotions.id`)
  - `original_price`: Float/Numeric
  - `computed_price`: Float/Numeric
  - `discount_amount`: Float/Numeric
  - `percentage_discount`: Float/Numeric
  - `updated_at`: DateTime

- **Table `promotion_usage_log`**:
  - `id`: String/UUID (PK)
  - `promotion_id`: String (FK -> `promotions.id`)
  - `variant_id`: String
  - `applied_at`: DateTime

### 2. PMI REST Endpoints (`PMI/backend/routers/promotions.py`)
- `GET /api/promotions`: List promotions (query params: `status`, `search`, `page`, `limit`)
- `POST /api/promotions`: Create promotion with scope definition
- `GET /api/promotions/{id}`: Get detail with affected variants & computed price summary
- `PUT /api/promotions/{id}`: Update promotion details/scope
- `DELETE /api/promotions/{id}`: Soft delete or delete draft
- `POST /api/promotions/{id}/activate`: Transition state to `ACTIVE` (or `SCHEDULED` if future `starts_at`), trigger computed price calculation
- `POST /api/promotions/{id}/pause`: Transition state `ACTIVE` -> `PAUSED`
- `POST /api/promotions/{id}/resume`: Transition state `PAUSED` -> `ACTIVE`
- `POST /api/promotions/{id}/end`: Transition state -> `ENDED`, recompute prices
- `POST /api/promotions/preview`: Preview promotion impact before saving
- `POST /api/promotions/parse-intent`: Parse natural language prompt into promotion fields (for AI agent)
- `GET /api/variants/{id}/computed-price`: Get current effective computed price for a variant
- `POST /api/computed-prices/bulk`: Get bulk computed prices for list of variant IDs

### 3. Price Calculation Rules
- Evaluates active promotions in descending priority order (`priority` high -> low).
- Resolves scope targeting: ALL > CATEGORY > PRODUCT > VARIANT, excluding `is_exclusion` items.
- Discount calculation:
  - `PERCENTAGE`: `original_price * (discount_value / 100)`, capped at `max_discount` if specified.
  - `FIXED_AMOUNT`: `discount_value`, capped at `original_price`.
  - `FIXED_PRICE`: `max(0, original_price - discount_value)`.
- Updates `promotion_computed_prices` table upon promotion state change or product price change.

### 4. PMI Frontend UI (`PMI/frontend/src`)
- Sidebar navigation: "Promotions" / "Khuyến mãi" item added.
- `/promotions` page: List with status tabs, search bar, table columns (code, name, type, value, status, date range, actions).
- `/promotions/create` & `/promotions/edit/[id]`: 4-step wizard/sections:
  1. Basic Info (Name, Code, Intent, AI metadata)
  2. Discount Type & Value (Percentage/Fixed Amount/Fixed Price, Value, Max Discount, Priority)
  3. Scope & Exclusions (Target type selection, inclusions/exclusions picker)
  4. Schedule & Preview Modal (Starts At, Ends At, Live impact preview)
- `/promotions/[id]`: Detail view with affected variants count, total potential discount, status badge, and lifecycle buttons (Kích hoạt, Tạm dừng, Tiếp tục, Kết thúc).

### 5. Web Storefront Integration (`web/src`)
- Custom hook `useComputedPrice(variantId: string)`: Fetches computed price from PMI API or returns original price if no active promotion.
- `productMappers.ts`: Enhanced mapping logic to combine base product/variant prices with active computed promotion data (`computedPrice`, `originalPrice`, `discountPercentage`, `hasActivePromotion`).
- `ProductCard.tsx`: When active promotion applies:
  - Displays original price with strikethrough.
  - Displays computed discounted price prominently.
  - Renders percentage badge (e.g. `-20%`).

## Code Layout
- `PMI/backend/`:
  - `models.py`: SQLAlchemy models (`Promotion`, `PromotionScope`, `PromotionComputedPrice`, `PromotionUsageLog`).
  - `alembic/versions/`: Alembic migration script for promotion tables.
  - `schemas/promotion.py`: Pydantic request/response schemas.
  - `services/promotion_service.py`: Core calculation engine, scope matcher, price updater, and intent parser.
  - `services/promotion_scheduler.py`: Background task/scheduler for status transitions (`SCHEDULED` -> `ACTIVE`, `ACTIVE` -> `ENDED`).
  - `routers/promotions.py`: FastAPI endpoints.
  - `tests/unit/`: Unit tests (`test_promotions_crud.py`, `test_promotions_lifecycle.py`, `test_promotions_compute.py`, `test_promotions_scope.py`, `test_promotions_scheduler.py`).
- `PMI/frontend/src/`:
  - `components/Sidebar.tsx`: Nav item.
  - `app/promotions/`: Next.js pages (`page.tsx`, `create/page.tsx`, `edit/[id]/page.tsx`, `[id]/page.tsx`).
  - `components/promotions/`: `PromotionList.tsx`, `PromotionForm.tsx`, `PromotionDetail.tsx`, `PromotionPreviewModal.tsx`.
  - `__tests__/components/`: `PromotionList.test.tsx`, `PromotionForm.test.tsx`.
- `web/src/`:
  - `hooks/useComputedPrice.ts`: Storefront hook.
  - `services/sport-api/productMappers.ts`: Updated mapper.
  - `components/ProductCard.tsx`: Strikethrough & badge rendering.
  - `__tests__/`: `useComputedPrice.test.ts`, `ProductCard.test.tsx`.
- `e2e_tests/tests/`:
  - `test_promotion_full_flow.py`: Full E2E verification suite.

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | M1_pmi_backend_models_scheduler | SQLAlchemy models, Alembic migration, schemas, background auto-scheduler service | None | DONE |
| M2 | M2_pmi_backend_engine_apis | Calculation engine, scope matcher, intent parser, REST endpoints `/api/promotions`, bulk/individual price endpoints, & 5 backend unit test files | M1 | DONE |
| M3 | M3_pmi_frontend_ui | Sidebar navigation, Promotion List, 4-step Create/Edit wizard, Detail page, preview modal, & frontend unit tests | M2 | DONE |
| M4 | M4_web_storefront_integration | `useComputedPrice` hook, `productMappers.ts`, `ProductCard.tsx` strikethrough/badge, & storefront unit tests | M2 | DONE |
| M5 | M5_e2e_testing_hardening | `test_promotion_full_flow.py` execution (Tiers 1-4) & white-box adversarial coverage hardening (Tier 5) with Forensic Auditor verification | M1, M2, M3, M4 | DONE (Phase 3 live-container E2E verification DEFERRED — see Backlog TODO-1) |

> **M5 completion note (2026-07-22):** Phases 1 (E2E suite 82/82) and 2 (Tier 5 adversarial hardening) are complete and reviewer-approved. Phase 3's Final Forensic live-container E2E audit is **DEFERRED**: it is blocked solely by an infrastructure-level SQLAlchemy `ObjectDeletedError` (stale-object after `recompute_promotion_prices` commits) that has already failed **two** prior generation fixes. The promotion feature code itself is complete; this is a test-harness/session-lifecycle defect, tracked as **TODO-1** below. M5 is marked DONE so orchestration does not loop.

## Backlog / Deferred TODOs

| ID | Title | Priority | Status | Notes |
|----|-------|----------|--------|-------|
| TODO-1 | Fix E2E stale-object bug (`ObjectDeletedError` after `recompute_promotion_prices` commit) | Medium | BACKLOG (do later) | Live-container Forensic Audit (M5 Phase 3) fails with SQLAlchemy `ObjectDeletedError` / stale-object when serializing `PromotionResponse` after `recompute_promotion_prices()` calls `db.commit()`. **Two prior generation fixes already failed** (`worker_m5_phase3_fix` → Audit Run 2 VIOLATION; `worker_m5_audit2_fix_2` → Audit Run 3 VIOLATION). Per stop-loss policy, further in-loop fixing is **halted**. Root-cause candidates already gathered: `expire_on_commit=True` default in `PMI/backend/database.py`; missing `.populate_existing()` on promotion re-fetch in `PMI/backend/routers/promotions.py`; premature `db.commit()` (should be `db.flush()`) in `recompute_variant_prices` in `PMI/backend/services/promotion_service.py`. See `.agents/sub_orch_m5/handoff.md` §3 and `.agents/explorer_m5_audit3_1/handoff.md` for the full remediation plan when this is picked up in a dedicated (non-looping) session. |
