# SePay Payment Integration Plan

> **Version**: 1.0  
> **Created**: 2026-07-28  
> **Status**: Ready for Development  
> **Estimated Effort**: 2-3 ngày  

## Mục tiêu

Tích hợp thanh toán QR chuyển khoản ngân hàng qua SePay Payment Gateway cho Web Storefront.

**Scope:**
- Hiển thị QR thanh toán khi checkout
- Nhận IPN khi khách chuyển khoản thành công
- Cập nhật trạng thái đơn hàng

**Out of scope:**
- Thẻ quốc tế, NAPAS QR (phase sau)
- Hoàn tiền (refund)

---

## Thông tin tích hợp (Production)

```
MERCHANT_ID:  <từ SePay Dashboard>
SECRET_KEY:   <từ SePay Dashboard>
API_KEY:      <từ SePay Dashboard>

Base URLs:
- Checkout:   https://pay.sepay.vn/v1/checkout/init
- API:        https://pgapi.sepay.vn
```

---

## Tasks

### Task 1: Database Migration

**File:** `OMS/backend/alembic/versions/xxx_add_payment_fields.py`

```sql
-- Thêm cột payment vào orders
ALTER TABLE orders ADD COLUMN payment_status VARCHAR(20) DEFAULT 'PENDING';
ALTER TABLE orders ADD COLUMN payment_method VARCHAR(20);
ALTER TABLE orders ADD COLUMN sepay_order_id VARCHAR(100);
ALTER TABLE orders ADD COLUMN paid_at TIMESTAMP;

-- Index
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_sepay_order_id ON orders(sepay_order_id);
```

**Acceptance Criteria:**
- [ ] Migration chạy thành công
- [ ] Rollback hoạt động

---

### Task 2: SePay Service

**File:** `OMS/backend/services/sepay_service.py`

```python
import hmac
import hashlib
import base64
import os
from typing import Optional
from dataclasses import dataclass

@dataclass
class CheckoutData:
    order_number: str
    amount: int  # VND, không có phần thập phân
    description: str
    success_url: str
    error_url: str
    cancel_url: str

class SepayService:
    def __init__(self):
        self.merchant_id = os.getenv("SEPAY_MERCHANT_ID")
        self.secret_key = os.getenv("SEPAY_SECRET_KEY")
        self.checkout_url = os.getenv(
            "SEPAY_CHECKOUT_URL", 
            "https://pay.sepay.vn/v1/checkout/init"
        )
    
    def generate_checkout_form(self, data: CheckoutData) -> dict:
        """
        Tạo form fields để POST đến SePay checkout.
        
        Returns:
            {
                "action": "https://pay.sepay.vn/v1/checkout/init",
                "fields": {
                    "merchant": "...",
                    "order_invoice_number": "...",
                    "order_amount": "...",
                    "signature": "...",
                    ...
                }
            }
        """
        fields = {
            "merchant": self.merchant_id,
            "currency": "VND",
            "order_amount": str(data.amount),
            "operation": "PURCHASE",
            "order_description": data.description,
            "order_invoice_number": data.order_number,
            "success_url": data.success_url,
            "error_url": data.error_url,
            "cancel_url": data.cancel_url,
        }
        
        fields["signature"] = self._sign_fields(fields)
        
        return {
            "action": self.checkout_url,
            "fields": fields
        }
    
    def _sign_fields(self, fields: dict) -> str:
        """
        Tạo signature theo spec SePay.
        """
        signed_field_names = [
            "merchant", "operation", "payment_method", "order_amount",
            "currency", "order_invoice_number", "order_description",
            "customer_id", "success_url", "error_url", "cancel_url"
        ]
        
        parts = []
        for field in signed_field_names:
            if field in fields:
                parts.append(f"{field}={fields[field]}")
        
        message = ",".join(parts)
        signature = hmac.new(
            self.secret_key.encode(),
            message.encode(),
            hashlib.sha256
        ).digest()
        
        return base64.b64encode(signature).decode()
```

**Acceptance Criteria:**
- [ ] Unit test với mock data
- [ ] Signature match với SePay test tool

---

### Task 3: Checkout API Endpoint

**File:** `OMS/backend/routers/payments.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from services.sepay_service import SepayService, CheckoutData
import models

router = APIRouter(prefix="/api/payments", tags=["Payments"])

class CheckoutRequest(BaseModel):
    order_id: int

class CheckoutResponse(BaseModel):
    action: str
    fields: dict

@router.post("/checkout", response_model=CheckoutResponse)
def create_checkout(
    req: CheckoutRequest, 
    db: Session = Depends(get_db)
):
    """
    Tạo form checkout SePay cho đơn hàng.
    Frontend sẽ render form và auto-submit.
    """
    order = db.query(models.Order).filter(
        models.Order.id == req.order_id
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Đơn hàng không tồn tại")
    
    if order.payment_status == "PAID":
        raise HTTPException(status_code=400, detail="Đơn hàng đã thanh toán")
    
    # URLs callback - thay bằng domain thật
    base_url = "https://topvnsport.vn"  # hoặc từ env
    
    sepay = SepayService()
    checkout_data = CheckoutData(
        order_number=order.order_number,
        amount=int(order.total_amount + order.shipping_fee),
        description=f"Thanh toan don hang {order.order_number}",
        success_url=f"{base_url}/checkout/success?order={order.order_number}",
        error_url=f"{base_url}/checkout/error?order={order.order_number}",
        cancel_url=f"{base_url}/checkout/cancel?order={order.order_number}",
    )
    
    return sepay.generate_checkout_form(checkout_data)
```

**Register router trong `main.py`:**
```python
from routers import payments
app.include_router(payments.router)
```

**Acceptance Criteria:**
- [ ] `POST /api/payments/checkout` trả về form data
- [ ] Signature hợp lệ khi submit đến SePay

---

### Task 4: IPN Webhook Handler

**File:** `OMS/backend/routers/webhooks.py` (đã có sẵn, cần bổ sung logic)

```python
@sepay_router.post("/sepay")
async def sepay_webhook(request: Request, db: Session = Depends(get_db)):
    raw_body = await request.body()

    try:
        payload = json.loads(raw_body)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid JSON")

    logger.info(f"SePay IPN: {payload}")

    notification_type = payload.get("notification_type")
    order_data = payload.get("order", {})
    transaction_data = payload.get("transaction", {})

    # Chỉ xử lý thanh toán thành công
    if notification_type not in ("PAYMENT_SUCCESS", "ORDER_PAID"):
        return {"success": True, "message": f"Ignored: {notification_type}"}

    if transaction_data.get("transaction_status") != "APPROVED":
        return {"success": True, "message": "Not approved"}

    # Lấy thông tin
    order_invoice_number = order_data.get("order_invoice_number")
    sepay_order_id = order_data.get("order_id")
    amount = order_data.get("order_amount")
    payment_method = transaction_data.get("payment_method")

    # Tìm và cập nhật đơn hàng
    order = db.query(models.Order).filter(
        models.Order.order_number == order_invoice_number
    ).first()

    if not order:
        logger.warning(f"Order not found: {order_invoice_number}")
        return {"success": True, "message": "Order not found"}

    if order.payment_status == "PAID":
        logger.info(f"Order already paid: {order_invoice_number}")
        return {"success": True, "message": "Already paid"}

    # Cập nhật trạng thái
    order.payment_status = "PAID"
    order.payment_method = payment_method
    order.sepay_order_id = sepay_order_id
    order.paid_at = datetime.now(timezone.utc)
    
    db.commit()
    
    logger.info(f"Order {order_invoice_number} marked as PAID")

    return {"success": True, "order_number": order_invoice_number}
```

**Acceptance Criteria:**
- [ ] IPN cập nhật `payment_status = PAID`
- [ ] Không xử lý duplicate (idempotent)
- [ ] Log đầy đủ để debug

---

### Task 5: Frontend Checkout Flow

**File:** `web/src/pages/checkout/payment.tsx` (hoặc tương đương)

```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

export default function PaymentPage({ orderId }: { orderId: number }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['checkout', orderId],
    queryFn: () => 
      fetch(`/api/payments/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId })
      }).then(res => res.json())
  });

  if (isLoading) return <div>Đang tạo thanh toán...</div>;
  if (error) return <div>Lỗi: {error.message}</div>;

  // Auto-submit form đến SePay
  return (
    <form 
      ref={formRef => formRef?.submit()} 
      action={data.action} 
      method="POST"
    >
      {Object.entries(data.fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value as string} />
      ))}
      <button type="submit">Đang chuyển đến trang thanh toán...</button>
    </form>
  );
}
```

**Callback pages:**

```tsx
// /checkout/success
export default function CheckoutSuccess() {
  return (
    <div>
      <h1>Thanh toán thành công!</h1>
      <p>Cảm ơn bạn đã mua hàng.</p>
      <a href="/orders">Xem đơn hàng</a>
    </div>
  );
}

// /checkout/error
export default function CheckoutError() {
  return (
    <div>
      <h1>Thanh toán thất bại</h1>
      <p>Vui lòng thử lại hoặc chọn phương thức khác.</p>
      <a href="/cart">Quay lại giỏ hàng</a>
    </div>
  );
}

// /checkout/cancel
export default function CheckoutCancel() {
  return (
    <div>
      <h1>Đã hủy thanh toán</h1>
      <a href="/cart">Quay lại giỏ hàng</a>
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] Click "Thanh toán" → redirect đến SePay
- [ ] SePay hiển thị QR code
- [ ] Sau khi quét QR → redirect về success/error/cancel

---

### Task 6: Environment Variables

**File:** `OMS/docker-compose.yml` và `.env`

```yaml
# docker-compose.yml
environment:
  - SEPAY_MERCHANT_ID=${SEPAY_MERCHANT_ID}
  - SEPAY_SECRET_KEY=${SEPAY_SECRET_KEY}
  - SEPAY_CHECKOUT_URL=${SEPAY_CHECKOUT_URL:-https://pay.sepay.vn/v1/checkout/init}
  - WEB_BASE_URL=${WEB_BASE_URL:-https://topvnsport.vn}
```

```bash
# .env.production
SEPAY_MERCHANT_ID=<từ SePay Dashboard>
SEPAY_SECRET_KEY=<từ SePay Dashboard>
SEPAY_CHECKOUT_URL=https://pay.sepay.vn/v1/checkout/init
WEB_BASE_URL=https://topvnsport.vn
```

**Acceptance Criteria:**
- [ ] Env vars được load đúng
- [ ] Không commit secrets vào git

---

### Task 7: Configure IPN URL on SePay Dashboard

**Manual step:**

1. Đăng nhập https://my.sepay.vn
2. Vào **Cổng thanh toán** → **Cài đặt**
3. Cập nhật **IPN URL**: `https://api.topvnsport.vn/webhooks/sepay`
4. Test IPN → verify 200 OK

**Acceptance Criteria:**
- [ ] SePay Dashboard hiển thị "Thành công" khi test IPN

---

## Test Checklist

### Local Test (với ngrok/cloudflare tunnel)

- [ ] Tạo đơn hàng trên web
- [ ] Click thanh toán → redirect đến SePay
- [ ] SePay hiển thị QR code
- [ ] Quét QR bằng app ngân hàng (test mode)
- [ ] Redirect về success page
- [ ] Check DB: `payment_status = PAID`

### Production Test

- [ ] Đơn hàng thật với số tiền nhỏ (10,000đ)
- [ ] Chuyển khoản thật
- [ ] Verify IPN nhận được
- [ ] Order status cập nhật đúng

---

## Sequence Diagram

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  User    │     │   Web    │     │   OMS    │     │  SePay   │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │ 1. Checkout    │                │                │
     │───────────────>│                │                │
     │                │ 2. POST /checkout              │
     │                │───────────────>│                │
     │                │                │                │
     │                │ 3. Return form │                │
     │                │<───────────────│                │
     │                │                │                │
     │ 4. Auto-submit to SePay         │                │
     │<───────────────│                │                │
     │────────────────────────────────────────────────>│
     │                │                │                │
     │ 5. Show QR     │                │                │
     │<────────────────────────────────────────────────│
     │                │                │                │
     │ 6. Scan & Pay  │                │                │
     │────────────────────────────────────────────────>│
     │                │                │                │
     │                │                │ 7. IPN webhook │
     │                │                │<───────────────│
     │                │                │                │
     │                │                │ 8. Update order│
     │                │                │────────┐       │
     │                │                │        │       │
     │                │                │<───────┘       │
     │                │                │                │
     │ 9. Redirect to success_url      │                │
     │<────────────────────────────────────────────────│
     │                │                │                │
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `OMS/backend/alembic/versions/xxx_add_payment_fields.py` | Create | Migration |
| `OMS/backend/services/sepay_service.py` | Create | SePay service |
| `OMS/backend/routers/payments.py` | Create | Checkout endpoint |
| `OMS/backend/routers/webhooks.py` | Modify | Update IPN handler |
| `OMS/backend/main.py` | Modify | Register payments router |
| `OMS/backend/models.py` | Modify | Add payment fields |
| `web/src/pages/checkout/*` | Create | Frontend pages |
| `OMS/.env.production` | Create | Production secrets |

---

## Go Live Checklist

- [ ] Migration deployed
- [ ] IPN URL configured on SePay Dashboard
- [ ] Test IPN từ SePay Dashboard → 200 OK
- [ ] Test đơn hàng với số tiền nhỏ
- [ ] Monitor logs 24h đầu
- [ ] Backup database trước deploy

---

## Reviewer Notes

Khi dev xong, reviewer cần check:

1. **Security:**
   - Secret key không hardcode
   - Signature verification đúng algorithm

2. **Idempotency:**
   - IPN gọi 2 lần không tạo duplicate payment
   - Order đã PAID không xử lý lại

3. **Error handling:**
   - Order không tồn tại → log warning, return 200
   - Invalid JSON → return 400
   - Database error → return 500, không mất data

4. **Logging:**
   - Log đủ info để debug
   - Không log secret key
