# Identity Service - Implementation Plan Overview

## Mục tiêu
Xây dựng hệ thống SSO tập trung cho Staff trên PMI, OMS, WMS với kiến trúc API Gateway Offloading.

## Phạm vi
- **In-scope:** 
  - Identity Service Backend (FastAPI)
  - Identity Management Frontend (Next.js)
  - Nginx Gateway với auth_request
  - Tích hợp PMI/OMS/WMS

- **Out-of-scope:**
  - Customer authentication (CIAM)
  - Service-to-Service auth (giữ nguyên X-API-Key)

## Timeline ước tính: 2-3 tuần

| Phase | Nội dung | Thời gian |
|-------|----------|-----------|
| Phase 1 | Identity Service Backend | 4-5 ngày |
| Phase 2 | Identity Management UI | 3-4 ngày |
| Phase 3 | Nginx Gateway Setup | 2 ngày |
| Phase 4 | Tích hợp PMI/OMS/WMS | 3-4 ngày |
| Phase 5 | Testing & Go-live | 2-3 ngày |

## Kiến trúc tổng thể

```
┌─────────────────────────────────────────────────────────────────────┐
│                         NGINX GATEWAY                               │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  location /api/pmi/  →  auth_request /auth/verify           │   │
│  │  location /api/oms/  →  auth_request /auth/verify           │   │
│  │  location /api/wms/  →  auth_request /auth/verify           │   │
│  │  location /auth/     →  proxy_pass identity-service (NO auth)│   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│              ┌───────────────┼───────────────┐                     │
│              ▼               ▼               ▼                     │
│    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐              │
│    │ PMI Backend  │ │ OMS Backend  │ │ WMS Backend  │              │
│    │  (port 8000) │ │  (port 8000) │ │  (port 8000) │              │
│    └──────────────┘ └──────────────┘ └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │  IDENTITY SERVICE    │
                   │  - POST /auth/login  │
                   │  - GET /auth/verify  │
                   │  - POST /auth/refresh│
                   │  - CRUD /staff       │
                   │  - CRUD /roles       │
                   └──────────────────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │   identity-db        │
                   │   (PostgreSQL)       │
                   └──────────────────────┘
```

## Port Map (sau khi triển khai)

| Service | Internal Port | External Port |
|---------|---------------|---------------|
| Nginx Gateway | 80 | 8080 |
| Identity Service API | 8000 | 18110 |
| Identity Frontend | 3000 | 13110 |
| Identity Postgres | 5432 | 15436 |
| PMI API | 8000 | (via nginx) |
| OMS API | 8000 | (via nginx) |
| WMS API | 8000 | (via nginx) |
| PMI Frontend | 3000 | 13100 |
| OMS Frontend | 3000 | 13101 |
| WMS Frontend | 3000 | 13102 |

## Luồng xác thực

### Login Flow
```
1. User → Identity Frontend → POST /auth/login
2. Identity Service verify credentials → Return JWT
3. Frontend stores token in localStorage
4. User redirects to PMI/OMS/WMS
```

### Request Flow (sau login)
```
1. Frontend → Nginx (Bearer token)
2. Nginx → GET /auth/verify (sub-request)
3. Identity Service validates JWT
4. If valid: Return 200 + X-User-* headers
5. Nginx injects headers → Backend
6. Backend reads headers, processes request
```

## Danh sách documents

| File | Nội dung |
|------|----------|
| [01_identity_backend.md](./01_identity_backend.md) | Identity Service Backend spec |
| [02_identity_frontend.md](./02_identity_frontend.md) | Identity Management UI spec |
| [03_nginx_gateway.md](./03_nginx_gateway.md) | Nginx configuration |
| [04_pmi_integration.md](./04_pmi_integration.md) | PMI Backend/Frontend changes |
| [05_oms_wms_integration.md](./05_oms_wms_integration.md) | OMS/WMS integration |
| [06_test_specifications.md](./06_test_specifications.md) | Test cases cho toàn hệ thống |
| [07_deployment.md](./07_deployment.md) | Deployment & migration plan |
