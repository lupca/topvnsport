# File Checklist - Tất cả files cần tạo/sửa/xóa

## Tổng quan nhanh

| Action | Count |
|--------|-------|
| Tạo mới | 8 files |
| Sửa | 12 files |
| Xóa | 1 thư mục |

---

## Files TẠO MỚI

| # | File | Phase | Mô tả |
|---|------|-------|-------|
| 1 | `gateway/nginx/conf.d/upstream.prod.conf` | 1 | Upstream config cho production |
| 2 | `gateway/nginx/conf.d/locations.prod.conf` | 1 | Subdomain routing + auth cho production |
| 3 | `gateway/docker-compose.prod.yml` | 1 | Docker compose cho production |
| 4 | `WMS/frontend/src/utils/apiClient.ts` | 2 | API client với auth cho WMS |
| 5 | `gateway/test_gateway.sh` | 4 | Integration test script |
| 6 | `gateway/run_all_tests.sh` | 6 | Full test suite |
| 7 | (Optional) `OMS/frontend/src/utils/apiClient.ts` | 2 | Nếu muốn refactor giống PMI |
| 8 | (Optional) `gateway/nginx/conf.d/locations.dev.conf` | 1 | Rename từ locations.conf |

---

## Files SỬA

| # | File | Phase | Thay đổi |
|---|------|-------|----------|
| 1 | `gateway/nginx/conf.d/upstream.conf` | 1 | Fix ports OMS/WMS (8001/8002, 3001/3002) |
| 2 | `OMS/frontend/src/utils/api.ts` | 2 | Thêm Authorization header |
| 3 | `OMS/backend/utils/auth.py` | 3 | Thêm JWT fallback |
| 4 | `WMS/backend/utils/auth.py` | 3 | Thêm JWT fallback |
| 5 | `OMS/backend/main.py` | 3 | Thêm auth dependency vào endpoints |
| 6 | `WMS/backend/main.py` | 3 | Thêm auth dependency vào endpoints |
| 7 | `OMS/backend/requirements.txt` | 3 | Thêm python-jose |
| 8 | `WMS/backend/requirements.txt` | 3 | Thêm python-jose |
| 9 | `deploy_prod.sh` | 4 | Đổi nginx → gateway |
| 10 | `start_all.sh` | 4 | Thêm gateway startup |
| 11 | `CLAUDE.md` | 5 | Cập nhật docs |
| 12 | `gateway/README.md` | 5 | Cập nhật docs |

---

## Files XÓA

| # | Path | Phase | Điều kiện |
|---|------|-------|-----------|
| 1 | `nginx/` (toàn bộ thư mục) | 5 | Sau khi prod ổn định 24h |

---

## Files CẦN KIỂM TRA (có thể cần sửa thêm)

| File | Kiểm tra |
|------|----------|
| `WMS/frontend/src/app/(desktop)/inventory/page.tsx` | Đổi fetch → apiClient |
| `WMS/frontend/src/app/(desktop)/warehouses/page.tsx` | Đổi fetch → apiClient |
| `WMS/frontend/src/app/(mobile)/m/*.tsx` | Đổi fetch → apiClient |
| `PMI/docker-compose.yml` | Thêm gateway_network |
| `OMS/docker-compose.yml` | Thêm gateway_network + JWT_SECRET_KEY |
| `WMS/docker-compose.yml` | Thêm gateway_network + JWT_SECRET_KEY |
| `docs/architecture.md` | Cập nhật diagram |

---

## Quick Commands

### Tạo tất cả files mới (Phase 1)
```bash
# Xem plan chi tiết trong 01_gateway_config.md
touch gateway/nginx/conf.d/upstream.prod.conf
touch gateway/nginx/conf.d/locations.prod.conf
touch gateway/docker-compose.prod.yml
```

### Kiểm tra files đã sửa
```bash
git status
git diff gateway/nginx/conf.d/upstream.conf
git diff OMS/frontend/src/utils/api.ts
# ...
```

### Chạy tests sau mỗi phase
```bash
# Phase 1
cd gateway && docker compose up -d && curl localhost:8080/health

# Phase 2-3
./start_all.sh && ./gateway/test_gateway.sh

# Phase 4
./start_all.sh  # should include gateway

# Phase 6
./gateway/run_all_tests.sh
```

---

## Dependency Order

```
Phase 1 (Gateway config)
    ↓
    ├── Phase 2 (Frontend auth) ──┐
    │                             ├── Có thể làm song song
    └── Phase 3 (Backend auth) ───┘
                ↓
        Phase 4 (Scripts)
                ↓
        Phase 5 (Cleanup) ← CHỈ sau khi prod OK
                ↓
        Phase 6 (Testing) ← Chạy liên tục
```

---

## Estimate theo file

| Phase | Files | Effort |
|-------|-------|--------|
| 1 | 3-4 files | 4h |
| 2 | 2-10 files (tùy WMS pages) | 4-6h |
| 3 | 4 files + nhiều endpoints | 6-8h |
| 4 | 3 files | 2h |
| 5 | 3 files | 1h |
| 6 | 2 files + manual testing | 4h |

**Tổng: ~21-25h = 3-4 ngày làm việc**
