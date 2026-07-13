# Migration: Web Storefront to Shared Packages

## Task ID: MIG-04
## Prerequisites: MIG-01 (PMI Migration complete)
## Estimated: 2 hours

---

## Mục Tiêu

Migrate web storefront to use shared frontend package.

Note: Web storefront không có backend riêng (uses APIs from PMI/OMS/WMS).

---

## Frontend Migration

### 1. Update package.json

```json
{
  "name": "@topvnsport/web",
  "dependencies": {
    "@topvnsport/ui-kit": "workspace:*"
  }
}
```

### 2. Replace DataTable imports

```tsx
// web/src/components/ProductList.tsx

// BEFORE
import DataTable from '../common/DataTable';

// AFTER
import { DataTable } from '@topvnsport/ui-kit';
```

### 3. Replace popupService imports

```tsx
// web/src/App.tsx

// BEFORE
import { SystemPopupProvider } from './components/SystemPopup';

// AFTER
import { SystemPopupProvider } from '@topvnsport/ui-kit';

// Usage
function App() {
  return (
    <SystemPopupProvider position="bottom-right">
      <Routes>...</Routes>
    </SystemPopupProvider>
  );
}
```

### 4. Replace hook imports

```tsx
// BEFORE
import useDebounce from '../hooks/useDebounce';

// AFTER
import { useDebounce } from '@topvnsport/ui-kit';
```

### 5. Using popupService

```tsx
// web/src/pages/CartPage.tsx

// BEFORE
import { toast } from 'react-toastify';
toast.success('Đã thêm vào giỏ hàng');

// AFTER
import { popupService } from '@topvnsport/ui-kit';
popupService.success('Đã thêm vào giỏ hàng');
```

---

## Test Cases

### Web Frontend Migration Tests

```typescript
// web/src/__tests__/migration/migration.test.tsx

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('Web Storefront Migration', () => {
  describe('DataTable Migration', () => {
    it('DataTable from ui-kit renders', async () => {
      const { DataTable } = await import('@topvnsport/ui-kit');
      
      render(
        <DataTable
          data={[{ id: 1, name: 'Áo thể thao', price: 250000 }]}
          columns={[
            { key: 'name', header: 'Sản phẩm' },
            { key: 'price', header: 'Giá', render: (item) => `${item.price.toLocaleString()}đ` },
          ]}
        />
      );
      
      expect(screen.getByText('Áo thể thao')).toBeInTheDocument();
      expect(screen.getByText('250,000đ')).toBeInTheDocument();
    });
  });

  describe('PopupService Migration', () => {
    it('popupService works for cart notifications', async () => {
      const { popupService, SystemPopupProvider } = await import('@topvnsport/ui-kit');
      
      const { container } = render(
        <SystemPopupProvider>
          <button onClick={() => popupService.success('Đã thêm vào giỏ')}>
            Add
          </button>
        </SystemPopupProvider>
      );
      
      expect(popupService.success).toBeInstanceOf(Function);
    });
  });

  describe('Hooks Migration', () => {
    it('useDebounce works for product search', async () => {
      const { useDebounce } = await import('@topvnsport/ui-kit');
      const { renderHook, act } = await import('@testing-library/react');
      
      const { result } = renderHook(() => useDebounce('search', 300));
      expect(result.current).toBe('search');
    });
  });
});
```

### E2E Migration Verification

```typescript
// e2e_tests/web/migration_verification.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Web Storefront Migration', () => {
  test('product list renders with DataTable', async ({ page }) => {
    await page.goto('/products');
    
    // Products should display
    await expect(page.locator('table')).toBeVisible();
  });

  test('add to cart shows popup', async ({ page }) => {
    await page.goto('/products/1');
    
    await page.click('[data-testid="add-to-cart"]');
    
    // Popup from ui-kit should appear
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText(/thêm vào giỏ/i)).toBeVisible();
  });

  test('search debounce works', async ({ page }) => {
    await page.goto('/products');
    
    // Type in search
    await page.fill('[data-testid="search-input"]', 'áo');
    
    // Should debounce (not search immediately)
    // Wait for results after debounce
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="product-card"]').first()).toBeVisible();
  });
});
```

---

## Verification

```bash
# Frontend
cd web
pnpm install
pnpm test src/__tests__/migration/

# Dev server
pnpm dev
# Open http://localhost:3000 and test manually

# E2E
./start_all.sh
playwright test e2e_tests/web/migration_verification.spec.ts
```

---

## Files to Delete After Migration

```
web/src/common/DataTable.tsx
web/src/components/SystemPopup/
web/src/services/popupService.ts
web/src/hooks/useDebounce.ts
```

---

## Differences from Admin Frontends

Web storefront may have different needs:
- Bottom-right popups (customer-facing UX)
- No admin layout components (Sidebar, Topbar)
- Different DataTable styling (may need to customize)

```tsx
// Customize popup position for storefront
<SystemPopupProvider position="bottom-right" maxPopups={3}>
  <App />
</SystemPopupProvider>
```

---

## Checklist

- [ ] package.json references @topvnsport/ui-kit
- [ ] DataTable imports updated
- [ ] SystemPopupProvider added to App
- [ ] popupService imports updated
- [ ] Hook imports updated
- [ ] Duplicate files deleted
- [ ] Frontend tests pass
- [ ] E2E tests pass
- [ ] Manual smoke test passed
