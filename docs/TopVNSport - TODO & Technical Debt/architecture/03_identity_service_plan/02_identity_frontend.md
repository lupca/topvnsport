# Phase 2: Identity Management Frontend

## Tổng quan
Xây dựng UI quản lý nhân sự và phân quyền tập trung, sử dụng Next.js 14 + Tailwind (giống PMI frontend).

## Cấu trúc thư mục

```
identity-service/
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx
    │   │   ├── page.tsx                    # Redirect to /login hoặc /dashboard
    │   │   ├── login/
    │   │   │   └── page.tsx
    │   │   ├── dashboard/
    │   │   │   └── page.tsx                # Overview stats
    │   │   ├── staff/
    │   │   │   ├── page.tsx                # Staff list
    │   │   │   ├── new/
    │   │   │   │   └── page.tsx            # Create staff
    │   │   │   └── [id]/
    │   │   │       └── page.tsx            # Edit staff
    │   │   ├── roles/
    │   │   │   ├── page.tsx                # Roles list
    │   │   │   ├── new/
    │   │   │   │   └── page.tsx
    │   │   │   └── [id]/
    │   │   │       └── page.tsx
    │   │   └── settings/
    │   │       └── page.tsx                # Change password, profile
    │   ├── components/
    │   │   ├── layout/
    │   │   │   ├── DashboardLayout.tsx
    │   │   │   ├── Sidebar.tsx
    │   │   │   └── Topbar.tsx
    │   │   ├── staff/
    │   │   │   ├── StaffTable.tsx
    │   │   │   ├── StaffForm.tsx
    │   │   │   └── StaffStatusBadge.tsx
    │   │   ├── roles/
    │   │   │   ├── RoleTable.tsx
    │   │   │   ├── RoleForm.tsx
    │   │   │   └── PermissionSelector.tsx
    │   │   └── ui/
    │   │       ├── Button.tsx
    │   │       ├── Input.tsx
    │   │       ├── Select.tsx
    │   │       ├── Modal.tsx
    │   │       ├── Table.tsx
    │   │       └── Toast.tsx
    │   ├── utils/
    │   │   ├── apiClient.ts
    │   │   └── auth.ts
    │   ├── hooks/
    │   │   ├── useAuth.ts
    │   │   └── useStaff.ts
    │   └── config/
    │       └── settings.ts
    ├── public/
    ├── package.json
    ├── tailwind.config.js
    ├── tsconfig.json
    ├── Dockerfile
    └── Dockerfile.dev
```

---

## 1. Màn hình đăng nhập

### File: `app/login/page.tsx`

**Mockup:**
```
┌─────────────────────────────────────────────┐
│                                             │
│        ╔═══════════════════════════╗        │
│        ║   Identity Management     ║        │
│        ║        Top VN Sport       ║        │
│        ╚═══════════════════════════╝        │
│                                             │
│        ┌───────────────────────────┐        │
│        │ Tên đăng nhập             │        │
│        └───────────────────────────┘        │
│        ┌───────────────────────────┐        │
│        │ Mật khẩu                  │        │
│        └───────────────────────────┘        │
│                                             │
│        ┌───────────────────────────┐        │
│        │       ĐĂNG NHẬP           │        │
│        └───────────────────────────┘        │
│                                             │
│        ┌───────────────────────────┐        │
│        │ [PMI] [OMS] [WMS]         │        │
│        │ Quick links to systems    │        │
│        └───────────────────────────┘        │
└─────────────────────────────────────────────┘
```

**Flow:**
1. User nhập username/password
2. POST `/auth/login` → nhận access_token + refresh_token
3. Lưu tokens vào localStorage
4. Redirect đến `/dashboard`

**Validation (Zod):**
```typescript
const loginSchema = z.object({
  username: z.string().min(1, "Vui lòng nhập tên đăng nhập"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
});
```

---

## 2. Dashboard Layout

### File: `components/layout/DashboardLayout.tsx`

**Mockup:**
```
┌──────────────────────────────────────────────────────────────────┐
│ ┌─────────┐                              [Admin ▼] [Đăng xuất]  │
│ │  LOGO   │  Identity Management                                 │
├─┴─────────┴──────────────────────────────────────────────────────┤
│ ┌──────────┐  ┌────────────────────────────────────────────────┐ │
│ │          │  │                                                │ │
│ │ Dashboard│  │              MAIN CONTENT                      │ │
│ │          │  │                                                │ │
│ │ ────────── │  │                                                │ │
│ │ Nhân sự  │  │                                                │ │
│ │          │  │                                                │ │
│ │ ────────── │  │                                                │ │
│ │ Vai trò  │  │                                                │ │
│ │          │  │                                                │ │
│ │ ────────── │  │                                                │ │
│ │ Cài đặt  │  │                                                │ │
│ │          │  │                                                │ │
│ │ ────────── │  │                                                │ │
│ │           │  │                                                │ │
│ │ [PMI]    │  │                                                │ │
│ │ [OMS]    │  │                                                │ │
│ │ [WMS]    │  │                                                │ │
│ └──────────┘  └────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

**Sidebar Menu Items:**
```typescript
const menuItems = [
  { label: "Dashboard", href: "/dashboard", icon: Home },
  { label: "Nhân sự", href: "/staff", icon: Users },
  { label: "Vai trò", href: "/roles", icon: Shield },
  { label: "Cài đặt", href: "/settings", icon: Settings },
  { type: "divider" },
  { label: "PMI", href: "http://localhost:13100", icon: Package, external: true },
  { label: "OMS", href: "http://localhost:13101", icon: ShoppingCart, external: true },
  { label: "WMS", href: "http://localhost:13102", icon: Warehouse, external: true },
];
```

---

## 3. Quản lý Nhân sự

### 3.1 Danh sách nhân sự (`/staff`)

**Mockup:**
```
┌────────────────────────────────────────────────────────────────────┐
│  Quản lý Nhân sự                              [+ Thêm nhân viên]   │
├────────────────────────────────────────────────────────────────────┤
│  🔍 Tìm kiếm...              [Vai trò ▼] [Trạng thái ▼]           │
├────────────────────────────────────────────────────────────────────┤
│  ┌────┬─────────────┬───────────────────┬──────────┬────────┬────┐ │
│  │ #  │ Tên         │ Email             │ Vai trò  │Trạng thái│   │ │
│  ├────┼─────────────┼───────────────────┼──────────┼────────┼────┤ │
│  │ 1  │ admin       │ admin@example.com │ Admin    │ ● Active│ ⋮ │ │
│  │ 2  │ nguyen_van  │ nguyen@example.com│ PMI Staff│ ● Active│ ⋮ │ │
│  │ 3  │ tran_thi    │ tran@example.com  │ OMS Staff│ ○ Inactive│ ⋮│ │
│  └────┴─────────────┴───────────────────┴──────────┴────────┴────┘ │
│                                                                    │
│  ◀ 1 2 3 ... 10 ▶                              Hiển thị 10 / trang │
└────────────────────────────────────────────────────────────────────┘
```

**Features:**
- Pagination (10/20/50 items per page)
- Search by username, email
- Filter by role, status
- Actions menu: Edit, Deactivate/Activate, Reset Password, Delete

### 3.2 Form thêm/sửa nhân viên

**Mockup:**
```
┌────────────────────────────────────────────────────────────────────┐
│  Thêm nhân viên mới                                    [← Quay lại]│
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Tên đăng nhập *                                                   │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ nguyen_van_a                                                │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  Email *                                                           │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ nguyen.van.a@topvnsport.com                                 │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  Họ và tên                                                         │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ Nguyễn Văn A                                                │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  Vai trò *                                                         │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ Nhân viên PMI                                           ▼   │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  Mật khẩu * (chỉ hiển thị khi tạo mới)                            │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ ••••••••••••                                                │   │
│  └────────────────────────────────────────────────────────────┘   │
│  Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường,   │
│  số và ký tự đặc biệt.                                            │
│                                                                    │
│  ┌─────────────┐  ┌─────────────┐                                 │
│  │    Hủy      │  │    Lưu      │                                 │
│  └─────────────┘  └─────────────┘                                 │
└────────────────────────────────────────────────────────────────────┘
```

**Validation (Zod):**
```typescript
const staffSchema = z.object({
  username: z.string()
    .min(3, "Tên đăng nhập phải có ít nhất 3 ký tự")
    .max(100, "Tên đăng nhập không quá 100 ký tự")
    .regex(/^[a-z0-9_]+$/, "Chỉ cho phép chữ thường, số và dấu gạch dưới"),
  email: z.string().email("Email không hợp lệ"),
  full_name: z.string().max(255).optional(),
  role_id: z.number({ required_error: "Vui lòng chọn vai trò" }),
  password: z.string()
    .min(8, "Mật khẩu phải có ít nhất 8 ký tự")
    .regex(/[A-Z]/, "Mật khẩu phải có ít nhất 1 chữ hoa")
    .regex(/[a-z]/, "Mật khẩu phải có ít nhất 1 chữ thường")
    .regex(/[0-9]/, "Mật khẩu phải có ít nhất 1 số")
    .optional(),  // Required only when creating
});
```

---

## 4. Quản lý Vai trò

### 4.1 Danh sách vai trò (`/roles`)

**Mockup:**
```
┌────────────────────────────────────────────────────────────────────┐
│  Quản lý Vai trò                                  [+ Thêm vai trò] │
├────────────────────────────────────────────────────────────────────┤
│  ┌────┬─────────────┬─────────────────────────┬──────────────┬────┐│
│  │ #  │ Mã          │ Tên                     │ Số nhân viên │    ││
│  ├────┼─────────────┼─────────────────────────┼──────────────┼────┤│
│  │ 1  │ admin       │ Quản trị viên           │      2       │ ⋮  ││
│  │ 2  │ pmi_staff   │ Nhân viên PMI           │      5       │ ⋮  ││
│  │ 3  │ oms_staff   │ Nhân viên OMS           │      3       │ ⋮  ││
│  │ 4  │ wms_staff   │ Nhân viên WMS           │      4       │ ⋮  ││
│  │ 5  │ viewer      │ Người xem               │      1       │ ⋮  ││
│  └────┴─────────────┴─────────────────────────┴──────────────┴────┘│
└────────────────────────────────────────────────────────────────────┘
```

### 4.2 Form vai trò

**Mockup:**
```
┌────────────────────────────────────────────────────────────────────┐
│  Thêm vai trò mới                                      [← Quay lại]│
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Mã vai trò * (không thể sửa sau khi tạo)                         │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ sales_staff                                                 │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  Tên vai trò *                                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ Nhân viên Kinh doanh                                        │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  Mô tả                                                             │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ Quản lý đơn hàng và xem thông tin sản phẩm                  │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  Quyền hạn                                                         │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  PMI                                                        │   │
│  │  ☑ Xem sản phẩm (pmi:read)                                 │   │
│  │  ☐ Chỉnh sửa sản phẩm (pmi:write)                          │   │
│  │  ☐ Toàn quyền PMI (pmi:*)                                  │   │
│  │                                                             │   │
│  │  OMS                                                        │   │
│  │  ☑ Xem đơn hàng (oms:read)                                 │   │
│  │  ☑ Chỉnh sửa đơn hàng (oms:write)                          │   │
│  │  ☐ Toàn quyền OMS (oms:*)                                  │   │
│  │                                                             │   │
│  │  WMS                                                        │   │
│  │  ☑ Xem kho (wms:read)                                      │   │
│  │  ☐ Chỉnh sửa kho (wms:write)                               │   │
│  │  ☐ Toàn quyền WMS (wms:*)                                  │   │
│  │                                                             │   │
│  │  Identity                                                   │   │
│  │  ☐ Quản lý nhân sự (identity:staff)                        │   │
│  │  ☐ Quản lý vai trò (identity:roles)                        │   │
│  │  ☐ Toàn quyền Identity (identity:*)                        │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  ┌─────────────┐  ┌─────────────┐                                 │
│  │    Hủy      │  │    Lưu      │                                 │
│  └─────────────┘  └─────────────┘                                 │
└────────────────────────────────────────────────────────────────────┘
```

---

## 5. Cài đặt tài khoản

### File: `app/settings/page.tsx`

**Mockup:**
```
┌────────────────────────────────────────────────────────────────────┐
│  Cài đặt tài khoản                                                 │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Thông tin cá nhân                                                 │
│  ────────────────────────────────────────────────────────────────  │
│  Tên đăng nhập:  admin                                             │
│  Email:          admin@topvnsport.com                              │
│  Vai trò:        Quản trị viên                                     │
│                                                                    │
│  Đổi mật khẩu                                                      │
│  ────────────────────────────────────────────────────────────────  │
│                                                                    │
│  Mật khẩu hiện tại *                                               │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ ••••••••••••                                                │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  Mật khẩu mới *                                                    │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ ••••••••••••                                                │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  Xác nhận mật khẩu mới *                                           │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ ••••••••••••                                                │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  ┌─────────────────┐                                              │
│  │  Đổi mật khẩu   │                                              │
│  └─────────────────┘                                              │
│                                                                    │
│  Phiên đăng nhập                                                   │
│  ────────────────────────────────────────────────────────────────  │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ Chrome - Windows (Hiện tại)           Đăng nhập: 2 giờ trước│  │
│  │ Firefox - MacOS                       Đăng nhập: 1 ngày trước│  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌───────────────────────────┐                                    │
│  │ Đăng xuất tất cả thiết bị │                                    │
│  └───────────────────────────┘                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 6. API Client

### File: `utils/apiClient.ts`

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
    const response = await fetch(`${APP_SETTINGS.api.baseUrl}/auth/refresh`, {
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
    window.location.href = "/login";
    throw new ApiError("Phiên làm việc đã hết hạn", 401);
  }

  if (!response.ok) {
    const errorInfo = await response.json().catch(() => ({}));
    throw new ApiError(
      errorInfo.detail || `API error: ${response.status}`,
      response.status,
      errorInfo
    );
  }

  if (response.status === 204) return null;
  return response.json();
}
```

---

## 7. Docker Configuration

### File: `docker-compose.yml` (thêm vào identity-service)

```yaml
  identity-frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    container_name: identity-frontend
    ports:
      - "13110:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:18110
      - NEXT_PUBLIC_PMI_URL=http://localhost:13100
      - NEXT_PUBLIC_OMS_URL=http://localhost:13101
      - NEXT_PUBLIC_WMS_URL=http://localhost:13102
    depends_on:
      - identity-api
    develop:
      watch:
        - action: sync
          path: ./frontend/src
          target: /app/src
        - action: rebuild
          path: ./frontend/package.json
```

---

## 8. Checklist triển khai Phase 2

- [ ] Tạo Next.js project với TypeScript
- [ ] Cấu hình Tailwind CSS
- [ ] Implement Login page
- [ ] Implement DashboardLayout với Sidebar
- [ ] Implement Staff list với pagination, search, filter
- [ ] Implement Staff form (create/edit)
- [ ] Implement Roles list
- [ ] Implement Role form với permission selector
- [ ] Implement Settings page (change password)
- [ ] Setup apiClient với refresh token
- [ ] Viết Vitest unit tests cho components
- [ ] Setup Dockerfile
- [ ] Test manual toàn bộ flow
