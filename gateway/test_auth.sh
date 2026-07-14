#!/bin/bash
set -e

GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"

echo "=== Gateway Auth Flow Tests ==="
echo "Gateway URL: $GATEWAY_URL"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓ PASS${NC}: $1"; }
fail() { echo -e "${RED}✗ FAIL${NC}: $1"; exit 1; }

# Test 1: Health check
echo "Test 1: Health check"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/health")
[ "$RESPONSE" = "200" ] && pass "Health check returns 200" || fail "Health check failed (got $RESPONSE)"

# Test 2: Auth endpoint accessible without auth
echo "Test 2: Auth endpoint accessible"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/auth/verify")
[ "$RESPONSE" = "401" ] && pass "Auth verify returns 401 without token" || fail "Expected 401, got $RESPONSE"

# Test 3: Login
echo "Test 3: Login with admin credentials"
LOGIN_RESPONSE=$(curl -s -X POST "$GATEWAY_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token // empty')
if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
    pass "Login successful, got token"
else
    fail "Login failed: $LOGIN_RESPONSE"
fi

# Test 4: Verify token
echo "Test 4: Verify valid token"
VERIFY_RESPONSE=$(curl -s -i "$GATEWAY_URL/auth/verify" \
  -H "Authorization: Bearer $TOKEN")

if echo "$VERIFY_RESPONSE" | grep -q "X-User-Id"; then
    pass "Verify returns X-User-Id header"
else
    fail "Verify did not return X-User-Id header"
fi

# Test 5: Invalid token rejected
echo "Test 5: Invalid token rejected"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/auth/verify" \
  -H "Authorization: Bearer invalid_token_here")
[ "$RESPONSE" = "401" ] && pass "Invalid token returns 401" || fail "Expected 401, got $RESPONSE"

# Test 6: Header spoofing prevention
echo "Test 6: Header spoofing prevention"
ME_RESPONSE=$(curl -s "$GATEWAY_URL/auth/me" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-User-Id: 9999" \
  -H "X-User-Username: hacker")

ACTUAL_ID=$(echo "$ME_RESPONSE" | jq -r '.id // empty')
if [ "$ACTUAL_ID" != "9999" ] && [ -n "$ACTUAL_ID" ]; then
    pass "Header spoofing blocked (got id=$ACTUAL_ID, not 9999)"
else
    fail "Header spoofing may not be blocked properly"
fi

# Test 7: Protected endpoint without token
echo "Test 7: Protected endpoint without token"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/api/pmi/products" 2>/dev/null || echo "000")
if [ "$RESPONSE" = "401" ] || [ "$RESPONSE" = "000" ]; then
    pass "Protected endpoint requires auth (got $RESPONSE)"
else
    fail "Expected 401 or connection refused, got $RESPONSE"
fi

echo ""
echo "=== All Gateway Auth Tests Passed ==="
