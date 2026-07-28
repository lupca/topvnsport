# TODO: OCR Scan Bugs (Code Quality Issues)

## Mức độ: HIGH
## Estimated Effort: Low (2-4 hours)

## Audit 2026-07-28

❌ **Open.** Các bugs được phát hiện bởi OCR scan tool ngày 2026-07-25, chưa có task fix.

---

## 1. PMI: ALLOWED_SERVICE_KEYS crash at import

**File:** `PMI/backend/routers/audit.py:18`

```python
ALLOWED_SERVICE_KEYS = set(os.environ["ALLOWED_SERVICE_KEYS"].split(","))
```

**Impact:** KeyError nếu env var không set. App crash khi import module.

**Fix:**
```python
ALLOWED_SERVICE_KEYS = set(
    os.environ.get("ALLOWED_SERVICE_KEYS", "").split(",")
) - {""}
```

---

## 2. OMS: ZaloConfigOut expose secrets

**File:** `OMS/backend/schemas/auth.py`

```python
class ZaloConfigOut(BaseModel):
    zalo_app_id: str
    zalo_secret_key: str      # ❌ Exposed in API response
    zalo_access_token: str    # ❌ Exposed
    zalo_refresh_token: str   # ❌ Exposed
    zalo_template_id: str
```

**Impact:** API GET /api/configs/sms trả về secrets trong response body.

**Fix:** Mask secrets như đã làm với SePay config (OMS-017):
```python
class ZaloConfigOut(BaseModel):
    zalo_app_id: str
    zalo_secret_key: str = "***masked***"
    zalo_access_token: str = "***masked***"
    ...
```

---

## 3. OMS: Mutable default arguments

**File:** `OMS/backend/schemas/order.py:73-74`

```python
class OrderOut(BaseModel):
    items: List[OrderItemOut] = []           # ❌ Shared state
    fulfillment_orders: List[...] = []       # ❌ Shared state
```

**Impact:** Default list shared across all instances → data corruption.

**Fix:**
```python
from pydantic import Field

class OrderOut(BaseModel):
    items: List[OrderItemOut] = Field(default_factory=list)
    fulfillment_orders: List[...] = Field(default_factory=list)
```

---

## 4. WMS: Mutable default arguments

**File:** `WMS/backend/schemas.py` (5+ occurrences)

```python
class InboundItemCreate(BaseModel):
    items: List[...] = []                    # ❌ Line 124
class PickListItemCreate(BaseModel):
    pick_list_items: List[...] = []          # ❌ Line 179
# ... more
```

**Fix:** Same as OMS — use `Field(default_factory=list)`

---

## 5. WMS: seed.py resource leak

**File:** `WMS/backend/seed.py`

```python
def seed():
    db = SessionLocal()
    # ... multiple db.commit() calls
    db.close()  # ❌ Not called if exception
```

**Impact:** DB connection leak nếu crash giữa chừng. Partial seeded state.

**Fix:**
```python
def seed():
    db = SessionLocal()
    try:
        # ... all inserts
        db.commit()  # Single commit at end
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
```

---

## 6. Web: omsHelpers returns empty array on error

**File:** `web/src/services/sport-api/omsHelpers.ts:10-12`

```typescript
if (!response.ok) {
    return [];  // ❌ Can't distinguish "no data" vs "API error"
}
```

**Fix:**
```typescript
if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
}
```

---

## 7. Web: HomePage Redux selectors no null check

**File:** `web/src/features/home/HomePage.tsx:17-19, 181`

```typescript
const products = useAppSelector(state => state.appData.products);
const blogs = useAppSelector(state => state.appData.blogs);
// ...
{blogs.slice(0, 3).map(...)}  // ❌ Crash if blogs undefined
```

**Fix:**
```typescript
const products = useAppSelector(state => state.appData.products) ?? [];
const blogs = useAppSelector(state => state.appData.blogs) ?? [];
```

---

## Verification

```bash
# PMI
grep -n "os.environ\[" PMI/backend/routers/audit.py

# OMS schemas
grep -n "= \[\]" OMS/backend/schemas/order.py

# WMS schemas  
grep -n "= \[\]" WMS/backend/schemas.py

# Web
grep -n "useAppSelector" web/src/features/home/HomePage.tsx
```

## References

- Task: Chưa mở (gộp vào PMI-0XX hoặc tạo task riêng per service)
- Source: inbox.md OCR SCAN FINDINGS 2026-07-25
