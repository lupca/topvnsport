# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Top VNSport is a multi-system e-commerce platform with centralized SSO authentication:

| System | Backend | Frontend | Ports (API / UI) |
|--------|---------|----------|------------------|
| **Gateway** | Nginx (auth_request) | — | 8080 |
| **Identity** (SSO Service) | FastAPI + PostgreSQL | Next.js 14 + Tailwind | 18110 / 13110 |
| **PMI** (Product Information Management) | FastAPI + PostgreSQL + MinIO | Next.js 14 + Tailwind | 18100 / 13100 |
| **OMS** (Order Management System) | FastAPI + PostgreSQL | Next.js 14 + Tailwind | 18101 / 13101 |
| **WMS** (Warehouse Management System) | FastAPI + PostgreSQL | Next.js 14 + Tailwind | 18102 / 13102 |
| **web** (Customer-facing storefront) | Vite + React + Redux Toolkit | — | 3000 |
| **MinIO** (PMI file storage) | — | — | 19005 (API) / 19006 (Console) |

All backends use SQLAlchemy ORM with PostgreSQL 15. PMI is the most actively developed subsystem. Stock management is handled exclusively by WMS (PMI has no stock fields).

## Common Commands

### Start all services
```bash
./start_all.sh              # build + hot-reload (default)
./start_all.sh --no-build   # skip image rebuild
./start_all.sh --test       # start + run OMS-WMS e2e tests
```

### Start a single subsystem
```bash
cd PMI && docker compose up      # or OMS/, WMS/
cd web && npm run dev             # storefront (port 3000)
```

### Start Gateway + Identity (centralized auth)
```bash
# Create networks first (if not already running other services)
docker network create pmi_default oms_default wms_default identity_default gateway_network 2>/dev/null || true
cd gateway && docker compose up
```
Gateway runs on port 8080, routes `/api/pmi/*`, `/api/oms/*`, `/api/wms/*` through auth.

### Running Tests

All tests should be run inside Docker to match CI behavior.

**PMI Backend (pytest + testcontainers-postgres):**
```bash
# Run inside the pim-api container:
docker compose -f PMI/docker-compose.yml exec api pytest              # all tests
docker compose -f PMI/docker-compose.yml exec api pytest tests/unit/  # unit only
docker compose -f PMI/docker-compose.yml exec api pytest tests/integration/
docker compose -f PMI/docker-compose.yml exec api pytest tests/test_auth.py -k "test_login"  # single test
```

Tests use `testcontainers[postgres]` to spin up a real Postgres per session. Set `BYPASS_TESTCONTAINERS=true` to use an external database. Factories in `tests/factories/`.

**PMI Frontend (vitest):**
```bash
docker compose -f PMI/docker-compose.yml exec frontend npm run test        # vitest unit tests
docker compose -f PMI/docker-compose.yml exec frontend npm run test:watch  # watch mode
```

**PMI E2E (Playwright) — dedicated ephemeral stack:**
```bash
docker compose -f PMI/docker-compose.e2e.yml up --build   # spins up isolated DB (port 15436) + API (port 18109)
# Then run Playwright against it, or use Dockerfile.test (root) for containerized runs
```

**OMS/WMS Backend (pytest):**
```bash
docker compose -f OMS/docker-compose.yml exec api pytest    # OMS tests
docker compose -f WMS/docker-compose.yml exec api pytest    # WMS tests
```

**Identity Service (pytest):**
```bash
docker compose -f gateway/docker-compose.yml exec identity-api pytest
```

**Cross-system E2E (pytest + Playwright):**
```bash
./start_all.sh --no-watch                        # bring up all services
pip install -r e2e_tests/requirements.txt
python -m playwright install --with-deps chromium
pytest e2e_tests/ -v
```

E2E environment overrides:
- `E2E_PMI_API_URL` (default: `http://localhost:18100`)
- `E2E_OMS_API_URL` (default: `http://localhost:18101`)
- `E2E_WMS_API_URL` (default: `http://localhost:18102`)

### Linting
```bash
# Frontend (Next.js / Vite)
docker compose -f PMI/docker-compose.yml exec frontend npm run lint   # PMI: next lint
cd web && npm run lint                                                  # Storefront: tsc --noEmit
```

### Database Migrations (PMI)
```bash
cd PMI/backend
alembic upgrade head
alembic revision --autogenerate -m "description"
```

### Deploy to Production
```bash
EC2_HOST=<host> ./deploy_prod.sh    # rsync + docker compose on EC2
```

## CI/CD (GitHub Actions)

Three workflows in `.github/workflows/`:

| Workflow | File | Trigger | What it does |
|----------|------|---------|--------------|
| **PIM Test Pipeline** | `test.yml` | push/PR to `main` | PMI backend pytest, PMI frontend vitest (Playwright e2e currently commented out) |
| **E2E Test Pipeline** | `e2e_test.yml` | push/PR to `main` + manual | Starts all services via `start_all.sh`, waits for readiness, runs `pytest e2e_tests/` with Playwright (chromium), uploads artifacts |
| **CI/CD** | `cicd.yml` | push/PR to `main` | Validates all prod compose files, builds all frontends, Python syntax check; on `main` push deploys to EC2 via `deploy_prod.sh` |

## Required Environment Variables

PMI backend requires these env vars (set in docker-compose or `.env`):
- `JWT_SECRET_KEY` — signing key for JWT tokens
- `INTERNAL_SERVICE_TOKEN` — shared secret for inter-service API calls
- `DATABASE_URL` — Postgres connection string
- `MINIO_*` — MinIO credentials for file storage

Test modes:
- `BYPASS_TESTCONTAINERS=true` — use external DB instead of testcontainers
- `USE_E2E_COMPOSE=true` — use the e2e docker-compose stack

Default dev credentials (seeded on startup):
- Admin: `admin` / `Admin@123`

## Architecture Details

### Gateway + Identity Service
- **Gateway** (`gateway/`): Nginx with `auth_request` module for centralized auth
  - All `/api/*` routes validated via `/auth/verify` before proxying to backend
  - `/internal/*` routes use X-API-Key for service-to-service calls
  - Config in `gateway/nginx/conf.d/upstream.conf` (dev), `locations.conf` (dev) and `locations.prod.conf` (prod)
- **Identity Service** (`identity-service/`): FastAPI SSO service
  - Manages users, roles, JWT tokens (access + refresh)
  - Routers: `auth.py` (login/verify/refresh), `staff.py`, `roles.py`
  - Frontend: Next.js login/dashboard at port 13110

### PMI Backend Structure (`PMI/backend/`)
- **Routers**: `routers/` — one file per domain (products, categories, channels, attributes, auth, audit, upload)
- **Schemas**: `schemas/` — Pydantic v2 models split by domain (product, category, channel_config, attribute, tier_variation)
- **Services**: `services/` — business logic layer; `product_service.py` is the main one
- **Models**: `models.py` — all SQLAlchemy models in one file, uses `declarative_base()` from `database.py`
- **Utils**: `utils/` — auth (JWT), audit logging, SKU generation, request context middleware, startup routines (auto-runs migrations + seed data on boot)
- **Audit system**: background `AuditWorker` thread processes an outbox table on a 0.5s loop

### Validation
- Backend validation errors are translated to **Vietnamese** via a custom `RequestValidationError` handler in `main.py`
- Frontend uses **Zod** schemas with `react-hook-form` for client-side validation (also Vietnamese messages)

### Inter-service Communication
- OMS, WMS, and PMI share Docker networks (`pmi_default`, `wms_default`, `oms_default`) for cross-service API calls
- Each system has its own Postgres database on a dedicated host port (PMI: 15433, OMS: 15434, WMS: 15435)
- **WMS Public Stock API**: `GET /public/stock?sku_codes=SKU-A,SKU-B` — unauthenticated endpoint aggregating stock across all inventory locations; used by web storefront

### Frontend Conventions
- All frontends: Next.js 14 + React 18 + Tailwind CSS + TypeScript
- Form handling: `react-hook-form` + `@hookform/resolvers` + Zod
- Icons: `lucide-react`
- CSS utilities: `clsx` + `tailwind-merge`

## Documentation

`docs/` contains architecture docs, user manuals, and testing guides written in Vietnamese. Note: these docs may lag behind the current code — always verify against the source.

Key docs:
- `docs/architecture.md` — overall system architecture with Mermaid diagrams
- `docs/architecture_pmi.md`, `architecture_oms.md`, `architecture_wms.md` — per-system deep dives
- `docs/e2e_testing.md` — E2E and integration testing guide
- `docs/system_data_dictionary/` — data dictionary

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes_tool` or `query_graph_tool` instead of Grep
- **Understanding impact**: `get_impact_radius_tool` instead of manually tracing imports
- **Code review**: `detect_changes_tool` + `get_review_context_tool` instead of reading entire files
- **Finding relationships**: `query_graph_tool` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview_tool` + `list_communities_tool`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
| ------ | ---------- |
| `detect_changes_tool` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context_tool` | Need source snippets for review — token-efficient |
| `get_impact_radius_tool` | Understanding blast radius of a change |
| `get_affected_flows_tool` | Finding which execution paths are impacted |
| `query_graph_tool` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes_tool` | Finding functions/classes by name or keyword |
| `get_architecture_overview_tool` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes_tool` for code review.
3. Use `get_affected_flows_tool` to understand impact.
4. Use `query_graph_tool` pattern="tests_for" to check coverage.
