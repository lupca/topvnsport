# Phase 1: Gateway Configuration

## Mục tiêu
- Chuẩn bị gateway cho cả dev (path-based) và prod (subdomain-based)
- Fix ports sai trong upstream config
- Tạo docker-compose.prod.yml

---

## Task 1.1: Fix upstream.conf (Dev)

**File:** `gateway/nginx/conf.d/upstream.conf`

**Vấn đề:** Ports của OMS/WMS đang sai (assume tất cả là 8000/3000)

**Sửa:**

```nginx
# Backend services
upstream identity_api {
    server identity-api:8000;
    keepalive 32;
}

upstream pmi_api {
    server pim-api:8000;
    keepalive 32;
}

upstream oms_api {
    server oms_backend:8001;   # FIX: 8000 → 8001
    keepalive 32;
}

upstream wms_api {
    server wms-api:8002;       # FIX: 8000 → 8002
    keepalive 32;
}

# Frontend services
upstream identity_frontend {
    server identity-frontend:3000;
}

upstream pmi_frontend {
    server pim-frontend:3000;
}

upstream oms_frontend {
    server oms_frontend:3001;   # FIX: 3000 → 3001
}

upstream wms_frontend {
    server wms_frontend:3002;   # FIX: 3000 → 3002
}
```

---

## Task 1.2: Tạo upstream.prod.conf

**File MỚI:** `gateway/nginx/conf.d/upstream.prod.conf`

```nginx
# ==============================================
# PRODUCTION UPSTREAM CONFIG
# Container names có suffix -prod cho identity
# ==============================================

# Backend services
upstream identity_api {
    server identity-api-prod:8000;
    keepalive 32;
}

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

# Frontend services
upstream identity_frontend {
    server identity-frontend-prod:3000;
}

upstream pmi_frontend {
    server pim-frontend:3000;
}

upstream oms_frontend {
    server oms_frontend:3001;
}

upstream wms_frontend {
    server wms_frontend:3002;
}

# Web storefront
upstream web_frontend {
    server web_frontend:80;
}

# MinIO
upstream minio {
    server pim-minio:9000;
}
```

---

## Task 1.3: Tạo locations.prod.conf

**File MỚI:** `gateway/nginx/conf.d/locations.prod.conf`

```nginx
# ==============================================
# PRODUCTION LOCATIONS - SUBDOMAIN ROUTING + AUTH
# ==============================================

# Internal auth endpoint (shared across all servers)
map $host $auth_backend {
    default identity_api;
}

# ====================
# MAIN WEBSITE
# ====================
server {
    listen 80;
    server_name topvnsport.com www.topvnsport.com;
    
    location / {
        proxy_pass http://web_frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# ====================
# IDENTITY SERVICE (SSO)
# ====================
server {
    listen 80;
    server_name identity.topvnsport.com;

    # Auth endpoints - NO auth required
    location /auth/ {
        proxy_pass http://identity_api/auth/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # Clear client-sent auth headers
        proxy_set_header X-User-Id "";
        proxy_set_header X-User-Username "";
        proxy_set_header X-User-Role "";
    }

    # Identity API proxy
    location /identity-api/ {
        proxy_pass http://identity_api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Identity Frontend
    location / {
        proxy_pass http://identity_frontend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

server {
    listen 80;
    server_name api-identity.topvnsport.com;
    
    location / {
        proxy_pass http://identity_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# ====================
# PMI SERVICE
# ====================
server {
    listen 80;
    server_name pmi.topvnsport.com;
    
    location / {
        proxy_pass http://pmi_frontend;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

server {
    listen 80;
    server_name api-pmi.topvnsport.com;

    location = /auth_verify {
        internal;
        proxy_pass http://identity_api/auth/verify;
        proxy_pass_request_body off;
        proxy_set_header Content-Length "";
        proxy_set_header X-Original-URI $request_uri;
        proxy_set_header Authorization $http_authorization;
    }

    location @auth_error {
        default_type application/json;
        return 401 '{"detail": "Unauthorized - Please login"}';
    }

    # Public endpoints - NO auth
    location /public/ {
        proxy_pass http://pmi_api/public/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location ~ ^/(docs|openapi\.json|health)$ {
        proxy_pass http://pmi_api;
        proxy_set_header Host $host;
    }

    # Protected endpoints - WITH auth
    location / {
        auth_request /auth_verify;
        auth_request_set $auth_user_id $upstream_http_x_user_id;
        auth_request_set $auth_user_username $upstream_http_x_user_username;
        auth_request_set $auth_user_role $upstream_http_x_user_role;
        auth_request_set $auth_user_permissions $upstream_http_x_user_permissions;
        error_page 401 = @auth_error;

        proxy_pass http://pmi_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-User-Id $auth_user_id;
        proxy_set_header X-User-Username $auth_user_username;
        proxy_set_header X-User-Role $auth_user_role;
        proxy_set_header X-User-Permissions $auth_user_permissions;
    }
}

# ====================
# OMS SERVICE
# ====================
server {
    listen 80;
    server_name oms.topvnsport.com;
    
    location / {
        proxy_pass http://oms_frontend;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

server {
    listen 80;
    server_name api-oms.topvnsport.com;

    location = /auth_verify {
        internal;
        proxy_pass http://identity_api/auth/verify;
        proxy_pass_request_body off;
        proxy_set_header Content-Length "";
        proxy_set_header X-Original-URI $request_uri;
        proxy_set_header Authorization $http_authorization;
    }

    location @auth_error {
        default_type application/json;
        return 401 '{"detail": "Unauthorized - Please login"}';
    }

    # Public endpoints for web storefront - NO auth
    location ~ ^/(api/sms|health|docs|openapi\.json) {
        proxy_pass http://oms_api;
        proxy_set_header Host $host;
    }

    # Protected endpoints - WITH auth
    location / {
        auth_request /auth_verify;
        auth_request_set $auth_user_id $upstream_http_x_user_id;
        auth_request_set $auth_user_username $upstream_http_x_user_username;
        auth_request_set $auth_user_role $upstream_http_x_user_role;
        auth_request_set $auth_user_permissions $upstream_http_x_user_permissions;
        error_page 401 = @auth_error;

        proxy_pass http://oms_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-User-Id $auth_user_id;
        proxy_set_header X-User-Username $auth_user_username;
        proxy_set_header X-User-Role $auth_user_role;
        proxy_set_header X-User-Permissions $auth_user_permissions;
    }
}

# ====================
# WMS SERVICE
# ====================
server {
    listen 80;
    server_name wms.topvnsport.com;
    
    location / {
        proxy_pass http://wms_frontend;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

server {
    listen 80;
    server_name api-wms.topvnsport.com;

    location = /auth_verify {
        internal;
        proxy_pass http://identity_api/auth/verify;
        proxy_pass_request_body off;
        proxy_set_header Content-Length "";
        proxy_set_header X-Original-URI $request_uri;
        proxy_set_header Authorization $http_authorization;
    }

    location @auth_error {
        default_type application/json;
        return 401 '{"detail": "Unauthorized - Please login"}';
    }

    location ~ ^/(health|docs|openapi\.json)$ {
        proxy_pass http://wms_api;
        proxy_set_header Host $host;
    }

    # Protected endpoints - WITH auth
    location / {
        auth_request /auth_verify;
        auth_request_set $auth_user_id $upstream_http_x_user_id;
        auth_request_set $auth_user_username $upstream_http_x_user_username;
        auth_request_set $auth_user_role $upstream_http_x_user_role;
        auth_request_set $auth_user_permissions $upstream_http_x_user_permissions;
        error_page 401 = @auth_error;

        proxy_pass http://wms_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-User-Id $auth_user_id;
        proxy_set_header X-User-Username $auth_user_username;
        proxy_set_header X-User-Role $auth_user_role;
        proxy_set_header X-User-Permissions $auth_user_permissions;
    }
}

# ====================
# MINIO (Media)
# ====================
server {
    listen 80;
    server_name media.topvnsport.com;
    client_max_body_size 100M;
    
    location / {
        proxy_pass http://minio;
        proxy_set_header Host $host;
    }
}

# ====================
# HEALTH CHECK (Default)
# ====================
server {
    listen 80 default_server;
    server_name _;
    
    location /health {
        access_log off;
        return 200 "OK\n";
        add_header Content-Type text/plain;
    }
    
    location / {
        return 444;
    }
}
```

---

## Task 1.4: Tạo docker-compose.prod.yml

**File MỚI:** `gateway/docker-compose.prod.yml`

```yaml
# ==============================================
# PRODUCTION GATEWAY
# Chỉ có nginx, không có identity service
# (Identity chạy riêng trong identity-service/)
# ==============================================

services:
  gateway-nginx:
    image: nginx:1.25-alpine
    container_name: gateway-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d/upstream.prod.conf:/etc/nginx/conf.d/upstream.conf:ro
      - ./nginx/conf.d/locations.prod.conf:/etc/nginx/conf.d/locations.conf:ro
      # SSL certs - uncomment khi có
      # - /etc/letsencrypt:/etc/letsencrypt:ro
    networks:
      - pmi_default
      - oms_default
      - wms_default
      - identity_default
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

networks:
  pmi_default:
    external: true
  oms_default:
    external: true
  wms_default:
    external: true
  identity_default:
    external: true
```

---

## Task 1.5: Rename locations.conf → locations.dev.conf

**File:** `gateway/nginx/conf.d/locations.conf`

Giữ nguyên nội dung, chỉ đổi tên để phân biệt với prod.

Hoặc giữ tên `locations.conf` cho dev (vì docker-compose.yml dev mount trực tiếp).

---

## Checklist Phase 1

- [ ] Fix ports trong `gateway/nginx/conf.d/upstream.conf`
- [ ] Tạo `gateway/nginx/conf.d/upstream.prod.conf`
- [ ] Tạo `gateway/nginx/conf.d/locations.prod.conf`
- [ ] Tạo `gateway/docker-compose.prod.yml`
- [ ] Test dev: `cd gateway && docker compose up`
- [ ] Verify: `curl http://localhost:8080/health`

---

## Lưu ý quan trọng

### Web storefront vẫn hoạt động vì:
- PMI: `/public/*` endpoints không cần auth
- OMS: `/api/sms/*` (OTP) không cần auth
- Các endpoint public được whitelist trong `locations.prod.conf`

### Service-to-service calls:
- OMS/WMS gọi PMI qua `/internal/*` với `X-API-Key`
- Đã có sẵn trong `locations.conf` hiện tại
- Cần copy sang `locations.prod.conf` nếu dùng
