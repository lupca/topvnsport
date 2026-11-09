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

## Seller API key (`X-API-Key: vk_…`)

Ứng dụng bên ngoài (VOMA Insights) gọi Gateway bằng API key theo seller thay cho JWT. Identity `/auth/verify` xác thực key, kiểm tra scope theo `X-Original-Method` + `X-Original-URI`, rồi trả về cùng bộ header `X-User-*`, `X-Tenant-Id`, `X-Seller-Id` như request của nhân viên. Gateway luôn lấy `X-Tenant-Id`/`X-Seller-Id` từ Identity và xoá `X-API-Key` trước khi gọi backend. Chi tiết: [`docs/api_keys.md`](../docs/api_keys.md).

```bash
KEY=vk_test_...   # tạo ở Identity → API key (chỉ hiện một lần)

curl -s "http://localhost:8080/api/oms/orders?page=1&limit=100" -H "X-API-Key: $KEY"           # 200 (insights:read)
curl -s "http://localhost:8080/api/pmi/products?page=1&limit=100" -H "X-API-Key: $KEY"         # 200 (insights:read)
curl -s "http://localhost:8080/api/wms/inbound-shipments" -H "X-API-Key: $KEY"                 # 200 (insights:read)
curl -s -X POST "http://localhost:8080/api/wms/inbound-shipments" -H "X-API-Key: $KEY" \
  -H 'Content-Type: application/json' -d '{...}'                                              # 200 chỉ khi có inbound:write, nếu không 403
curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:8080/api/oms/customers" -H "X-API-Key: $KEY"  # 403 (ngoài danh sách)
curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:8080/api/oms/orders" -H "X-API-Key: $KEY" \
  -H "X-Seller-Id: <seller khác>"                                                              # 403
curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:8080/api/oms/orders" -H "X-API-Key: vk_test_revoked..."  # 401
```

Production: base URL `https://api-identity.voma.vn` (location `/api/pmi/`, `/api/oms/`, `/api/wms/`). Các host theo dịch vụ (`api-oms.voma.vn`, `oms.voma.vn/oms-api`, …) luôn trả 403 cho API key.

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
- Only headers from `/auth/verify` response are trusted and injected (incl. `X-Tenant-Id`, `X-Tenant-Code`, `X-Seller-Id`)
- `X-API-Key` is removed before proxying to backends on authenticated routes (external `vk_` keys and the internal service token never pass the public edge)
- Backends trust these headers, so their ports must only be reachable through the Gateway
- `/internal/*` endpoints only accessible from Docker networks or authorized services
