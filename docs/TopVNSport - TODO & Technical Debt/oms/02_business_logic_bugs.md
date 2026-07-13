# TODO: OMS Business Logic Bugs

## Mức độ: HIGH
## Estimated Effort: High (1-2 days)

---

## 1. RACE CONDITION: Order Number Generation

**File:** `OMS/backend/main.py`, lines 617-628

```python
count_today = db.query(models.Order).filter(
    models.Order.channel_id == channel.id,
    models.Order.created_at >= today_start
).count()
suffix_int = count_today + 1

while True:
    candidate = f"{prefix}{suffix_int:04d}"
    existing = db.query(models.Order).filter(
        models.Order.order_number == candidate
    ).first()
    if not existing:
        break
    suffix_int += 1
```

**Impact:** 2 concurrent requests có thể nhận cùng order number. Unique constraint sẽ catch nhưng gây 500 error.

**Fix - Option A (Database Sequence):**
```python
# Sử dụng database sequence
from sqlalchemy import Sequence

order_seq = Sequence('order_number_seq')

@app.post("/api/orders")
async def create_order(...):
    next_num = db.execute(order_seq)
    order_number = f"{prefix}{next_num:04d}"
```

**Fix - Option B (Retry Logic):**
```python
from sqlalchemy.exc import IntegrityError
import random
import time

MAX_RETRIES = 3

for attempt in range(MAX_RETRIES):
    try:
        order_number = generate_order_number(db, channel)
        order = models.Order(order_number=order_number, ...)
        db.add(order)
        db.commit()
        break
    except IntegrityError:
        db.rollback()
        if attempt == MAX_RETRIES - 1:
            raise HTTPException(503, "Could not generate unique order number")
        time.sleep(random.uniform(0.01, 0.05))  # Jitter
```

---

## 2. RACE CONDITION: Inventory Allocation (TOCTOU)

**File:** `OMS/backend/main.py`, lines 158-300

```python
# allocate_order_items() - Time-of-Check to Time-of-Use vulnerability

# Step 1: Check inventory (READ)
response = call_api(f"{WMS_API_URL}/api/inventory?sku={sku}")
available = response["qty_available"]

# ... time passes, other orders may reserve inventory ...

# Step 2: Create fulfillment (WRITE) - inventory may be gone!
wms_response = call_api(f"{WMS_API_URL}/api/fulfillment-orders", method="POST", ...)
```

**Impact:** Giữa bước check và reserve, order khác có thể lấy mất inventory. Confirmation thành công nhưng WMS reservation fail.

**Fix - Optimistic Reservation:**
```python
async def confirm_order_with_reservation(order_id: int, db: Session):
    """
    Use optimistic locking with retry:
    1. Try to reserve in WMS first
    2. If WMS fails (insufficient stock), rollback OMS changes
    3. If WMS succeeds, commit OMS changes
    """
    order = db.query(models.Order).with_for_update().get(order_id)
    
    try:
        # Try WMS reservation first (atomic operation in WMS)
        wms_result = await create_wms_fulfillment(order)
        
        if wms_result["status"] == "insufficient_stock":
            raise HTTPException(409, "Không đủ tồn kho")
        
        # WMS succeeded, now update OMS
        order.status = "CONFIRMED"
        db.commit()
        
    except Exception as e:
        db.rollback()
        # Compensate: cancel WMS fulfillment if created
        if wms_result.get("fulfillment_id"):
            await cancel_wms_fulfillment(wms_result["fulfillment_id"])
        raise
```

---

## 3. RACE CONDITION: OTP Token Consumption

**File:** `OMS/backend/main.py`, lines 589-614

```python
# No row locking when consuming OTP token
otp_record = db.query(models.OtpVerification).filter(
    models.OtpVerification.verification_token == payload.verification_token
).first()  # No with_for_update()!

if otp_record.used_at:  # Check
    raise HTTPException(400, "Token already used")

otp_record.used_at = datetime.utcnow()  # Use
```

**Impact:** 2 concurrent requests với cùng token có thể cả 2 đều pass validation.

**Fix:**
```python
otp_record = db.query(models.OtpVerification).filter(
    models.OtpVerification.verification_token == payload.verification_token
).with_for_update().first()  # Lock the row

if not otp_record or otp_record.used_at:
    raise HTTPException(400, "Invalid or used token")

otp_record.used_at = datetime.utcnow()
db.flush()  # Immediately write to DB
```

---

## 4. Customer/Channel Deletion với Active Orders

**Files:** 
- `OMS/backend/main.py`, lines 459-469 (delete_customer)
- `OMS/backend/main.py`, lines 555-565 (delete_channel)

```python
@app.delete("/api/customers/{customer_id}")
async def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(models.Customer).get(customer_id)
    if not customer:
        raise HTTPException(404)
    db.delete(customer)  # No check for existing orders!
    db.commit()
```

**Impact:** FK constraint violation hoặc orphaned orders.

**Fix:**
```python
@app.delete("/api/customers/{customer_id}")
async def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(models.Customer).get(customer_id)
    if not customer:
        raise HTTPException(404, "Customer not found")
    
    # Check for active orders
    active_orders = db.query(models.Order).filter(
        models.Order.customer_id == customer_id,
        models.Order.status.notin_(["COMPLETED", "CANCELLED"])
    ).count()
    
    if active_orders > 0:
        raise HTTPException(
            409, 
            f"Cannot delete customer with {active_orders} active orders"
        )
    
    # Soft delete instead of hard delete
    customer.is_deleted = True
    customer.deleted_at = datetime.utcnow()
    db.commit()
```

---

## 5. Partial Failure in WMS Cancellation

**File:** `OMS/backend/main.py`, lines 904-914

```python
for fo in fulfillment_orders:
    wms_response = call_api(
        f"{WMS_API_URL}/api/fulfillment-orders/{fo.fulfillment_number}/cancel",
        method="POST"
    )
    if wms_response.get("status") != "cancelled":
        raise HTTPException(500, "WMS cancellation failed")  # Early exit!
```

**Impact:** Nếu fulfillment #2 fail, #1 đã bị cancel nhưng order vẫn CANCELLED trong OMS.

**Fix:**
```python
async def cancel_order(order_id: int, db: Session):
    order = db.query(models.Order).with_for_update().get(order_id)
    
    errors = []
    for fo in order.fulfillment_orders:
        try:
            await cancel_wms_fulfillment(fo.fulfillment_number)
            fo.status = "CANCELLED"
        except Exception as e:
            errors.append(f"FO {fo.fulfillment_number}: {str(e)}")
    
    if errors:
        # Partial cancellation - log for manual review
        order.notes = f"Partial cancellation errors: {errors}"
        order.status = "CANCELLATION_PENDING"
        db.commit()
        raise HTTPException(
            207,  # Multi-Status
            {"message": "Partial cancellation", "errors": errors}
        )
    
    order.status = "CANCELLED"
    db.commit()
```

---

## 6. Missing Input Validations

**File:** `OMS/backend/schemas/order.py`

```python
# Current - no constraints
class OrderItemInput(BaseModel):
    sku_code: str
    quantity: int  # Allows 0, negative

# Fix
class OrderItemInput(BaseModel):
    sku_code: str = Field(..., min_length=1)
    quantity: int = Field(..., ge=1, le=9999)  # 1-9999 only
```

**Similar fixes needed for:**
- `shipping_fee: Decimal` → `Field(ge=0)`
- `customer.phone` → regex validation
- `items: List[OrderItemInput]` → `Field(min_items=1)`

---

## Files Cần Modify

| File | Action |
|------|--------|
| `OMS/backend/main.py` | Fix race conditions, add validation |
| `OMS/backend/schemas/order.py` | Add Field constraints |
| `OMS/backend/schemas/common.py` | Add phone validation |
| `OMS/backend/models.py` | Add soft delete columns |

---

## Verification

```python
# Test concurrent order number generation
import asyncio
import aiohttp

async def create_order():
    async with aiohttp.ClientSession() as session:
        async with session.post(f"{OMS_URL}/api/orders", json=order_data) as resp:
            return await resp.json()

# Run 10 concurrent creates
results = await asyncio.gather(*[create_order() for _ in range(10)])
order_numbers = [r.get("order_number") for r in results]
assert len(order_numbers) == len(set(order_numbers)), "Duplicate order numbers!"
```
