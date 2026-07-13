# CI/CD Pipeline

## Tổng quan

Hệ thống CI/CD sử dụng GitHub Actions với 3 workflows chính:

```
.github/workflows/
├── ci.yml      # Continuous Integration - test & build
├── deploy.yml  # Continuous Deployment - deploy to production
└── e2e.yml     # End-to-End Tests - full system testing
```

## Workflow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Push/PR to main                       │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      ci.yml (CI)                             │
├─────────────────────────────────────────────────────────────┤
│  1. Detect Changes (path filtering)                         │
│     ├── PMI/** → pmi-backend, pmi-frontend                  │
│     ├── OMS/** → oms-backend, oms-frontend                  │
│     ├── WMS/** → wms-backend, wms-frontend                  │
│     └── web/** → web-build                                  │
│                                                              │
│  2. Run relevant jobs in parallel                           │
│     ├── pmi-backend (pytest)                                │
│     ├── pmi-frontend (vitest + build)                       │
│     ├── oms-backend (syntax check)                          │
│     ├── oms-frontend (build)                                │
│     ├── wms-backend (syntax check)                          │
│     ├── wms-frontend (build)                                │
│     ├── web-build (vite build)                              │
│     └── validate-compose (docker compose config)            │
│                                                              │
│  3. ci-success (summary job for branch protection)          │
└─────────────────────────┬───────────────────────────────────┘
                          ▼ (on main branch, CI success)
┌─────────────────────────────────────────────────────────────┐
│                    deploy.yml (CD)                           │
├─────────────────────────────────────────────────────────────┤
│  1. Checkout repository                                      │
│  2. Setup SSH credentials                                    │
│  3. Run deploy_prod.sh → EC2                                │
└─────────────────────────────────────────────────────────────┘
```

## Path Filtering

CI chỉ chạy tests cho subsystems có thay đổi:

| Path Pattern | Jobs Triggered |
|--------------|----------------|
| `PMI/**` | pmi-backend, pmi-frontend |
| `OMS/**` | oms-backend, oms-frontend |
| `WMS/**` | wms-backend, wms-frontend |
| `web/**` | web-build |
| `.github/workflows/**` | All jobs |
| `**.md`, `docs/**` | Skipped |

## Environment Variables

### CI Environment (ci.yml)

PMI Backend tests cần các env vars sau (đã config trong workflow):

```yaml
env:
  JWT_SECRET_KEY: ci-test-jwt-secret-key-not-for-prod
  INTERNAL_SERVICE_TOKEN: ci-test-internal-token
  JWT_ALGORITHM: HS256
  ACCESS_TOKEN_EXPIRE_MINUTES: '1440'
  ALLOWED_SERVICE_KEYS: ci-test-service-key
  TESTING: 'true'
```

### CD Environment (deploy.yml)

Secrets cần config trong GitHub repository settings:

| Secret | Description |
|--------|-------------|
| `DEPLOY_SSH_KEY` | SSH private key for EC2 access |
| `SSH_KNOWN_HOSTS` | SSH known_hosts entry for EC2 |
| `EC2_HOST` | EC2 hostname or IP |
| `EC2_USER` | SSH username (e.g., ubuntu) |
| `DEPLOY_PATH` | Deployment path on EC2 |
| `PUBLIC_HOST` | Public domain name |

## Caching

Workflows sử dụng caching để tăng tốc:

```yaml
# pip cache
- uses: actions/cache@v4
  with:
    path: ~/.cache/pip
    key: pip-pmi-${{ hashFiles('PMI/backend/requirements*.txt') }}

# npm cache
- uses: actions/cache@v4
  with:
    path: ~/.npm
    key: npm-pmi-${{ hashFiles('PMI/frontend/package-lock.json') }}
```

## Concurrency Control

Mỗi workflow có concurrency group để cancel runs cũ:

```yaml
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```

## E2E Tests (e2e.yml)

E2E tests chạy theo schedule hoặc manual trigger:

- **Schedule:** Nightly at 2 AM UTC
- **Manual:** workflow_dispatch

```bash
# Manual trigger
gh workflow run e2e.yml
```

## Troubleshooting

### 1. Backend tests fail với KeyError

**Nguyên nhân:** Missing env vars  
**Fix:** Verify env vars trong ci.yml pmi-backend job

### 2. npm ci fails

**Nguyên nhân:** Missing `package-lock.json`  
**Fix:** 
```bash
cd PMI/frontend && npm install
git add package-lock.json
git commit -m "Add lockfile"
```

### 3. CD fails với SSH error

**Nguyên nhân:** Invalid SSH credentials  
**Fix:** Verify secrets trong GitHub repo settings

## Local Testing

```bash
# Run PMI backend tests locally
cd PMI/backend
JWT_SECRET_KEY=test INTERNAL_SERVICE_TOKEN=test ALLOWED_SERVICE_KEYS=test \
  pytest -v

# Run PMI frontend tests locally
cd PMI/frontend
npm run test

# Validate compose files
docker compose -f PMI/docker-compose.prod.yml config
```
