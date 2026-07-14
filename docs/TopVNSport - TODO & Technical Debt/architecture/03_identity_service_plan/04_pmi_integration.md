# Phase 4a: PMI Backend & Frontend Integration

## Tổng quan
Cập nhật PMI để đọc user info từ Nginx headers thay vì tự decode JWT.

---

## 1. PMI Backend Changes

### 1.1 File cần sửa

| File | Thay đổi |
|------|----------|
| `utils/dependency.py` | Đọc từ headers thay vì decode JWT |
| `utils/auth.py` | Giữ nguyên cho service-to-service |
| `routers/auth.py` | Xóa hoặc redirect đến Identity Service |
| `models.py` | Giữ User model cho migration reference |

### 1.2 Cập nhật `utils/dependency.py`

**TRƯỚC (hiện tại):**
```python
async def get_current_identity(
    request: Request,
    api_key: Optional[str] = Security(api_key_header),
    token: Optional[HTTPAuthorizationCredentials] = Security(security_bearer),
    db: Session = Depends(get_db)
):
    # 1. API Key Auth (Services)
    if api_key:
        if verify_service_token(api_key):
            # ... handle service auth
            return {...}
    
    # 2. JWT Bearer Auth (Human Users)
    if token:
        payload = decode_access_token(token.credentials)
        # ... decode and verify JWT
        user = db.query(models.User).filter(...)
        # ... check is_active, etc.
        return {...}
```

**SAU (mới):**
```python
from fastapi import Header

async def get_current_identity(
    request: Request,
    api_key: Optional[str] = Security(api_key_header),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_user_username: Optional[str] = Header(None, alias="X-User-Username"),
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    x_user_permissions: Optional[str] = Header(None, alias="X-User-Permissions"),
    db: Session = Depends(get_db)
):
    """
    Dependency để xác thực request.
    
    Ưu tiên:
    1. X-API-Key: Service-to-Service auth (OMS/WMS gọi PMI)
    2. X-User-* headers: User auth được inject bởi Nginx Gateway
    """
    
    # 1. API Key Auth (Services - giữ nguyên)
    if api_key:
        if verify_service_token(api_key):
            service_header = request.headers.get("X-Service-Name")
            service_name = service_header if service_header else "OMS"
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
        # Headers đã được verify bởi Identity Service qua Nginx
        # Không cần query DB hoặc verify JWT ở đây
        
        actor_username_var.set(x_user_username)
        actor_type_var.set("USER")
        actor_id_var.set(x_user_id)
        
        # Parse permissions if needed
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
    
    # 3. No auth provided
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication credentials are required"
    )
```

### 1.3 Cập nhật `routers/auth.py`

**Xóa hoặc giữ lại cho backward compatibility:**

```python
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse

router = APIRouter(prefix="/api/auth", tags=["Auth"])

@router.post("/login")
async def login():
    """
    DEPRECATED: Login đã chuyển sang Identity Service.
    Redirect frontend đến /auth/login trên Gateway.
    """
    raise HTTPException(
        status_code=410,  # Gone
        detail="Login đã chuyển sang Identity Service. Vui lòng sử dụng /auth/login"
    )

@router.get("/me")
async def get_me(identity: dict = Depends(get_current_identity)):
    """
    Trả về thông tin user hiện tại.
    Giữ lại endpoint này cho compatibility với frontend cũ.
    """
    return {
        "actor_type": identity.get("actor_type"),
        "actor_username": identity.get("actor_username"),
        "actor_id": identity.get("actor_id"),
        "role": identity.get("role"),
        "permissions": identity.get("permissions", [])
    }
```

### 1.4 Thêm Permission Checking (Optional)

```python
# utils/permissions.py

from functools import wraps
from fastapi import HTTPException, status

def require_permission(permission: str):
    """
    Decorator để check permission.
    
    Usage:
        @router.post("/products")
        @require_permission("pmi:write")
        async def create_product(..., identity = Depends(get_current_identity)):
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, identity: dict = None, **kwargs):
            if not identity:
                raise HTTPException(401, "Not authenticated")
            
            user_permissions = identity.get("permissions", [])
            
            # Check exact match or wildcard
            if permission in user_permissions:
                return await func(*args, identity=identity, **kwargs)
            
            # Check wildcard (e.g., "pmi:*" covers "pmi:write")
            service = permission.split(":")[0]
            if f"{service}:*" in user_permissions:
                return await func(*args, identity=identity, **kwargs)
            
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {permission} required"
            )
        
        return wrapper
    return decorator
```

---

## 2. PMI Frontend Changes

### 2.1 File cần sửa

| File | Thay đổi |
|------|----------|
| `app/login/page.tsx` | Redirect đến Identity Service |
| `utils/apiClient.ts` | Cập nhật base URL nếu qua Gateway |
| `components/layout/Topbar.tsx` | Update logout flow |
| `config/settings.ts` | Thêm Identity Service URL |

### 2.2 Cập nhật `config/settings.ts`

```typescript
export const APP_SETTINGS = {
  api: {
    // Khi chạy qua Gateway
    baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/pmi",
  },
  identity: {
    // Identity Service URL
    baseUrl: process.env.NEXT_PUBLIC_IDENTITY_URL || "http://localhost:8080",
    loginUrl: process.env.NEXT_PUBLIC_IDENTITY_LOGIN_URL || "http://localhost:13110/login",
  },
};
```

### 2.3 Cập nhật `app/login/page.tsx`

```typescript
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { APP_SETTINGS } from "@/config/settings";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    // Check if already logged in
    const token = localStorage.getItem("access_token");
    if (token) {
      router.push("/");
      return;
    }

    // Redirect to Identity Service login
    // After login, Identity Service sẽ redirect về PMI với token
    const returnUrl = encodeURIComponent(window.location.origin);
    window.location.href = `${APP_SETTINGS.identity.loginUrl}?redirect=${returnUrl}`;
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-4 border-brand-primary border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-600">Đang chuyển hướng đến trang đăng nhập...</p>
      </div>
    </div>
  );
}
```

### 2.4 Cập nhật `utils/apiClient.ts`

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

async function refreshToken(): Promise<string | null> {
  const refresh = localStorage.getItem("refresh_token");
  if (!refresh) return null;

  try {
    // Call Identity Service refresh endpoint
    const response = await fetch(`${APP_SETTINGS.identity.baseUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    return data.access_token;
  } catch {
    return null;
  }
}

export async function fetchWithAuth(path: string, options: RequestInit = {}): Promise<any> {
  const baseUrl = APP_SETTINGS.api.baseUrl;
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;

  const headers = new Headers(options.headers || {});
  let token = localStorage.getItem("access_token");
  
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response = await fetch(url, { ...options, headers });

  // Try refresh on 401
  if (response.status === 401 && token) {
    const newToken = await refreshToken();
    if (newToken) {
      headers.set("Authorization", `Bearer ${newToken}`);
      response = await fetch(url, { ...options, headers });
    }
  }

  if (response.status === 401) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_username");
    
    // Redirect to Identity Service login
    const returnUrl = encodeURIComponent(window.location.href);
    window.location.href = `${APP_SETTINGS.identity.loginUrl}?redirect=${returnUrl}`;
    throw new ApiError("Phiên làm việc đã hết hạn", 401);
  }

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
      message = errorInfo.detail.map((err: any) => 
        `${err.loc?.join(".") || ""}: ${err.msg}`
      ).join(", ");
    }
    
    throw new ApiError(message, response.status, errorInfo);
  }

  if (response.status === 204) return null;
  
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
  delete: (path: string, options?: Omit<RequestInit, "method">) => 
    fetchWithAuth(path, { ...options, method: "DELETE" }),
};
```

### 2.5 Cập nhật `components/layout/Topbar.tsx`

```typescript
// Thêm logout handler
const handleLogout = async () => {
  try {
    // Call Identity Service logout
    const token = localStorage.getItem("access_token");
    if (token) {
      await fetch(`${APP_SETTINGS.identity.baseUrl}/auth/logout`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
    }
  } catch (e) {
    // Ignore logout errors
  } finally {
    // Clear local storage
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_username");
    
    // Redirect to Identity Service login
    window.location.href = APP_SETTINGS.identity.loginUrl;
  }
};
```

---

## 3. Environment Variables Update

### PMI Backend `.env` / `docker-compose.yml`

```yaml
environment:
  # Existing
  - DATABASE_URL=postgresql://postgres:postgres@db:5432/pim_db
  - MINIO_ENDPOINT=minio:9000
  # ... other existing vars
  
  # Keep for service-to-service auth
  - INTERNAL_SERVICE_TOKEN=oms_wms_internal_api_key_secret_2026
  
  # Remove or keep as fallback (optional)
  # - JWT_SECRET_KEY=... (không cần nữa nếu không tự decode JWT)
```

### PMI Frontend `.env`

```bash
# Qua Gateway
NEXT_PUBLIC_API_URL=http://localhost:8080/api/pmi

# Identity Service
NEXT_PUBLIC_IDENTITY_URL=http://localhost:8080
NEXT_PUBLIC_IDENTITY_LOGIN_URL=http://localhost:13110/login
```

---

## 4. Migration Script

### File: `scripts/migrate_users_to_identity.py`

```python
"""
Script để migrate users từ PMI sang Identity Service.
Chạy một lần trước khi go-live.
"""
import os
import requests
import psycopg2
from psycopg2.extras import RealDictCursor

PMI_DB_URL = os.environ.get("PMI_DATABASE_URL", "postgresql://postgres:postgres@localhost:15433/pim_db")
IDENTITY_API_URL = os.environ.get("IDENTITY_API_URL", "http://localhost:18110")
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN")  # Token của admin account đã tạo ở Identity

def get_pmi_users():
    """Lấy danh sách users từ PMI database."""
    conn = psycopg2.connect(PMI_DB_URL)
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    cursor.execute("""
        SELECT id, username, email, hashed_password, role, is_active, created_at
        FROM users
    """)
    
    users = cursor.fetchall()
    cursor.close()
    conn.close()
    
    return users

def get_or_create_role(role_code: str, headers: dict) -> int:
    """Lấy hoặc tạo role trong Identity Service."""
    # Try to get existing role
    response = requests.get(
        f"{IDENTITY_API_URL}/roles",
        headers=headers
    )
    
    if response.ok:
        roles = response.json()
        for role in roles:
            if role["code"] == role_code:
                return role["id"]
    
    # Create new role if not exists
    role_mapping = {
        "admin": {"name": "Quản trị viên", "permissions": ["pmi:*", "oms:*", "wms:*", "identity:*"]},
        "staff": {"name": "Nhân viên PMI", "permissions": ["pmi:read", "pmi:write"]},
        "viewer": {"name": "Người xem", "permissions": ["pmi:read"]},
    }
    
    role_data = role_mapping.get(role_code, {
        "name": role_code.title(),
        "permissions": ["pmi:read"]
    })
    
    response = requests.post(
        f"{IDENTITY_API_URL}/roles",
        headers=headers,
        json={
            "code": role_code,
            "name": role_data["name"],
            "permissions": role_data["permissions"]
        }
    )
    
    if response.ok:
        return response.json()["id"]
    
    raise Exception(f"Failed to create role {role_code}: {response.text}")

def migrate_user(user: dict, role_id: int, headers: dict):
    """Migrate một user sang Identity Service."""
    response = requests.post(
        f"{IDENTITY_API_URL}/staff/import",  # Special import endpoint that accepts hashed_password
        headers=headers,
        json={
            "username": user["username"],
            "email": user["email"],
            "hashed_password": user["hashed_password"],  # Already hashed
            "role_id": role_id,
            "is_active": user["is_active"],
        }
    )
    
    if response.ok:
        print(f"✓ Migrated user: {user['username']}")
        return True
    elif response.status_code == 409:  # Conflict - user exists
        print(f"⊘ User already exists: {user['username']}")
        return True
    else:
        print(f"✗ Failed to migrate {user['username']}: {response.text}")
        return False

def main():
    if not ADMIN_TOKEN:
        print("Error: ADMIN_TOKEN environment variable is required")
        return
    
    headers = {
        "Authorization": f"Bearer {ADMIN_TOKEN}",
        "Content-Type": "application/json"
    }
    
    # Get PMI users
    print("Fetching users from PMI...")
    users = get_pmi_users()
    print(f"Found {len(users)} users")
    
    # Create role cache
    role_cache = {}
    
    # Migrate each user
    success_count = 0
    for user in users:
        role_code = user["role"] or "viewer"
        
        if role_code not in role_cache:
            role_cache[role_code] = get_or_create_role(role_code, headers)
        
        if migrate_user(user, role_cache[role_code], headers):
            success_count += 1
    
    print(f"\nMigration complete: {success_count}/{len(users)} users migrated")

if __name__ == "__main__":
    main()
```

---

## 5. Checklist triển khai Phase 4a

### Backend
- [ ] Cập nhật `utils/dependency.py` để đọc từ headers
- [ ] Update `routers/auth.py` (deprecate hoặc xóa)
- [ ] Thêm `utils/permissions.py` (optional)
- [ ] Update unit tests
- [ ] Test với curl qua Gateway

### Frontend
- [ ] Cập nhật `config/settings.ts`
- [ ] Cập nhật `app/login/page.tsx` để redirect
- [ ] Cập nhật `utils/apiClient.ts` với refresh token
- [ ] Cập nhật `Topbar.tsx` logout handler
- [ ] Update environment variables
- [ ] Test login/logout flow

### Migration
- [ ] Viết migration script
- [ ] Test migration trên staging
- [ ] Backup PMI users table
- [ ] Run migration
- [ ] Verify all users can login
