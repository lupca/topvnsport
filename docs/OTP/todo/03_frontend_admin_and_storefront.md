# 03. Frontend Admin & Storefront

## 1. OMS Frontend (Next.js Admin)
- Tạo trang quản lý cấu hình SMS tại Admin của OMS: `src/app/settings/sms/page.tsx`.
- Input field để nhập Token nên để `type="password"`.
- Khi fetch từ API `/api/configs/sms`, giá trị hiển thị sẽ là mask (VD: `HeW9e***********`). Nếu admin cần đổi token, họ ghi đè đoạn text này bằng token mới.

## 2. Storefront (React Vite Web)

### 2.1 Component `OtpModal.tsx`
- Quản lý state độc lập: `cooldown` (60s countdown), `otpCode`, `errorMessage`.
- Handle HTTP status lỗi rõ ràng.

### 2.2 Cập nhật `CartModal.tsx`
Luồng hoạt động:
1. Người dùng ấn "Xác nhận đặt hàng ✓".
2. Bỏ `isSubmitting = true`. Thay vào đó, set `isOtpModalOpen = true`. Modal ngầm gọi API `sendOtp(phone)` sang OMS.
3. Nhập mã, ấn "Xác nhận OTP" -> Gọi `verifyOtp(phone, code)`.
4. Nhận `verification_token` -> Tắt modal, bật cờ `isSubmitting = true` để chống ấn nhiều lần.
5. Gọi `sportApi.createOrder(payload)` sang OMS với trường `verification_token`.
