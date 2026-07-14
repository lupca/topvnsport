# Phase 2: Fix Frontend Auth (OMS/WMS)

## Mục tiêu
- OMS/WMS frontend gửi JWT token trong mọi API request
- Cập nhật next.config.ts để route qua Gateway (tùy chọn)

---

## Task 2.1: Tạo apiClient.ts cho WMS

**File MỚI:** `WMS/frontend/src/utils/apiClient.ts`

Copy từ PMI và điều chỉnh:

```typescript
import { APP_SETTINGS } from "@/config/settings";

export class ApiError extends Error {
  status: number;
  info?: any;

  constructor(message: string, status: number, info?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.info = info;
  }
}

export async function fetchWithAuth(path: string, options: RequestInit = {}): Promise<any> {
  const baseUrl = APP_SETTINGS.api.baseUrl;
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;

  const headers = new Headers(options.headers || {});
  
  // Attach JWT token
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  // Set default content type
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 401 - redirect to login
  if (response.status === 401) {
    if (typeof window !== "undefined") {
      const { removeAccessToken, redirectToLogin } = await import("@/utils/auth");
      removeAccessToken();
      redirectToLogin();
    }
    throw new ApiError("Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.", 401);
  }

  // Handle other errors
  if (!response.ok) {
    let errorInfo: any = null;
    try {
      errorInfo = await response.clone().json();
    } catch {
      try {
        errorInfo = { detail: await response.clone().text() };
      } catch {
        errorInfo = { detail: "Unknown error" };
      }
    }
    
    let message = "API Error";
    if (typeof errorInfo?.detail === "string") {
      message = errorInfo.detail;
    } else if (Array.isArray(errorInfo?.detail)) {
      message = errorInfo.detail.map((err: any) => `${err.loc?.join(".") || ""}: ${err.msg}`).join(", ");
    }
    
    throw new ApiError(message, response.status, errorInfo);
  }

  if (response.status === 204) {
    return response;
  }

  const contentType = response.headers?.get?.("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  
  return response;
}

export const apiClient = {
  get: (path: string, options?: Omit<RequestInit, "method">) => 
    fetchWithAuth(path, { ...options, method: "GET" }),
  
  post: (path: string, body?: any, options?: Omit<RequestInit, "method" | "body">) => 
    fetchWithAuth(path, { 
      ...options, 
      method: "POST", 
      body: body instanceof FormData ? body : JSON.stringify(body) 
    }),
  
  put: (path: string, body?: any, options?: Omit<RequestInit, "method" | "body">) => 
    fetchWithAuth(path, { 
      ...options, 
      method: "PUT", 
      body: body instanceof FormData ? body : JSON.stringify(body) 
    }),
  
  patch: (path: string, body?: any, options?: Omit<RequestInit, "method" | "body">) => 
    fetchWithAuth(path, { 
      ...options, 
      method: "PATCH", 
      body: body instanceof FormData ? body : JSON.stringify(body) 
    }),
  
  delete: (path: string, options?: Omit<RequestInit, "method">) => 
    fetchWithAuth(path, { ...options, method: "DELETE" }),
};
```

---

## Task 2.2: Sửa api.ts cho OMS

**File:** `OMS/frontend/src/utils/api.ts`

**Thay đổi:** Thêm Authorization header vào function `request()`

```typescript
// THÊM import
import { getAccessToken, removeAccessToken, redirectToLogin } from "@/utils/auth";

// SỬA function request()
async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    // THÊM: Lấy token và tạo headers
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options?.headers,
    };
    
    // THÊM: Attach JWT token
    if (typeof window !== "undefined") {
      const token = getAccessToken();
      if (token) {
        (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
      }
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 401) {
      if (typeof window !== "undefined") {
        removeAccessToken();
        redirectToLogin();
      }
      throw new Error("Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.");
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `API Request Failed with status ${response.status}`);
    }

    if (response.status === 204) {
      return null as T;
    }

    return response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out after 15 seconds');
    }
    throw error;
  }
}
```

---

## Task 2.3: Cập nhật WMS pages sử dụng apiClient

**Các file cần sửa trong WMS:**

### 2.3.1 `WMS/frontend/src/app/(desktop)/inventory/page.tsx`

```typescript
// THAY THẾ
const [invRes, locRes, whRes] = await Promise.all([
  fetch(`${APP_SETTINGS.api.baseUrl}/inventory`),
  fetch(`${APP_SETTINGS.api.baseUrl}/locations`),
  fetch(`${APP_SETTINGS.api.baseUrl}/warehouses`)
]);

// BẰNG
import { apiClient } from "@/utils/apiClient";

const [inventory, locations, warehouses] = await Promise.all([
  apiClient.get<InventoryItem[]>("/inventory"),
  apiClient.get<Location[]>("/locations"),
  apiClient.get<Warehouse[]>("/warehouses")
]);
```

### 2.3.2 Các pages khác cần sửa tương tự:

| File | Thay đổi |
|------|----------|
| `(desktop)/inventory/page.tsx` | fetch → apiClient |
| `(desktop)/warehouses/page.tsx` | fetch → apiClient |
| `(desktop)/locations/page.tsx` | fetch → apiClient |
| `(desktop)/inbound/page.tsx` | fetch → apiClient |
| `(desktop)/barcode-mappings/page.tsx` | fetch → apiClient |
| `(mobile)/m/page.tsx` | fetch → apiClient |
| `(mobile)/m/lookup/page.tsx` | fetch → apiClient |
| `(mobile)/m/receive/page.tsx` | fetch → apiClient |
| `(mobile)/m/receive/[id]/page.tsx` | fetch → apiClient |

**Pattern thay thế:**

```typescript
// CŨ
const res = await fetch(`${APP_SETTINGS.api.baseUrl}/endpoint`);
const data = await res.json();

// MỚI
import { apiClient } from "@/utils/apiClient";
const data = await apiClient.get("/endpoint");
```

```typescript
// CŨ
const res = await fetch(`${APP_SETTINGS.api.baseUrl}/endpoint`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload)
});

// MỚI
const data = await apiClient.post("/endpoint", payload);
```

---

## Task 2.4: (Tùy chọn) Route qua Gateway

Nếu muốn frontend dev cũng đi qua Gateway:

### PMI/frontend/next.config.ts

```typescript
const gatewayUrl = process.env.GATEWAY_URL || 'http://gateway-nginx:80';

const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/pmi-api/:path*',
        destination: `${gatewayUrl}/api/pmi/:path*`,  // Qua gateway
      },
    ];
  },
};
```

### OMS/frontend/next.config.ts

```typescript
const gatewayUrl = process.env.GATEWAY_URL || 'http://gateway-nginx:80';

const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/oms-api/:path*',
        destination: `${gatewayUrl}/api/oms/:path*`,
      },
    ];
  },
};
```

### WMS/frontend/next.config.ts

```typescript
const gatewayUrl = process.env.GATEWAY_URL || 'http://gateway-nginx:80';

const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/wms-api/:path*',
        destination: `${gatewayUrl}/api/wms/:path*`,
      },
    ];
  },
};
```

**Lưu ý:** Nếu không route qua Gateway:
- Dev: Frontend → Backend trực tiếp (backend cần verify JWT)
- Prod: Frontend → Gateway → Backend (gateway verify JWT)

---

## Checklist Phase 2

- [ ] Tạo `WMS/frontend/src/utils/apiClient.ts`
- [ ] Sửa `OMS/frontend/src/utils/api.ts` thêm Authorization header
- [ ] Cập nhật tất cả WMS pages dùng apiClient thay vì raw fetch
- [ ] Test OMS: đăng nhập và thao tác CRUD
- [ ] Test WMS: đăng nhập và thao tác CRUD
- [ ] Verify token được gửi trong request (DevTools → Network → Headers)

---

## Test thủ công

```bash
# 1. Mở DevTools (F12) → Network tab
# 2. Đăng nhập vào OMS/WMS
# 3. Thực hiện 1 action (ví dụ: load danh sách)
# 4. Kiểm tra request có header "Authorization: Bearer xxx" không
```
