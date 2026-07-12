# 01. Database & Security Requirements

## 1. Cập Nhật Models (OMS Backend - `OMS/backend/models.py`)

Vì OTP phục vụ trực tiếp cho quá trình tạo đơn hàng và danh tính khách hàng, toàn bộ Database Models sẽ được đặt tại **OMS** để tối ưu tốc độ tra cứu và giảm điểm đứt gãy (Single point of failure) khi thiết kế microservices.

**SystemConfig Model (Mã hóa At-Rest):**
Lưu token cấu hình nhưng phải mã hóa hai chiều (dùng `Fernet` với key từ biến môi trường) trước khi ghi xuống DB.
```python
class SystemConfig(Base):
    __tablename__ = "system_configs"
    id = Column(Integer, primary_key=True, index=True)
    config_key = Column(String(100), unique=True, nullable=False, index=True)
    config_value = Column(String(500), nullable=True) # Dữ liệu đã bị mã hóa at-rest
    description = Column(String(255), nullable=True)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
```

**OtpVerification Model:**
Theo dõi vòng đời tách biệt `verified_at` và `used_at` bằng một bảng duy nhất tại OMS:
```python
class OtpVerification(Base):
    __tablename__ = "otp_verifications"
    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String(20), nullable=False, index=True) # Chuẩn hóa định dạng 0xxxxxxxxx
    otp_hash = Column(String(255), nullable=False) # HMAC/SHA256
    expires_at = Column(DateTime, nullable=False) # TTL của mã OTP 6 số (5 phút)
    
    # Lifecycle Timestamps
    verified_at = Column(DateTime, nullable=True) # Đánh dấu khi User nhập đúng OTP
    used_at = Column(DateTime, nullable=True)     # Đánh dấu khi đơn hàng đã được tạo thành công với OTP này
    
    # Verification Token
    verification_token = Column(String(255), nullable=True, unique=True, index=True)
    verification_expires_at = Column(DateTime, nullable=True) # Token TTL (verified_at + 15m)
    
    # Trạng thái SMS Provider
    provider_status = Column(String(50), nullable=True)
    provider_response = Column(Text, nullable=True)
    failed_reason = Column(String(255), nullable=True)
    sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)
```

**SmsRateLimit Model (Bắt Buộc):**
Sử dụng trực tiếp Database OMS để chống Brute-force:
```python
class SmsRateLimit(Base):
    __tablename__ = "sms_rate_limits"
    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String(20), nullable=False, index=True)
    action_type = Column(String(50), nullable=False) # 'send', 'verify'
    attempt_count = Column(Integer, default=1)
    last_attempt_at = Column(DateTime, default=utcnow)
    lockout_until = Column(DateTime, nullable=True)
```
