# Deployment & Migration Plan

## Tổng quan
Document này mô tả quy trình deploy Identity Service và migration từ hệ thống cũ.

---

## 1. Prerequisites

### 1.1 Infrastructure Requirements

| Component | Requirement |
|-----------|-------------|
| Identity Service | 1 container (FastAPI) |
| Identity DB | PostgreSQL 15 |
| Identity Frontend | 1 container (Next.js) |
| Nginx Gateway | 1 container |
| Memory | +512MB RAM cho Identity stack |
| Storage | +1GB cho Identity DB |

### 1.2 Network Setup

```yaml
# Các networks cần tạo
networks:
  gateway_network:    # Nginx ↔ All services
  identity_network:   # Identity service internal
  pmi_default:        # PMI internal (existing)
  oms_default:        # OMS internal (existing)
  wms_default:        # WMS internal (existing)
```

### 1.3 Environment Variables

```bash
# Identity Service
JWT_SECRET_KEY=<generate-strong-secret-min-32-chars>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7
DATABASE_URL=postgresql://user:pass@identity-db:5432/identity_db

# PMI/OMS/WMS (update existing)
INTERNAL_SERVICE_TOKEN=<shared-service-token>

# Frontends (update existing)
NEXT_PUBLIC_IDENTITY_URL=http://<gateway-host>:8080
NEXT_PUBLIC_IDENTITY_LOGIN_URL=http://<identity-frontend-host>:13110/login
```

---

## 2. Deployment Sequence

### Phase 1: Deploy Identity Service (Day 1-2)

```bash
# Step 1: Tạo networks
docker network create gateway_network
docker network create identity_network

# Step 2: Deploy Identity DB
cd identity-service
docker compose up -d identity-db
# Wait for healthy
docker compose exec identity-db pg_isready -U postgres

# Step 3: Run migrations
docker compose run --rm identity-api alembic upgrade head

# Step 4: Deploy Identity API
docker compose up -d identity-api
# Verify
curl http://localhost:18110/health

# Step 5: Deploy Identity Frontend
docker compose up -d identity-frontend
# Verify
curl http://localhost:13110
```

### Phase 2: Deploy Nginx Gateway (Day 2)

```bash
# Step 1: Deploy Nginx
cd gateway
docker compose up -d nginx
# Verify
curl http://localhost:8080/health

# Step 2: Test auth flow
TOKEN=$(curl -s http://localhost:8080/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}' | jq -r '.access_token')

curl -i http://localhost:8080/auth/verify \
  -H "Authorization: Bearer $TOKEN"
# Should return 200 with X-User-* headers
```

### Phase 3: Migrate Users (Day 2-3)

```bash
# Step 1: Backup PMI users
docker compose -f PMI/docker-compose.yml exec db \
  pg_dump -U postgres -t users pim_db > pmi_users_backup.sql

# Step 2: Run migration script
export PMI_DATABASE_URL=postgresql://postgres:postgres@localhost:15433/pim_db
export IDENTITY_API_URL=http://localhost:18110
export ADMIN_TOKEN=<admin-token>

python scripts/migrate_users_to_identity.py

# Step 3: Verify migration
curl http://localhost:18110/staff \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.total'
# Should match PMI user count
```

### Phase 4: Update PMI (Day 3)

```bash
# Step 1: Update PMI backend code
# (Deploy new version with header-based auth)

# Step 2: Update PMI environment
# Set NEXT_PUBLIC_IDENTITY_URL, etc.

# Step 3: Restart PMI
docker compose -f PMI/docker-compose.yml up -d --build

# Step 4: Test PMI through Gateway
curl http://localhost:8080/api/pmi/products \
  -H "Authorization: Bearer $TOKEN"
```

### Phase 5: Update OMS & WMS (Day 4)

```bash
# Step 1: Update OMS
docker compose -f OMS/docker-compose.yml up -d --build

# Step 2: Update WMS
docker compose -f WMS/docker-compose.yml up -d --build

# Step 3: Test all systems
curl http://localhost:8080/api/oms/orders \
  -H "Authorization: Bearer $TOKEN"

curl http://localhost:8080/api/wms/inventory \
  -H "Authorization: Bearer $TOKEN"
```

### Phase 6: Go Live (Day 5)

```bash
# Step 1: Final health checks
./scripts/health_check_all.sh

# Step 2: Update DNS/Load Balancer to point to Gateway

# Step 3: Monitor logs
docker compose logs -f nginx identity-api pim-api oms-api wms-api
```

---

## 3. Docker Compose Files

### Root `docker-compose.prod.yml`

```yaml
version: "3.8"

services:
  # ========== GATEWAY ==========
  nginx:
    image: nginx:1.25-alpine
    container_name: gateway-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./gateway/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./gateway/nginx/conf.d:/etc/nginx/conf.d:ro
      - ./gateway/nginx/snippets:/etc/nginx/snippets:ro
      - ./gateway/ssl:/etc/nginx/ssl:ro  # SSL certs for production
    depends_on:
      - identity-api
      - pim-api
      - oms-api
      - wms-api
    networks:
      - gateway_network
    restart: unless-stopped

  # ========== IDENTITY ==========
  identity-db:
    image: postgres:15-alpine
    container_name: identity-db
    environment:
      - POSTGRES_USER=${IDENTITY_DB_USER:-postgres}
      - POSTGRES_PASSWORD=${IDENTITY_DB_PASSWORD}
      - POSTGRES_DB=identity_db
    volumes:
      - identity_pgdata:/var/lib/postgresql/data
    networks:
      - identity_network
    restart: unless-stopped

  identity-api:
    build:
      context: ./identity-service/backend
      dockerfile: Dockerfile
    container_name: identity-api
    environment:
      - DATABASE_URL=postgresql://${IDENTITY_DB_USER}:${IDENTITY_DB_PASSWORD}@identity-db:5432/identity_db
      - JWT_SECRET_KEY=${JWT_SECRET_KEY}
      - JWT_ALGORITHM=HS256
      - ACCESS_TOKEN_EXPIRE_MINUTES=60
    depends_on:
      - identity-db
    networks:
      - gateway_network
      - identity_network
    restart: unless-stopped

  identity-frontend:
    build:
      context: ./identity-service/frontend
      dockerfile: Dockerfile
    container_name: identity-frontend
    environment:
      - NEXT_PUBLIC_API_URL=${IDENTITY_API_URL}
    networks:
      - gateway_network
    restart: unless-stopped

  # ========== PMI ==========
  pim-db:
    image: postgres:15-alpine
    container_name: pim-db
    environment:
      - POSTGRES_USER=${PMI_DB_USER:-postgres}
      - POSTGRES_PASSWORD=${PMI_DB_PASSWORD}
      - POSTGRES_DB=pim_db
    volumes:
      - pmi_pgdata:/var/lib/postgresql/data
    networks:
      - pmi_network
    restart: unless-stopped

  pim-api:
    build:
      context: ./PMI/backend
      dockerfile: Dockerfile
    container_name: pim-api
    environment:
      - DATABASE_URL=postgresql://${PMI_DB_USER}:${PMI_DB_PASSWORD}@pim-db:5432/pim_db
      - INTERNAL_SERVICE_TOKEN=${INTERNAL_SERVICE_TOKEN}
      - MINIO_ENDPOINT=pim-minio:9000
      # ... other PMI vars
    depends_on:
      - pim-db
      - pim-minio
    networks:
      - gateway_network
      - pmi_network
    restart: unless-stopped

  # ... (similar for OMS, WMS)

volumes:
  identity_pgdata:
  pmi_pgdata:
  oms_pgdata:
  wms_pgdata:

networks:
  gateway_network:
    driver: bridge
  identity_network:
    driver: bridge
  pmi_network:
    driver: bridge
  oms_network:
    driver: bridge
  wms_network:
    driver: bridge
```

---

## 4. Health Check Script

### `scripts/health_check_all.sh`

```bash
#!/bin/bash
set -e

echo "=== System Health Check ==="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

check_service() {
    local name=$1
    local url=$2
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    
    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✓${NC} $name: OK"
        return 0
    else
        echo -e "${RED}✗${NC} $name: FAILED (HTTP $response)"
        return 1
    fi
}

# Check all services
FAILED=0

check_service "Nginx Gateway" "http://localhost:8080/health" || FAILED=1
check_service "Identity API" "http://localhost:18110/health" || FAILED=1
check_service "Identity Frontend" "http://localhost:13110" || FAILED=1
check_service "PMI API" "http://localhost:18100/health" || FAILED=1
check_service "PMI Frontend" "http://localhost:13100" || FAILED=1
check_service "OMS API" "http://localhost:18101/health" || FAILED=1
check_service "OMS Frontend" "http://localhost:13101" || FAILED=1
check_service "WMS API" "http://localhost:18102/health" || FAILED=1
check_service "WMS Frontend" "http://localhost:13102" || FAILED=1

echo ""

# Test auth flow
echo "=== Auth Flow Test ==="
TOKEN=$(curl -s http://localhost:8080/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}' 2>/dev/null | jq -r '.access_token')

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
    echo -e "${GREEN}✓${NC} Login: OK"
    
    # Test PMI through gateway
    PMI_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
      "http://localhost:8080/api/pmi/products" \
      -H "Authorization: Bearer $TOKEN")
    
    if [ "$PMI_RESPONSE" = "200" ]; then
        echo -e "${GREEN}✓${NC} PMI via Gateway: OK"
    else
        echo -e "${RED}✗${NC} PMI via Gateway: FAILED"
        FAILED=1
    fi
else
    echo -e "${RED}✗${NC} Login: FAILED"
    FAILED=1
fi

echo ""
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All checks passed!${NC}"
    exit 0
else
    echo -e "${RED}Some checks failed!${NC}"
    exit 1
fi
```

---

## 5. Monitoring & Logging

### 5.1 Log Aggregation

```yaml
# docker-compose.logging.yml
services:
  loki:
    image: grafana/loki:2.9.0
    ports:
      - "3100:3100"
    volumes:
      - loki_data:/loki

  promtail:
    image: grafana/promtail:2.9.0
    volumes:
      - /var/log:/var/log
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - ./promtail-config.yml:/etc/promtail/config.yml
    command: -config.file=/etc/promtail/config.yml

  grafana:
    image: grafana/grafana:10.0.0
    ports:
      - "3001:3000"
    volumes:
      - grafana_data:/var/lib/grafana
```

### 5.2 Key Metrics to Monitor

| Metric | Alert Threshold |
|--------|-----------------|
| Identity API response time | > 500ms |
| Login failure rate | > 10% in 5 min |
| Token verification latency | > 100ms |
| Gateway 5xx errors | > 1% |
| Active sessions | For capacity planning |

---

## 6. Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| 401 on all requests | JWT_SECRET_KEY mismatch | Verify same key in Identity & check |
| 502 Bad Gateway | Service not reachable | Check network connectivity |
| CORS errors | Missing headers | Update Nginx CORS config |
| Slow auth | DB connection issues | Check connection pool |

### Debug Commands

```bash
# Check Nginx auth_request
docker exec gateway-nginx nginx -T | grep auth_request

# Check Identity API logs
docker logs identity-api --tail 100

# Test token verification directly
curl -v http://localhost:18110/auth/verify \
  -H "Authorization: Bearer $TOKEN"

# Check network connectivity
docker exec gateway-nginx ping identity-api

# Check DB connections
docker exec identity-api python -c "from database import engine; print(engine.pool.status())"
```

---

## 7. Checklist

### Pre-Deployment
- [ ] Generate strong JWT_SECRET_KEY (min 32 chars)
- [ ] Generate INTERNAL_SERVICE_TOKEN
- [ ] Backup all databases
- [ ] Test migration script on staging
- [ ] Prepare monitoring dashboards
- [ ] Document emergency contacts

### Deployment
- [ ] Create networks
- [ ] Deploy Identity DB
- [ ] Run migrations
- [ ] Deploy Identity API
- [ ] Deploy Identity Frontend
- [ ] Deploy Nginx Gateway
- [ ] Migrate users
- [ ] Update PMI
- [ ] Update OMS
- [ ] Update WMS
- [ ] Run health checks
- [ ] Update DNS

### Post-Deployment
- [ ] Verify all users can login
- [ ] Verify cross-system SSO works
- [ ] Verify service-to-service calls work
- [ ] Monitor error rates for 24h
- [ ] Document any issues encountered
