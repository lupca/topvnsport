# TopVNSport - Multi-System E-Commerce Platform

Monorepo chứa 5 hệ thống độc lập với centralized authentication:

| System | Description | Ports (API/UI) |
|--------|-------------|----------------|
| **Identity** | SSO Service (JWT auth) | 18110 / 13110 |
| **PMI** | Product Information Management | 18100 / 13100 |
| **OMS** | Order Management System | 18101 / 13101 |
| **WMS** | Warehouse Management System | 18102 / 13102 |
| **Gateway** | Nginx reverse proxy + auth | 8080 |

## Tech Stack

- **Backend**: FastAPI + SQLAlchemy + PostgreSQL 15
- **Frontend**: Next.js 14 + React 18 + Tailwind CSS
- **Shared packages**: `@topvnsport/ui-kit`, `@topvnsport/api-client` (GitHub repos)
- **Storage**: MinIO (PMI media files)
- **Auth**: JWT tokens via Identity Service

## Quick Start

```bash
./start_all.sh              # Start all services
./start_all.sh --no-build   # Skip rebuild
```

Single subsystem:
```bash
cd PMI && docker compose up
```

## Default Credentials

- Admin: `admin` / `Admin@123`

## Project Structure

```
├── gateway/           # Nginx + auth_request
├── identity-service/  # SSO backend + frontend
├── PMI/              # Product management
│   ├── backend/      # FastAPI
│   └── frontend/     # Next.js
├── OMS/              # Order management
├── WMS/              # Warehouse management
├── docs/             # Architecture & API docs
├── e2e_tests/        # Cross-system E2E tests
└── CLAUDE.md         # AI agent instructions
```

## Documentation

- [CLAUDE.md](./CLAUDE.md) - AI agent instructions (commands, testing, architecture)
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) - System architecture
- [docs/API.md](./docs/API.md) - API reference
- [docs/DATABASE.md](./docs/DATABASE.md) - Database schema

## Inter-Service Communication

Services communicate via REST APIs over Docker networks:
- `pmi_default`, `oms_default`, `wms_default` - service networks
- `gateway_network` - shared gateway network

WMS provides public stock API: `GET /public/stock?sku_codes=SKU-A,SKU-B`
