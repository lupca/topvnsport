# Workspace Configuration: pnpm Monorepo

## Task ID: WS-01
## Prerequisites: FE-00 (Frontend Setup)
## Estimated: 1 hour

---

## Mục Tiêu

Cấu hình pnpm workspace để:
- Link packages trong monorepo
- Shared dependencies
- Parallel builds

---

## Implementation

### 1. File: `pnpm-workspace.yaml` (root)

```yaml
packages:
  - 'packages/*'
  - 'PMI/frontend'
  - 'OMS/frontend'
  - 'WMS/frontend'
  - 'web'
```

### 2. File: `package.json` (root)

```json
{
  "name": "topvnsport",
  "private": true,
  "scripts": {
    "build:packages": "pnpm --filter './packages/*' build",
    "dev:packages": "pnpm --filter './packages/*' dev",
    "test:packages": "pnpm --filter './packages/*' test",
    "lint:packages": "pnpm --filter './packages/*' lint",
    "clean": "pnpm -r exec rm -rf node_modules dist .next",
    "install:all": "pnpm install",
    "build:all": "pnpm build:packages && pnpm -r build",
    "test:all": "pnpm -r test"
  },
  "devDependencies": {
    "turbo": "^2.0.0"
  },
  "engines": {
    "node": ">=18",
    "pnpm": ">=8"
  },
  "packageManager": "pnpm@8.15.0"
}
```

### 3. File: `turbo.json` (root) - Optional Turbo for faster builds

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {}
  }
}
```

### 4. Update PMI/frontend/package.json

```json
{
  "name": "@topvnsport/pmi-frontend",
  "dependencies": {
    "@topvnsport/ui-kit": "workspace:*"
  }
}
```

### 5. Update OMS/frontend/package.json

```json
{
  "name": "@topvnsport/oms-frontend",
  "dependencies": {
    "@topvnsport/ui-kit": "workspace:*"
  }
}
```

### 6. Update WMS/frontend/package.json

```json
{
  "name": "@topvnsport/wms-frontend",
  "dependencies": {
    "@topvnsport/ui-kit": "workspace:*"
  }
}
```

### 7. Update web/package.json

```json
{
  "name": "@topvnsport/web",
  "dependencies": {
    "@topvnsport/ui-kit": "workspace:*"
  }
}
```

---

## Test Cases

### File: `tests/workspace/test_pnpm_workspace.sh`

```bash
#!/bin/bash
set -e

echo "=== Test: pnpm workspace configuration ==="

# Test 1: Workspace file exists
echo "Test 1: pnpm-workspace.yaml exists"
test -f pnpm-workspace.yaml && echo "PASS" || (echo "FAIL" && exit 1)

# Test 2: Root package.json has workspace scripts
echo "Test 2: Root package.json has build:packages script"
grep -q "build:packages" package.json && echo "PASS" || (echo "FAIL" && exit 1)

# Test 3: UI-kit is listed in workspace
echo "Test 3: ui-kit is in workspace"
grep -q "packages/\*" pnpm-workspace.yaml && echo "PASS" || (echo "FAIL" && exit 1)

# Test 4: PMI frontend references workspace package
echo "Test 4: PMI frontend uses workspace:*"
grep -q "workspace:\*" PMI/frontend/package.json && echo "PASS" || (echo "FAIL" && exit 1)

# Test 5: pnpm install succeeds
echo "Test 5: pnpm install succeeds"
pnpm install && echo "PASS" || (echo "FAIL" && exit 1)

# Test 6: packages are linked correctly
echo "Test 6: Packages are linked"
test -L PMI/frontend/node_modules/@topvnsport/ui-kit && echo "PASS" || (echo "FAIL" && exit 1)

# Test 7: Build packages succeeds
echo "Test 7: Build packages succeeds"
pnpm build:packages && echo "PASS" || (echo "FAIL" && exit 1)

# Test 8: Import works in PMI frontend
echo "Test 8: Import works"
cd PMI/frontend
node -e "require('@topvnsport/ui-kit')" && echo "PASS" || (echo "FAIL" && exit 1)
cd ../..

echo "=== All workspace tests passed ==="
```

### Integration Test

```typescript
// packages/ui-kit/src/__tests__/integration/workspace.test.ts
import { describe, it, expect } from 'vitest';

describe('Workspace Integration', () => {
  it('package can be imported by name', async () => {
    // This test runs in the ui-kit package itself
    // Real integration is tested by the shell script
    const pkg = await import('../../index');
    expect(pkg.DataTable).toBeDefined();
    expect(pkg.popupService).toBeDefined();
  });

  it('exports all expected components', async () => {
    const pkg = await import('../../index');
    
    // Components
    expect(pkg.DataTable).toBeDefined();
    expect(pkg.SystemPopupProvider).toBeDefined();
    expect(pkg.Sidebar).toBeDefined();
    expect(pkg.Topbar).toBeDefined();
    expect(pkg.MobileNav).toBeDefined();
    
    // Hooks
    expect(pkg.useDebounce).toBeDefined();
    expect(pkg.usePagination).toBeDefined();
    
    // Services
    expect(pkg.popupService).toBeDefined();
    
    // Utils
    expect(pkg.cn).toBeDefined();
  });
});
```

---

## Verification

```bash
# From root directory

# 1. Install all dependencies
pnpm install

# 2. Build packages first
pnpm build:packages

# 3. Verify links
ls -la PMI/frontend/node_modules/@topvnsport/

# 4. Run workspace tests
chmod +x tests/workspace/test_pnpm_workspace.sh
./tests/workspace/test_pnpm_workspace.sh

# 5. Test import in PMI
cd PMI/frontend
node -e "const {DataTable} = require('@topvnsport/ui-kit'); console.log('OK:', typeof DataTable)"
```

---

## Checklist

- [ ] pnpm-workspace.yaml created
- [ ] Root package.json with workspace scripts
- [ ] turbo.json for build optimization (optional)
- [ ] PMI/frontend references @topvnsport/ui-kit
- [ ] OMS/frontend references @topvnsport/ui-kit
- [ ] WMS/frontend references @topvnsport/ui-kit
- [ ] web references @topvnsport/ui-kit
- [ ] pnpm install links packages correctly
- [ ] Build order is correct (packages first)
- [ ] All 8 workspace tests pass
