# Project: TopVNSport Technical Debt Resolution

## Architecture
- **Gateway (`gateway/`)**: Nginx reverse proxy routing requests, handling SSL termination, and performing identity auth requests.
- **Identity Service (`identity-service/`)**: FastAPI SSO service and Next.js management UI.
- **PMI (`PMI/`)**: Product Information Management microservice (FastAPI backend + Next.js frontend).
- **OMS (`OMS/`)**: Order Management System microservice (FastAPI backend + Next.js frontend).
- **WMS (`WMS/`)**: Warehouse Management System microservice (FastAPI backend + Next.js frontend).
- **Web Storefront (`web/`)**: Customer e-commerce application (Vite + React 19 + Redux Toolkit).
- **Shared Packages (`packages/`)**: Monorepo shared packages for UI components and API clients.

## Code Layout
- `gateway/` — Nginx configurations (`nginx.conf`, `docker-compose.prod.yml`)
- `PMI/backend/` — PMI FastAPI app (`main.py`, `routers/`, `services/`, `utils/`)
- `PMI/frontend/` — PMI Next.js UI (`src/components/`, `src/services/`)
- `OMS/backend/` — OMS FastAPI app (`main.py`, `routers/`, `schemas/`)
- `OMS/frontend/` — OMS Next.js UI (`src/components/`, `src/utils/`)
- `WMS/backend/` — WMS FastAPI app (`main.py`, `routers/`, `schemas.py`)
- `WMS/frontend/` — WMS Next.js UI (`src/components/`, `src/utils/`)
- `web/` — Web storefront app (`src/features/`, `src/services/`, `src/components/`)
- `docs/TopVNSport - TODO & Technical Debt/` — Technical debt tracking documentation

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | PMI Domain Authorization / RBAC | Enforce role/permission checks in `PMI/backend/utils/dependency.py` and routers (`products.py`, `categories.py`, `channels.py`, `attributes.py`) | none | DONE |
| M2 | OCR Scan Bugs | Fix 7 stability/security bugs: missing `ALLOWED_SERVICE_KEYS` env var handling, secret masking in `ZaloConfigOut`, Pydantic mutable defaults (`= []`), DB session leak in `seed.py`, empty array fallbacks in frontend API helpers, Redux fallback (`?? []`) | none | DONE |
| M3 | HTTPS/TLS Production Setup | Uncomment port 443, configure SSL volume mounts, add HTTPS server blocks and HTTP-to-HTTPS redirect in `gateway/docker-compose.prod.yml` and `gateway/nginx.conf` | none | DONE |
| M4 | Shared Code & Package Duplication | Deduplicate `DataTable`, `SystemPopupProvider`, `popupService` into a shared package (`packages/ui-kit`), configure `pnpm-workspace.yaml`, and update frontends | none | PLANNED |
| M5 | HTTP Exceptions in Service Layer | Replace direct `HTTPException` raises in `PMI/backend/services/product_service.py` with custom domain exceptions and FastAPI exception handlers | none | DONE |
| M6 | API Client Standardization | Create `@topvnsport/api-client` (or standardized client module) and refactor frontends to use unified client | M4 | PLANNED |
| M7 | Web Cart/State/Checkout Reliability | Add `localStorage` persistence to `web/src/features/cart/cartSlice.ts`, fix OTP modal state loss, remove hardcoded `SIMULATED_LATENCY = 200` delay | none | DONE |
| M8 | WMS Race Conditions & Data Integrity | Add `with_for_update()` row locking on inbound scans, enforce quantity bounds on scan-pick, correct status string `"PICKED"` notification | none | DONE |
| M9 | Final E2E Test Suite & TODO Doc Update | Verify all test suites pass, update TODO documentation marking 1 Critical and 7 High priority items as ✅ Done | M1-M8 | PLANNED |

## Verification Commands
- PMI Backend Tests: `cd PMI/backend && pytest`
- PMI Frontend Tests: `cd PMI/frontend && npm run test`
- OMS Backend Tests: `cd OMS/backend && pytest`
- OMS Frontend Tests: `cd OMS/frontend && npm run test`
- WMS Backend Tests: `cd WMS/backend && pytest`
- WMS Frontend Tests: `cd WMS/frontend && npm run test`
- Identity Backend Tests: `cd identity-service/backend && pytest`
- Identity Frontend Tests: `cd identity-service/frontend && npm run test`
- Web Storefront Tests: `cd web && npm run test`
- E2E Tests: `pytest e2e_tests/ -v`
