# 05. Testing & Quality Assurance

Yêu cầu đảm bảo test bao phủ toàn bộ các luồng bảo mật, rate limit và native architecture cho OMS.

## 1. Backend Testing (Pytest cho OMS)
Các test case bắt buộc:
- **Rate Limit & Lockout:** Gửi 2 OTP trong 60s -> `429`. Gửi 6 OTP trong 15m -> Lockout. Sai OTP 5 lần -> Lockout.
- **OTP Hashing:** Verify giá trị DB là hash, không lộ OTP.
- **SMS Provider Mocking:** Mock `httpx.AsyncClient` trả về lỗi SpeedSMS -> API trả lỗi 500, DB lưu `provider_status = failed`.
- **Verify Logic:** Verify đúng -> Sinh token, update `verified_at`. Reuse OTP -> 400.
- **Order Creation Security:** Test API tạo đơn với `verification_token` trống hoặc sai -> `403`. Token đúng -> đơn được tạo và `used_at` được set. Dùng lại token đó lần 2 -> `403`.

## 2. E2E Testing Frontend (Playwright)
Dù là một tác vụ tập trung vào API, theo đúng `ORIGINAL_REQUEST.md`, hệ thống sẽ sử dụng **Playwright** để xác nhận end-to-end user flow:
- **OMS Admin Settings:** Mở trang Admin, kiểm tra hiển thị token đã mask, điền token mới, ấn Save -> Báo thành công.
- **Storefront Cart Checkout:**
  - Điền form mua hàng -> Nút gửi mã OTP trigger cooldown 60s. Bấm nhiều lần để check UI Rate limit.
  - Điền mã OTP đúng -> Modal đóng, `CartModal` tự động đẩy order kèm `verification_token` -> Hiện bảng Thành Công.
