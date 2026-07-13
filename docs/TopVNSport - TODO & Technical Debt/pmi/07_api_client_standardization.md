# TODO: API Client Standardization

## Mức độ: HIGH
## Estimated Effort: Medium (4-6 hours)

---

## Mô Tả Vấn Đề

Mỗi frontend sử dụng pattern khác nhau để gọi API, gây inconsistency và duplicate code.

### Current State:

| System | File | Pattern | Quality |
|--------|------|---------|---------|
| **PMI** | `src/lib/apiClient.ts` | Centralized client với auth, 401 redirect, typed errors | ✅ Best |
| **OMS** | `src/lib/api.ts` | Simple client với timeout, không auth handling | ⚠️ Medium |
| **WMS** | (none) | Direct `fetch()` trong page components | ❌ Poor |
| **Web** | `src/services/sport-api/` | Mixed patterns | ⚠️ Medium |

### Problematic Code Examples:

**WMS/frontend/src/app/(mobile)/m/lookup/page.tsx (lines 49-96):**
```typescript
// Raw fetch without error handling
const response = await fetch(`${API_URL}/products/${sku}`);
const data = await response.json();
// No auth token
// No error handling
// No retry logic
```

**OMS/frontend/src/lib/api.ts:**
```typescript
// Missing auth token refresh
// No 401 redirect
// No typed responses
```

---

## Impact

- **Security:** WMS requests may miss auth tokens
- **UX:** Inconsistent error handling across systems
- **Maintenance:** Bug fixes need to be applied differently in each system
- **Reliability:** No retry logic for transient failures

---

## Proposed Solution

Adopt PMI's `apiClient.ts` pattern as the standard, then either:
1. **Option A:** Copy to each frontend (quick fix)
2. **Option B:** Extract to shared package (proper solution - see TODO #05)

---

## PMI's apiClient Pattern (Reference Implementation)

**File: PMI/frontend/src/lib/apiClient.ts**

Key features to standardize:
```typescript
// 1. Typed response wrapper
interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
}

// 2. Automatic auth token injection
const headers = {
  'Authorization': `Bearer ${getToken()}`,
  'Content-Type': 'application/json',
};

// 3. 401 handling with redirect
if (response.status === 401) {
  clearToken();
  window.location.href = '/login';
  return { data: null, error: { code: 'UNAUTHORIZED' } };
}

// 4. Consistent error structure
if (!response.ok) {
  return {
    data: null,
    error: {
      code: response.status.toString(),
      message: await response.text(),
    }
  };
}

// 5. Type-safe methods
async function get<T>(url: string): Promise<ApiResponse<T>>
async function post<T>(url: string, body: unknown): Promise<ApiResponse<T>>
async function put<T>(url: string, body: unknown): Promise<ApiResponse<T>>
async function del<T>(url: string): Promise<ApiResponse<T>>
```

---

## Steps to Implement

### Option A: Quick Fix (Copy Pattern)

**Step 1:** Create standardized apiClient for OMS

```typescript
// OMS/frontend/src/lib/apiClient.ts
// Copy from PMI with OMS-specific config

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:18101';

// ... same pattern as PMI
```

**Step 2:** Create standardized apiClient for WMS

```typescript
// WMS/frontend/src/lib/apiClient.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:18102';
```

**Step 3:** Update WMS pages to use apiClient

```typescript
// Before (WMS/frontend/src/app/(mobile)/m/lookup/page.tsx)
const response = await fetch(`${API_URL}/products/${sku}`);
const data = await response.json();

// After
import { apiClient } from '@/lib/apiClient';

const { data, error } = await apiClient.get<Product>(`/products/${sku}`);
if (error) {
  // Handle error consistently
}
```

**Step 4:** Update Web storefront

```typescript
// web/src/lib/apiClient.ts
// Unified client for both PMI and OMS APIs

export const pmiClient = createApiClient({
  baseUrl: import.meta.env.VITE_PMI_API_URL,
});

export const omsClient = createApiClient({
  baseUrl: import.meta.env.VITE_OMS_API_URL,
});
```

### Option B: Shared Package (Recommended)

See TODO #05 for monorepo setup, then:

```typescript
// packages/api-client/src/index.ts
export function createApiClient(config: ApiClientConfig) {
  return {
    get: <T>(url: string) => request<T>('GET', url, config),
    post: <T>(url: string, body: unknown) => request<T>('POST', url, config, body),
    put: <T>(url: string, body: unknown) => request<T>('PUT', url, config, body),
    delete: <T>(url: string) => request<T>('DELETE', url, config),
  };
}

// Usage in each frontend
import { createApiClient } from '@topvnsport/api-client';

export const apiClient = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL,
  getToken: () => localStorage.getItem('token'),
  onUnauthorized: () => window.location.href = '/login',
});
```

---

## Files Cần Tạo/Modify

### New Files (Option A)
| File | Description |
|------|-------------|
| `OMS/frontend/src/lib/apiClient.ts` | Standardized API client |
| `WMS/frontend/src/lib/apiClient.ts` | Standardized API client |

### Modified Files
| File | Action |
|------|--------|
| `WMS/frontend/src/app/(mobile)/m/lookup/page.tsx` | Use apiClient |
| `WMS/frontend/src/app/(mobile)/m/receive/page.tsx` | Use apiClient |
| `WMS/frontend/src/app/**/*.tsx` | Update all fetch calls |
| `OMS/frontend/src/lib/api.ts` | Replace with apiClient |
| `OMS/frontend/src/**/*.tsx` | Update imports |
| `web/src/services/sport-api/*.ts` | Standardize patterns |

---

## Standard API Client Interface

```typescript
interface ApiClientConfig {
  baseUrl: string;
  timeout?: number;                    // Default 30000ms
  getToken?: () => string | null;      // Auth token provider
  onUnauthorized?: () => void;         // 401 handler
  onError?: (error: ApiError) => void; // Global error handler
  retries?: number;                    // Retry count for 5xx
}

interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
  status: number;
}

interface ApiClient {
  get<T>(url: string, options?: RequestOptions): Promise<ApiResponse<T>>;
  post<T>(url: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>>;
  put<T>(url: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>>;
  patch<T>(url: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>>;
  delete<T>(url: string, options?: RequestOptions): Promise<ApiResponse<T>>;
}
```

---

## Verification

```typescript
// Add tests for each frontend

describe('apiClient', () => {
  it('includes auth token in requests', async () => {
    localStorage.setItem('token', 'test-token');
    
    const { data } = await apiClient.get('/products');
    
    // Verify Authorization header was sent
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-token'
        })
      })
    );
  });

  it('redirects on 401', async () => {
    mockFetch.mockResolvedValue({ status: 401 });
    
    await apiClient.get('/protected');
    
    expect(window.location.href).toBe('/login');
  });
});
```

### Manual Testing
1. Login to each system, verify API calls include auth token
2. Expire token, verify redirect to login
3. Trigger API error, verify consistent error display
