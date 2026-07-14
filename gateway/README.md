# Gateway - API Gateway with SSO

API Gateway sử dụng Nginx với `auth_request` module để xác thực tập trung qua Identity Service.

## Cấu trúc

```
gateway/
├── nginx/
│   ├── nginx.conf               # Main nginx config
│   └── conf.d/
│       ├── upstream.conf        # Dev backend service definitions
│       ├── upstream.prod.conf   # Prod backend service definitions
│       ├── locations.conf       # Dev route configs (path-based)
│       └── locations.prod.conf  # Prod route configs (subdomain-based)
├── docker-compose.yml           # Gateway + Identity stack (Dev)
├── docker-compose.prod.yml      # Gateway stack (Prod)
├── test_auth.sh                # Auth flow test script
├── test_gateway.sh             # Full integration test script
└── README.md
```

## Chạy Gateway

### Development
```bash
# Tạo networks trước (hoặc dùng start_all.sh)
docker network create pmi_default oms_default wms_default identity_default gateway_network 2>/dev/null || true

# Start gateway + identity
cd gateway
docker compose up -d

# Verify
curl http://localhost:8080/health
./test_gateway.sh
```

### Production
```bash
docker compose -f docker-compose.prod.yml up -d
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
| `/api/pmi/public/*` | No | PMI Public Endpoints |
| `/api/pmi/*` | Yes | PMI Backend |
| `/api/oms/*` | Yes | OMS Backend |
| `/api/wms/*` | Yes | WMS Backend |
| `/internal/pmi/*` | X-API-Key | PMI (service-to-service) |
| `/internal/oms/*` | X-API-Key | OMS (service-to-service) |
| `/health` | No | Nginx health check |
| `/` | No | Identity Frontend |

## Security

- Client `X-User-*` headers are ignored and stripped at the Gateway level
- Only headers from `/auth/verify` response are trusted and injected
- `/internal/*` endpoints only accessible from Docker networks or authorized services
