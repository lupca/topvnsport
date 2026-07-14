# Gateway Migration Plan - Tổng quan

## Mục tiêu
1. Xóa thư mục `nginx/` (reverse proxy cũ, không có auth)
2. Thống nhất dùng `gateway/` cho cả dev và production
3. Fix auth cho OMS/WMS frontend và backend
4. Đảm bảo không downtime khi deploy

## Tình trạng hiện tại

### Vấn đề phát hiện

| Hệ thống | Frontend gửi token? | Backend check token? | Trạng thái |
|----------|---------------------|----------------------|------------|
| PMI | ✅ Có | ⚠️ Chỉ 2 router | Cần bổ sung |
| OMS | ❌ Không | ❌ Không | LỖ HỔNG |
| WMS | ❌ Không | ❌ Không | LỖ HỔNG |

### Cấu trúc thư mục liên quan

```
topvnsport/
├── nginx/                    # XÓA - reverse proxy cũ
├── gateway/                  # GIỮ - API Gateway với SSO
│   ├── nginx/
│   │   ├── nginx.conf
│   │   └── conf.d/
│   │       ├── upstream.conf      # SỬA - fix ports
│   │       └── locations.conf     # GIỮ - dev config
│   ├── docker-compose.yml         # GIỮ - dev
│   └── docker-compose.prod.yml    # TẠO MỚI
├── PMI/frontend/
│   └── next.config.ts             # SỬA - route qua gateway
├── OMS/frontend/
│   ├── next.config.ts             # SỬA - route qua gateway
│   └── src/utils/api.ts           # SỬA - thêm auth header
├── WMS/frontend/
│   ├── next.config.ts             # SỬA - route qua gateway
│   └── src/utils/apiClient.ts     # TẠO MỚI
├── OMS/backend/main.py            # SỬA - thêm auth dependency
├── WMS/backend/main.py            # SỬA - thêm auth dependency
├── deploy_prod.sh                 # SỬA
└── start_all.sh                   # SỬA
```

## Phases

| Phase | Mô tả | Effort | Files |
|-------|-------|--------|-------|
| 1 | Gateway config cho dev + prod | 1 ngày | `01_gateway_config.md` |
| 2 | Fix frontend auth (OMS/WMS) | 1 ngày | `02_frontend_auth.md` |
| 3 | Fix backend auth (OMS/WMS) | 1-2 ngày | `03_backend_auth.md` |
| 4 | Update scripts | 0.5 ngày | `04_scripts_update.md` |
| 5 | Cleanup & docs | 0.5 ngày | `05_cleanup.md` |
| 6 | Testing | 1 ngày | `06_testing.md` |

**Tổng estimate: 5-6 ngày**

## Thứ tự thực hiện

```
Phase 1 (Gateway config)
    ↓
Phase 2 (Frontend auth) ←→ Phase 3 (Backend auth)  [song song]
    ↓
Phase 4 (Scripts)
    ↓
Phase 5 (Cleanup)
    ↓
Phase 6 (Testing)
    ↓
Deploy staging → Test → Deploy production
```

## Rollback Plan

Nếu có vấn đề sau khi deploy:

```bash
# 1. Restore nginx/ từ git
git checkout HEAD -- nginx/

# 2. Revert deploy_prod.sh
git checkout HEAD -- deploy_prod.sh

# 3. Redeploy
EC2_HOST=<host> ./deploy_prod.sh
```

## Checklist trước khi bắt đầu

- [ ] Backup database production
- [ ] Thông báo team về maintenance window
- [ ] Chuẩn bị staging environment
- [ ] Review tất cả các plan files
