# Phase 3: Nginx Gateway Configuration

## Tổng quan
Cấu hình Nginx làm API Gateway với `auth_request` module để xác thực tập trung.

## Cấu trúc thư mục

```
gateway/
├── nginx/
│   ├── nginx.conf
│   ├── conf.d/
│   │   ├── upstream.conf
│   │   └── locations.conf
│   └── snippets/
│       └── auth.conf
├── docker-compose.yml
└── README.md
```

---

## 1. Nginx Configuration

### File: `nginx/nginx.conf`

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for" '
                    'auth_user=$upstream_http_x_user_id';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript 
               application/xml application/rss+xml application/atom+xml image/svg+xml;

    include /etc/nginx/conf.d/*.conf;
}
```

### File: `nginx/conf.d/upstream.conf`

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
    server oms-api:8000;
    keepalive 32;
}

upstream wms_api {
    server wms-api:8000;
    keepalive 32;
}

# Frontend services (for production)
upstream identity_frontend {
    server identity-frontend:3000;
}

upstream pmi_frontend {
    server pim-frontend:3000;
}

upstream oms_frontend {
    server oms-frontend:3000;
}

upstream wms_frontend {
    server wms-frontend:3000;
}
```

### File: `nginx/conf.d/locations.conf`

```nginx
server {
    listen 80;
    server_name localhost;

    # ====================
    # SECURITY HEADERS
    # ====================
    
    # Strip any X-User-* headers from client requests (CRITICAL)
    # Prevents header spoofing attacks
    set $clean_x_user_id "";
    set $clean_x_user_username "";
    set $clean_x_user_role "";
    set $clean_x_user_permissions "";

    # ====================
    # IDENTITY SERVICE (NO AUTH)
    # ====================
    
    # Auth endpoints - không cần xác thực
    location /auth/ {
        proxy_pass http://identity_api/auth/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Clear any client-sent auth headers
        proxy_set_header X-User-Id "";
        proxy_set_header X-User-Username "";
        proxy_set_header X-User-Role "";
        proxy_set_header X-User-Permissions "";
    }

    # Identity management API - cần xác thực
    location /api/identity/ {
        include /etc/nginx/snippets/auth.conf;
        
        proxy_pass http://identity_api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Inject authenticated user headers
        proxy_set_header X-User-Id $upstream_http_x_user_id;
        proxy_set_header X-User-Username $upstream_http_x_user_username;
        proxy_set_header X-User-Role $upstream_http_x_user_role;
        proxy_set_header X-User-Permissions $upstream_http_x_user_permissions;
    }

    # ====================
    # PMI SERVICE
    # ====================
    
    location /api/pmi/ {
        include /etc/nginx/snippets/auth.conf;
        
        # Rewrite để bỏ prefix /api/pmi
        rewrite ^/api/pmi/(.*)$ /api/$1 break;
        
        proxy_pass http://pmi_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Inject authenticated user headers
        proxy_set_header X-User-Id $upstream_http_x_user_id;
        proxy_set_header X-User-Username $upstream_http_x_user_username;
        proxy_set_header X-User-Role $upstream_http_x_user_role;
        proxy_set_header X-User-Permissions $upstream_http_x_user_permissions;
        
        # Keep Authorization header for service-to-service calls (X-API-Key)
        # PMI backend will check X-API-Key first, then fall back to X-User-* headers
    }

    # ====================
    # OMS SERVICE
    # ====================
    
    location /api/oms/ {
        include /etc/nginx/snippets/auth.conf;
        
        rewrite ^/api/oms/(.*)$ /api/$1 break;
        
        proxy_pass http://oms_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_set_header X-User-Id $upstream_http_x_user_id;
        proxy_set_header X-User-Username $upstream_http_x_user_username;
        proxy_set_header X-User-Role $upstream_http_x_user_role;
        proxy_set_header X-User-Permissions $upstream_http_x_user_permissions;
    }

    # ====================
    # WMS SERVICE
    # ====================
    
    location /api/wms/ {
        include /etc/nginx/snippets/auth.conf;
        
        rewrite ^/api/wms/(.*)$ /api/$1 break;
        
        proxy_pass http://wms_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_set_header X-User-Id $upstream_http_x_user_id;
        proxy_set_header X-User-Username $upstream_http_x_user_username;
        proxy_set_header X-User-Role $upstream_http_x_user_role;
        proxy_set_header X-User-Permissions $upstream_http_x_user_permissions;
    }

    # ====================
    # SERVICE-TO-SERVICE (INTERNAL)
    # ====================
    
    # Internal endpoints cho OMS/WMS gọi PMI
    # Sử dụng X-API-Key, không qua auth_request
    location /internal/pmi/ {
        # Chỉ cho phép từ internal network
        allow 172.16.0.0/12;  # Docker networks
        allow 10.0.0.0/8;
        deny all;
        
        rewrite ^/internal/pmi/(.*)$ /api/$1 break;
        
        proxy_pass http://pmi_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        # Keep X-API-Key header from calling service
    }

    # ====================
    # FRONTEND PROXIES (Production)
    # ====================
    
    location /pmi/ {
        proxy_pass http://pmi_frontend/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location /oms/ {
        proxy_pass http://oms_frontend/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location /wms/ {
        proxy_pass http://wms_frontend/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Identity frontend as default
    location / {
        proxy_pass http://identity_frontend/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # ====================
    # HEALTH CHECK
    # ====================
    
    location /health {
        access_log off;
        return 200 "OK\n";
        add_header Content-Type text/plain;
    }
}
```

### File: `nginx/snippets/auth.conf`

```nginx
# Auth subrequest configuration
# Include this in locations that require authentication

# Internal auth endpoint
auth_request /auth_verify;

# Capture response headers from auth endpoint
auth_request_set $upstream_http_x_user_id $upstream_http_x_user_id;
auth_request_set $upstream_http_x_user_username $upstream_http_x_user_username;
auth_request_set $upstream_http_x_user_role $upstream_http_x_user_role;
auth_request_set $upstream_http_x_user_permissions $upstream_http_x_user_permissions;

# Handle auth errors
error_page 401 = @auth_error;
error_page 403 = @auth_error;

# Internal location for auth verification
location = /auth_verify {
    internal;
    
    proxy_pass http://identity_api/auth/verify;
    proxy_pass_request_body off;
    proxy_set_header Content-Length "";
    proxy_set_header X-Original-URI $request_uri;
    proxy_set_header X-Original-Method $request_method;
    
    # Forward the Authorization header to Identity Service
    proxy_set_header Authorization $http_authorization;
    
    # Cache successful auth responses for 60 seconds
    proxy_cache_valid 200 60s;
}

location @auth_error {
    default_type application/json;
    return 401 '{"detail": "Unauthorized - Please login"}';
}
```

---

## 2. Docker Configuration

### File: `gateway/docker-compose.yml`

```yaml
services:
  nginx:
    image: nginx:1.25-alpine
    container_name: gateway-nginx
    ports:
      - "8080:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/snippets:/etc/nginx/snippets:ro
    depends_on:
      - identity-api
    networks:
      - gateway_network
      - identity_network
      - pmi_default
      - oms_default
      - wms_default
    healthcheck:
      test: ["CMD", "nginx", "-t"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

networks:
  gateway_network:
    driver: bridge
  identity_network:
    external: true
  pmi_default:
    external: true
  oms_default:
    external: true
  wms_default:
    external: true
```

---

## 3. Luồng xử lý request

### 3.1 User Request Flow

```
┌────────────┐     ┌─────────────────────────────────────────────────────────┐
│            │     │                      NGINX                              │
│  Browser   │────▶│  1. Receive request with Authorization: Bearer <token> │
│            │     │                                                         │
└────────────┘     │  2. auth_request → GET /auth/verify                    │
                   │     ┌──────────────────────────────────────────┐        │
                   │     │         Identity Service                 │        │
                   │     │  - Decode JWT                            │        │
                   │     │  - Check user exists & is_active         │        │
                   │     │  - Return 200 + X-User-* headers         │        │
                   │     │    OR 401 if invalid                     │        │
                   │     └──────────────────────────────────────────┘        │
                   │                                                         │
                   │  3. If 200: Inject headers → Forward to backend        │
                   │  4. If 401: Return error response                      │
                   │                                                         │
                   │  ┌──────────────────────────────────────────┐          │
                   │  │           PMI/OMS/WMS Backend            │          │
                   │  │  - Receive X-User-Id, X-User-Username    │          │
                   │  │  - X-User-Role, X-User-Permissions       │          │
                   │  │  - Process request with user context     │          │
                   │  └──────────────────────────────────────────┘          │
                   └─────────────────────────────────────────────────────────┘
```

### 3.2 Service-to-Service Flow

```
┌────────────┐     ┌─────────────────────────────────────────────────────────┐
│            │     │                      NGINX                              │
│  OMS API   │────▶│  Request to /internal/pmi/products                     │
│            │     │  X-API-Key: <service_token>                            │
└────────────┘     │                                                         │
                   │  [No auth_request - direct proxy]                      │
                   │                                                         │
                   │  ┌──────────────────────────────────────────┐          │
                   │  │              PMI Backend                 │          │
                   │  │  - Check X-API-Key header               │          │
                   │  │  - Verify against INTERNAL_SERVICE_TOKEN │          │
                   │  │  - Process as SERVICE actor              │          │
                   │  └──────────────────────────────────────────┘          │
                   └─────────────────────────────────────────────────────────┘
```

---

## 4. Security Considerations

### 4.1 Header Spoofing Prevention

**QUAN TRỌNG**: Nginx PHẢI strip tất cả X-User-* headers từ client request.

```nginx
# Trong mỗi location block, luôn set headers từ upstream response, KHÔNG từ client
proxy_set_header X-User-Id $upstream_http_x_user_id;
# KHÔNG PHẢI: proxy_set_header X-User-Id $http_x_user_id;
```

### 4.2 Internal Endpoints Protection

```nginx
location /internal/ {
    # Chỉ cho phép từ Docker internal networks
    allow 172.16.0.0/12;
    allow 10.0.0.0/8;
    deny all;
}
```

### 4.3 Rate Limiting (Optional)

```nginx
# Trong http block
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/s;

# Trong location /auth/login
limit_req zone=auth_limit burst=20 nodelay;

# Trong các API locations
limit_req zone=api_limit burst=50 nodelay;
```

---

## 5. Testing Configuration

### Test auth flow với curl:

```bash
# 1. Login để lấy token
TOKEN=$(curl -s -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}' \
  | jq -r '.access_token')

# 2. Test PMI endpoint qua gateway
curl -i http://localhost:8080/api/pmi/products \
  -H "Authorization: Bearer $TOKEN"

# 3. Verify response có X-User headers được inject
# Backend sẽ log: X-User-Id=1, X-User-Username=admin, X-User-Role=admin

# 4. Test với invalid token
curl -i http://localhost:8080/api/pmi/products \
  -H "Authorization: Bearer invalid_token"
# Expected: 401 Unauthorized

# 5. Test header spoofing prevention
curl -i http://localhost:8080/api/pmi/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-User-Id: 999" \
  -H "X-User-Role: admin"
# Expected: X-User-Id should be from token, NOT from request header
```

---

## 6. Checklist triển khai Phase 3

- [ ] Tạo thư mục `gateway/`
- [ ] Viết `nginx.conf` với logging format
- [ ] Viết `upstream.conf` cho tất cả services
- [ ] Viết `locations.conf` với auth_request
- [ ] Viết `auth.conf` snippet
- [ ] Setup Docker Compose với networks
- [ ] Test auth flow với curl
- [ ] Test header spoofing prevention
- [ ] Test service-to-service flow
- [ ] Test error handling (401, 403)
- [ ] Document API endpoints mapping
