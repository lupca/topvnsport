# Phase 6: Testing

## Mục tiêu
- Đảm bảo mọi thứ hoạt động sau migration
- Test cả dev và production environment
- Không regression cho web storefront

---

## Test Environment Setup

### Dev
```bash
./start_all.sh
# Hoặc
docker network create pmi_default oms_default wms_default identity_default gateway_network 2>/dev/null || true
docker compose -f PMI/docker-compose.yml up -d
docker compose -f OMS/docker-compose.yml up -d
docker compose -f WMS/docker-compose.yml up -d
docker compose -f gateway/docker-compose.yml up -d
```

### Staging
```bash
EC2_HOST=staging.topvnsport.com ./deploy_prod.sh
```

---

## Test Suite

### 1. Gateway Health Tests

```bash
# Gateway health
curl -i http://localhost:8080/health
# Expected: 200 OK

# Identity API health
curl -i http://localhost:18110/health
# Expected: 200 OK
```

### 2. Authentication Tests

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}' | jq -r '.access_token')

echo "Token: $TOKEN"

# Verify token
curl -i http://localhost:8080/auth/verify \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 OK + user info

# Refresh token
REFRESH=$(curl -s -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}' | jq -r '.refresh_token')

curl -i -X POST http://localhost:8080/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$REFRESH\"}"
# Expected: 200 OK + new tokens
```

### 3. PMI API Tests

```bash
# Public endpoint (no auth)
curl -i http://localhost:8080/api/pmi/public/products
# Expected: 200 OK

# Protected endpoint WITHOUT auth
curl -i http://localhost:8080/api/pmi/products
# Expected: 401 Unauthorized

# Protected endpoint WITH auth
curl -i http://localhost:8080/api/pmi/products \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 OK + products list
```

### 4. OMS API Tests

```bash
# Protected endpoint WITHOUT auth
curl -i http://localhost:8080/api/oms/customers
# Expected: 401 Unauthorized

# Protected endpoint WITH auth
curl -i http://localhost:8080/api/oms/customers \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 OK

# Public endpoint (OTP - no auth required)
curl -i -X POST http://localhost:8080/api/oms/api/sms/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone_number":"0901234567"}'
# Expected: 200 OK (or rate limit error)
```

### 5. WMS API Tests

```bash
# Protected endpoint WITHOUT auth
curl -i http://localhost:8080/api/wms/warehouses
# Expected: 401 Unauthorized

# Protected endpoint WITH auth
curl -i http://localhost:8080/api/wms/warehouses \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 OK
```

### 6. Web Storefront Tests (Regression)

```bash
# Public products
curl -i http://localhost:8080/api/pmi/public/products
# Expected: 200 OK

# Public categories
curl -i http://localhost:8080/api/pmi/public/categories
# Expected: 200 OK

# Create order (no staff auth, uses OTP)
# This should still work for web storefront
curl -i -X POST http://localhost:8080/api/oms/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 1,
    "channel_id": 1,
    "shipping_fee": 30000,
    "shipping_address": "Test Address",
    "items": [{"sku_code": "TEST-SKU", "quantity": 1}]
  }'
# Expected: 200 OK (or validation error, NOT 401)
```

### 7. Frontend Tests

#### 7.1 PMI Frontend
1. Mở http://localhost:13100
2. Redirect tới Identity login? ✓
3. Đăng nhập thành công? ✓
4. Load danh sách sản phẩm? ✓
5. CRUD sản phẩm hoạt động? ✓
6. Kiểm tra Network tab: có `Authorization` header? ✓

#### 7.2 OMS Frontend
1. Mở http://localhost:13101
2. Redirect tới Identity login? ✓
3. Đăng nhập thành công? ✓
4. Load danh sách đơn hàng? ✓
5. CRUD đơn hàng hoạt động? ✓
6. Kiểm tra Network tab: có `Authorization` header? ✓

#### 7.3 WMS Frontend
1. Mở http://localhost:13102
2. Redirect tới Identity login? ✓
3. Đăng nhập thành công? ✓
4. Load inventory? ✓
5. Điều chỉnh tồn kho hoạt động? ✓
6. Kiểm tra Network tab: có `Authorization` header? ✓

#### 7.4 Web Storefront
1. Mở http://localhost:3000
2. Xem danh sách sản phẩm? ✓
3. Xem chi tiết sản phẩm? ✓
4. Thêm vào giỏ hàng? ✓
5. Checkout với OTP? ✓
6. Đặt hàng thành công? ✓

### 8. Service-to-Service Tests

```bash
# PMI internal API (từ OMS/WMS)
curl -i http://localhost:8080/internal/pmi/products \
  -H "X-API-Key: your-internal-service-token"
# Expected: 200 OK (nếu IP allowed) hoặc 403 (nếu từ external)
```

---

## Production Checklist

### Pre-deployment
- [ ] Staging tests all passed
- [ ] Database backed up
- [ ] Team notified of maintenance window
- [ ] Rollback plan reviewed

### Deployment
- [ ] Deploy gateway first
- [ ] Verify gateway health
- [ ] Test auth flow
- [ ] Test each service through gateway
- [ ] Monitor error rates

### Post-deployment (24h monitoring)
- [ ] No 401 errors tăng đột biến
- [ ] No 502/503 errors
- [ ] Web storefront orders working
- [ ] Admin CRUD working
- [ ] Response times acceptable

---

## Automated Test Script

**File:** `gateway/run_all_tests.sh`

```bash
#!/bin/bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
PASSED=0
FAILED=0

test_endpoint() {
    local name=$1
    local method=$2
    local url=$3
    local expected_status=$4
    local auth=$5
    local body=$6
    
    local headers="-H 'Content-Type: application/json'"
    if [ -n "$auth" ]; then
        headers="$headers -H 'Authorization: Bearer $auth'"
    fi
    
    local cmd="curl -s -o /dev/null -w '%{http_code}' -X $method '$url' $headers"
    if [ -n "$body" ]; then
        cmd="$cmd -d '$body'"
    fi
    
    local status=$(eval $cmd)
    
    if [ "$status" = "$expected_status" ]; then
        echo -e "${GREEN}✓${NC} $name (expected $expected_status, got $status)"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $name (expected $expected_status, got $status)"
        ((FAILED++))
    fi
}

echo "=== Gateway Migration Tests ==="
echo ""

# Get token
echo "Getting auth token..."
LOGIN_RESPONSE=$(curl -s -X POST "$GATEWAY_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}')
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token // empty')

if [ -z "$TOKEN" ]; then
    echo -e "${RED}Failed to get token. Aborting.${NC}"
    exit 1
fi
echo -e "${GREEN}Token acquired${NC}"
echo ""

# Health checks
echo "--- Health Checks ---"
test_endpoint "Gateway health" "GET" "$GATEWAY_URL/health" "200" "" ""

# Auth endpoints
echo ""
echo "--- Auth Endpoints ---"
test_endpoint "Verify token" "GET" "$GATEWAY_URL/auth/verify" "200" "$TOKEN" ""
test_endpoint "Verify without token" "GET" "$GATEWAY_URL/auth/verify" "401" "" ""

# PMI endpoints
echo ""
echo "--- PMI Endpoints ---"
test_endpoint "PMI public products" "GET" "$GATEWAY_URL/api/pmi/public/products" "200" "" ""
test_endpoint "PMI protected without auth" "GET" "$GATEWAY_URL/api/pmi/products" "401" "" ""
test_endpoint "PMI protected with auth" "GET" "$GATEWAY_URL/api/pmi/products" "200" "$TOKEN" ""

# OMS endpoints
echo ""
echo "--- OMS Endpoints ---"
test_endpoint "OMS protected without auth" "GET" "$GATEWAY_URL/api/oms/customers" "401" "" ""
test_endpoint "OMS protected with auth" "GET" "$GATEWAY_URL/api/oms/customers" "200" "$TOKEN" ""

# WMS endpoints
echo ""
echo "--- WMS Endpoints ---"
test_endpoint "WMS protected without auth" "GET" "$GATEWAY_URL/api/wms/warehouses" "401" "" ""
test_endpoint "WMS protected with auth" "GET" "$GATEWAY_URL/api/wms/warehouses" "200" "$TOKEN" ""

# Summary
echo ""
echo "=== Summary ==="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"

if [ $FAILED -gt 0 ]; then
    exit 1
fi
```

---

## Checklist Phase 6

- [ ] Run `gateway/test_auth.sh`
- [ ] Run `gateway/test_gateway.sh`
- [ ] Run `gateway/run_all_tests.sh`
- [ ] Manual test PMI frontend
- [ ] Manual test OMS frontend
- [ ] Manual test WMS frontend
- [ ] Manual test web storefront
- [ ] Deploy to staging
- [ ] Run all tests on staging
- [ ] Deploy to production
- [ ] Monitor 24h

---

## Troubleshooting

### 401 Unauthorized everywhere
- Kiểm tra Identity Service có chạy không
- Kiểm tra JWT_SECRET_KEY giống nhau giữa Identity và backends
- Kiểm tra token chưa hết hạn

### 502 Bad Gateway
- Kiểm tra backend service có chạy không
- Kiểm tra upstream config đúng container name và port
- Kiểm tra networks đã connect

### CORS errors
- Kiểm tra CORS config trong mỗi backend
- Thêm CORS headers trong gateway nếu cần

### Timeout errors
- Tăng proxy_read_timeout trong nginx config
- Kiểm tra backend response time
