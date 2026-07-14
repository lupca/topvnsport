# ARCHITECTURE: Centralized Identity Service (Staff SSO)

## Mức độ: HIGH
## Estimated Effort: High (2-3 weeks)

---

## Implementation Status (2026-07-14)

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Identity Backend | ✅ Complete | `identity-service/backend/` - Auth, Staff, Role APIs |
| Phase 2: Identity Frontend | ✅ Complete | `identity-service/frontend/` - Login, Dashboard, Staff/Role CRUD |
| Phase 3: Nginx Gateway | ✅ Complete | `gateway/` - auth_request config, header injection |
| Phase 4: PMI Integration | ✅ Complete | `PMI/backend/utils/dependency.py` - reads X-User-* headers |
| Phase 4: OMS/WMS Integration | ✅ Complete | `OMS/WMS backend/utils/auth.py` - header reading utilities |
| Phase 5: Testing & Go-live | ⏳ Pending | Run gateway stack, test auth flow |

---

> **CHI TIẾT TRIỂN KHAI**: Xem thư mục [03_identity_service_plan/](./03_identity_service_plan/) để có plan chi tiết cho từng phase.

## Quick Links

| Document | Nội dung |
|----------|----------|
| [00_overview.md](./03_identity_service_plan/00_overview.md) | Tổng quan kiến trúc & timeline |
| [01_identity_backend.md](./03_identity_service_plan/01_identity_backend.md) | Identity Service Backend (Models, APIs, Docker) |
| [02_identity_frontend.md](./03_identity_service_plan/02_identity_frontend.md) | Identity Management UI (Mockups, Components) |
| [03_nginx_gateway.md](./03_identity_service_plan/03_nginx_gateway.md) | Nginx Gateway Configuration |
| [04_pmi_integration.md](./03_identity_service_plan/04_pmi_integration.md) | PMI Backend/Frontend Integration |
| [05_oms_wms_integration.md](./03_identity_service_plan/05_oms_wms_integration.md) | OMS & WMS Integration |
| [06_test_specifications.md](./03_identity_service_plan/06_test_specifications.md) | Test Cases (Unit, Integration, E2E) |
| [07_deployment.md](./03_identity_service_plan/07_deployment.md) | Deployment & Migration Plan |

---

## 1. Yêu Cầu & Mục Tiêu

Kiến trúc này tập trung giải quyết bài toán Single Sign-On (SSO) và phân quyền tập trung cho **Nhân viên (Staff)** trên cả 3 hệ thống: PMI, OMS, và WMS.

- **In-scope:** 
  - Identity Service Backend (Cấp phát token & verify).
  - Identity Management Frontend (Giao diện cho Admin quản lý User/Role).
  - Nginx Gateway (Xử lý xác thực tập trung).
- **Out-of-scope (Tạm thời bỏ qua):**
  - Xác thực Khách hàng (Customer CIAM).
  - Giao tiếp Service-to-Service (Giữ nguyên X-API-Key cho OMS/WMS gọi PMI).

---

## 2. Đánh giá tác động lên hệ thống PMI hiện tại

**Câu hỏi:** Hiện tại auth của hệ thống PMI đang rất ổn định, khi thay đổi thì có ảnh hưởng lớn không?

**Trả lời: RẤT ÍT ẢNH HƯỞNG (Zero-Business-Logic Impact)**

Áp dụng pattern **API Gateway Offloading**:
- Hiện tại: Request → PMI Backend → PMI tự giải mã JWT → Chạy Logic.
- Sắp tới: Request → **Nginx (verify via Identity Service)** → Nginx inject Header `X-User-*` → PMI Backend → Chạy Logic.

**Việc cần làm ở PMI:** 
- Backend: Sửa `get_current_identity()` để đọc từ `X-User-*` headers thay vì decode JWT
- Frontend: Redirect login đến Identity Service, update apiClient với refresh token

**Giữ nguyên:**
- Service-to-Service auth (X-API-Key) cho OMS/WMS gọi PMI
- Toàn bộ business logic, database operations

---

## 3. Kiến Trúc Tổng Thể

```
┌─────────────────────────────────────────────────────────────────────┐
│                         NGINX GATEWAY (:8080)                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  location /auth/     →  proxy_pass identity (NO auth)       │   │
│  │  location /api/pmi/  →  auth_request + proxy to PMI         │   │
│  │  location /api/oms/  →  auth_request + proxy to OMS         │   │
│  │  location /api/wms/  →  auth_request + proxy to WMS         │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
        │                           │
        ▼                           ▼
┌──────────────────┐      ┌──────────────────────────────────────────┐
│ IDENTITY SERVICE │      │           BACKEND SERVICES               │
│  POST /auth/login│      │  PMI (:18100) - reads X-User-* headers   │
│  GET /auth/verify│      │  OMS (:18101) - reads X-User-* headers   │
│  CRUD /staff     │      │  WMS (:18102) - reads X-User-* headers   │
│  CRUD /roles     │      │                                          │
└──────────────────┘      │  Service-to-Service: X-API-Key (direct)  │
                          └──────────────────────────────────────────┘
```

### Security: Header Spoofing Prevention

Nginx **PHẢI** strip tất cả `X-User-*` headers từ client request trước khi forward. Chỉ headers từ `/auth/verify` response được trust.

---

## 4. Kế Hoạch Triển Khai

| Phase | Nội dung | Thời gian | Chi tiết |
|-------|----------|-----------|----------|
| **Phase 1** | Identity Service Backend | 4-5 ngày | [01_identity_backend.md](./03_identity_service_plan/01_identity_backend.md) |
| **Phase 2** | Identity Management UI | 3-4 ngày | [02_identity_frontend.md](./03_identity_service_plan/02_identity_frontend.md) |
| **Phase 3** | Nginx Gateway Setup | 2 ngày | [03_nginx_gateway.md](./03_identity_service_plan/03_nginx_gateway.md) |
| **Phase 4a** | PMI Integration | 2 ngày | [04_pmi_integration.md](./03_identity_service_plan/04_pmi_integration.md) |
| **Phase 4b** | OMS/WMS Integration | 2 ngày | [05_oms_wms_integration.md](./03_identity_service_plan/05_oms_wms_integration.md) |
| **Phase 5** | Testing & Go-live | 2-3 ngày | [06_test_specifications.md](./03_identity_service_plan/06_test_specifications.md), [07_deployment.md](./03_identity_service_plan/07_deployment.md) |

**Tổng: ~15-18 ngày làm việc**

---

## 5. Port Map (sau triển khai)

| Service | Port |
|---------|------|
| Nginx Gateway | 8080 |
| Identity API | 18110 |
| Identity Frontend | 13110 |
| Identity Postgres | 15436 |
| PMI API | 18100 (via gateway) |
| OMS API | 18101 (via gateway) |
| WMS API | 18102 (via gateway) |
