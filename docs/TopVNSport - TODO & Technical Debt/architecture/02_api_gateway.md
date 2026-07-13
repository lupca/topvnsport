# ARCHITECTURE: API Gateway Enhancement

## Mức độ: HIGH
## Estimated Effort: Medium (3-5 days)

---

## Vấn Đề Hiện Tại

### nginx Hiện Tại Chỉ Là Reverse Proxy

**File:** `nginx/conf.d/default.conf`

```nginx
# Current - chỉ proxy đơn giản
server {
    listen 80;
    server_name api-pmi.topvnsport.com;
    
    location / {
        proxy_pass http://pim-api:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Missing Gateway Features

| Feature | Status | Risk |
|---------|--------|------|
| Rate limiting | ❌ Missing | DDoS vulnerability |
| Authentication | ❌ Missing | Open APIs |
| Request logging | ❌ Missing | No audit trail |
| Circuit breaker | ❌ Missing | Cascading failures |
| SSL/TLS | ❌ Missing | Data interception |
| CORS unified | ❌ Per-service | Inconsistent |
| API versioning | ❌ Missing | Breaking changes |
| Health aggregation | ❌ Missing | No unified status |

---

## Giải Pháp Đề Xuất

### Option A: Enhanced nginx + Lua (OpenResty)

Lightweight, build on existing nginx:

```nginx
# nginx/conf.d/gateway.conf

# Rate limiting zone
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $http_authorization zone=auth_limit:10m rate=100r/s;

# Upstream health checks
upstream pmi_api {
    server pim-api:8000;
    keepalive 32;
}

upstream oms_api {
    server oms_backend:8001;
    keepalive 32;
}

upstream wms_api {
    server wms-api:8002;
    keepalive 32;
}

# Main API Gateway
server {
    listen 443 ssl http2;
    server_name api.topvnsport.com;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/topvnsport.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/topvnsport.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Request logging
    access_log /var/log/nginx/api_access.log combined;
    error_log /var/log/nginx/api_error.log;
    
    # Rate limiting
    limit_req zone=api_limit burst=20 nodelay;
    
    # CORS - unified
    add_header 'Access-Control-Allow-Origin' '$http_origin' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, X-API-Key' always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;
    
    if ($request_method = 'OPTIONS') {
        return 204;
    }
    
    # API versioning via path
    # /v1/pmi/* -> PMI API
    # /v1/oms/* -> OMS API
    # /v1/wms/* -> WMS API
    
    location /v1/pmi/ {
        rewrite ^/v1/pmi/(.*) /api/v1/$1 break;
        proxy_pass http://pmi_api;
        include /etc/nginx/conf.d/proxy_params.conf;
    }
    
    location /v1/oms/ {
        rewrite ^/v1/oms/(.*) /api/$1 break;
        proxy_pass http://oms_api;
        include /etc/nginx/conf.d/proxy_params.conf;
    }
    
    location /v1/wms/ {
        rewrite ^/v1/wms/(.*) /api/$1 break;
        proxy_pass http://wms_api;
        include /etc/nginx/conf.d/proxy_params.conf;
    }
    
    # Health check aggregation
    location /health {
        content_by_lua_block {
            local http = require "resty.http"
            local httpc = http.new()
            
            local services = {
                {name = "pmi", url = "http://pim-api:8000/health"},
                {name = "oms", url = "http://oms_backend:8001/api/health"},
                {name = "wms", url = "http://wms-api:8002/api/health"},
            }
            
            local results = {}
            local all_healthy = true
            
            for _, svc in ipairs(services) do
                local res, err = httpc:request_uri(svc.url, {method = "GET"})
                if res and res.status == 200 then
                    results[svc.name] = "healthy"
                else
                    results[svc.name] = "unhealthy"
                    all_healthy = false
                end
            end
            
            ngx.status = all_healthy and 200 or 503
            ngx.header["Content-Type"] = "application/json"
            ngx.say(require("cjson").encode({
                status = all_healthy and "healthy" or "degraded",
                services = results,
                timestamp = os.date("!%Y-%m-%dT%H:%M:%SZ")
            }))
        }
    }
}
```

### Option B: Kong API Gateway

Full-featured gateway, more complex:

```yaml
# docker-compose.gateway.yml
services:
  kong:
    image: kong:3.4
    environment:
      KONG_DATABASE: "off"
      KONG_DECLARATIVE_CONFIG: /kong/kong.yml
      KONG_PROXY_LISTEN: "0.0.0.0:8000, 0.0.0.0:8443 ssl"
    volumes:
      - ./kong/kong.yml:/kong/kong.yml
    ports:
      - "80:8000"
      - "443:8443"
```

```yaml
# kong/kong.yml
_format_version: "3.0"

services:
  - name: pmi-service
    url: http://pim-api:8000
    routes:
      - name: pmi-route
        paths: ["/v1/pmi"]
        strip_path: true
    plugins:
      - name: rate-limiting
        config:
          minute: 100
      - name: jwt
        config:
          secret_is_base64: false
      - name: cors
      
  - name: oms-service
    url: http://oms_backend:8001
    routes:
      - name: oms-route
        paths: ["/v1/oms"]
    plugins:
      - name: rate-limiting
        config:
          minute: 200
```

---

## Comparison

| Feature | nginx + Lua | Kong | Traefik |
|---------|-------------|------|---------|
| Setup complexity | Low | Medium | Low |
| Rate limiting | Manual | Built-in | Built-in |
| JWT validation | Manual | Plugin | Middleware |
| Observability | Manual | Built-in | Built-in |
| Service discovery | No | Yes | Yes (Docker) |
| Learning curve | Low | Medium | Low |
| Resource usage | Very low | Medium | Low |

**Recommendation:** Enhanced nginx for now (existing infrastructure), consider Kong khi scale lớn hơn.

---

## Implementation - Enhanced nginx

### Step 1: Install OpenResty

```dockerfile
# nginx/Dockerfile
FROM openresty/openresty:alpine

COPY conf.d/ /etc/nginx/conf.d/
COPY lua/ /etc/nginx/lua/
```

### Step 2: Add Rate Limiting

```nginx
# Already included in gateway.conf above
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

location /v1/pmi/ {
    limit_req zone=api_limit burst=20 nodelay;
    # ...
}
```

### Step 3: Add JWT Validation (Lua)

```lua
-- nginx/lua/jwt_auth.lua
local jwt = require "resty.jwt"

local function validate_jwt()
    local auth_header = ngx.req.get_headers()["Authorization"]
    if not auth_header then
        ngx.status = 401
        ngx.say('{"error": "Missing Authorization header"}')
        return ngx.exit(401)
    end
    
    local token = string.match(auth_header, "Bearer%s+(.+)")
    if not token then
        ngx.status = 401
        ngx.say('{"error": "Invalid Authorization format"}')
        return ngx.exit(401)
    end
    
    local jwt_obj = jwt:verify(os.getenv("JWT_SECRET"), token)
    if not jwt_obj.verified then
        ngx.status = 401
        ngx.say('{"error": "Invalid token"}')
        return ngx.exit(401)
    end
    
    -- Pass user info to backend
    ngx.req.set_header("X-User-ID", jwt_obj.payload.sub)
    ngx.req.set_header("X-User-Role", jwt_obj.payload.role)
end

return {
    validate = validate_jwt
}
```

```nginx
# Protected routes
location /v1/pmi/admin/ {
    access_by_lua_block {
        require("jwt_auth").validate()
    }
    proxy_pass http://pmi_api;
}

# Public routes (no JWT required)
location /v1/pmi/public/ {
    proxy_pass http://pmi_api;
}
```

### Step 4: Unified Error Handling

```nginx
# Custom error pages
error_page 500 502 503 504 /50x.json;
location = /50x.json {
    internal;
    default_type application/json;
    return 500 '{"error": "Service temporarily unavailable", "code": "SERVICE_ERROR"}';
}

error_page 429 /429.json;
location = /429.json {
    internal;
    default_type application/json;
    return 429 '{"error": "Too many requests", "code": "RATE_LIMITED", "retry_after": 60}';
}
```

---

## Files Cần Tạo/Modify

| File | Action |
|------|--------|
| `nginx/Dockerfile` | Switch to OpenResty |
| `nginx/conf.d/gateway.conf` | New gateway config |
| `nginx/conf.d/proxy_params.conf` | Shared proxy settings |
| `nginx/lua/jwt_auth.lua` | JWT validation |
| `nginx/lua/rate_limit.lua` | Custom rate limiting |
| `docker-compose.yml` | Update nginx service |

---

## Verification

```bash
# Test rate limiting
for i in {1..50}; do curl -s -o /dev/null -w "%{http_code}\n" http://api.topvnsport.com/v1/pmi/products; done
# Should see 429 after ~20 requests

# Test JWT validation
curl -H "Authorization: Bearer invalid" http://api.topvnsport.com/v1/pmi/admin/users
# Should return 401

# Test health endpoint
curl http://api.topvnsport.com/health
# Should return aggregated health status

# Test unified error
docker stop pim-api
curl http://api.topvnsport.com/v1/pmi/products
# Should return JSON error, not nginx HTML
```
