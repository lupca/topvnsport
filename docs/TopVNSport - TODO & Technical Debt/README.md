# TopVNSport - TODO & Technical Debt

Thư mục này chứa tất cả các vấn đề kỹ thuật, bugs, và đề xuất cải tiến cho hệ thống TopVNSport.

## Cấu Trúc Thư Mục

```
todo/
├── pmi/                    # PMI (Product Information Management) issues
├── oms/                    # OMS (Order Management System) issues
├── wms/                    # WMS (Warehouse Management System) issues
├── web/                    # Web Storefront issues
├── architecture/           # Đề xuất kiến trúc mới & hệ thống mới
└── cleanup/                # Dead code & cleanup tasks
```

## Mức Độ Ưu Tiên

| Icon | Level | Description |
|------|-------|-------------|
| 🔴 | CRITICAL | Security vulnerabilities, data loss risk - Fix ngay |
| 🟠 | HIGH | Major bugs, business logic issues - Fix trong sprint này |
| 🟡 | MEDIUM | Performance, UX issues - Plan vào backlog |
| 🟢 | LOW | Cleanup, refactoring - Khi có thời gian |

---

## Tổng Quan Vấn Đề

### 🔴 CRITICAL (Fix Ngay)

| # | Vấn đề | Hệ thống | File |
|---|--------|----------|------|
| 1 | OTP Bypass Token hardcoded | OMS, Web | `oms/01_security_critical.md` |
| 2 | No Authentication trên OMS API | OMS | `oms/01_security_critical.md` |
| 3 | Hardcoded secrets trong compose files | PMI, OMS | `pmi/02_security_hardcoded_secrets.md` |
| 4 | No RBAC - ai cũng có full quyền | PMI | `pmi/04_rbac_authorization.md` |
| 5 | Database ports exposed ra internet | All | `pmi/03_security_https_database.md` |

### 🟠 HIGH

| # | Vấn đề | Hệ thống | File |
|---|--------|----------|------|
| 6 | Race condition order numbers | OMS | `oms/02_business_logic_bugs.md` |
| 7 | Race condition inventory | OMS, WMS | `oms/02_business_logic_bugs.md`, `wms/01_race_conditions.md` |
| 8 | Code duplication 4x | All frontends | `pmi/05_code_deduplication.md` |
| 9 | Cart không persist | Web | `web/01_security_and_state.md` |
| 10 | Over-picking/receiving allowed | WMS | `wms/01_race_conditions.md` |

### 🟡 MEDIUM

| # | Vấn đề | Hệ thống | File |
|---|--------|----------|------|
| 11 | N+1 queries | PMI | `pmi/08_performance_n1_queries.md` |
| 12 | Missing Error Boundaries | All frontends | `pmi/09_error_boundaries.md` |
| 13 | No code splitting | Web | `web/02_performance.md` |
| 14 | No healthchecks | OMS | `pmi/10_infrastructure_improvements.md` |

### 🟢 LOW

| # | Vấn đề | Hệ thống | File |
|---|--------|----------|------|
| 15 | Dead code ~1,400 lines | All | `cleanup/01_dead_code_removal.md` |

---

## Đề Xuất Kiến Trúc Mới

| Proposal | Mô tả | Effort | File |
|----------|-------|--------|------|
| Event Bus | Redis Streams cho async messaging | High | `architecture/01_event_bus.md` |
| API Gateway | Enhanced nginx với rate limiting, auth | Medium | `architecture/02_api_gateway.md` |
| Identity Service | Centralized auth & user management | High | `architecture/03_identity_service.md` |
| Observability | Logging, tracing, metrics stack | Medium | `architecture/04_observability.md` |
| Shared Packages | Monorepo với shared code | High | `architecture/05_shared_packages.md` |

---

## Roadmap Đề Xuất

### Phase 1: Security First (Tuần 1-2)
1. ✅ Remove OTP bypass (OMS + Web)
2. ✅ Add authentication to OMS
3. ✅ Move secrets to env files
4. ✅ Implement basic RBAC

### Phase 2: Data Integrity (Tuần 3-4)
5. Fix race conditions (order numbers, inventory)
6. Add row locking in WMS
7. Add transaction boundaries

### Phase 3: Developer Experience (Tuần 5-6)
8. Extract shared packages
9. Standardize API clients
10. Add Error Boundaries

### Phase 4: Infrastructure (Tháng 2)
11. Add API Gateway
12. Add Event Bus (Redis Streams)
13. Add Observability stack

### Phase 5: Scale (Tháng 3+)
14. Identity Service
15. Database replication
16. CDN integration

---

## Cách Đóng Góp

1. Chọn một TODO file
2. Đọc "Vấn Đề" và "Steps to Implement"
3. Tạo branch: `fix/todo-<tên-file>`
4. Implement và test theo "Verification"
5. Tạo PR với link đến TODO file
6. Sau khi merge, đánh dấu ✅ trong file

---

## Liên Hệ

- **Owner:** dangthanhtung.open@gmail.com
- **Last Updated:** 2026-07-13
