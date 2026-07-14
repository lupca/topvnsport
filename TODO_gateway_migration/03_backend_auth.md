# Phase 3: Fix Backend Auth (OMS/WMS)

## Mục tiêu
- OMS/WMS backend kiểm tra auth trên các endpoint cần bảo vệ
- Sử dụng `get_current_user()` đã có sẵn trong `utils/auth.py`
- Giữ một số endpoint public cho web storefront

---

## Hiểu về auth flow

### Khi đi qua Gateway:
```
Request + JWT → Gateway → auth_request → Identity verify
                              ↓
                    Inject X-User-* headers
                              ↓
                    Forward to Backend
                              ↓
            Backend đọc X-User-* headers (get_current_user)
```

### Khi gọi trực tiếp (dev/fallback):
```
Request + JWT → Backend → verify JWT locally
```

---

## Task 3.1: Cập nhật OMS utils/auth.py

**File:** `OMS/backend/utils/auth.py`

Thêm JWT fallback để hỗ trợ cả 2 flows:

```python
from typing import Optional
from fastapi import Request, HTTPException, status
import os
from jose import JWTError, jwt

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key")
JWT_ALGORITHM = "HS256"


def get_current_user(request: Request) -> dict:
    """
    Authenticate user via:
    1. Gateway-injected X-User-* headers (primary)
    2. JWT Bearer token fallback (direct API access)
    """
    # Method 1: Gateway headers
    x_user_id = request.headers.get("X-User-Id")
    x_user_username = request.headers.get("X-User-Username")

    if x_user_id and x_user_username:
        return {
            "user_id": x_user_id,
            "username": x_user_username,
            "role": request.headers.get("X-User-Role", ""),
            "permissions": request.headers.get("X-User-Permissions", "").split(",") 
                          if request.headers.get("X-User-Permissions") else [],
        }

    # Method 2: JWT Bearer fallback
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]
        try:
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
            username = payload.get("sub")
            if username:
                return {
                    "user_id": str(payload.get("staff_id", "")),
                    "username": username,
                    "role": payload.get("role", ""),
                    "permissions": [],
                }
        except JWTError:
            pass

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required"
    )


def get_optional_user(request: Request) -> Optional[dict]:
    """
    Same as get_current_user but returns None instead of raising.
    Use for endpoints that work both authenticated and unauthenticated.
    """
    try:
        return get_current_user(request)
    except HTTPException:
        return None
```

---

## Task 3.2: Cập nhật WMS utils/auth.py

**File:** `WMS/backend/utils/auth.py`

Copy nội dung giống OMS (Task 3.1).

---

## Task 3.3: Thêm auth vào OMS endpoints

**File:** `OMS/backend/main.py`

### 3.3.1 Import dependency

```python
# THÊM import
from utils.auth import get_current_user, get_optional_user
```

### 3.3.2 Endpoint nào cần auth?

| Endpoint | Auth? | Lý do |
|----------|-------|-------|
| `GET /dashboard/stats` | ✅ Có | Admin only |
| `POST /customers` | ⚠️ Optional | Web storefront tạo customer |
| `GET /customers` | ✅ Có | Admin only |
| `PUT /customers/{id}` | ✅ Có | Admin only |
| `DELETE /customers/{id}` | ✅ Có | Admin only |
| `GET /channels` | ⚠️ Optional | Web cần list channels |
| `POST /channels` | ✅ Có | Admin only |
| `GET /orders` | ✅ Có | Admin only |
| `POST /orders` | ⚠️ Optional | Web storefront đặt hàng |
| `PUT /orders/{id}/*` | ✅ Có | Admin only |
| `/api/sms/*` | ❌ Không | OTP verification |

### 3.3.3 Ví dụ thêm auth

```python
from fastapi import Depends, Request

# Endpoint BẮT BUỘC auth
@app.get("/dashboard/stats")
def get_dashboard_stats(
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)  # THÊM
):
    # current_user chứa {"user_id", "username", "role", "permissions"}
    # ... existing code ...
    pass


# Endpoint OPTIONAL auth (web storefront có thể gọi)
@app.post("/orders")
def create_order(
    payload: schemas.OrderCreateInput,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_optional_user)  # THÊM
):
    # current_user có thể None nếu từ web storefront
    created_by = current_user["username"] if current_user else "storefront"
    # ... existing code ...
    pass
```

### 3.3.4 Danh sách endpoints cần sửa trong OMS

```python
# BẮT BUỘC AUTH - thêm: current_user: dict = Depends(get_current_user)
@app.get("/dashboard/stats")
@app.get("/customers")
@app.get("/customers/{customer_id}")
@app.put("/customers/{customer_id}")
@app.delete("/customers/{customer_id}")
@app.post("/channels")
@app.put("/channels/{channel_id}")
@app.delete("/channels/{channel_id}")
@app.get("/orders")
@app.get("/orders/{order_id}")
@app.post("/orders/{order_id}/confirm")
@app.post("/orders/{order_id}/cancel")
@app.put("/orders/{order_id}")
@app.delete("/orders/{order_id}")

# OPTIONAL AUTH - thêm: current_user: Optional[dict] = Depends(get_optional_user)
@app.post("/customers")
@app.get("/channels")
@app.post("/orders")

# KHÔNG AUTH - giữ nguyên
@app.post("/api/sms/send-otp")
@app.post("/api/sms/verify-otp")
@app.get("/health")
```

---

## Task 3.4: Thêm auth vào WMS endpoints

**File:** `WMS/backend/main.py`

### 3.4.1 Import

```python
from utils.auth import get_current_user
```

### 3.4.2 Tất cả WMS endpoints đều cần auth

WMS là hệ thống nội bộ, không có public API.

```python
# THÊM vào TẤT CẢ endpoints (trừ /health)
@app.get("/warehouses")
def list_warehouses(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)  # THÊM
):
    # ...
```

### 3.4.3 Danh sách endpoints WMS

```python
# TẤT CẢ cần auth
@app.get("/status")
@app.get("/dashboard/stats")
@app.post("/warehouses")
@app.get("/warehouses")
@app.get("/warehouses/{warehouse_id}")
@app.get("/warehouses/code/{code}")
@app.put("/warehouses/{warehouse_id}")
@app.delete("/warehouses/{warehouse_id}")
@app.get("/locations")
@app.get("/warehouses/{id}/locations")
@app.get("/locations/code/{code}")
@app.get("/locations/{id_or_code}")
@app.post("/locations")
@app.put("/locations/{location_id}")
@app.delete("/locations/{location_id}")
@app.get("/inventory")
@app.post("/inventory/adjust")
@app.post("/inventory/transfer")
@app.get("/barcode-mappings")
@app.get("/barcode-mappings/lookup/{barcode}")
@app.post("/barcode-mappings")
@app.put("/barcode-mappings/{id}")
@app.delete("/barcode-mappings/{id}")
@app.get("/inbound-shipments")
@app.get("/inbound-shipments/{shipment_id}")
@app.post("/inbound-shipments")
@app.post("/inbound/{shipment_id}/receive-scan")
@app.post("/products/sync")

# KHÔNG AUTH
@app.get("/health")
```

---

## Task 3.5: Thêm JWT_SECRET_KEY vào docker-compose

**Files:**
- `OMS/docker-compose.yml`
- `WMS/docker-compose.yml`

```yaml
services:
  api:  # hoặc oms_backend, wms-api
    environment:
      # ... existing vars ...
      - JWT_SECRET_KEY=${JWT_SECRET_KEY:-identity_jwt_secret_key_2026_change_me_in_prod}
```

**Lưu ý:** JWT_SECRET_KEY phải GIỐNG với Identity Service để verify token.

---

## Task 3.6: Thêm python-jose dependency

**Files:**
- `OMS/backend/requirements.txt`
- `WMS/backend/requirements.txt`

```
python-jose[cryptography]==3.3.0
```

---

## Checklist Phase 3

- [ ] Cập nhật `OMS/backend/utils/auth.py` với JWT fallback
- [ ] Cập nhật `WMS/backend/utils/auth.py` với JWT fallback
- [ ] Thêm `python-jose` vào requirements.txt
- [ ] Thêm `JWT_SECRET_KEY` vào docker-compose
- [ ] Sửa OMS endpoints thêm auth dependency
- [ ] Sửa WMS endpoints thêm auth dependency
- [ ] Test: Gọi API không có token → 401
- [ ] Test: Gọi API có token → 200
- [ ] Test: Web storefront vẫn đặt hàng được (OTP flow)

---

## Test commands

```bash
# Test không token → 401
curl -i http://localhost:18101/customers
# Expected: 401 Unauthorized

# Test có token → 200
TOKEN="your-jwt-token-here"
curl -i http://localhost:18101/customers \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 OK + data

# Test OMS qua Gateway
curl -i http://localhost:8080/api/oms/customers \
  -H "Authorization: Bearer $TOKEN"
```

---

## Lưu ý về backward compatibility

### Web storefront endpoints (phải giữ public hoặc optional auth):
- `POST /orders` - đặt hàng
- `POST /customers` - tạo customer mới
- `GET /channels` - list channels
- `/api/sms/*` - OTP

### PMI sync endpoints (service-to-service):
- Sử dụng `X-API-Key` header
- Không cần sửa, đã có xử lý trong PMI
