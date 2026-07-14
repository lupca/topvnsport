# Phase 4b: OMS & WMS Integration

## Tổng quan
OMS và WMS hiện tại chưa có auth system. Phase này sẽ:
1. Thêm auth dependency vào backends
2. Thêm login redirect vào frontends
3. Kết nối qua Nginx Gateway

---

## 1. Current State Analysis

### OMS Backend (`OMS/backend/main.py`)
- Không có auth middleware
- Các endpoints mở trực tiếp
- Có gọi PMI qua HTTP để lấy product info

### WMS Backend (`WMS/backend/main.py`)
- Không có auth middleware
- Các endpoints mở trực tiếp
- Có gọi OMS để sync inventory

### OMS/WMS Frontend
- Không có login page
- Không có auth token handling

---

## 2. OMS Backend Integration

### 2.1 Thêm files mới

```
OMS/backend/
├── utils/
│   ├── __init__.py
│   ├── auth.py          # Service token verification
│   └── dependency.py    # get_current_identity
└── ...
```

### 2.2 File: `utils/auth.py`

```python
import os
import secrets

INTERNAL_SERVICE_TOKEN = os.environ.get("INTERNAL_SERVICE_TOKEN", "")

def verify_service_token(api_key: str) -> bool:
    """Verify if the X-API-Key matches the system's service token."""
    if not INTERNAL_SERVICE_TOKEN:
        return False
    try:
        return secrets.compare_digest(api_key, INTERNAL_SERVICE_TOKEN)
    except TypeError:
        return False
```

### 2.3 File: `utils/dependency.py`

```python
from typing import Optional
from fastapi import Depends, HTTPException, status, Security, Header, Request
from fastapi.security import APIKeyHeader
from contextvars import ContextVar

# Context variables for audit logging
actor_username_var: ContextVar[Optional[str]] = ContextVar("actor_username", default=None)
actor_type_var: ContextVar[Optional[str]] = ContextVar("actor_type", default=None)
actor_id_var: ContextVar[Optional[str]] = ContextVar("actor_id", default=None)

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

async def get_current_identity(
    request: Request,
    api_key: Optional[str] = Security(api_key_header),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_user_username: Optional[str] = Header(None, alias="X-User-Username"),
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    x_user_permissions: Optional[str] = Header(None, alias="X-User-Permissions"),
):
    """
    Dependency để xác thực request.
    
    Ưu tiên:
    1. X-API-Key: Service-to-Service auth
    2. X-User-* headers: User auth từ Nginx Gateway
    """
    from utils.auth import verify_service_token
    
    # 1. API Key Auth (Services)
    if api_key:
        if verify_service_token(api_key):
            service_name = request.headers.get("X-Service-Name", "PMI")
            actor_username_var.set(service_name)
            actor_type_var.set("SERVICE")
            actor_id_var.set(service_name)
            return {
                "actor_type": "SERVICE",
                "actor_username": service_name,
                "actor_id": service_name
            }
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Service API Key"
        )
    
    # 2. User Auth via Nginx Headers
    if x_user_id and x_user_username:
        actor_username_var.set(x_user_username)
        actor_type_var.set("USER")
        actor_id_var.set(x_user_id)
        
        permissions = []
        if x_user_permissions:
            permissions = [p.strip() for p in x_user_permissions.split(",") if p.strip()]
        
        return {
            "actor_type": "USER",
            "actor_username": x_user_username,
            "actor_id": x_user_id,
            "role": x_user_role,
            "permissions": permissions
        }
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication credentials are required"
    )


def require_oms_access(identity: dict = Depends(get_current_identity)):
    """
    Dependency để check OMS permission.
    """
    if identity["actor_type"] == "SERVICE":
        return identity
    
    permissions = identity.get("permissions", [])
    
    # Check OMS permissions
    if "oms:read" in permissions or "oms:write" in permissions or "oms:*" in permissions:
        return identity
    
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="OMS access required"
    )
```

### 2.4 Update `main.py`

```python
# Thêm import
from utils.dependency import get_current_identity, require_oms_access

# Thêm auth vào các endpoints quan trọng
# Ví dụ:

@app.get("/api/orders")
async def list_orders(
    identity: dict = Depends(require_oms_access),  # Thêm dòng này
    db: Session = Depends(get_db)
):
    # ... existing logic
    pass

@app.post("/api/orders")
async def create_order(
    order_data: OrderCreate,
    identity: dict = Depends(require_oms_access),  # Thêm dòng này
    db: Session = Depends(get_db)
):
    # ... existing logic
    pass

# Một số endpoints có thể public (health check, webhooks từ external)
@app.get("/health")
async def health():
    return {"status": "ok"}
```

### 2.5 Update `docker-compose.yml`

```yaml
services:
  # ... existing services

  api:
    # ... existing config
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/oms_db
      # Thêm service token cho internal calls
      - INTERNAL_SERVICE_TOKEN=oms_wms_internal_api_key_secret_2026
    networks:
      - oms_default
      - gateway_network  # Thêm network để kết nối với Gateway
```

---

## 3. WMS Backend Integration

### 3.1 Tương tự OMS

Copy `utils/auth.py` và `utils/dependency.py` từ OMS, chỉ đổi permission check:

```python
def require_wms_access(identity: dict = Depends(get_current_identity)):
    """
    Dependency để check WMS permission.
    """
    if identity["actor_type"] == "SERVICE":
        return identity
    
    permissions = identity.get("permissions", [])
    
    # Check WMS permissions
    if "wms:read" in permissions or "wms:write" in permissions or "wms:*" in permissions:
        return identity
    
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="WMS access required"
    )
```

---

## 4. OMS Frontend Integration

### 4.1 Thêm files mới

```
OMS/frontend/src/
├── app/
│   └── login/
│       └── page.tsx
├── utils/
│   └── apiClient.ts
├── config/
│   └── settings.ts
└── components/
    └── layout/
        └── AuthWrapper.tsx
```

### 4.2 File: `config/settings.ts`

```typescript
export const APP_SETTINGS = {
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/oms",
  },
  identity: {
    baseUrl: process.env.NEXT_PUBLIC_IDENTITY_URL || "http://localhost:8080",
    loginUrl: process.env.NEXT_PUBLIC_IDENTITY_LOGIN_URL || "http://localhost:13110/login",
  },
};
```

### 4.3 File: `utils/apiClient.ts`

(Copy từ PMI frontend, đổi base URL)

### 4.4 File: `app/login/page.tsx`

```typescript
"use client";

import { useEffect } from "react";
import { APP_SETTINGS } from "@/config/settings";

export default function LoginPage() {
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      window.location.href = "/";
      return;
    }

    // Redirect to Identity Service
    const returnUrl = encodeURIComponent(window.location.origin);
    window.location.href = `${APP_SETTINGS.identity.loginUrl}?redirect=${returnUrl}`;
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-600">Đang chuyển hướng đến trang đăng nhập...</p>
      </div>
    </div>
  );
}
```

### 4.5 File: `components/layout/AuthWrapper.tsx`

```typescript
"use client";

import { useEffect, useState, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { APP_SETTINGS } from "@/config/settings";

interface AuthWrapperProps {
  children: ReactNode;
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Skip auth check on login page
    if (pathname === "/login") {
      setIsAuthenticated(true);
      return;
    }

    const token = localStorage.getItem("access_token");
    
    if (!token) {
      // Redirect to login
      const returnUrl = encodeURIComponent(window.location.href);
      window.location.href = `${APP_SETTINGS.identity.loginUrl}?redirect=${returnUrl}`;
      return;
    }

    // Verify token is still valid (optional - can call /auth/me)
    setIsAuthenticated(true);
  }, [pathname, router]);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return <>{children}</>;
}
```

### 4.6 Update `app/layout.tsx`

```typescript
import AuthWrapper from "@/components/layout/AuthWrapper";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>
        <AuthWrapper>
          {children}
        </AuthWrapper>
      </body>
    </html>
  );
}
```

### 4.7 Update existing API calls

Tất cả các API calls cần update để sử dụng `apiClient`:

```typescript
// TRƯỚC
const response = await fetch("/api/orders");

// SAU
import { apiClient } from "@/utils/apiClient";
const orders = await apiClient.get("/orders");
```

---

## 5. WMS Frontend Integration

### Tương tự OMS Frontend

1. Copy `config/settings.ts` từ OMS, đổi base URL
2. Copy `utils/apiClient.ts`
3. Copy `app/login/page.tsx`
4. Copy `components/layout/AuthWrapper.tsx`
5. Update `app/layout.tsx`
6. Update all API calls

---

## 6. Docker Compose Updates

### OMS `docker-compose.yml`

```yaml
services:
  api:
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/oms_db
      - INTERNAL_SERVICE_TOKEN=oms_wms_internal_api_key_secret_2026
    networks:
      - oms_default
      - gateway_network

  frontend:
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8080/api/oms
      - NEXT_PUBLIC_IDENTITY_URL=http://localhost:8080
      - NEXT_PUBLIC_IDENTITY_LOGIN_URL=http://localhost:13110/login
    networks:
      - oms_default

networks:
  oms_default:
    driver: bridge
  gateway_network:
    external: true
```

### WMS `docker-compose.yml`

```yaml
services:
  api:
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/wms_db
      - INTERNAL_SERVICE_TOKEN=oms_wms_internal_api_key_secret_2026
    networks:
      - wms_default
      - gateway_network

  frontend:
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8080/api/wms
      - NEXT_PUBLIC_IDENTITY_URL=http://localhost:8080
      - NEXT_PUBLIC_IDENTITY_LOGIN_URL=http://localhost:13110/login
    networks:
      - wms_default

networks:
  wms_default:
    driver: bridge
  gateway_network:
    external: true
```

---

## 7. Service-to-Service Calls Update

### OMS gọi PMI

```python
# OMS/backend/services/product_service.py

import os
import httpx

PMI_INTERNAL_URL = os.environ.get("PMI_INTERNAL_URL", "http://pim-api:8000")
INTERNAL_SERVICE_TOKEN = os.environ.get("INTERNAL_SERVICE_TOKEN", "")

async def get_product_from_pmi(product_id: int):
    """Lấy thông tin sản phẩm từ PMI."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{PMI_INTERNAL_URL}/api/products/{product_id}",
            headers={
                "X-API-Key": INTERNAL_SERVICE_TOKEN,
                "X-Service-Name": "OMS"
            }
        )
        response.raise_for_status()
        return response.json()
```

### WMS gọi OMS

```python
# WMS/backend/services/order_service.py

import os
import httpx

OMS_INTERNAL_URL = os.environ.get("OMS_INTERNAL_URL", "http://oms-api:8000")
INTERNAL_SERVICE_TOKEN = os.environ.get("INTERNAL_SERVICE_TOKEN", "")

async def get_order_from_oms(order_id: int):
    """Lấy thông tin đơn hàng từ OMS."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{OMS_INTERNAL_URL}/api/orders/{order_id}",
            headers={
                "X-API-Key": INTERNAL_SERVICE_TOKEN,
                "X-Service-Name": "WMS"
            }
        )
        response.raise_for_status()
        return response.json()
```

---

## 8. Checklist triển khai Phase 4b

### OMS Backend
- [ ] Tạo `utils/auth.py`
- [ ] Tạo `utils/dependency.py`
- [ ] Update `main.py` với auth dependencies
- [ ] Update `docker-compose.yml` với networks
- [ ] Test với curl qua Gateway

### OMS Frontend
- [ ] Tạo `config/settings.ts`
- [ ] Tạo `utils/apiClient.ts`
- [ ] Tạo `app/login/page.tsx`
- [ ] Tạo `components/layout/AuthWrapper.tsx`
- [ ] Update `app/layout.tsx`
- [ ] Update tất cả API calls
- [ ] Update environment variables
- [ ] Test login/logout flow

### WMS Backend
- [ ] Copy và modify từ OMS
- [ ] Update permission checks cho WMS
- [ ] Test với curl qua Gateway

### WMS Frontend
- [ ] Copy và modify từ OMS frontend
- [ ] Test login/logout flow

### Integration Testing
- [ ] Test OMS gọi PMI với service token
- [ ] Test WMS gọi OMS với service token
- [ ] Test user login flow qua Gateway
- [ ] Test permission denied scenarios
