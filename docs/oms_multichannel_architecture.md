# OMS Multi-channel Architecture Plan

> **Version**: 1.0  
> **Created**: 2026-07-28  
> **Status**: Draft  

## 1. Tổng quan

### 1.1 Mục tiêu

Xây dựng hệ thống OMS có khả năng:
- **Multi-channel**: Tích hợp đơn hàng từ Shopee, TikTok Shop, Lazada, Web, POS
- **Payment Reconciliation**: Đối soát thanh toán từ SePay, VNPay, MoMo, COD
- **E-Invoice**: Xuất hóa đơn điện tử hàng loạt qua VNPT, Viettel, MeInvoice

### 1.2 Nguyên tắc thiết kế

| Nguyên tắc | Mô tả |
|------------|-------|
| **Adapter Pattern** | Mỗi kênh/provider là 1 adapter implement chung interface |
| **Event-driven** | Sử dụng event để decouple các bước xử lý |
| **Idempotency** | Xử lý duplicate webhook/request từ marketplace |
| **Audit Trail** | Log mọi thay đổi cho đối soát và compliance |

### 1.3 Tham khảo

- commercetools (Headless, API-first)
- Shopify Order Management
- Salesforce Commerce Cloud

---

## 2. Kiến trúc tổng quan

### 2.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CHANNEL LAYER                                  │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────────┤
│   Shopee    │  TikTok     │   Lazada    │    Web      │      POS        │
│   Adapter   │  Adapter    │   Adapter   │  Storefront │    Adapter      │
└──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┴────────┬────────┘
       │             │             │             │               │
       └─────────────┴─────────────┴─────────────┴───────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │      ORDER INGESTION        │
                    │   (Normalize + Dedupe)      │
                    └──────────────┬──────────────┘
                                   │
       ┌───────────────────────────┼───────────────────────────┐
       │                           │                           │
       ▼                           ▼                           ▼
┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│    ORDER     │          │   PAYMENT    │          │   INVOICE    │
│   SERVICE    │          │   SERVICE    │          │   SERVICE    │
└──────┬───────┘          └──────┬───────┘          └──────┬───────┘
       │                         │                         │
       ▼                         ▼                         ▼
┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│  Inventory   │          │    SePay     │          │    VNPT      │
│  Allocation  │          │    VNPay     │          │   Viettel    │
│    (WMS)     │          │    MoMo      │          │  MeInvoice   │
└──────────────┘          └──────────────┘          └──────────────┘
```

### 2.2 Data Flow

```
┌──────────┐    Webhook/Poll    ┌──────────┐    Normalize    ┌──────────┐
│ Shopee   │ ─────────────────► │ Channel  │ ──────────────► │  Order   │
│ TikTok   │                    │ Adapter  │                 │  Table   │
│ Lazada   │                    └──────────┘                 └────┬─────┘
└──────────┘                                                      │
                                                                  │
     ┌────────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────┐    IPN Webhook     ┌──────────┐    Reconcile    ┌──────────┐
│  SePay   │ ─────────────────► │ Payment  │ ──────────────► │ Payment  │
│  VNPay   │                    │ Adapter  │                 │  Table   │
└──────────┘                    └──────────┘                 └────┬─────┘
                                                                  │
     ┌────────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────┐    Batch Job       ┌──────────┐    Issue        ┌──────────┐
│  Order   │ ─────────────────► │ Invoice  │ ──────────────► │ Invoice  │
│  (PAID)  │                    │ Adapter  │                 │  Table   │
└──────────┘                    └──────────┘                 └──────────┘
```

---

## 3. Cấu trúc code

### 3.1 Directory Structure

```
OMS/backend/
├── adapters/
│   ├── __init__.py
│   ├── channels/
│   │   ├── __init__.py
│   │   ├── base.py              # ChannelAdapter ABC
│   │   ├── shopee.py
│   │   ├── tiktok.py
│   │   ├── lazada.py
│   │   └── web.py
│   ├── payments/
│   │   ├── __init__.py
│   │   ├── base.py              # PaymentProvider ABC
│   │   ├── sepay.py
│   │   ├── vnpay.py
│   │   ├── momo.py
│   │   └── cod.py
│   └── invoices/
│       ├── __init__.py
│       ├── base.py              # InvoiceProvider ABC
│       ├── vnpt.py
│       ├── viettel.py
│       └── meinvoice.py
├── services/
│   ├── order_service.py
│   ├── payment_service.py
│   ├── invoice_service.py
│   └── reconciliation_service.py
├── workers/
│   ├── __init__.py
│   ├── channel_sync_worker.py   # Poll orders từ marketplace
│   ├── payment_reconcile_worker.py
│   └── invoice_batch_worker.py
├── events/
│   ├── __init__.py
│   ├── dispatcher.py
│   └── handlers.py
├── routers/
│   ├── orders.py
│   ├── payments.py
│   ├── invoices.py
│   └── webhooks/
│       ├── sepay.py
│       ├── shopee.py
│       └── tiktok.py
└── models/
    ├── order.py
    ├── payment.py
    └── invoice.py
```

### 3.2 Adapter Interfaces

#### Channel Adapter

```python
# adapters/channels/base.py
from abc import ABC, abstractmethod
from typing import List, Optional
from dataclasses import dataclass

@dataclass
class NormalizedOrder:
    """Chuẩn hóa đơn hàng từ mọi kênh"""
    channel_code: str
    channel_order_id: str
    customer_name: str
    customer_phone: str
    shipping_address: str
    items: List[dict]
    total_amount: Decimal
    shipping_fee: Decimal
    channel_metadata: dict  # Data đặc thù từng kênh

class ChannelAdapter(ABC):
    """Base interface cho mọi channel adapter"""
    
    @property
    @abstractmethod
    def channel_code(self) -> str:
        """SHOPEE, TIKTOK, LAZADA, WEB"""
        pass
    
    @abstractmethod
    async def fetch_orders(
        self, 
        from_date: datetime, 
        to_date: datetime
    ) -> List[NormalizedOrder]:
        """Poll đơn hàng mới từ marketplace"""
        pass
    
    @abstractmethod
    async def handle_webhook(
        self, 
        payload: dict
    ) -> Optional[NormalizedOrder]:
        """Xử lý webhook từ marketplace"""
        pass
    
    @abstractmethod
    async def sync_order_status(
        self, 
        channel_order_id: str, 
        status: str
    ) -> bool:
        """Đồng bộ trạng thái ngược lại marketplace"""
        pass
    
    @abstractmethod
    async def get_order_detail(
        self, 
        channel_order_id: str
    ) -> Optional[NormalizedOrder]:
        """Lấy chi tiết 1 đơn hàng"""
        pass
```

#### Payment Provider

```python
# adapters/payments/base.py
from abc import ABC, abstractmethod
from dataclasses import dataclass
from decimal import Decimal

@dataclass
class PaymentTransaction:
    """Giao dịch thanh toán chuẩn hóa"""
    provider: str
    provider_txn_id: str
    amount: Decimal
    content: str
    transaction_date: datetime
    raw_data: dict

class PaymentProvider(ABC):
    """Base interface cho mọi payment provider"""
    
    @property
    @abstractmethod
    def provider_code(self) -> str:
        """SEPAY, VNPAY, MOMO, COD"""
        pass
    
    @abstractmethod
    async def handle_webhook(
        self, 
        payload: dict, 
        signature: str
    ) -> Optional[PaymentTransaction]:
        """Xử lý IPN webhook"""
        pass
    
    @abstractmethod
    async def verify_signature(
        self, 
        payload: bytes, 
        signature: str
    ) -> bool:
        """Verify webhook signature"""
        pass
    
    @abstractmethod
    async def query_transaction(
        self, 
        txn_id: str
    ) -> Optional[PaymentTransaction]:
        """Truy vấn giao dịch theo ID"""
        pass
    
    @abstractmethod
    async def list_transactions(
        self, 
        from_date: datetime, 
        to_date: datetime
    ) -> List[PaymentTransaction]:
        """Lấy danh sách giao dịch để đối soát"""
        pass
```

#### Invoice Provider

```python
# adapters/invoices/base.py
from abc import ABC, abstractmethod
from dataclasses import dataclass

@dataclass
class InvoiceRequest:
    """Yêu cầu xuất hóa đơn"""
    order_id: str
    customer_name: str
    customer_tax_code: Optional[str]
    customer_address: str
    items: List[dict]
    total_amount: Decimal
    vat_amount: Decimal

@dataclass
class InvoiceResult:
    """Kết quả xuất hóa đơn"""
    provider: str
    invoice_number: str
    invoice_date: datetime
    pdf_url: str
    status: str

class InvoiceProvider(ABC):
    """Base interface cho mọi e-invoice provider"""
    
    @property
    @abstractmethod
    def provider_code(self) -> str:
        """VNPT, VIETTEL, MEINVOICE"""
        pass
    
    @abstractmethod
    async def issue_invoice(
        self, 
        request: InvoiceRequest
    ) -> InvoiceResult:
        """Xuất 1 hóa đơn"""
        pass
    
    @abstractmethod
    async def batch_issue(
        self, 
        requests: List[InvoiceRequest]
    ) -> List[InvoiceResult]:
        """Xuất hàng loạt hóa đơn"""
        pass
    
    @abstractmethod
    async def cancel_invoice(
        self, 
        invoice_number: str, 
        reason: str
    ) -> bool:
        """Hủy hóa đơn"""
        pass
    
    @abstractmethod
    async def get_invoice_pdf(
        self, 
        invoice_number: str
    ) -> bytes:
        """Download PDF hóa đơn"""
        pass
```

---

## 4. Database Schema

### 4.1 ERD

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              ORDERS                                      │
├─────────────────────────────────────────────────────────────────────────┤
│ id (UUID, PK)                                                           │
│ channel_code (VARCHAR) ─────────────────┐                               │
│ channel_order_id (VARCHAR) ─────────────┼─► UNIQUE(channel_code,        │
│ order_number (VARCHAR, UNIQUE)          │      channel_order_id)        │
│ status (VARCHAR)                        │                               │
│ payment_status (VARCHAR)                │                               │
│ customer_id (FK → customers)            │                               │
│ shipping_address (TEXT)                 │                               │
│ total_amount (DECIMAL)                  │                               │
│ shipping_fee (DECIMAL)                  │                               │
│ channel_metadata (JSONB)                │                               │
│ created_at, updated_at                  │                               │
└────────────────┬────────────────────────┘                               │
                 │                                                         │
     ┌───────────┼───────────┬───────────────────────┐                    │
     │           │           │                       │                    │
     ▼           ▼           ▼                       ▼                    │
┌─────────┐ ┌─────────┐ ┌─────────────┐      ┌─────────────┐              │
│ ORDER   │ │PAYMENTS │ │  INVOICES   │      │ ORDER       │              │
│ ITEMS   │ │         │ │             │      │ EVENTS      │              │
├─────────┤ ├─────────┤ ├─────────────┤      ├─────────────┤              │
│ id      │ │ id      │ │ id          │      │ id          │              │
│ order_id│ │ order_id│ │ order_id    │      │ order_id    │              │
│ sku     │ │ provider│ │ provider    │      │ event_type  │              │
│ quantity│ │ txn_id  │ │ inv_number  │      │ payload     │              │
│ price   │ │ amount  │ │ pdf_url     │      │ created_at  │              │
└─────────┘ │ status  │ │ status      │      └─────────────┘              │
            └─────────┘ └─────────────┘                                   │
                 │                                                         │
                 ▼                                                         │
          ┌─────────────┐                                                  │
          │  PAYMENT    │                                                  │
          │  LEDGER     │                                                  │
          ├─────────────┤                                                  │
          │ id          │                                                  │
          │ payment_id  │                                                  │
          │ entry_type  │  (CREDIT, DEBIT, REFUND)                        │
          │ amount      │                                                  │
          │ balance     │                                                  │
          │ metadata    │                                                  │
          └─────────────┘                                                  │
```

### 4.2 Migration SQL

```sql
-- Migration: Add multi-channel support to orders
-- Version: 2026_07_28_001

-- 1. Thêm cột channel vào orders
ALTER TABLE orders 
ADD COLUMN channel_code VARCHAR(20) DEFAULT 'WEB',
ADD COLUMN channel_order_id VARCHAR(100),
ADD COLUMN channel_metadata JSONB DEFAULT '{}',
ADD COLUMN payment_status VARCHAR(20) DEFAULT 'PENDING';

-- 2. Unique constraint cho channel + order_id
CREATE UNIQUE INDEX idx_orders_channel_unique 
ON orders(channel_code, channel_order_id) 
WHERE channel_order_id IS NOT NULL;

-- 3. Bảng payments
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    provider VARCHAR(20) NOT NULL,  -- SEPAY, VNPAY, MOMO, COD
    provider_txn_id VARCHAR(100),
    amount DECIMAL(15,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    reconciled_at TIMESTAMP,
    raw_data JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(provider, provider_txn_id)
);

-- 4. Bảng payment_ledger (double-entry)
CREATE TABLE payment_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id),
    entry_type VARCHAR(20) NOT NULL,  -- CREDIT, DEBIT, REFUND
    amount DECIMAL(15,2) NOT NULL,
    running_balance DECIMAL(15,2),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Bảng invoices
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    provider VARCHAR(20) NOT NULL,  -- VNPT, VIETTEL, MEINVOICE
    invoice_number VARCHAR(50),
    invoice_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    pdf_url VARCHAR(500),
    raw_response JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(provider, invoice_number)
);

-- 6. Bảng order_events (audit trail)
CREATE TABLE order_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_order_events_order_id ON order_events(order_id);
CREATE INDEX idx_order_events_type ON order_events(event_type);

-- 7. Indexes
CREATE INDEX idx_orders_channel ON orders(channel_code);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_provider ON payments(provider);
CREATE INDEX idx_invoices_status ON invoices(status);
```

---

## 5. Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Mục tiêu**: Setup adapter pattern và migrate schema

| Task | Mô tả | Effort |
|------|-------|--------|
| 1.1 | Tạo database migration | 2h |
| 1.2 | Tạo base adapter interfaces | 4h |
| 1.3 | Refactor SePay thành adapter pattern | 4h |
| 1.4 | Thêm payment_status vào Order | 2h |
| 1.5 | Unit tests cho adapters | 4h |

**Deliverables**:
- `adapters/payments/base.py`
- `adapters/payments/sepay.py`
- Migration script
- Payment matching logic (order_number trong content)

### Phase 2: Payment Reconciliation (Week 3-4)

**Mục tiêu**: Hoàn thiện payment flow

| Task | Mô tả | Effort |
|------|-------|--------|
| 2.1 | Tích hợp VNPay adapter | 8h |
| 2.2 | Tích hợp MoMo adapter | 8h |
| 2.3 | COD adapter | 4h |
| 2.4 | Reconciliation service | 8h |
| 2.5 | Background worker đối soát | 4h |
| 2.6 | Admin UI hiển thị payment | 8h |

**Deliverables**:
- `adapters/payments/vnpay.py`
- `adapters/payments/momo.py`
- `services/reconciliation_service.py`
- Daily reconciliation report

### Phase 3: Channel Integration (Week 5-8)

**Mục tiêu**: Tích hợp Shopee, TikTok, Lazada

| Task | Mô tả | Effort |
|------|-------|--------|
| 3.1 | Shopee adapter (OAuth + API) | 16h |
| 3.2 | Shopee webhook handler | 8h |
| 3.3 | TikTok Shop adapter | 16h |
| 3.4 | TikTok webhook handler | 8h |
| 3.5 | Lazada adapter | 16h |
| 3.6 | Order sync worker | 8h |
| 3.7 | SKU mapping service | 8h |
| 3.8 | Channel admin UI | 16h |

**Deliverables**:
- `adapters/channels/shopee.py`
- `adapters/channels/tiktok.py`
- `adapters/channels/lazada.py`
- Unified order list từ mọi kênh
- SKU mapping configuration

### Phase 4: E-Invoice (Week 9-10)

**Mục tiêu**: Xuất hóa đơn điện tử tự động

| Task | Mô tả | Effort |
|------|-------|--------|
| 4.1 | VNPT e-Invoice adapter | 12h |
| 4.2 | Viettel S-Invoice adapter | 12h |
| 4.3 | Batch processing worker | 8h |
| 4.4 | Invoice queue management | 4h |
| 4.5 | PDF storage (MinIO) | 4h |
| 4.6 | Invoice admin UI | 8h |

**Deliverables**:
- `adapters/invoices/vnpt.py`
- `adapters/invoices/viettel.py`
- Batch invoice generation
- Invoice status tracking

### Phase 5: Polish & Production (Week 11-12)

| Task | Mô tả | Effort |
|------|-------|--------|
| 5.1 | Error handling & retry logic | 8h |
| 5.2 | Monitoring & alerting | 8h |
| 5.3 | Rate limiting per provider | 4h |
| 5.4 | Integration tests | 16h |
| 5.5 | Documentation | 8h |
| 5.6 | Production deployment | 8h |

---

## 6. API Endpoints

### 6.1 Orders

```
GET    /api/orders                    # List orders (filter by channel, status)
GET    /api/orders/{id}               # Order detail
POST   /api/orders                    # Create order (Web channel)
PATCH  /api/orders/{id}/status        # Update status
GET    /api/orders/{id}/events        # Order event history
```

### 6.2 Payments

```
GET    /api/payments                  # List payments
GET    /api/payments/{id}             # Payment detail
POST   /api/payments/{id}/reconcile   # Manual reconcile
GET    /api/reconciliation/report     # Daily reconciliation report
```

### 6.3 Invoices

```
GET    /api/invoices                  # List invoices
POST   /api/invoices/batch            # Batch issue invoices
GET    /api/invoices/{id}/pdf         # Download PDF
POST   /api/invoices/{id}/cancel      # Cancel invoice
```

### 6.4 Webhooks

```
POST   /webhooks/sepay                # SePay IPN
POST   /webhooks/vnpay                # VNPay IPN
POST   /webhooks/shopee               # Shopee order webhook
POST   /webhooks/tiktok               # TikTok order webhook
POST   /webhooks/lazada               # Lazada order webhook
```

### 6.5 Admin

```
GET    /api/channels                  # List connected channels
POST   /api/channels/{code}/sync      # Force sync orders
GET    /api/channels/{code}/status    # Channel connection status
PUT    /api/channels/{code}/mapping   # SKU mapping config
```

---

## 7. Event System

### 7.1 Order Events

| Event | Trigger | Action |
|-------|---------|--------|
| `order.created` | Đơn hàng mới | Allocate inventory |
| `order.confirmed` | Xác nhận đơn | Create fulfillment |
| `order.paid` | Thanh toán thành công | Update payment_status |
| `order.shipped` | Giao hàng | Sync to marketplace |
| `order.completed` | Hoàn thành | Queue invoice generation |
| `order.cancelled` | Hủy đơn | Release inventory, refund |

### 7.2 Implementation

```python
# events/dispatcher.py
from enum import Enum
from typing import Callable, Dict, List

class OrderEvent(Enum):
    CREATED = "order.created"
    CONFIRMED = "order.confirmed"
    PAID = "order.paid"
    SHIPPED = "order.shipped"
    COMPLETED = "order.completed"
    CANCELLED = "order.cancelled"

class EventDispatcher:
    _handlers: Dict[str, List[Callable]] = {}
    
    @classmethod
    def register(cls, event: OrderEvent):
        def decorator(handler: Callable):
            if event.value not in cls._handlers:
                cls._handlers[event.value] = []
            cls._handlers[event.value].append(handler)
            return handler
        return decorator
    
    @classmethod
    async def dispatch(cls, event: OrderEvent, payload: dict):
        handlers = cls._handlers.get(event.value, [])
        for handler in handlers:
            await handler(payload)

# Usage
@EventDispatcher.register(OrderEvent.COMPLETED)
async def queue_invoice_generation(payload: dict):
    order_id = payload["order_id"]
    await invoice_queue.enqueue(order_id)
```

---

## 8. Background Workers

### 8.1 Channel Sync Worker

```python
# workers/channel_sync_worker.py
"""
Poll đơn hàng mới từ marketplace mỗi 5 phút
"""
async def sync_channel_orders():
    for adapter in get_active_adapters():
        try:
            orders = await adapter.fetch_orders(
                from_date=last_sync_time,
                to_date=datetime.now()
            )
            for order in orders:
                await order_service.create_or_update(order)
        except Exception as e:
            logger.error(f"Sync failed for {adapter.channel_code}: {e}")
            alert_service.notify(f"Channel sync failed: {adapter.channel_code}")
```

### 8.2 Payment Reconciliation Worker

```python
# workers/payment_reconcile_worker.py
"""
Đối soát thanh toán hàng ngày lúc 2:00 AM
"""
async def daily_reconciliation():
    yesterday = date.today() - timedelta(days=1)
    
    for provider in get_payment_providers():
        # Lấy giao dịch từ provider
        transactions = await provider.list_transactions(yesterday)
        
        # Lấy payments từ DB
        db_payments = await payment_repo.get_by_date(yesterday)
        
        # So sánh và báo cáo
        report = reconcile(transactions, db_payments)
        await send_reconciliation_report(report)
```

### 8.3 Invoice Batch Worker

```python
# workers/invoice_batch_worker.py
"""
Xuất hóa đơn hàng loạt mỗi giờ
"""
async def process_invoice_queue():
    pending = await invoice_queue.get_pending(limit=50)
    
    provider = get_invoice_provider()
    results = await provider.batch_issue(pending)
    
    for result in results:
        await invoice_repo.update_status(
            order_id=result.order_id,
            invoice_number=result.invoice_number,
            pdf_url=result.pdf_url
        )
```

---

## 9. Error Handling & Retry

### 9.1 Retry Policy

| Provider | Max Retries | Backoff | Timeout |
|----------|-------------|---------|---------|
| Shopee API | 3 | Exponential (1s, 2s, 4s) | 30s |
| TikTok API | 3 | Exponential | 30s |
| SePay Webhook | 0 (immediate) | - | 5s |
| VNPT Invoice | 5 | Linear (5s) | 60s |

### 9.2 Circuit Breaker

```python
# utils/circuit_breaker.py
class CircuitBreaker:
    def __init__(self, failure_threshold=5, recovery_timeout=60):
        self.failure_count = 0
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.state = "CLOSED"
        self.last_failure_time = None
    
    async def call(self, func, *args, **kwargs):
        if self.state == "OPEN":
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = "HALF_OPEN"
            else:
                raise CircuitBreakerOpen()
        
        try:
            result = await func(*args, **kwargs)
            self.failure_count = 0
            self.state = "CLOSED"
            return result
        except Exception as e:
            self.failure_count += 1
            self.last_failure_time = time.time()
            if self.failure_count >= self.failure_threshold:
                self.state = "OPEN"
            raise
```

---

## 10. Monitoring & Alerting

### 10.1 Metrics

| Metric | Type | Alert Threshold |
|--------|------|-----------------|
| `orders.created.count` | Counter | - |
| `orders.created.by_channel` | Counter | - |
| `payments.pending.count` | Gauge | > 100 |
| `payments.reconciliation.discrepancy` | Counter | > 0 |
| `invoices.failed.count` | Counter | > 10/hour |
| `channel.sync.latency` | Histogram | p99 > 30s |
| `channel.sync.errors` | Counter | > 5/hour |

### 10.2 Alerts

```yaml
# alerting/rules.yml
- alert: PaymentReconciliationFailed
  expr: payments_reconciliation_discrepancy > 0
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "Payment reconciliation has discrepancies"

- alert: ChannelSyncDown
  expr: channel_sync_errors > 5
  for: 15m
  labels:
    severity: warning
  annotations:
    summary: "Channel {{ $labels.channel }} sync is failing"
```

---

## 11. Security Considerations

### 11.1 API Keys & Secrets

| Secret | Storage | Rotation |
|--------|---------|----------|
| Shopee App Secret | SystemConfig (encrypted) | 90 days |
| TikTok App Secret | SystemConfig (encrypted) | 90 days |
| SePay Secret Key | Env var | On demand |
| VNPT Invoice Cert | File (mounted) | 1 year |

### 11.2 Webhook Security

- Verify HMAC signature cho mọi webhook
- IP whitelist cho marketplace webhooks
- Rate limit per source IP
- Idempotency check (duplicate webhook detection)

---

## 12. Testing Strategy

### 12.1 Unit Tests

```
tests/
├── adapters/
│   ├── test_shopee_adapter.py
│   ├── test_sepay_adapter.py
│   └── test_vnpt_adapter.py
├── services/
│   ├── test_order_service.py
│   └── test_reconciliation_service.py
└── workers/
    └── test_channel_sync.py
```

### 12.2 Integration Tests

- Mock marketplace APIs (VCR/responses)
- Real database (testcontainers)
- Webhook simulation

### 12.3 E2E Tests

- Full flow: Create order → Payment → Invoice
- Multi-channel scenario
- Reconciliation report generation

---

## 13. Rollout Plan

| Week | Milestone | Go/No-Go Criteria |
|------|-----------|-------------------|
| 2 | Payment adapter live | SePay webhook working |
| 4 | VNPay + MoMo live | All payment methods working |
| 6 | Shopee integration | 100 orders synced successfully |
| 8 | TikTok + Lazada | Multi-channel order list working |
| 10 | E-Invoice pilot | 50 invoices issued successfully |
| 12 | Production | All systems green for 1 week |

---

## Appendix A: Marketplace API References

| Platform | API Docs | Sandbox |
|----------|----------|---------|
| Shopee | [open.shopee.com](https://open.shopee.com) | Yes |
| TikTok Shop | [partner.tiktokshop.com](https://partner.tiktokshop.com) | Yes |
| Lazada | [open.lazada.com](https://open.lazada.com) | Yes |

## Appendix B: Payment Provider References

| Provider | API Docs | Sandbox |
|----------|----------|---------|
| SePay | [docs.sepay.vn](https://docs.sepay.vn) | Yes |
| VNPay | [sandbox.vnpayment.vn](https://sandbox.vnpayment.vn) | Yes |
| MoMo | [developers.momo.vn](https://developers.momo.vn) | Yes |

## Appendix C: E-Invoice Provider References

| Provider | API Docs | Compliance |
|----------|----------|------------|
| VNPT | Internal docs | Decree 70/2025 |
| Viettel | Internal docs | Decree 70/2025 |
| MeInvoice | [meinvoice.vn](https://meinvoice.vn) | Decree 70/2025 |
