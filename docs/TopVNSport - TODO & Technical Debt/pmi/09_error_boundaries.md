# TODO: React Error Boundaries

## Mức độ: MEDIUM
## Estimated Effort: Low (2-3 hours)

---

## Mô Tả Vấn Đề

Không có React Error Boundary nào trong tất cả 4 frontends. Khi một component throw error (runtime exception), toàn bộ page sẽ crash và hiển thị blank screen.

### Current State:

```bash
# Search for ErrorBoundary in all frontends
grep -r "ErrorBoundary" PMI/frontend OMS/frontend WMS/frontend web
# Result: 0 matches
```

### Example Crash Scenario:

```typescript
// Any unhandled error crashes the entire page
function ProductCard({ product }) {
  // If product.price is undefined, this crashes:
  const formattedPrice = product.price.toLocaleString();
  
  // Without ErrorBoundary: entire page goes blank
  // With ErrorBoundary: only this card shows error UI
}
```

---

## Impact

- **User Experience:** Entire page crashes on minor component errors
- **Debugging:** No error information shown to user or logged
- **Reliability:** One bad data record can break entire list view

---

## Steps to Implement

### Step 1: Create ErrorBoundary Component

**File: PMI/frontend/src/components/ErrorBoundary.tsx** (NEW)

```typescript
'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to error reporting service
    console.error('ErrorBoundary caught:', error, errorInfo);
    
    // Call optional error handler
    this.props.onError?.(error, errorInfo);
    
    // TODO: Send to error tracking (Sentry, etc.)
    // reportError(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback or default error UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-red-800 font-semibold">Đã xảy ra lỗi</h2>
          <p className="text-red-600 text-sm mt-1">
            Vui lòng thử tải lại trang hoặc liên hệ hỗ trợ.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-2 px-3 py-1 bg-red-100 text-red-800 rounded text-sm hover:bg-red-200"
          >
            Thử lại
          </button>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <pre className="mt-2 p-2 bg-red-100 rounded text-xs overflow-auto">
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
```

### Step 2: Create Page-Level Error Boundary

**File: PMI/frontend/src/components/PageErrorBoundary.tsx** (NEW)

```typescript
'use client';

import { ErrorBoundary } from './ErrorBoundary';
import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export function PageErrorBoundary({ children }: Props) {
  return (
    <ErrorBoundary
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center p-8">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">
              Đã xảy ra lỗi
            </h1>
            <p className="text-gray-600 mb-6">
              Trang không thể tải. Vui lòng thử lại.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
```

### Step 3: Wrap Root Layout

**File: PMI/frontend/src/app/layout.tsx** (UPDATE)

```typescript
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <PageErrorBoundary>
          {/* existing layout content */}
          {children}
        </PageErrorBoundary>
      </body>
    </html>
  );
}
```

### Step 4: Add Component-Level Boundaries

For critical sections that shouldn't crash the whole page:

```typescript
// PMI/frontend/src/app/products/page.tsx

import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function ProductsPage() {
  return (
    <div>
      <h1>Sản phẩm</h1>
      
      {/* If DataTable crashes, only this section shows error */}
      <ErrorBoundary fallback={<p>Không thể tải danh sách sản phẩm</p>}>
        <ProductDataTable />
      </ErrorBoundary>
      
      {/* Sidebar still works even if table crashes */}
      <ProductFilters />
    </div>
  );
}
```

### Step 5: Repeat for Other Frontends

Copy `ErrorBoundary.tsx` and `PageErrorBoundary.tsx` to:
- `OMS/frontend/src/components/`
- `WMS/frontend/src/components/`
- `web/src/components/`

Update each root layout to wrap with `PageErrorBoundary`.

---

## Files Cần Tạo/Modify

### New Files
| File | Description |
|------|-------------|
| `PMI/frontend/src/components/ErrorBoundary.tsx` | Base error boundary |
| `PMI/frontend/src/components/PageErrorBoundary.tsx` | Full-page fallback |
| `OMS/frontend/src/components/ErrorBoundary.tsx` | Copy |
| `OMS/frontend/src/components/PageErrorBoundary.tsx` | Copy |
| `WMS/frontend/src/components/ErrorBoundary.tsx` | Copy |
| `WMS/frontend/src/components/PageErrorBoundary.tsx` | Copy |
| `web/src/components/ErrorBoundary.tsx` | Copy |

### Modified Files
| File | Action |
|------|--------|
| `PMI/frontend/src/app/layout.tsx` | Wrap with PageErrorBoundary |
| `OMS/frontend/src/app/layout.tsx` | Wrap with PageErrorBoundary |
| `WMS/frontend/src/app/layout.tsx` | Wrap with PageErrorBoundary |
| `web/src/App.tsx` or `main.tsx` | Wrap with PageErrorBoundary |

---

## Verification

### Unit Test

```typescript
// tests/components/ErrorBoundary.test.tsx
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

const ThrowError = () => {
  throw new Error('Test error');
};

describe('ErrorBoundary', () => {
  it('catches errors and shows fallback', () => {
    // Suppress console.error for this test
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    render(
      <ErrorBoundary fallback={<div>Error occurred</div>}>
        <ThrowError />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Error occurred')).toBeInTheDocument();
  });

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Normal content</div>
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Normal content')).toBeInTheDocument();
  });
});
```

### Manual Testing

1. Add temporary error in a component:
   ```typescript
   throw new Error('Test crash');
   ```
2. Load the page
3. Verify error UI shows instead of blank screen
4. Verify "Thử lại" button works
5. Remove the temporary error

---

## Future Enhancements

1. **Error Reporting:** Integrate with Sentry or similar
   ```typescript
   componentDidCatch(error, errorInfo) {
     Sentry.captureException(error, { extra: errorInfo });
   }
   ```

2. **Granular Boundaries:** Add boundaries around:
   - Data tables
   - Forms
   - Charts/visualizations
   - Third-party components

3. **Recovery Strategies:** 
   - Auto-retry with exponential backoff
   - Clear cache and retry
   - Navigate to safe page
