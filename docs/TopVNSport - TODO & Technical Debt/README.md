# TopVNSport - TODO & Technical Debt

Tài liệu này là sổ theo dõi nợ kỹ thuật, lỗi đã biết và các đề xuất kiến trúc của TopVNSport.

## Phạm vi và cách đếm

Audit ngày **2026-07-25** đã đối chiếu 15 hồ sơ nợ kỹ thuật cấp hệ thống trong `pmi/`, `oms/`, `web/`, `wms/` và `cleanup/` với source hiện tại, cùng 5 đề xuất kiến trúc và 33 tài liệu kế hoạch lồng nhau. Mỗi hồ sơ được tính một lần theo mức độ cao nhất còn hiệu lực; các đề xuất kiến trúc được theo dõi riêng, không cộng vào số nợ kỹ thuật.

## Mức độ ưu tiên

| Icon | Level | Description |
|------|-------|-------------|
| 🔴 | CRITICAL | Security vulnerabilities, data loss risk - Fix ngay |
| 🟠 | HIGH | Major bugs, business logic issues - Fix trong sprint này |
| 🟡 | MEDIUM | Performance, UX và vận hành - Plan vào backlog |
| 🟢 | LOW | Cleanup, refactoring - Khi có thời gian |

## Tổng quan vấn đề còn hiệu lực

**Tổng: 15 hồ sơ — CRITICAL: 4 · HIGH: 6 · MEDIUM: 4 · LOW: 1**

### 🔴 CRITICAL (4)

| # | Vấn đề | Trạng thái | File |
|---|--------|-----------|------|
| 1 | OMS security: secret fallback, wildcard CORS và OTP test endpoint | ⚠️ Partial/open | `oms/01_security_critical.md` |
| 2 | Hardcoded production secrets | ❌ Open | `pmi/02_security_hardcoded_secrets.md` |
| 3 | Database ports và HTTPS/TLS | ❌ Open | `pmi/03_security_https_database.md` |
| 4 | PMI domain authorization/RBAC | ⚠️ Partial/open | `pmi/04_rbac_authorization.md` |

### 🟠 HIGH (6)

| # | Vấn đề | Trạng thái | File |
|---|--------|-----------|------|
| 5 | OMS order/inventory/OTP races và business invariants | ❌ Open | `oms/02_business_logic_bugs.md` |
| 6 | Shared code/package duplication | ❌ Open | `pmi/05_code_deduplication.md` |
| 7 | HTTP exceptions trong service layer | ❌ Open | `pmi/06_layer_violations.md` |
| 8 | Chuẩn hóa API clients | ⚠️ Partial/open | `pmi/07_api_client_standardization.md` |
| 9 | Web cart/state/checkout reliability | ❌ Open | `web/01_security_and_state.md` |
| 10 | WMS race conditions và data integrity | ⚠️ Partial/open | `wms/01_race_conditions.md` |

### 🟡 MEDIUM (4)

| # | Vấn đề | Trạng thái | File |
|---|--------|-----------|------|
| 11 | PMI N+1 queries và transaction boundaries | ⚠️ Partial/open | `pmi/08_performance_n1_queries.md` |
| 12 | React error boundaries | ❌ Open | `pmi/09_error_boundaries.md` |
| 13 | Web performance: splitting, debounce, bundle và images | ❌ Open | `web/02_performance.md` |
| 14 | Infrastructure: health checks, limits, cache, resilience | ⚠️ Partial/open | `pmi/10_infrastructure_improvements.md` |

### 🟢 LOW (1)

| # | Vấn đề | Trạng thái | File |
|---|--------|-----------|------|
| 15 | Dead code, backup files và unused dependencies | ❌ Open | `cleanup/01_dead_code_removal.md` |

## Phase 1 — Security First

| Item | Kết quả audit | Reference |
|------|---------------|-----------|
| Remove OTP bypass (OMS + Web) | ✅ Resolved | `0906aea`, `abc27d7` |
| Add authentication to OMS | ✅ Resolved cho protected routes | `b279b90`, `6eca152` |
| Move secrets to env files | ❌ Chưa resolved; production compose vẫn có fallback/plaintext values | `PMI/docker-compose.prod.yml`, `OMS/docker-compose.prod.yml`, `WMS/docker-compose.prod.yml`, `identity-service/docker-compose.prod.yml` |
| Implement basic RBAC | ✅ Identity baseline implemented; PMI route-level authorization vẫn là debt riêng | `0d22c38`, `identity-service/backend/routers/{staff,roles}.py` |

## Đề xuất kiến trúc

| Proposal | Trạng thái audit | File |
|----------|-----------------|------|
| Event Bus / Redis Streams | ❌ Proposal only | `architecture/01_event_bus.md` |
| API Gateway | ⚠️ Partial: gateway/auth/rate-limit đã có; TLS/circuit breaker/versioning còn thiếu | `architecture/02_api_gateway.md` |
| Centralized Identity Service | ✅ Baseline implemented | `architecture/03_identity_service.md` |
| Centralized Observability | ❌ Proposal only | `architecture/04_observability.md` |
| Shared Packages | ❌ Proposal only | `architecture/05_shared_packages/00_overview.md` |

Các tài liệu `architecture/03_identity_service_plan/` (9 file) được giữ làm runbook/historical implementation record và đã đối chiếu với Identity, Gateway, PMI, OMS, WMS hiện tại. Các tài liệu `architecture/05_shared_packages/` (24 file) vẫn là kế hoạch chưa triển khai; repository chưa có `packages/`, workspace config hay shared package implementation.

## Roadmap còn lại

1. Loại bỏ secret fallback/plaintext values và bật HTTPS/TLS production.
2. Hoàn thiện authorization theo permission ở PMI/OMS/WMS.
3. Khóa các race condition và invariant của OMS/WMS; bổ sung concurrency tests.
4. Chuẩn hóa web API client, cart persistence, validation và error boundaries.
5. Sau đó mới triển khai shared packages, event bus và observability theo nhu cầu vận hành.

## Cách đóng góp

1. Chọn một hồ sơ TODO.
2. Đối chiếu phần **Audit** với source trước khi sửa.
3. Implement và test theo phần Verification.
4. Tạo PR, ghi commit/PR reference vào hồ sơ.
5. Chỉ đánh dấu ✅ khi source và test đã xác nhận hoàn tất.

## Liên hệ

- **Owner:** dangthanhtung.open@gmail.com
- **Last Updated:** 2026-07-25
