# Workspace Configuration: Docker Setup

## Task ID: WS-03
## Prerequisites: WS-01, WS-02
## Estimated: 2 hours

---

## Mục Tiêu

Cấu hình Docker để shared packages hoạt động trong:
- Local development (docker-compose up)
- Production deployment (cùng 1 server)

---

## Kiến Trúc

```
┌─────────────────────────────────────────────────────────────────┐
│  topvnsport/ (root - Docker build context)                      │
│                                                                 │
│  packages/                    ◄── Shared packages               │
│  ├── backend-common/                                            │
│  └── ui-kit/                                                    │
│                                                                 │
│  PMI/                                                           │
│  ├── backend/                                                   │
│  │   ├── Dockerfile          ◄── COPY packages/ vào image       │
│  │   └── requirements.txt    ◄── KHÔNG có -e path               │
│  ├── frontend/                                                  │
│  │   └── Dockerfile          ◄── Build ui-kit trước             │
│  └── docker-compose.yml      ◄── context: ..                    │
│                                                                 │
│  OMS/, WMS/, web/            ◄── Tương tự                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Backend Dockerfile

### File: `PMI/backend/Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy shared package first (for better layer caching)
COPY packages/backend-common /app/packages/backend-common

# Install shared package
RUN pip install --no-cache-dir /app/packages/backend-common

# Copy service requirements
COPY PMI/backend/requirements.txt /app/requirements.txt

# Install service dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy service code
COPY PMI/backend /app

# Default command (override in docker-compose for dev)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### File: `PMI/backend/requirements.txt`

```txt
# Core
fastapi>=0.104.0
uvicorn[standard]>=0.24.0
sqlalchemy>=2.0.0
psycopg2-binary>=2.9.9
alembic>=1.12.0

# Validation & Serialization
pydantic>=2.5.0
pydantic-settings>=2.1.0

# Auth
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4

# Storage
boto3>=1.33.0
python-multipart>=0.0.6

# Testing (dev only)
pytest>=7.4.0
pytest-asyncio>=0.21.0
httpx>=0.25.0

# NOTE: topvnsport-common is installed via Dockerfile, not here
# This keeps requirements.txt portable
```

---

## Frontend Dockerfile

### File: `PMI/frontend/Dockerfile`

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8 --activate

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy shared package
COPY packages/ui-kit ./packages/ui-kit

# Copy service package.json
COPY PMI/frontend/package.json ./PMI/frontend/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build shared package first
RUN pnpm --filter @topvnsport/ui-kit build

# Copy service source
COPY PMI/frontend ./PMI/frontend

# Build service
RUN pnpm --filter @topvnsport/pmi-frontend build

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

COPY --from=builder /app/PMI/frontend/.next/standalone ./
COPY --from=builder /app/PMI/frontend/.next/static ./PMI/frontend/.next/static
COPY --from=builder /app/PMI/frontend/public ./PMI/frontend/public

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "PMI/frontend/server.js"]
```

### Development Dockerfile (simpler)

```dockerfile
# PMI/frontend/Dockerfile.dev

FROM node:20-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8 --activate

# Copy everything (volumes will override in dev)
COPY . .

# Install all dependencies
RUN pnpm install

# Build shared package
RUN pnpm --filter @topvnsport/ui-kit build

WORKDIR /app/PMI/frontend

CMD ["pnpm", "dev"]
```

---

## Docker Compose Configuration

### File: `PMI/docker-compose.yml`

```yaml
version: '3.8'

services:
  api:
    build:
      context: ..                    # Root context for packages/
      dockerfile: PMI/backend/Dockerfile
    ports:
      - "18100:8000"
    environment:
      - DATABASE_URL=postgresql://pmi:pmi@db:5432/pmi
      - JWT_SECRET_KEY=${JWT_SECRET_KEY:-dev-secret-key}
      - MINIO_ENDPOINT=minio:9000
    volumes:
      # Hot reload in development
      - ./backend:/app
      - ../packages/backend-common:/app/packages/backend-common
    depends_on:
      - db
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload

  frontend:
    build:
      context: ..                    # Root context for packages/
      dockerfile: PMI/frontend/Dockerfile.dev
    ports:
      - "13100:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:18100
    volumes:
      # Hot reload in development
      - ./frontend:/app/PMI/frontend
      - ../packages/ui-kit:/app/packages/ui-kit
      - /app/PMI/frontend/node_modules
      - /app/PMI/frontend/.next
    depends_on:
      - api

  db:
    image: postgres:15-alpine
    ports:
      - "15433:5432"
    environment:
      - POSTGRES_USER=pmi
      - POSTGRES_PASSWORD=pmi
      - POSTGRES_DB=pmi
    volumes:
      - pmi_postgres_data:/var/lib/postgresql/data

  minio:
    image: minio/minio
    ports:
      - "19005:9000"
      - "19006:9001"
    environment:
      - MINIO_ROOT_USER=minioadmin
      - MINIO_ROOT_PASSWORD=minioadmin
    volumes:
      - pmi_minio_data:/data
    command: server /data --console-address ":9001"

volumes:
  pmi_postgres_data:
  pmi_minio_data:
```

### Production Override

```yaml
# PMI/docker-compose.prod.yml

version: '3.8'

services:
  api:
    build:
      context: ..
      dockerfile: PMI/backend/Dockerfile
    # No volumes - use built image
    volumes: []
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
    restart: always

  frontend:
    build:
      context: ..
      dockerfile: PMI/frontend/Dockerfile
    volumes: []
    restart: always

  db:
    restart: always

  minio:
    restart: always
```

---

## Root Start Script Update

### File: `start_all.sh`

```bash
#!/bin/bash

set -e

# Parse arguments
BUILD_FLAG=""
if [[ "$1" != "--no-build" ]]; then
    BUILD_FLAG="--build"
fi

echo "Starting all services..."

# Build shared packages first (for non-Docker dev)
if command -v pnpm &> /dev/null; then
    echo "Building ui-kit..."
    (cd packages/ui-kit && pnpm install && pnpm build) || true
fi

# Start all services with Docker Compose
# Using root context so each service can access packages/
docker compose -f PMI/docker-compose.yml up -d $BUILD_FLAG
docker compose -f OMS/docker-compose.yml up -d $BUILD_FLAG
docker compose -f WMS/docker-compose.yml up -d $BUILD_FLAG

echo ""
echo "Services started:"
echo "  PMI API:      http://localhost:18100"
echo "  PMI Frontend: http://localhost:13100"
echo "  OMS API:      http://localhost:18101"
echo "  OMS Frontend: http://localhost:13101"
echo "  WMS API:      http://localhost:18102"
echo "  WMS Frontend: http://localhost:13102"
echo ""
echo "Use 'docker compose -f <service>/docker-compose.yml logs -f' to view logs"
```

---

## Test Cases

### File: `tests/docker/test_docker_build.sh`

```bash
#!/bin/bash
set -e

echo "=== Test: Docker Build với Shared Packages ==="

# Test 1: PMI API builds
echo "Test 1: PMI API Docker build"
docker compose -f PMI/docker-compose.yml build api
echo "PASS"

# Test 2: PMI API can import shared package
echo "Test 2: Import shared package in container"
docker compose -f PMI/docker-compose.yml run --rm api \
    python -c "from topvnsport_common import paginate, NotFoundError; print('PASS')"

# Test 3: PMI Frontend builds
echo "Test 3: PMI Frontend Docker build"
docker compose -f PMI/docker-compose.yml build frontend
echo "PASS"

# Test 4: All modules importable
echo "Test 4: All backend modules importable"
docker compose -f PMI/docker-compose.yml run --rm api python -c "
from topvnsport_common.database import create_db_engine
from topvnsport_common.pagination import paginate
from topvnsport_common.exceptions import NotFoundError
from topvnsport_common.crypto import hash_password
from topvnsport_common.phone import normalize_phone
from topvnsport_common.auth import create_access_token
from topvnsport_common.logging import get_logger
print('PASS')
"

# Test 5: OMS builds
echo "Test 5: OMS Docker build"
docker compose -f OMS/docker-compose.yml build api
echo "PASS"

# Test 6: WMS builds
echo "Test 6: WMS Docker build"
docker compose -f WMS/docker-compose.yml build api
echo "PASS"

echo ""
echo "=== All Docker tests passed ==="
```

### File: `tests/docker/test_hot_reload.sh`

```bash
#!/bin/bash
set -e

echo "=== Test: Hot Reload với Volumes ==="

# Start services
docker compose -f PMI/docker-compose.yml up -d

# Wait for services
sleep 10

# Test 1: API health
echo "Test 1: API is running"
curl -f http://localhost:18100/health && echo " PASS" || (echo " FAIL" && exit 1)

# Test 2: Modify shared package và verify reload
echo "Test 2: Hot reload shared package"
# Add a test endpoint temporarily
cat >> packages/backend-common/topvnsport_common/__init__.py << 'EOF'
HOT_RELOAD_TEST = "success"
EOF

sleep 3  # Wait for reload

# Check if change is reflected
docker compose -f PMI/docker-compose.yml exec api \
    python -c "from topvnsport_common import HOT_RELOAD_TEST; print('PASS' if HOT_RELOAD_TEST == 'success' else 'FAIL')"

# Cleanup
git checkout packages/backend-common/topvnsport_common/__init__.py

# Stop services
docker compose -f PMI/docker-compose.yml down

echo ""
echo "=== Hot reload tests passed ==="
```

---

## Verification

```bash
# 1. Build all images
docker compose -f PMI/docker-compose.yml build
docker compose -f OMS/docker-compose.yml build
docker compose -f WMS/docker-compose.yml build

# 2. Run Docker tests
chmod +x tests/docker/test_docker_build.sh
./tests/docker/test_docker_build.sh

# 3. Start services
./start_all.sh

# 4. Verify services
curl http://localhost:18100/health
curl http://localhost:18101/health
curl http://localhost:18102/health

# 5. Run full test suite
docker compose -f PMI/docker-compose.yml exec api pytest tests/ -v
```

---

## Checklist

- [ ] PMI/backend/Dockerfile copies packages/
- [ ] PMI/frontend/Dockerfile builds ui-kit first
- [ ] docker-compose.yml uses context: ..
- [ ] Development volumes mount packages/
- [ ] Production compose has no volumes
- [ ] requirements.txt không có -e paths
- [ ] start_all.sh updated
- [ ] Hot reload works for shared packages
- [ ] All Docker tests pass
- [ ] All services start correctly
