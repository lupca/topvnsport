# 04. OMS Verification Integration

Kiến trúc đặt SMS API trực tiếp tại OMS giúp triệt tiêu hoàn toàn sự phức tạp của giao tiếp liên dịch vụ (Cross-service API calls). OMS tự phát hành, tự kiểm định và tự giới hạn vòng đời của OTP.

## Quy Trình Chống Bypass Native Server-Side

1. Khi luồng Checkout gọi API tạo đơn (`POST /orders`), payload gửi kèm `verification_token`.
2. Controller xử lý CreateOrder của OMS sẽ trực tiếp tra cứu `verification_token` trong DB cục bộ `OtpVerification`.
3. Kiểm tra các điều kiện an toàn:
   - `verification_expires_at > now()` (Token còn hạn 15m).
   - `verified_at IS NOT NULL` (Đã được xác minh qua OTP).
   - `used_at IS NULL` (Chống Replay attack).
4. Nếu hợp lệ, tiến hành lưu trữ Order vào DB và set ngay lập tức `used_at = now()` cho record OTP đó.
5. Nếu không hợp lệ, reject lập tức với mã `403 Forbidden`.
