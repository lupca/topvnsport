# TODO: Test cases cho SSO Authentication

## 1. PMI Frontend

### apiClient.ts - 401 handling
- [x] Test fetchWithAuth redirect to Identity Service khi nhận 401
- [x] Test removeAccessToken được gọi trước khi redirect
- [x] Test không redirect khi chạy trên server (typeof window === "undefined")

### Topbar.tsx - Logout button
- [x] Test handleLogout gọi logout() từ auth.ts
- [x] Test logout button render đúng

### DashboardLayout.tsx
- [x] Test layout render đúng cho mobile/desktop
- [x] Test không còn auth check logic (đã chuyển sang AuthGuard)

## 2. OMS Frontend

### api.ts - 401 handling
- [x] Test request() redirect to Identity Service khi nhận 401
- [x] Test removeAccessToken được gọi trước khi redirect

### Topbar.tsx - Logout button
- [x] Test handleLogout gọi logout() từ auth.ts

## 3. WMS Frontend

### Topbar.tsx - Logout button
- [x] Test handleLogout gọi logout() từ auth.ts

## 4. Integration Tests

- [x] Test flow: User đăng nhập qua Identity Service -> redirect về app với token
- [x] Test flow: Token hết hạn -> 401 -> redirect về Identity Service
- [x] Test flow: User click logout -> redirect về Identity Service login page

## Notes

- Các test cần mock `@/utils/auth` module
- Sử dụng vi.hoisted() để khai báo mock variables trước vi.mock()
- Tham khảo pattern trong PMI/frontend/src/__tests__/components/ProductList.test.tsx
