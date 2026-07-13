# TODO: OMS Security - Critical Issues

## Mức độ: CRITICAL
## Estimated Effort: High (1-2 days)

---

## Các Vấn Đề Bảo Mật Nghiêm Trọng

### 1. HARDCODED OTP BYPASS TOKEN (CRITICAL)

**File:** `OMS/backend/main.py`, line 589

```python
if payload.verification_token != "BYPASS_OTP_TOKEN":
    # Verify OTP...
```

**Impact:** Bất kỳ ai biết token "BYPASS_OTP_TOKEN" có thể đặt hàng mà không cần xác minh điện thoại. Token này cũng được hiển thị trong frontend!

**Fix:**
```python
# Xóa hoàn toàn bypass logic
# Hoặc chỉ cho phép trong development mode
if os.getenv("ENV") == "development" and payload.verification_token == os.getenv("DEV_BYPASS_TOKEN"):
    pass  # Allow bypass only in dev with env var
else:
    # Always verify OTP in production
    otp_record = db.query(models.OtpVerification)...
```

---

### 2. HARDCODED FERNET ENCRYPTION KEY (CRITICAL)

**Files:** 
- `OMS/backend/models.py`, lines 101-102
- `OMS/backend/utils/crypto.py`, lines 6-7

```python
key = "lz_K8Z8d1d-0iO-4yN2Vb11234567890abcdefghijk="  # PUBLIC KEY!
```

**Impact:** Tất cả encrypted data (SMS tokens) sử dụng key công khai nếu env var không được set. Attacker có thể decrypt sensitive config.

**Fix:**
```python
# crypto.py
import os
from cryptography.fernet import Fernet

key = os.getenv("FERNET_KEY")
if not key:
    raise RuntimeError("FERNET_KEY environment variable is required")

fernet = Fernet(key.encode())
```

---

### 3. NO AUTHENTICATION ON ANY ENDPOINT (CRITICAL)

**File:** `OMS/backend/main.py`

**Impact:** Tất cả endpoints đều public - bất kỳ ai cũng có thể:
- Xem/sửa/xóa customers
- Tạo/hủy orders
- Cập nhật SMS config (lấy API token!)
- Xem tất cả order data

**Fix:** Thêm authentication middleware tương tự PMI:

```python
from fastapi import Depends, Security
from fastapi.security import HTTPBearer, APIKeyHeader

security = HTTPBearer()
api_key_header = APIKeyHeader(name="X-API-Key")

async def get_current_user(token: str = Security(security)):
    # Verify JWT token
    ...

async def verify_api_key(api_key: str = Security(api_key_header)):
    # Verify API key for service-to-service
    ...

# Apply to admin routes
@router.delete("/customers/{id}", dependencies=[Depends(get_current_user)])
async def delete_customer(...):
    ...

# Public routes (storefront checkout) - require OTP verification only
@router.post("/orders/storefront", dependencies=[])  # No auth, but OTP required
```

---

### 4. WILDCARD CORS WITH CREDENTIALS (HIGH)

**File:** `OMS/backend/main.py`, lines 65-71

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,  # DANGEROUS COMBINATION!
)
```

**Impact:** Bất kỳ website nào cũng có thể gửi authenticated requests đến API, cho phép CSRF-like attacks.

**Fix:**
```python
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:13101",
    "https://yourdomain.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
)
```

---

### 5. SMS CONFIG UPDATE WITHOUT AUTH (CRITICAL)

**File:** `OMS/backend/main.py`, lines 1219-1238

```python
@app.put("/api/configs/sms")
async def update_sms_config(payload: SmsConfigUpdate, db: Session = Depends(get_db)):
    # Anyone can update the SpeedSMS API token!
```

**Impact:** Attacker có thể thay đổi SMS API token, redirect OTPs, hoặc extract token hiện tại.

**Fix:**
```python
@app.put("/api/configs/sms", dependencies=[Depends(require_admin)])
async def update_sms_config(...):
    ...
```

---

### 6. DEVELOPMENT OTP ENDPOINT EXPOSED

**File:** `OMS/backend/main.py`, lines 1017-1024

```python
@app.get("/api/sms/test-last-otp")
async def get_last_otp(phone: str):
    if INTEGRITY_MODE == "development" or os.getenv("ENV") == "development":
        return {"otp": LAST_OTPS.get(phone)}
```

**Impact:** Nếu env var bị set sai, OTP codes bị leak.

**Fix:**
```python
@app.get("/api/sms/test-last-otp", include_in_schema=False)
async def get_last_otp(phone: str):
    # Only allow in explicit test mode
    if os.getenv("ALLOW_TEST_OTP_ENDPOINT") != "true":
        raise HTTPException(404, "Not found")
    ...
```

---

## Files Cần Modify

| File | Action |
|------|--------|
| `OMS/backend/main.py` | Remove OTP bypass, add auth, fix CORS |
| `OMS/backend/utils/crypto.py` | Require FERNET_KEY env var |
| `OMS/backend/models.py` | Remove hardcoded fallback key |
| `OMS/.env.example` | Document required env vars |

---

## Verification

```bash
# Test no auth on admin endpoints
curl -X DELETE http://localhost:18101/api/customers/1
# Should return 401 Unauthorized

# Test CORS
curl -H "Origin: http://evil.com" -X OPTIONS http://localhost:18101/api/orders
# Should NOT include Access-Control-Allow-Origin: *

# Test OTP bypass removed
curl -X POST http://localhost:18101/api/orders \
  -d '{"verification_token": "BYPASS_OTP_TOKEN", ...}'
# Should return 401/403, not success
```
