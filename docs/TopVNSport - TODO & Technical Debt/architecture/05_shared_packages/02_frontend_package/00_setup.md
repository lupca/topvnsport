# Frontend Package: Setup

## Task ID: FE-00
## Prerequisites: None
## Estimated: 1 hour

---

## Mục Tiêu

Tạo structure cho React shared package `@topvnsport/ui-kit`.

---

## Implementation

### 1. Tạo Directory Structure

```bash
mkdir -p packages/ui-kit/src/{components,hooks,utils}
mkdir -p packages/ui-kit/src/components/{DataTable,Popup,Layout}
mkdir -p packages/ui-kit/src/__tests__
```

### 2. File: `packages/ui-kit/package.json`

```json
{
  "name": "@topvnsport/ui-kit",
  "version": "1.0.0",
  "description": "Shared UI components for TopVNSport applications",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./styles.css": "./dist/styles.css"
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts --external react",
    "dev": "tsup src/index.ts --format cjs,esm --dts --external react --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src --ext .ts,.tsx",
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": {
    "react": ">=18.0.0",
    "react-dom": ">=18.0.0"
  },
  "devDependencies": {
    "@testing-library/react": "^14.1.0",
    "@testing-library/jest-dom": "^6.1.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "eslint": "^8.55.0",
    "eslint-plugin-react": "^7.33.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "jsdom": "^23.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "tsup": "^8.0.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0",
    "@vitest/coverage-v8": "^1.0.0"
  },
  "dependencies": {
    "clsx": "^2.0.0",
    "lucide-react": "^0.294.0"
  }
}
```

### 3. File: `packages/ui-kit/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

### 4. File: `packages/ui-kit/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['**/*.test.{ts,tsx}', '**/setup.ts'],
    },
  },
});
```

### 5. File: `packages/ui-kit/src/__tests__/setup.ts`

```typescript
import '@testing-library/jest-dom';
```

### 6. File: `packages/ui-kit/src/index.ts`

```typescript
// Components
export { DataTable } from './components/DataTable/DataTable';
export type { DataTableProps, Column } from './components/DataTable/DataTable';

export { SystemPopupProvider } from './components/Popup/SystemPopupProvider';
export { popupService } from './components/Popup/popupService';
export type { PopupOptions, PopupType } from './components/Popup/popupService';

export { Sidebar } from './components/Layout/Sidebar';
export type { SidebarProps, MenuItem } from './components/Layout/Sidebar';

export { Topbar } from './components/Layout/Topbar';
export type { TopbarProps } from './components/Layout/Topbar';

export { MobileNav } from './components/Layout/MobileNav';
export type { MobileNavProps } from './components/Layout/MobileNav';

// Hooks
export { useDebounce } from './hooks/useDebounce';
export { usePagination } from './hooks/usePagination';

// Utilities
export { cn } from './utils/cn';
```

### 7. File: `packages/ui-kit/src/utils/cn.ts`

```typescript
import { clsx, type ClassValue } from 'clsx';

/**
 * Utility function to merge class names.
 * Combines clsx for conditional classes.
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
```

### 8. File: `packages/ui-kit/README.md`

```markdown
# @topvnsport/ui-kit

Shared UI components for TopVNSport applications.

## Installation

```bash
# In the monorepo
pnpm add @topvnsport/ui-kit --workspace
```

## Components

### DataTable

```tsx
import { DataTable, Column } from '@topvnsport/ui-kit';

interface Product {
  id: number;
  name: string;
  price: number;
}

const columns: Column<Product>[] = [
  { key: 'name', header: 'Tên sản phẩm' },
  { key: 'price', header: 'Giá', render: (item) => `${item.price}đ` },
];

<DataTable
  data={products}
  columns={columns}
  onRowClick={(item) => navigate(`/products/${item.id}`)}
  pagination={{
    page: 1,
    pageSize: 10,
    total: 100,
    onPageChange: setPage,
  }}
/>
```

### Popup Service

```tsx
import { SystemPopupProvider, popupService } from '@topvnsport/ui-kit';

// Wrap app with provider
<SystemPopupProvider>
  <App />
</SystemPopupProvider>

// Use anywhere
popupService.success('Lưu thành công!');
popupService.error('Có lỗi xảy ra');
popupService.confirm('Bạn có chắc muốn xóa?', () => deleteItem());
```

### Layout Components

```tsx
import { Sidebar, Topbar, MobileNav } from '@topvnsport/ui-kit';

<Sidebar
  menuItems={menuItems}
  currentPath={pathname}
  onNavigate={navigate}
/>

<Topbar
  user={{ name: 'Admin', avatar: '/avatar.png' }}
  onLogout={logout}
/>
```

## Hooks

### useDebounce

```tsx
import { useDebounce } from '@topvnsport/ui-kit';

const [search, setSearch] = useState('');
const debouncedSearch = useDebounce(search, 300);

useEffect(() => {
  fetchResults(debouncedSearch);
}, [debouncedSearch]);
```

### usePagination

```tsx
import { usePagination } from '@topvnsport/ui-kit';

const {
  page,
  totalPages,
  hasNext,
  hasPrev,
  nextPage,
  prevPage,
  goToPage,
} = usePagination({ total: 100, pageSize: 10 });
```

## Development

```bash
cd packages/ui-kit
pnpm install
pnpm dev       # Watch mode
pnpm test      # Run tests
pnpm build     # Build package
```
```

---

## Test Cases

### File: `packages/ui-kit/src/__tests__/package.test.ts`

```typescript
import { describe, it, expect } from 'vitest';

describe('Package Exports', () => {
  it('exports DataTable component', async () => {
    const { DataTable } = await import('../index');
    expect(DataTable).toBeDefined();
  });

  it('exports popupService', async () => {
    const { popupService } = await import('../index');
    expect(popupService).toBeDefined();
    expect(popupService.success).toBeInstanceOf(Function);
    expect(popupService.error).toBeInstanceOf(Function);
    expect(popupService.confirm).toBeInstanceOf(Function);
  });

  it('exports SystemPopupProvider', async () => {
    const { SystemPopupProvider } = await import('../index');
    expect(SystemPopupProvider).toBeDefined();
  });

  it('exports layout components', async () => {
    const { Sidebar, Topbar, MobileNav } = await import('../index');
    expect(Sidebar).toBeDefined();
    expect(Topbar).toBeDefined();
    expect(MobileNav).toBeDefined();
  });

  it('exports hooks', async () => {
    const { useDebounce, usePagination } = await import('../index');
    expect(useDebounce).toBeDefined();
    expect(usePagination).toBeDefined();
  });

  it('exports utility functions', async () => {
    const { cn } = await import('../index');
    expect(cn).toBeDefined();
    expect(cn('a', 'b')).toBe('a b');
    expect(cn('a', false && 'b', 'c')).toBe('a c');
  });
});
```

---

## Verification

```bash
# Install dependencies
cd packages/ui-kit
pnpm install

# Run setup tests
pnpm test src/__tests__/package.test.ts

# Build package
pnpm build

# Verify build output
ls -la dist/
```

---

## Checklist

- [ ] Directory structure created
- [ ] package.json with all dependencies
- [ ] tsconfig.json configured
- [ ] vitest.config.ts for testing
- [ ] Test setup file
- [ ] Index file with all exports
- [ ] Utility function (cn)
- [ ] README.md documentation
- [ ] Package exports test passes
- [ ] Package builds successfully
