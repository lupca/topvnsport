# Final Verification Checklist

## Task ID: VER-01
## Prerequisites: All previous tasks complete
## Estimated: 2 hours

---

## Mục Tiêu

Verify toàn bộ shared packages implementation hoạt động đúng.

---

## 1. Package Structure Verification

### Backend Package

```bash
# Verify structure
ls -la packages/backend-common/
# Expected:
# - pyproject.toml
# - README.md
# - topvnsport_common/
#   - __init__.py
#   - database.py
#   - pagination.py
#   - exceptions.py
#   - crypto.py
#   - phone.py
#   - auth.py
#   - logging.py
# - tests/
#   - unit/
#   - integration/

# Verify installable
cd packages/backend-common
pip install -e ".[dev]"

# Verify all imports
python -c "
from topvnsport_common import (
    create_db_engine, create_session_factory, get_db_dependency, Base,
    paginate, PaginatedResponse,
    AppException, NotFoundError, ValidationError, ConflictError,
    UnauthorizedError, ForbiddenError, register_exception_handlers,
)
from topvnsport_common.crypto import hash_password, verify_password, encrypt, decrypt
from topvnsport_common.phone import normalize_phone, validate_phone
from topvnsport_common.auth import TokenConfig, create_access_token, verify_token
from topvnsport_common.logging import configure_logging, get_logger
print('All imports OK')
"
```

### Frontend Package

```bash
# Verify structure
ls -la packages/ui-kit/
# Expected:
# - package.json
# - tsconfig.json
# - vitest.config.ts
# - src/
#   - index.ts
#   - components/
#   - hooks/
#   - utils/

# Verify buildable
cd packages/ui-kit
pnpm install
pnpm build

# Verify dist output
ls -la dist/
# Expected: index.js, index.mjs, index.d.ts

# Verify exports
node -e "
const pkg = require('./dist');
console.log('Exports:', Object.keys(pkg));
// Expected: DataTable, SystemPopupProvider, popupService, Sidebar, Topbar, MobileNav, useDebounce, usePagination, cn
"
```

---

## 2. Workspace Verification

```bash
# Root directory
cd /home/lupca/projects/topvnsport

# Verify workspace files
test -f pnpm-workspace.yaml && echo "pnpm-workspace.yaml OK"
test -f package.json && echo "Root package.json OK"
test -f pyproject.toml && echo "Root pyproject.toml OK"

# Verify pnpm install links packages
pnpm install

# Verify symlinks
ls -la PMI/frontend/node_modules/@topvnsport/
# Expected: ui-kit -> ../../../packages/ui-kit

# Verify scripts work
pnpm build:packages
pnpm test:packages
```

---

## 3. Service Migration Verification

### PMI Backend

```bash
cd PMI/backend

# Check requirements.txt has shared package
grep "packages/backend-common" requirements.txt

# Install and verify
pip install -r requirements.txt
python -c "from topvnsport_common import paginate; print('PMI Backend OK')"

# Run tests
pytest tests/ -v
```

### PMI Frontend

```bash
cd PMI/frontend

# Check package.json has ui-kit
grep "@topvnsport/ui-kit" package.json

# Install and verify
pnpm install
node -e "require('@topvnsport/ui-kit'); console.log('PMI Frontend OK')"

# Run tests
pnpm test
```

### OMS, WMS, Web (repeat pattern)

```bash
# OMS
cd OMS/backend && pip install -r requirements.txt && python -c "from topvnsport_common import paginate"
cd OMS/frontend && pnpm install && node -e "require('@topvnsport/ui-kit')"

# WMS
cd WMS/backend && pip install -r requirements.txt && python -c "from topvnsport_common import paginate"
cd WMS/frontend && pnpm install && node -e "require('@topvnsport/ui-kit')"

# Web
cd web && pnpm install && node -e "require('@topvnsport/ui-kit')"
```

---

## 4. Docker Build Verification

```bash
# Build all services
docker compose -f PMI/docker-compose.yml build
docker compose -f OMS/docker-compose.yml build
docker compose -f WMS/docker-compose.yml build

# Verify imports inside containers
docker compose -f PMI/docker-compose.yml run --rm api \
  python -c "from topvnsport_common import paginate; print('Docker OK')"
```

---

## 5. Test Coverage Verification

### Backend Package

```bash
cd packages/backend-common
pytest tests/ --cov=topvnsport_common --cov-report=term-missing

# Expected: >95% coverage
```

### Frontend Package

```bash
cd packages/ui-kit
pnpm test:coverage

# Expected: >95% coverage
```

---

## 6. Integration Test Verification

```bash
# Start all services
./start_all.sh

# Wait for services
sleep 30

# Run E2E tests
pytest e2e_tests/ -v

# Expected: All tests pass
```

---

## 7. No Duplicate Code Verification

Check that duplicate files have been removed:

```bash
# Should NOT exist after migration
test ! -f PMI/frontend/src/components/ui/DataTable.tsx
test ! -f PMI/frontend/src/services/popupService.ts
test ! -f PMI/frontend/src/hooks/useDebounce.ts

test ! -f OMS/frontend/src/components/ui/DataTable.tsx
test ! -f OMS/frontend/src/services/popupService.ts

test ! -f WMS/frontend/src/components/ui/DataTable.tsx
test ! -f WMS/frontend/src/services/popupService.ts

test ! -f web/src/common/DataTable.tsx
test ! -f web/src/services/popupService.ts

echo "All duplicate files removed"
```

---

## 8. API Response Format Verification

All services should return consistent pagination format:

```bash
# PMI
curl -s http://localhost:18100/api/products | jq 'keys'
# Expected: ["has_next", "has_prev", "items", "page", "page_size", "pages", "total"]

# OMS
curl -s http://localhost:18101/api/orders | jq 'keys'
# Expected: same format

# WMS
curl -s http://localhost:18102/api/inventory | jq 'keys'
# Expected: same format
```

---

## 9. Exception Format Verification

All services should return consistent error format:

```bash
# PMI
curl -s http://localhost:18100/api/products/99999 | jq
# Expected: {"error": "NOT_FOUND", "message": "Product with id '99999' not found"}

# OMS
curl -s http://localhost:18101/api/orders/99999 | jq
# Expected: same format

# WMS
curl -s http://localhost:18102/api/locations/99999 | jq
# Expected: same format
```

---

## 10. Request ID Header Verification

All services should include X-Request-ID:

```bash
# PMI
curl -sI http://localhost:18100/api/products | grep -i x-request-id
# Expected: X-Request-ID: <uuid>

# OMS
curl -sI http://localhost:18101/api/orders | grep -i x-request-id
# Expected: X-Request-ID: <uuid>

# WMS
curl -sI http://localhost:18102/api/inventory | grep -i x-request-id
# Expected: X-Request-ID: <uuid>
```

---

## Final Checklist

### Packages
- [ ] Backend package installed and all modules importable
- [ ] Frontend package built with all exports
- [ ] All package tests pass with >95% coverage

### Workspace
- [ ] pnpm workspace configured
- [ ] Python editable installs working
- [ ] Build scripts work

### Services
- [ ] PMI backend uses shared packages
- [ ] PMI frontend uses shared packages
- [ ] OMS backend uses shared packages
- [ ] OMS frontend uses shared packages
- [ ] WMS backend uses shared packages
- [ ] WMS frontend uses shared packages
- [ ] Web storefront uses shared packages

### Docker
- [ ] All Docker builds succeed
- [ ] Containers can import shared packages

### Tests
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass

### Code Quality
- [ ] No duplicate code in services
- [ ] Consistent pagination format
- [ ] Consistent exception format
- [ ] Request ID headers present

### CI/CD
- [ ] Package tests run in CI
- [ ] Service tests depend on package build
- [ ] Docker builds use root context

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| Code Reviewer | | | |
| QA | | | |
| Tech Lead | | | |
