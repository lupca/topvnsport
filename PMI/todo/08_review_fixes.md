# Todo 08: Review và Sửa Các Vấn Đề Còn Tồn Đọng

**Ngày review**: 2026-07-13

**Mục tiêu**: Kiểm tra lại 5 mục dev đã báo sửa xong và chỉ ra các vấn đề còn tồn đọng cần khắc phục triệt để.

---

## Kết Quả Review

### 1. Backend Test Fixture (client_no_auth_override) ✅ DONE
**File**: `PMI/backend/tests/conftest.py` (lines 156-168)

**Trạng thái**: Đã hoàn thành đúng yêu cầu.

**Chi tiết**:
- Fixture `client_no_auth_override` đã được tạo
- Chỉ override `get_db`, KHÔNG override `get_current_identity`
- Cho phép test thực tế cơ chế JWT Authentication

---

### 2. Middleware API Key Parsing ✅ DONE (còn 1 vấn đề nhỏ)
**File**: `PMI/backend/utils/middleware.py` (lines 29-41)

**Trạng thái**: Đã implement đúng chức năng chính.

**Vấn đề còn tồn đọng**:
- **Line 38**: Service name bị hardcode là `"OMS"`:
  ```python
  actor_name = "OMS"
  ```
- Không phân biệt được OMS vs WMS vs các service khác khi gọi API

**Đề xuất sửa**:
```python
# Option 1: Thêm header X-Service-Name
service_name = request.headers.get("X-Service-Name", "UNKNOWN_SERVICE")

# Option 2: Map API key -> service name qua env
import os
SERVICE_KEY_MAP = {
    os.getenv("OMS_API_KEY"): "OMS",
    os.getenv("WMS_API_KEY"): "WMS",
}
service_name = SERVICE_KEY_MAP.get(api_key, "UNKNOWN_SERVICE")
```

---

### 3. Tự động Commit Outbox Record ✅ DONE
**File**: `PMI/backend/utils/audit.py` (lines 169, 226)

**Trạng thái**: Đã implement - decorator LUÔN gọi `db.commit()`.

**Lưu ý về thiết kế**:
- Todo gốc (04_action_level_logging.md) nói decorator KHÔNG được commit cho writable endpoints
- Implementation hiện tại commit cho TẤT CẢ endpoints để tránh mất log
- Cách này an toàn hơn cho production nhưng có thể tạo thêm transaction overhead

**Khuyến nghị**: Giữ nguyên implementation hiện tại vì đảm bảo log không bị mất.

---

### 4. Debug Print Statement CHƯA XÓA ❌
**File**: `PMI/backend/utils/dependency.py` (line 36)

**Vấn đề**: Debug print statement vẫn còn trong production code:
```python
print("DEBUG_BE_GET_IDENTITY: token=", token.credentials if token else None)
```

**Cần sửa**: Xóa dòng này hoặc đổi sang `logger.debug()`:
```python
import logging
logger = logging.getLogger(__name__)
# ...
logger.debug(f"DEBUG_BE_GET_IDENTITY: token={token.credentials if token else None}")
```

---

### 5. Service Name Hardcoded trong dependency.py ❌
**File**: `PMI/backend/utils/dependency.py` (line 26)

**Vấn đề**: Giống như middleware.py, service name bị hardcode:
```python
service_name = "OMS"  # Default service name
```

**Cần sửa**: Đồng bộ với cách sửa ở middleware.py.

---

### 6. E2E Tests - product.spec.ts ✅ DONE
**File**: `PMI/frontend/tests/e2e/product.spec.ts`

**Trạng thái**: Đã hoàn thành đúng yêu cầu.

**Chi tiết đã sửa**:
- Login thực sự với `getAuthHeaders()` helper
- Chờ `await page.waitForURL("**/")` trước khi chuyển trang
- Chờ loader ẩn: `await expect(page.getByText("Đang tải...")).not.toBeVisible()`
- Loại bỏ mock API không cần thiết

---

### 7. E2E Tests - audit_e2e.spec.ts ⚠️ CÒN VẤN ĐỀ
**File**: `PMI/frontend/tests/e2e/audit_e2e.spec.ts`

**Các vấn đề còn tồn đọng**:

#### 7.1. Test 82 (line 19): Không chờ dashboard routing xong
```typescript
// Hiện tại:
await page.goto("/catalog");

// Cần sửa như product.spec.ts:
await page.waitForURL("**/");
await page.goto("/catalog");
await expect(page.getByText("Đang tải danh sách sản phẩm...")).not.toBeVisible({ timeout: 60000 });
```

#### 7.2. Test 91 (lines 81-118): Không verify login thành công
```typescript
// Hiện tại: Đăng nhập staff_user nhưng không check response
const staffLoginPromise = page.waitForResponse(...);
await page.getByRole("button", { name: "Đăng nhập" }).click();
await staffLoginPromise;

// Cần thêm verify:
const staffLoginResponse = await staffLoginPromise;
expect(staffLoginResponse.status()).toBe(200);
```

#### 7.3. Test 91 (line 100): Không chờ logout button visible
```typescript
// Hiện tại:
await page.getByRole("button", { name: "Đăng xuất" }).click();

// Cần sửa:
const logoutBtn = page.getByRole("button", { name: "Đăng xuất" });
await expect(logoutBtn).toBeVisible();
await logoutBtn.click();
```

#### 7.4. Test 92 (line 166-170): Pagination assertion có thể fail
```typescript
// Hiện tại expect chính xác 150 records:
await expect(page.getByText("Hiển thị 1 - 50 trong 150")).toBeVisible();

// Nếu DB có log khác ngoài 150 bulk logs thì sẽ fail
// Cần sửa thành pattern matching hoặc reset DB trước khi test
```

---

## Checklist Sửa Lỗi

| # | File | Line | Vấn đề | Ưu tiên |
|---|------|------|--------|---------|
| 1 | `utils/dependency.py` | 36 | Xóa debug print | HIGH |
| 2 | `utils/dependency.py` | 26 | Service name hardcoded | MEDIUM |
| 3 | `utils/middleware.py` | 38 | Service name hardcoded | MEDIUM |
| 4 | `tests/e2e/audit_e2e.spec.ts` | 19 | Thêm wait for dashboard | MEDIUM |
| 5 | `tests/e2e/audit_e2e.spec.ts` | 81-118 | Verify login response | LOW |
| 6 | `tests/e2e/audit_e2e.spec.ts` | 100 | Wait for logout visible | LOW |

---

## Verification

Sau khi sửa xong, chạy các tests:

```bash
# Backend tests
docker compose -f PMI/docker-compose.yml exec api pytest tests/test_auth.py -v
docker compose -f PMI/docker-compose.yml exec api pytest tests/test_audit.py -v

# E2E tests
cd PMI/frontend && npx playwright test tests/e2e/audit_e2e.spec.ts --headed
cd PMI/frontend && npx playwright test tests/e2e/product.spec.ts --headed
```
