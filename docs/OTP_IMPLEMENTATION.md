# Tài liệu Tích hợp SMS OTP (Native OMS)

Tính năng Xác thực SMS OTP được triển khai hoàn toàn (native) bên trong khối OMS (Order Management System), thay vì thực hiện gọi chéo qua khối PMI. Tài liệu này mô tả chi tiết kiến trúc, bảo mật, và quy trình luồng hoạt động từ Frontend tới Backend.

## 1. Kiến trúc Hệ thống (Architecture)

Hệ thống tuân thủ thiết kế Native OMS:
- **OMS Backend:** Chịu trách nhiệm khởi tạo OTP, gửi SMS qua API SpeedSMS, kiểm tra Rate Limit (chống spam), xác thực OTP, và bắt buộc đơn hàng (từ Storefront) phải có `verification_token` hợp lệ.
- **Storefront (Web Frontend):** Chặn luồng thanh toán tại `CartModal`, hiển thị `OtpModal` để yêu cầu xác thực. Sau khi thành công, chuyển mã token vào API tạo đơn.
- **OMS Admin:** Cung cấp giao diện để admin cấu hình Access Token của SpeedSMS. Token này được lưu trữ an toàn dưới dạng mã hóa tại database.

## 2. Các Model Database

Hệ thống sử dụng các Model SQLAlchemy sau trong `OMS/backend/models.py`:

1. **`SystemConfig`**: Lưu trữ các cấu hình chung của hệ thống (như Token của SpeedSMS). 
   - **Bảo mật:** Sử dụng Custom Type `EncryptedString` dựa trên `cryptography.fernet` để mã hóa Token lưu xuống Database và giải mã khi Query, đảm bảo an toàn nếu Database bị lộ.
2. **`OtpVerification`**: Lưu thông tin vòng đời của từng phiên tạo OTP. 
   - Không lưu mã OTP gốc (Plaintext). Mã OTP được mã hóa bằng hàm băm (Hash SHA-256) ngay khi vừa tạo ra.
   - Các trường quan trọng: `verified_at` (thời điểm nhập đúng OTP), `verification_token` (Token bảo mật cấp cho frontend sau khi verify), `used_at` (đánh dấu token đã được dùng để chốt đơn).
3. **`SmsRateLimit`**: Quản lý giới hạn chống spam (Rate Limit) cho mỗi số điện thoại.

## 3. Luồng Giao tiếp (Flow)

### A. Luồng gửi OTP (Send OTP)
- **Endpoint**: `POST /api/sms/send-otp`
- **Logic**:
  1. Frontend gọi API kèm `phone_number`. Backend chuẩn hóa số điện thoại về định dạng `84xxxxxxxxx`.
  2. Kiểm tra Rate Limit. Nếu số điện thoại này đã yêu cầu quá giới hạn (ví dụ: yêu cầu quá 5 lần trong thời gian ngắn), chặn lại (HTTP 429/403).
  3. Tạo mã OTP ngẫu nhiên 6 chữ số. Mã hóa Hash mã OTP này và lưu vào `OtpVerification`.
  4. Truy xuất `speed_sms_token` từ `SystemConfig`.
  5. Gọi API SpeedSMS (`sms_type = 2`).
  6. Nếu ở môi trường Test/Dev (biến `INTEGRITY_MODE=development` hoặc số `0382426669`), có hỗ trợ Bypass/Mock SpeedSMS để không tốn phí tin nhắn.

### B. Luồng Xác thực OTP (Verify OTP)
- **Endpoint**: `POST /api/sms/verify-otp`
- **Logic**:
  1. Băm (Hash) mã OTP mà người dùng nhập vào. So sánh mã Hash này với mã lưu trong `OtpVerification`.
  2. Nếu sai: Cập nhật biến đếm lỗi trong `SmsRateLimit`. Nếu sai quá 5 lần, khóa (Lockout) số điện thoại trong 15 phút.
  3. Nếu đúng: Cập nhật `verified_at`, sinh một `verification_token` (UUID) ngẫu nhiên, giới hạn hiệu lực token (15 phút), và trả token này cho Frontend.

### C. Luồng Tạo đơn hàng (Create Order)
- **Endpoint**: `POST /orders`
- **Logic**:
  1. Nếu đơn hàng đến từ kênh `STOREFRONT`, hệ thống bắt buộc phải có `verification_token`.
  2. Tra cứu `verification_token` trong Database:
     - Kiểm tra tính hết hạn (`verification_expires_at > now`).
     - Kiểm tra trạng thái sử dụng (`used_at IS NULL`).
     - Kiểm tra số điện thoại của token có khớp với số điện thoại đặt hàng.
  3. Sau khi tất cả Pass, hệ thống gán `used_at = now()` (Atomicity) và tiến hành ghi nhận đơn hàng.

## 4. Các điểm lưu ý về Tích hợp & Kiểm thử (Bypass Mode)

Để tạo thuận lợi cho đội QA/Tester và quá trình phát triển E2E mà không bị giới hạn hoặc block từ dịch vụ SpeedSMS, hệ thống hỗ trợ **Bypass Flow**:

- Trên Frontend (`OtpModal.tsx`), có một nút **"Bỏ qua xác nhận (Chỉ dùng cho Test)"**.
- Khi nhấn nút này, UI sẽ ngầm sinh ra mã token giả định là `"BYPASS_OTP_TOKEN"`.
- Backend (`OMS/backend/main.py`) được lập trình để chấp nhận mọi đơn hàng có `verification_token == "BYPASS_OTP_TOKEN"` mà không cần xác vấn database. 
- *Lưu ý: Khi lên Môi trường Production, nút Bypass này cần được loại bỏ.*

## 5. Các cấu hình Môi trường (.env)
- `FERNET_KEY`: Chuỗi base64 độ dài 32 byte để mã hóa token cấu hình trong DB.
- `INTEGRITY_MODE`: Khi gán bằng `development`, hệ thống cho phép bật một số API phục vụ E2E Testing (như lấy lại OTP test mà không cần gọi API thực tế).
