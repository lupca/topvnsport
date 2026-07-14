# Gateway - Nginx API Gateway

API Gateway sử dụng Nginx với `auth_request` module để xác thực tập trung qua Identity Service.

## Cấu trúc

```
gateway/
├── nginx/
│   ├── nginx.conf          # Main nginx config
│   └── conf.d/
│       ├── upstream.conf   # Backend service definitions
│       └── locations.conf  # Route configs with auth
├── docker-compose.yml      # Gateway + Identity stack
├── test_auth.sh           # Auth flow test script
└── README.md
```

## Chạy Gateway

```bash
# Cần có PMI, OMS, WMS networks trước
docker network create pmi_default 2>/dev/null || true
docker network create oms_default 2>/dev/null || true
docker network create wms_default 2>/dev/null || true

# Start gateway + identity
cd gateway
docker compose up -d

# Verify
curl http://localhost:8080/health
```

## Test Auth Flow

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}' \
  | jq -r '.access_token')

# Verify token
curl -i http://localhost:8080/auth/verify \
  -H "Authorization: Bearer $TOKEN"

# Access PMI through gateway (requires PMI running)
curl http://localhost:8080/api/pmi/products \
  -H "Authorization: Bearer $TOKEN"
```

## Endpoints

| Path | Auth | Backend |
|------|------|---------|
| `/auth/*` | No | Identity Service |
| `/api/identity/*` | Yes | Identity Service |
| `/api/pmi/*` | Yes | PMI Backend |
| `/api/oms/*` | Yes | OMS Backend |
| `/api/wms/*` | Yes | WMS Backend |
| `/internal/pmi/*` | X-API-Key | PMI (service-to-service) |
| `/internal/oms/*` | X-API-Key | OMS (service-to-service) |
| `/health` | No | Nginx health check |
| `/` | No | Identity Frontend |

## Security

- Client `X-User-*` headers are ignored
- Only headers from `/auth/verify` response are trusted
- `/internal/*` endpoints only accessible from Docker networks
