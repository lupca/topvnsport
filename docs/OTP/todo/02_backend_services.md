# 02. Backend Services (OMS - FastAPI)

Toàn bộ API quản lý OTP và gửi SMS được triển khai **native tại OMS Backend**.

## 1. SpeedSMS Integration (`services/sms_service.py`)

- Giải mã token SMS từ bảng `SystemConfig` (Fernet decryption).
- Parser response: đảm bảo `"code" == "00"`.

```python
import httpx
from utils.phone_helper import normalize_phone
from utils.crypto import decrypt_value

async def send_speed_sms(phone: str, otp: str, encrypted_token: str) -> dict:
    normalized_phone = normalize_phone(phone)
    token = decrypt_value(encrypted_token)
    # Return dict with status, provider_response, and failed_reason
```

## 2. API Endpoints (`routers/sms.py`)

### 2.1 POST `/api/sms/send-otp`
- Cập nhật bảng `SmsRateLimit`. Cooldown 60s giữa 2 lần gửi. Lockout nếu vượt 5 lần/15 phút.
- Ghi nhận `sent_at`, `provider_status` ngay sau khi gọi xong API.

### 2.2 POST `/api/sms/verify-otp`
- Nếu Hash hợp lệ và `expires_at` còn hạn:
  - Đánh dấu `verified_at = now()`.
  - Sinh `verification_token` (UUID) và set `verification_expires_at = now() + 15m`.
  - Trả token cho Frontend để đi tiếp luồng Order.

### 2.3 GET/PUT `/api/configs/sms`
- Endpoints cấu hình nằm ở OMS.
- Phân quyền Admin: Yêu cầu auth token của Admin OMS.
- Mask giá trị trả về bằng `*`. Tự động encrypt chuỗi text khi PUT.
