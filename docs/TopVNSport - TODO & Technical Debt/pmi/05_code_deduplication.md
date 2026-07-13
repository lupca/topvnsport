# TODO: Code Deduplication - Shared Packages

## Mức độ: HIGH
## Estimated Effort: High (2-3 days)

---

## Mô Tả Vấn Đề

Các UI components và utilities đang được duplicate across 4 frontends (PMI, OMS, WMS, Web). Mỗi lần fix bug hoặc add feature phải update 4 nơi.

### Duplicated Files (100% identical):

| Component | Locations |
|-----------|-----------|
| `popupService.ts` | PMI, OMS, WMS, Web (`/src/components/ui/`) |
| `SystemPopupProvider.tsx` | PMI, OMS, WMS, Web |
| `DataTable.tsx` | PMI, OMS, WMS, Web |
| `Sidebar.tsx` | PMI, OMS, WMS (layout) |
| `Topbar.tsx` | PMI, OMS, WMS |
| `MobileNav.tsx` | PMI, OMS, WMS |
| `settings.ts` | PMI, OMS, WMS (config structure) |

### Near-Duplicates (90%+ similar):

| Component | Variations |
|-----------|------------|
| `apiClient.ts` | PMI has best version, OMS/WMS simpler |
| Form components | Similar patterns, different fields |
| Validation schemas | Zod schemas with same structure |

---

## Impact

- **Maintenance Cost:** Bug in popupService needs 4 separate fixes
- **Inconsistency:** Easy to forget updating one system
- **Developer Experience:** Confusion about which version is "canonical"

---

## Proposed Solution: Monorepo with Shared Packages

```
topvnsport/
├── packages/                    # NEW shared packages
│   ├── ui-kit/                  # Shared React components
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── DataTable.tsx
│   │   │   │   ├── SystemPopupProvider.tsx
│   │   │   │   └── ...
│   │   │   ├── hooks/
│   │   │   └── index.ts
│   │   └── tsconfig.json
│   │
│   ├── api-client/              # Shared API client
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── client.ts
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   └── tsconfig.json
│   │
│   └── shared-utils/            # Shared utilities
│       ├── package.json
│       └── src/
│           ├── validation/
│           ├── formatting/
│           └── index.ts
│
├── PMI/frontend/                # Uses @topvnsport/ui-kit
├── OMS/frontend/
├── WMS/frontend/
├── web/
├── package.json                 # Root workspace config
└── pnpm-workspace.yaml          # Workspace definition
```

---

## Steps to Implement

### Phase 1: Setup Monorepo Structure

**Step 1:** Create root workspace configuration

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'PMI/frontend'
  - 'OMS/frontend'
  - 'WMS/frontend'
  - 'web'
```

```json
// package.json (root)
{
  "name": "topvnsport",
  "private": true,
  "workspaces": ["packages/*", "*/frontend", "web"]
}
```

**Step 2:** Create ui-kit package

```bash
mkdir -p packages/ui-kit/src/components
```

```json
// packages/ui-kit/package.json
{
  "name": "@topvnsport/ui-kit",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "dependencies": {
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0"
  }
}
```

### Phase 2: Extract Components

**Step 3:** Move DataTable to shared package

```typescript
// packages/ui-kit/src/components/DataTable.tsx
// Copy from PMI/frontend/src/components/ui/DataTable.tsx
// Make it configurable for different use cases
```

**Step 4:** Move popup system

```typescript
// packages/ui-kit/src/components/popup/
├── popupService.ts
├── SystemPopupProvider.tsx
└── index.ts
```

**Step 5:** Export from index

```typescript
// packages/ui-kit/src/index.ts
export { DataTable } from './components/DataTable';
export { SystemPopupProvider, popupService } from './components/popup';
export { Sidebar } from './components/layout/Sidebar';
// ... etc
```

### Phase 3: Update Frontends to Use Shared Package

**Step 6:** Add dependency in each frontend

```json
// PMI/frontend/package.json
{
  "dependencies": {
    "@topvnsport/ui-kit": "workspace:*"
  }
}
```

**Step 7:** Update imports

```typescript
// Before (PMI/frontend/src/app/products/page.tsx)
import { DataTable } from '@/components/ui/DataTable';

// After
import { DataTable } from '@topvnsport/ui-kit';
```

**Step 8:** Delete duplicated files from each frontend

```bash
# After migration is complete
rm PMI/frontend/src/components/ui/DataTable.tsx
rm OMS/frontend/src/components/ui/DataTable.tsx
# ... etc
```

### Phase 4: Create API Client Package

**Step 9:** Extract best API client (from PMI)

```typescript
// packages/api-client/src/client.ts
export function createApiClient(config: ApiClientConfig) {
  // Generic, configurable API client
  // Handles auth, errors, retries
}
```

---

## Files Cần Tạo/Modify

### New Files
| File | Description |
|------|-------------|
| `pnpm-workspace.yaml` | Workspace configuration |
| `packages/ui-kit/*` | Shared UI components |
| `packages/api-client/*` | Shared API client |
| `packages/shared-utils/*` | Shared utilities |

### Modified Files
| File | Action |
|------|--------|
| `PMI/frontend/package.json` | Add workspace dependency |
| `PMI/frontend/src/**/*.tsx` | Update imports |
| `OMS/frontend/package.json` | Add workspace dependency |
| `WMS/frontend/package.json` | Add workspace dependency |
| `web/package.json` | Add workspace dependency |

### Deleted Files (after migration)
| Path | Count |
|------|-------|
| `*/frontend/src/components/ui/popupService.ts` | 4 files |
| `*/frontend/src/components/ui/SystemPopupProvider.tsx` | 4 files |
| `*/frontend/src/components/ui/DataTable.tsx` | 4 files |

---

## Verification

```bash
# Build shared packages
cd packages/ui-kit && pnpm build

# Run each frontend
cd PMI/frontend && pnpm dev
cd OMS/frontend && pnpm dev
cd WMS/frontend && pnpm dev
cd web && pnpm dev

# Run tests
pnpm test --filter=@topvnsport/ui-kit
pnpm test --filter=pmi-frontend
```

### Manual Testing
1. Open each frontend, verify DataTable renders correctly
2. Test popup notifications work in all systems
3. Verify no TypeScript errors

---

## Migration Strategy

1. **Start small:** Extract one component (DataTable) first
2. **Test thoroughly:** Ensure all 4 frontends work with shared version
3. **Iterate:** Move more components progressively
4. **Clean up:** Remove duplicates only after migration verified

---

## Notes

- Consider Turborepo for faster builds in monorepo
- May need to update Docker builds to handle workspace dependencies
- TypeScript path aliases may need adjustment
- Tailwind config should also be shared/consistent
