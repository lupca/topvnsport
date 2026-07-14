# OMS/WMS Identity Service Integration Plan

## Status: TODO
## Priority: HIGH
## Created: 2026-07-14

---

## 1. Problem Summary

### 1.1 CORS/localhost Error (CRITICAL)
OMS và WMS frontend đang gọi `localhost:18101` và `localhost:18102` thay vì production URLs.

**Root cause:** Next.js bakes `NEXT_PUBLIC_*` variables at BUILD time, không phải runtime. Docker Compose đang set environment variables (runtime) thay vì build args.

**Error:**
```
Access to fetch at 'http://localhost:18101/dashboard/stats' from origin 'http://oms.topvnsport.com' 
has been blocked by CORS policy
```

### 1.2 Missing SSO Integration
OMS và WMS chưa có authentication flow, cần redirect sang Identity Service để đăng nhập.

---

## 2. Tasks

### Task 1: Fix OMS Frontend Build Args
**Files:**
- `OMS/frontend/Dockerfile`
- `OMS/docker-compose.prod.yml`

**Changes:**

```dockerfile
# OMS/frontend/Dockerfile - Add before RUN npm run build:
ARG NEXT_PUBLIC_API_URL=http://localhost:18101
ARG NEXT_PUBLIC_OMS_API_URL=http://localhost:18101
ARG NEXT_PUBLIC_WMS_API_URL=http://localhost:18102
ARG NEXT_PUBLIC_IDENTITY_URL=http://localhost:13110

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_OMS_API_URL=$NEXT_PUBLIC_OMS_API_URL
ENV NEXT_PUBLIC_WMS_API_URL=$NEXT_PUBLIC_WMS_API_URL
ENV NEXT_PUBLIC_IDENTITY_URL=$NEXT_PUBLIC_IDENTITY_URL
```

```yaml
# OMS/docker-compose.prod.yml - Change environment to build.args:
oms_frontend:
  build:
    context: ./frontend
    args:
      - NEXT_PUBLIC_API_URL=http://api-oms.topvnsport.com
      - NEXT_PUBLIC_OMS_API_URL=http://api-oms.topvnsport.com
      - NEXT_PUBLIC_WMS_API_URL=http://api-wms.topvnsport.com
      - NEXT_PUBLIC_IDENTITY_URL=http://identity.topvnsport.com
```

### Task 2: Fix WMS Frontend Build Args
**Files:**
- `WMS/frontend/Dockerfile`
- `WMS/docker-compose.prod.yml`

**Changes:** Same pattern as OMS

### Task 3: Add Auth Redirect Logic to OMS Frontend
**Files:**
- `OMS/frontend/src/utils/auth.ts` (new)
- `OMS/frontend/src/app/layout.tsx` or auth wrapper component

**Logic:**
```typescript
// utils/auth.ts
export function checkAuth() {
  const token = localStorage.getItem('access_token');
  if (!token) {
    const currentUrl = encodeURIComponent(window.location.href);
    window.location.href = `${process.env.NEXT_PUBLIC_IDENTITY_URL}/login?redirect=${currentUrl}`;
    return false;
  }
  return true;
}

export async function verifyToken(token: string): Promise<boolean> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_IDENTITY_URL}/api/auth/verify`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.ok;
}
```

**Auth wrapper component:**
```tsx
// components/AuthGuard.tsx
'use client';
import { useEffect, useState } from 'react';
import { checkAuth, verifyToken } from '@/utils/auth';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      checkAuth();
      return;
    }
    
    verifyToken(token).then(valid => {
      if (!valid) {
        localStorage.removeItem('access_token');
        checkAuth();
      } else {
        setIsAuthenticated(true);
      }
      setIsLoading(false);
    });
  }, []);

  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return null;
  return <>{children}</>;
}
```

### Task 4: Add Auth Redirect Logic to WMS Frontend
Same as Task 3, apply to WMS.

### Task 5: Identity Service - Handle Redirect After Login
**Files:**
- `identity-service/frontend/src/app/login/page.tsx`

**Logic:**
```typescript
// After successful login:
const params = new URLSearchParams(window.location.search);
const redirectUrl = params.get('redirect');
if (redirectUrl) {
  // Append token to redirect URL or set in localStorage
  window.location.href = decodeURIComponent(redirectUrl);
} else {
  router.push('/dashboard');
}
```

### Task 6: Update PMI to Use Identity Service (Optional)
PMI hiện có login form riêng. Có thể:
- **Option A:** Giữ nguyên (backward compatible)
- **Option B:** Chuyển sang dùng Identity Service như OMS/WMS

---

## 3. Backend Auth (Already Done)

Backend auth đã được update trong Phase 4:
- `OMS/backend/utils/auth.py` - reads X-User-* headers
- `WMS/backend/utils/auth.py` - reads X-User-* headers
- `PMI/backend/utils/dependency.py` - reads X-User-* headers with JWT fallback

---

## 4. Deployment Steps

1. Update Dockerfiles (Task 1, 2)
2. Update docker-compose.prod.yml (Task 1, 2)
3. Add auth utils and AuthGuard (Task 3, 4)
4. Update Identity login redirect (Task 5)
5. Rebuild and deploy:
   ```bash
   # On EC2:
   cd ~/topvnsport
   sudo docker compose -f OMS/docker-compose.prod.yml up -d --build
   sudo docker compose -f WMS/docker-compose.prod.yml up -d --build
   ```

---

## 5. Testing Checklist

- [ ] OMS frontend calls `api-oms.topvnsport.com` (not localhost)
- [ ] WMS frontend calls `api-wms.topvnsport.com` (not localhost)
- [ ] Unauthenticated user visiting OMS redirects to Identity login
- [ ] Unauthenticated user visiting WMS redirects to Identity login
- [ ] After login at Identity, user is redirected back to original URL
- [ ] Token is stored in localStorage and sent with API requests
- [ ] Invalid/expired token triggers re-authentication

---

## 6. Estimated Effort

| Task | Effort |
|------|--------|
| Task 1-2: Dockerfile/Compose fixes | 30 min |
| Task 3-4: Auth redirect logic | 2 hours |
| Task 5: Identity redirect handling | 30 min |
| Task 6: PMI migration (optional) | 2 hours |
| Testing & deployment | 1 hour |
| **Total** | **~6 hours** |
