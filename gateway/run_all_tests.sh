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
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗${NC} $name (expected $expected_status, got $status)"
        FAILED=$((FAILED + 1))
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
