# Phase 4: Update Scripts

## Mục tiêu
- Cập nhật `deploy_prod.sh` dùng gateway thay vì nginx
- Cập nhật `start_all.sh` thêm gateway cho dev

---

## Task 4.1: Cập nhật deploy_prod.sh

**File:** `deploy_prod.sh`

### 4.1.1 Thay đổi dòng 79

```bash
# CŨ
sudo -E docker compose -f nginx/docker-compose.yml up -d --build

# MỚI
sudo -E docker compose -f gateway/docker-compose.prod.yml up -d --build
```

### 4.1.2 Thêm health check cho gateway

Sau khi start gateway, thêm:

```bash
echo "Waiting for Gateway to be healthy..."
timeout 60 bash -c 'until curl -sf http://localhost/health > /dev/null 2>&1; do sleep 2; done'
if [ $? -eq 0 ]; then
    echo "Gateway is healthy"
else
    echo "WARNING: Gateway health check failed"
fi
```

### 4.1.3 Full diff

```diff
--- a/deploy_prod.sh
+++ b/deploy_prod.sh
@@ -76,7 +76,13 @@ fi
 # Start reverse proxy
 echo ""
 echo "Starting reverse proxy..."
-sudo -E docker compose -f nginx/docker-compose.yml up -d --build
+sudo -E docker compose -f gateway/docker-compose.prod.yml up -d --build
+
+echo "Waiting for Gateway to be healthy..."
+timeout 60 bash -c 'until curl -sf http://localhost/health > /dev/null 2>&1; do sleep 2; done'
+if [ $? -eq 0 ]; then
+    echo "Gateway is healthy"
+else
+    echo "WARNING: Gateway health check failed"
+fi
 
 # Verify deployment
```

---

## Task 4.2: Cập nhật start_all.sh

**File:** `start_all.sh`

### 4.2.1 Thêm gateway network

Tìm section tạo networks, thêm:

```bash
# Ensure all networks exist
docker network create pmi_default 2>/dev/null || true
docker network create oms_default 2>/dev/null || true
docker network create wms_default 2>/dev/null || true
docker network create identity_default 2>/dev/null || true  # THÊM
docker network create gateway_network 2>/dev/null || true   # THÊM
```

### 4.2.2 Thêm section start Gateway + Identity

Sau khi start PMI/OMS/WMS, thêm:

```bash
# ========================================
# Step: Start Gateway + Identity Service
# ========================================
echo ""
echo -e "${BLUE}Starting Gateway + Identity Service...${NC}"
docker compose -f gateway/docker-compose.yml up "${UP_ARGS[@]}"

# Wait for Identity API
echo "Waiting for Identity API..."
timeout 60 bash -c 'until curl -sf http://localhost:18110/health > /dev/null 2>&1; do sleep 2; done' || true

# Wait for Gateway
echo "Waiting for Gateway..."
timeout 30 bash -c 'until curl -sf http://localhost:8080/health > /dev/null 2>&1; do sleep 2; done' || true

echo -e "${GREEN}Gateway + Identity started${NC}"
```

### 4.2.3 Thêm vào watch mode (nếu có)

```bash
# Gateway watch
if [ "$WATCH_MODE" = true ]; then
    docker compose -f gateway/docker-compose.yml watch --no-up identity-api identity-frontend &
    WATCH_PIDS+=("$!")
fi
```

### 4.2.4 Thêm vào cleanup/stop

```bash
# Stop gateway
docker compose -f gateway/docker-compose.yml down
```

---

## Task 4.3: Tạo script test gateway

**File MỚI:** `gateway/test_gateway.sh`

```bash
#!/bin/bash

set -e

echo "=== Gateway Integration Test ==="

BASE_URL="${GATEWAY_URL:-http://localhost:8080}"
IDENTITY_URL="${IDENTITY_API_URL:-http://localhost:18110}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }

# Test 1: Gateway health
echo ""
echo "1. Testing Gateway health..."
curl -sf "$BASE_URL/health" > /dev/null && pass "Gateway is healthy" || fail "Gateway not responding"

# Test 2: Identity API health
echo ""
echo "2. Testing Identity API..."
curl -sf "$IDENTITY_URL/health" > /dev/null && pass "Identity API is healthy" || fail "Identity API not responding"

# Test 3: Auth flow - Login
echo ""
echo "3. Testing login..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token // empty')
if [ -n "$TOKEN" ]; then
    pass "Login successful"
else
    echo "Response: $LOGIN_RESPONSE"
    fail "Login failed"
fi

# Test 4: Verify token
echo ""
echo "4. Testing token verification..."
VERIFY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/auth/verify" \
  -H "Authorization: Bearer $TOKEN")
[ "$VERIFY_STATUS" = "200" ] && pass "Token verified" || fail "Token verification failed (status: $VERIFY_STATUS)"

# Test 5: PMI API with auth
echo ""
echo "5. Testing PMI API through Gateway..."
PMI_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/pmi/products" \
  -H "Authorization: Bearer $TOKEN")
[ "$PMI_STATUS" = "200" ] && pass "PMI API accessible" || fail "PMI API failed (status: $PMI_STATUS)"

# Test 6: PMI API without auth (should fail)
echo ""
echo "6. Testing PMI API without auth (should be 401)..."
NO_AUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/pmi/products")
[ "$NO_AUTH_STATUS" = "401" ] && pass "Unauthorized access blocked" || echo "WARNING: Got $NO_AUTH_STATUS instead of 401"

# Test 7: Public API (no auth required)
echo ""
echo "7. Testing public API..."
PUBLIC_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/pmi/public/products")
[ "$PUBLIC_STATUS" = "200" ] && pass "Public API accessible" || fail "Public API failed (status: $PUBLIC_STATUS)"

echo ""
echo "=== All tests passed ==="
```

---

## Task 4.4: Cập nhật docker-compose files thêm network

### PMI/docker-compose.yml

```yaml
services:
  api:
    networks:
      - default
      - gateway_network  # THÊM

networks:
  default:
    name: pmi_default
  gateway_network:  # THÊM
    external: true
```

### OMS/docker-compose.yml

```yaml
services:
  oms_backend:
    networks:
      - default
      - gateway_network  # THÊM

networks:
  default:
    name: oms_default
  gateway_network:  # THÊM
    external: true
```

### WMS/docker-compose.yml

```yaml
services:
  wms-api:
    networks:
      - default
      - gateway_network  # THÊM

networks:
  default:
    name: wms_default
  gateway_network:  # THÊM
    external: true
```

---

## Checklist Phase 4

- [ ] Sửa `deploy_prod.sh` dùng gateway/docker-compose.prod.yml
- [ ] Thêm health check cho gateway trong deploy_prod.sh
- [ ] Sửa `start_all.sh` thêm Gateway + Identity
- [ ] Tạo `gateway/test_gateway.sh`
- [ ] Cập nhật các docker-compose.yml thêm gateway_network
- [ ] Test: `./start_all.sh` khởi động thành công
- [ ] Test: `gateway/test_gateway.sh` pass

---

## Lưu ý

### Thứ tự khởi động
1. Networks (pmi_default, oms_default, wms_default, identity_default, gateway_network)
2. Databases (PMI, OMS, WMS, Identity)
3. Backends (PMI, OMS, WMS, Identity API)
4. Frontends
5. Gateway (cuối cùng, sau khi backends ready)

### Production deployment order
1. Identity Service (database + api + frontend)
2. PMI, OMS, WMS
3. Gateway (cuối cùng)
