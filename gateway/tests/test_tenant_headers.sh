#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
locations_file="$repo_root/gateway/nginx/conf.d/locations.prod.conf"
test_root="$(mktemp -d)"
container_id=""

cleanup() {
    if [[ -n "$container_id" ]]; then
        docker rm --force "$container_id" >/dev/null 2>&1 || true
    fi
    rm -rf "$test_root"
}
trap cleanup EXIT

fail() {
    echo "FAIL: $*" >&2
    exit 1
}

extract_server_block() {
    local host="$1"
    awk -v target="$host" '
        function brace_delta(line, copy, opens, closes) {
            copy = line
            opens = gsub(/\{/, "", copy)
            copy = line
            closes = gsub(/\}/, "", copy)
            return opens - closes
        }
        /^[[:space:]]*server[[:space:]]*\{/ && depth == 0 {
            inside = 1
            block = ""
        }
        inside {
            block = block $0 "\n"
            depth += brace_delta($0)
        }
        inside && depth == 0 {
            if (block ~ ("server_name[[:space:]]+" target "[[:space:]]*;")) {
                printf "%s", block
            }
            inside = 0
        }
    ' "$locations_file"
}

assert_once() {
    local block="$1"
    local directive="$2"
    local host="$3"
    local count
    count="$(grep -Fxc "$directive" <<<"$block" || true)"
    [[ "$count" == "1" ]] || fail "$host must contain exactly one: $directive (found $count)"
}

protected_hosts=(
    pim.voma.vn
    api-pim.voma.vn
    oms.voma.vn
    api-oms.voma.vn
    wms.voma.vn
    api-wms.voma.vn
)

for host in "${protected_hosts[@]}"; do
    block="$(extract_server_block "$host")"
    [[ -n "$block" ]] || fail "server block not found for $host"

    assert_once "$block" '        auth_request_set $auth_tenant_id $upstream_http_x_tenant_id;' "$host"
    assert_once "$block" '        auth_request_set $auth_tenant_code $upstream_http_x_tenant_code;' "$host"
    assert_once "$block" '        proxy_set_header X-Tenant-Id $auth_tenant_id;' "$host"
    assert_once "$block" '        proxy_set_header X-Tenant-Code $auth_tenant_code;' "$host"
    assert_once "$block" '        proxy_set_header X-Seller-Id $http_x_seller_id;' "$host"

    cors_count="$(grep -c "Access-Control-Allow-Headers.*X-Seller-Id" <<<"$block" || true)"
    [[ "$cors_count" == "1" ]] || fail "$host protected CORS must allow X-Seller-Id exactly once"
done

declare -A public_route_counts=(
    [api-pim.voma.vn]=2
    [api-oms.voma.vn]=1
    [api-wms.voma.vn]=2
)

for host in "${!public_route_counts[@]}"; do
    block="$(extract_server_block "$host")"
    expected="${public_route_counts[$host]}"
    tenant_clear_count="$(grep -Fxc '        proxy_set_header X-Tenant-Id "";' <<<"$block" || true)"
    seller_clear_count="$(grep -Fxc '        proxy_set_header X-Seller-Id "";' <<<"$block" || true)"
    [[ "$tenant_clear_count" == "$expected" ]] ||
        fail "$host must clear X-Tenant-Id on all $expected public upstream routes"
    [[ "$seller_clear_count" == "$expected" ]] ||
        fail "$host must clear X-Seller-Id on all $expected public upstream routes"
done

cat >"$test_root/nginx.conf" <<'NGINX'
events {}

http {
    server {
        listen 18080;

        location = /auth/verify {
            if ($http_authorization != "Bearer test-token") {
                return 401;
            }
            add_header X-Tenant-Id "tenant-A" always;
            add_header X-Tenant-Code "tenant-a" always;
            return 204;
        }
    }

    server {
        listen 18081;

        location / {
            default_type text/plain;
            return 200 "$http_x_tenant_id|$http_x_tenant_code|$http_x_seller_id\n";
        }
    }

    server {
        listen 8080;

        location = /ready {
            return 204;
        }

        location = /auth_verify {
            internal;
            proxy_pass http://127.0.0.1:18080/auth/verify;
            proxy_pass_request_body off;
            proxy_set_header Content-Length "";
            proxy_set_header Authorization $http_authorization;
        }

        location /public/ {
            proxy_pass http://127.0.0.1:18081;
            proxy_set_header X-Tenant-Id "";
            proxy_set_header X-Tenant-Code "";
            proxy_set_header X-Seller-Id "";
        }

        location /pmi/ {
            if ($request_method = OPTIONS) {
                add_header Access-Control-Allow-Headers "Content-Type,Authorization,X-Seller-Id" always;
                return 204;
            }
            auth_request /auth_verify;
            auth_request_set $auth_tenant_id $upstream_http_x_tenant_id;
            auth_request_set $auth_tenant_code $upstream_http_x_tenant_code;
            proxy_pass http://127.0.0.1:18081;
            proxy_set_header X-Tenant-Id $auth_tenant_id;
            proxy_set_header X-Tenant-Code $auth_tenant_code;
            proxy_set_header X-Seller-Id $http_x_seller_id;
        }

        location /oms/ {
            if ($request_method = OPTIONS) {
                add_header Access-Control-Allow-Headers "Content-Type,Authorization,X-Seller-Id" always;
                return 204;
            }
            auth_request /auth_verify;
            auth_request_set $auth_tenant_id $upstream_http_x_tenant_id;
            auth_request_set $auth_tenant_code $upstream_http_x_tenant_code;
            proxy_pass http://127.0.0.1:18081;
            proxy_set_header X-Tenant-Id $auth_tenant_id;
            proxy_set_header X-Tenant-Code $auth_tenant_code;
            proxy_set_header X-Seller-Id $http_x_seller_id;
        }

        location /wms/ {
            if ($request_method = OPTIONS) {
                add_header Access-Control-Allow-Headers "Content-Type,Authorization,X-Seller-Id" always;
                return 204;
            }
            auth_request /auth_verify;
            auth_request_set $auth_tenant_id $upstream_http_x_tenant_id;
            auth_request_set $auth_tenant_code $upstream_http_x_tenant_code;
            proxy_pass http://127.0.0.1:18081;
            proxy_set_header X-Tenant-Id $auth_tenant_id;
            proxy_set_header X-Tenant-Code $auth_tenant_code;
            proxy_set_header X-Seller-Id $http_x_seller_id;
        }
    }
}
NGINX

container_id="$(
    docker run --detach --rm \
        --publish 127.0.0.1::8080 \
        --volume "$test_root/nginx.conf:/etc/nginx/nginx.conf:ro" \
        nginx:alpine
)"
endpoint="$(docker port "$container_id" 8080/tcp)"
gateway_url="http://127.0.0.1:${endpoint##*:}"

for _ in $(seq 1 50); do
    if curl --silent --fail --output /dev/null "$gateway_url/ready"; then
        break
    fi
    sleep 0.1
done
curl --silent --fail --output /dev/null "$gateway_url/ready" ||
    fail "mock gateway did not become ready"

seller_a="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
seller_b="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

for service in pmi oms wms; do
    for seller in "$seller_a" "$seller_b"; do
        captured="$(
            curl --silent --show-error --fail \
                --header 'Authorization: Bearer test-token' \
                --header 'X-Tenant-Id: tenant-B' \
                --header 'X-Tenant-Code: tenant-b' \
                --header "X-Seller-Id: $seller" \
                "$gateway_url/$service/capture"
        )"
        [[ "$captured" == "tenant-A|tenant-a|$seller" ]] ||
            fail "$service propagated unexpected context: $captured"
    done

    preflight="$(
        curl --silent --show-error --dump-header - --output /dev/null \
            --request OPTIONS \
            --header 'Origin: https://app.voma.vn' \
            --header 'Access-Control-Request-Headers: X-Seller-Id' \
            "$gateway_url/$service/capture"
    )"
    grep -qi '^HTTP/.* 204' <<<"$preflight" || fail "$service CORS preflight did not return 204"
    grep -qi '^Access-Control-Allow-Headers:.*X-Seller-Id' <<<"$preflight" ||
        fail "$service CORS preflight does not allow X-Seller-Id"
done

public_capture="$(
    curl --silent --show-error --fail \
        --header 'X-Tenant-Id: tenant-B' \
        --header 'X-Tenant-Code: tenant-b' \
        --header "X-Seller-Id: $seller_a" \
        "$gateway_url/public/capture"
)"
[[ "$public_capture" == "||" ]] || fail "public route leaked client context: $public_capture"

echo "PASS: tenant overwrite, seller propagation, protected CORS, and public stripping verified"
