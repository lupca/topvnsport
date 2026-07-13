# TODO: WMS Race Conditions & Data Integrity

## Mức độ: HIGH
## Estimated Effort: High (1-2 days)

---

## 1. RACE CONDITION: Receive Scan (No Row Locking)

**File:** `WMS/backend/main.py`, lines 534-543

```python
item = db.query(models.InboundItem).filter(
    models.InboundItem.shipment_id == shipment.id,
    models.InboundItem.sku_code == sku
).first()  # NO with_for_update()!

item.received_qty += payload.quantity  # Race condition!
```

**Impact:** 2 operators scan cùng barcode đồng thời → mất count. Ví dụ: cả 2 đọc received_qty=5, cả 2 cộng 1, kết quả=6 thay vì 7.

**Fix:**
```python
item = db.query(models.InboundItem).filter(
    models.InboundItem.shipment_id == shipment.id,
    models.InboundItem.sku_code == sku
).with_for_update().first()  # Lock row

if not item:
    raise HTTPException(404, "Item not found in shipment")

item.received_qty += payload.quantity
db.flush()  # Immediately persist
```

---

## 2. RACE CONDITION: Pick Scan (No Row Locking)

**File:** `WMS/backend/main.py`, lines 772-779

```python
item = db.query(models.PickListItem).filter(
    models.PickListItem.fulfillment_order_id == fo.id,
    models.PickListItem.sku_code == sku
).first()  # NO with_for_update()!

item.picked_qty += payload.quantity  # Race condition!
```

**Impact:** Multiple pickers cùng order → sai số lượng picked.

**Fix:**
```python
item = db.query(models.PickListItem).filter(
    models.PickListItem.fulfillment_order_id == fo.id,
    models.PickListItem.sku_code == sku
).with_for_update().first()

item.picked_qty += payload.quantity
```

---

## 3. OVER-PICKING ALLOWED

**File:** `WMS/backend/main.py`, lines 779-780

```python
item.picked_qty += payload.quantity
if item.picked_qty >= item.quantity:
    item.status = "picked"
# No validation that picked_qty <= quantity!
```

**Impact:** Có thể pick nhiều hơn yêu cầu, gây sai inventory.

**Fix:**
```python
new_qty = item.picked_qty + payload.quantity

if new_qty > item.quantity:
    raise HTTPException(
        400, 
        f"Cannot pick {payload.quantity}. Max remaining: {item.quantity - item.picked_qty}"
    )

item.picked_qty = new_qty
if item.picked_qty == item.quantity:
    item.status = "picked"
```

---

## 4. OVER-RECEIVING ALLOWED

**File:** `WMS/backend/main.py`, line 540

```python
item.received_qty += payload.quantity
# No check against expected_qty!
```

**Impact:** Có thể receive nhiều hơn expected, inventory sai.

**Fix:**
```python
new_qty = item.received_qty + payload.quantity

# Option A: Hard block
if new_qty > item.expected_qty:
    raise HTTPException(
        400,
        f"Cannot receive {payload.quantity}. Expected: {item.expected_qty}, Already received: {item.received_qty}"
    )

# Option B: Allow with warning (common in real WMS)
if new_qty > item.expected_qty:
    # Log discrepancy for review
    log_discrepancy(shipment.id, item.sku_code, "over_receive", new_qty - item.expected_qty)

item.received_qty = new_qty
```

---

## 5. SHIP WITHOUT STATUS VALIDATION

**File:** `WMS/backend/main.py`, lines 943-946

```python
if fo.status == "SHIPPED":
    return {"status": "already_shipped", ...}
# Missing: check that status should be PACKED before shipping!
```

**Impact:** Orders có thể ship từ PENDING/PICKING, bypass quy trình pick/pack.

**Fix:**
```python
ALLOWED_SHIP_FROM = ["PACKED"]

if fo.status == "SHIPPED":
    return {"status": "already_shipped", ...}

if fo.status not in ALLOWED_SHIP_FROM:
    raise HTTPException(
        400,
        f"Cannot ship from status '{fo.status}'. Must be: {ALLOWED_SHIP_FROM}"
    )
```

---

## 6. BUG: Wrong OMS Status Notification

**File:** `WMS/backend/main.py`, line 812

```python
fo.status = "PICKED"
db.commit()
notify_oms_status(fo.oms_order_id, fo.fulfillment_number, "PICKING")  # BUG!
# Should be "PICKED", not "PICKING"
```

**Fix:**
```python
fo.status = "PICKED"
db.commit()
notify_oms_status(fo.oms_order_id, fo.fulfillment_number, "PICKED")  # Fixed
```

---

## 7. COMPLETE_PICK FORCES QUANTITIES

**File:** `WMS/backend/main.py`, lines 807-809

```python
# complete_pick endpoint
for item in fo.pick_list_items:
    if item.picked_qty < item.quantity:
        item.picked_qty = item.quantity  # Forces full pick without actual scan!
    item.status = "picked"
```

**Impact:** Admin có thể "complete" pick mà không thực sự scan, bypass validation.

**Fix:**
```python
# Option A: Don't allow force complete
for item in fo.pick_list_items:
    if item.picked_qty < item.quantity:
        raise HTTPException(
            400,
            f"Item {item.sku_code} not fully picked: {item.picked_qty}/{item.quantity}"
        )
    item.status = "picked"

# Option B: Require explicit force flag with audit
@app.post("/fulfillment-orders/{fn}/complete-pick")
async def complete_pick(fn: str, force: bool = False, reason: str = None, ...):
    for item in fo.pick_list_items:
        if item.picked_qty < item.quantity:
            if not force:
                raise HTTPException(400, "Not all items picked. Use force=true to override")
            if not reason:
                raise HTTPException(400, "Reason required for force complete")
            
            # Log the discrepancy
            log_audit(
                action="force_complete_pick",
                item=item.sku_code,
                expected=item.quantity,
                actual=item.picked_qty,
                reason=reason
            )
            item.picked_qty = item.quantity
```

---

## 8. DUPLICATE INVENTORY CREATION

**File:** `WMS/backend/main.py`, lines 596-605, 427-435

```python
inv = db.query(models.Inventory).filter(
    models.Inventory.sku_code == sku,
    models.Inventory.location_id == location.id
).first()  # No locking

if not inv:
    inv = models.Inventory(sku_code=sku, location_id=location.id)
    db.add(inv)
# Two concurrent requests both see inv=None, both try to create
```

**Fix:**
```python
from sqlalchemy.dialects.postgresql import insert

# Use upsert pattern
stmt = insert(models.Inventory).values(
    sku_code=sku,
    location_id=location.id,
    qty_on_hand=0,
    qty_reserved=0
).on_conflict_do_nothing(
    index_elements=['sku_code', 'location_id']
)
db.execute(stmt)
db.commit()

# Now fetch the record
inv = db.query(models.Inventory).filter(...).with_for_update().first()
inv.qty_on_hand += quantity
```

---

## 9. OMS NOTIFICATION FAILURE INCONSISTENCY

**File:** `WMS/backend/main.py`, lines 962-967

```python
try:
    notify_oms_status(fo.oms_order_id, fo.fulfillment_number, "SHIPPED")
    db.commit()
except Exception as e:
    db.rollback()
    raise HTTPException(...)
```

**Problem:** Nếu OMS nhận notification nhưng WMS rollback, trạng thái không đồng bộ.

**Fix - Outbox Pattern:**
```python
# Instead of direct HTTP call, write to outbox table
status_notification = models.StatusNotification(
    fulfillment_number=fo.fulfillment_number,
    oms_order_id=fo.oms_order_id,
    new_status="SHIPPED",
    created_at=datetime.utcnow()
)
db.add(status_notification)

fo.status = "SHIPPED"
db.commit()  # Atomic: both WMS state and notification intent

# Background worker processes outbox and retries on failure
```

---

## Files Cần Modify

| File | Action |
|------|--------|
| `WMS/backend/main.py` | Add row locking, validation, fix status notification |
| `WMS/backend/models.py` | Add StatusNotification model for outbox |

---

## Verification

```python
# Test concurrent receive
import asyncio
import aiohttp

async def receive_scan(qty):
    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{WMS_URL}/api/receive-scan",
            json={"shipment_id": 1, "barcode": "TEST123", "quantity": qty}
        ) as resp:
            return await resp.json()

# Simulate 10 operators each scanning 1 item
results = await asyncio.gather(*[receive_scan(1) for _ in range(10)])

# Verify total received
shipment = get_shipment(1)
assert shipment.items[0].received_qty == 10, "Race condition detected!"
```
