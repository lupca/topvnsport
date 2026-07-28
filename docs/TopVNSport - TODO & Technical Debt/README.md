# TopVNSport - TODO & Technical Debt

Tài liệu này là sổ theo dõi nợ kỹ thuật, lỗi đã biết và các đề xuất kiến trúc của TopVNSport.

## Phạm vi và cách đếm

Audit ngày **2026-07-28** đã cập nhật sau khi hoàn thành:
- OMS-006/007/008/009/010/011: Security + race conditions + migrations
- DEVOPS-001/002/003: RDS migration, GitHub secrets
- Secrets đã chuyển sang `${VAR:?}` fail-fast từ GitHub secrets

## Mức độ ưu tiên

| Icon | Level | Description |
|------|-------|-------------|
| 🔴 | CRITICAL | Security vulnerabilities, data loss risk - Fix ngay |
| 🟠 | HIGH | Major bugs, business logic issues - Fix trong sprint này |
| 🟡 | MEDIUM | Performance, UX và vận hành - Plan vào backlog |
| 🟢 | LOW | Cleanup, refactoring - Khi có thời gian |

## Tổng quan vấn đề còn hiệu lực

**Tổng: 9 hồ sơ — CRITICAL: 1 · HIGH: 7 · MEDIUM: 1 · LOW: 0**

### 🔴 CRITICAL (1)

| # | Vấn đề | Trạng thái | File |
|---|--------|-----------|------|
| 1 | PMI domain authorization/RBAC | ⚠️ Partial/open | `pmi/04_rbac_authorization.md` |

### 🟠 HIGH (7)

| # | Vấn đề | Trạng thái | File |
|---|--------|-----------|------|
| 2 | OCR scan bugs (7 items across PMI/OMS/WMS/Web) | ❌ Open | `pmi/01_ocr_scan_bugs.md` |
| 3 | HTTPS/TLS production | ❌ Open | `pmi/02_https_tls.md` |
| 4 | Shared code/package duplication | ❌ Open | `pmi/05_code_deduplication.md` |
| 5 | HTTP exceptions trong service layer | ❌ Open | `pmi/06_layer_violations.md` |
| 6 | Chuẩn hóa API clients | ⚠️ Partial/open | `pmi/07_api_client_standardization.md` |
| 7 | Web cart/state/checkout reliability | ❌ Open | `web/01_security_and_state.md` |
| 8 | WMS race conditions và data integrity | ⚠️ Partial/open | `wms/01_race_conditions.md` |

### 🟡 MEDIUM (1)

| # | Vấn đề | Trạng thái | File |
|---|--------|-----------|------|
| 9 | Infrastructure (resource limits, Redis caching) | ⚠️ Partial/open | `pmi/10_infrastructure_improvements.md` |

## ✅ Đã hoàn thành (2026-07-29)

| Item | Kết quả | Task/Commit |
|------|---------|-------------|
| OMS security (OTP, auth, Fernet, CORS) | ✅ Done | OMS-006, OMS-011 |
| Hardcoded secrets → GitHub secrets | ✅ Done | OMS-011, DEVOPS-001 |
| OMS race conditions + business logic | ✅ Done | OMS-007, OMS-008, OMS-009 |
| RDS migration (DB tách riêng) | ✅ Done | DEVOPS-001/002/003 |
| Identity Service baseline | ✅ Done | `0d22c38`, `b279b90` |
| Database ports exposure | ✅ N/A | Services dùng RDS, không còn local DB |
| PMI N+1 queries + transaction boundaries | ✅ Done | PMI-019, `897602eb` |
| React error boundaries | ✅ Done | PMI-020, `88ba0221` |
| Dead code removal | ✅ Done | PMI-022, `e0ed0a4c` |
| Web performance (lazy loading, bundle splitting) | ✅ Done | WEB-010, `c7664ad8` |

## Đề xuất kiến trúc

| Proposal | Trạng thái | File |
|----------|-----------|------|
| Event Bus / Redis Streams | ❌ Proposal only | `architecture/01_event_bus.md` |
| API Gateway (TLS/circuit breaker) | ⚠️ Partial: cần HTTPS | `architecture/02_api_gateway.md` |
| Centralized Observability | ❌ Proposal only | `architecture/04_observability.md` |
| Shared Packages | ❌ Proposal only | `architecture/05_shared_packages/` |

## Roadmap còn lại

1. ~~Secrets + RDS migration~~ ✅ Done
2. HTTPS/TLS cho gateway (PMI-014)
3. Hoàn thiện authorization theo permission ở PMI (PMI-015)
4. Khóa các race condition WMS (WMS-005)
5. ~~Chuẩn hóa web cart, validation, error boundaries (WEB-008/009/010)~~ ✅ Error boundaries done (PMI-020), web performance done (WEB-010)
6. Shared packages, event bus, observability theo nhu cầu

## Cách đóng góp

1. Chọn một hồ sơ TODO.
2. Đối chiếu phần **Audit** với source trước khi sửa.
3. Implement và test theo phần Verification.
4. Tạo PR, ghi commit/PR reference vào hồ sơ.
5. Chỉ đánh dấu ✅ khi source và test đã xác nhận hoàn tất.

## Liên hệ

- **Owner:** dangthanhtung.open@gmail.com
- **Last Updated:** 2026-07-29
