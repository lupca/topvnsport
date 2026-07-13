# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Top VNSport is a multi-system e-commerce platform consisting of four subsystems, each containerized with Docker Compose:

| System | Backend | Frontend | Ports (API / UI) |
|--------|---------|----------|------------------|
| **PMI** (Product Information Management) | FastAPI + PostgreSQL + MinIO | Next.js 14 + Tailwind | 18100 / 13100 |
| **OMS** (Order Management System) | FastAPI + PostgreSQL | Next.js 14 + Tailwind | 18101 / 13101 |
| **WMS** (Warehouse Management System) | FastAPI + PostgreSQL | Next.js 14 + Tailwind | 18102 / 13102 |
| **web** (Customer-facing storefront) | Vite + React + Redux Toolkit | — | 3000 |

All backends use SQLAlchemy ORM with PostgreSQL 15. PMI is the most actively developed subsystem.

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

**Cross-system E2E (pytest + Playwright):**
```bash
./start_all.sh --no-watch                        # bring up all services
pip install -r e2e_tests/requirements.txt
python -m playwright install --with-deps chromium
pytest e2e_tests/ -v
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

## Architecture Details

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

## Port Map

| Service | Host Port |
|---------|-----------|
| PMI Postgres | 15433 |
| OMS Postgres | 15434 |
| WMS Postgres | 15435 |
| PMI API | 18100 |
| OMS API | 18101 |
| WMS API | 18102 |
| PMI Frontend | 13100 |
| OMS Frontend | 13101 |
| WMS Frontend | 13102 |
| PMI MinIO API | 19005 |
| PMI MinIO Console | 19006 |
| Web (storefront) | 3000 |
