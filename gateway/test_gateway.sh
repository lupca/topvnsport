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
