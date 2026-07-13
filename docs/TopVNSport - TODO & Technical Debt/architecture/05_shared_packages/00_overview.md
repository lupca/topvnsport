# ARCHITECTURE: Shared Packages - Overview

## Mức độ: HIGH
## Estimated Effort: High (1-2 weeks)

---

## Mục Tiêu

Tạo monorepo với shared packages để giảm code duplication giữa các subsystems (PMI, OMS, WMS, web).

---

## Vấn Đề Hiện Tại

### Backend Code Duplication

| Module | PMI | OMS | WMS | Issue |
|--------|-----|-----|-----|-------|
| Database setup | `database.py` | `database.py` | `database.py` | 90% giống nhau |
| Crypto utils | - | `utils/crypto.py` | - | Chỉ OMS có |
| Phone helper | - | `utils/phone_helper.py` | - | Chỉ OMS có |
| Pagination | Custom | Custom | Custom | 3 implementations khác nhau |
| Error handling | Custom | Custom | Custom | Không consistent |

### Frontend Code Duplication

| Component | PMI | OMS | WMS | web |
|-----------|-----|-----|-----|-----|
| `popupService.ts` | ✓ | ✓ | ✓ | ✓ |
| `DataTable.tsx` | ✓ | ✓ | ✓ | ✓ |
| Layout (Sidebar, Topbar) | ✓ | ✓ | ✓ | - |

---

## Proposed Structure

```
topvnsport/
├── packages/                      # Shared packages
│   ├── backend-common/            # Python shared utils
│   │   ├── topvnsport_common/
│   │   │   ├── __init__.py
│   │   │   ├── database.py
│   │   │   ├── pagination.py
│   │   │   ├── exceptions.py
│   │   │   ├── auth.py
│   │   │   ├── crypto.py
│   │   │   ├── logging.py
│   │   │   └── phone.py
│   │   ├── tests/
│   │   ├── pyproject.toml
│   │   └── README.md
│   │
│   ├── ui-kit/                    # React shared components
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── DataTable/
│   │   │   │   ├── Popup/
│   │   │   │   └── Layout/
│   │   │   ├── hooks/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── api-client/                # TypeScript API client (optional)
│
├── PMI/
│   ├── backend/
│   │   └── requirements.txt       # includes topvnsport-common
│   └── frontend/
│       └── package.json           # includes @topvnsport/ui-kit
│
├── OMS/
├── WMS/
├── web/
├── pyproject.toml                 # Root Python workspace
└── pnpm-workspace.yaml            # Root JS workspace
```

---

## Trình Tự Thực Hiện

### Phase 1: Backend Package (Day 1-2)
1. `01_backend_package/00_setup.md` - Setup package structure
2. `01_backend_package/01_database.md` - Database module
3. `01_backend_package/02_pagination.md` - Pagination module
4. `01_backend_package/03_exceptions.md` - Exceptions module
5. `01_backend_package/04_crypto.md` - Crypto module
6. `01_backend_package/05_phone.md` - Phone helper
7. `01_backend_package/06_auth.md` - Auth module
8. `01_backend_package/07_logging.md` - Logging module

### Phase 2: Frontend Package (Day 2-3)
1. `02_frontend_package/00_setup.md` - Setup package structure
2. `02_frontend_package/01_datatable.md` - DataTable component
3. `02_frontend_package/02_popup.md` - Popup service + provider
4. `02_frontend_package/03_layout.md` - Layout components
5. `02_frontend_package/04_hooks.md` - Shared hooks

### Phase 3: Workspace Configuration (Day 3)
1. `03_workspace_config/01_pnpm_workspace.md` - pnpm monorepo setup
2. `03_workspace_config/02_python_workspace.md` - Python editable installs
3. `03_workspace_config/03_docker_setup.md` - Docker build với shared packages

### Phase 4: Migration (Day 4-6)
0. `04_migration/00_pre_migration_tests.md` - **Viết characterization tests TRƯỚC** (QUAN TRỌNG!)
1. `04_migration/01_migrate_pmi.md` - Migrate PMI (pilot)
2. `04_migration/02_migrate_oms.md` - Migrate OMS
3. `04_migration/03_migrate_wms.md` - Migrate WMS
4. `04_migration/04_migrate_web.md` - Migrate web storefront

### Phase 5: CI/CD (Day 6-7)
1. `05_ci_cd/01_update_workflows.md` - Update GitHub Actions

### Phase 6: Verification
1. `06_verification/01_final_verification.md` - Final checklist

---

## Testing Strategy (QUAN TRỌNG)

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: Viết Characterization Tests (04_migration/00_...)      │
│  Test behavior HIỆN TẠI của code → phải PASS                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: Implement Shared Packages (Phase 1-3)                  │
│  Tạo packages/ với unit tests riêng                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: Migrate Services (04_migration/01-04)                  │
│  Thay imports sang shared packages                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: Run Characterization Tests AGAIN                       │
│  CÙNG tests từ Step 1 → phải vẫn PASS                           │
│  Nếu FAIL = refactor đã break behavior!                         │
└─────────────────────────────────────────────────────────────────┘
```

> **Tại sao?** Characterization tests đảm bảo refactor không làm hỏng behavior cũ.

---

## Definition of Done

- [ ] Characterization tests written BEFORE migration
- [ ] Characterization tests PASS before migration
- [ ] All shared packages have 100% test coverage
- [ ] All services migrated and using shared packages
- [ ] Characterization tests PASS after migration
- [ ] No duplicate code remains in individual services
- [ ] CI/CD builds and tests shared packages
- [ ] All existing tests pass
- [ ] Documentation updated
