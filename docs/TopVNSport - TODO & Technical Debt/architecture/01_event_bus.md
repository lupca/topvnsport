# ARCHITECTURE: Event Bus / Message Queue

## Mức độ: HIGH
## Estimated Effort: High (1-2 weeks)

---

## Vấn Đề Hiện Tại

### Synchronous HTTP Coupling

Hiện tại tất cả inter-service communication đều là **synchronous HTTP REST calls**:

```
OMS ──HTTP POST──> WMS (create fulfillment)
WMS ──HTTP PATCH──> OMS (status callback)
```

**Files:**
- `OMS/backend/main.py:158-210` - OMS gọi WMS
- `WMS/backend/main.py:74-95` - WMS callback OMS

### Cascading Failures

```
Scenario: OMS xác nhận đơn hàng

1. OMS nhận request "confirm order"
2. OMS gọi WMS để tạo fulfillment (HTTP, timeout 10s)
3. WMS đang quá tải → timeout
4. OMS trả về 500 error cho customer
5. Customer retry → duplicate order risk

Kết quả: Một service chậm → toàn bộ chain fail
```

### Lost Callbacks

```
Scenario: WMS update status

1. WMS hoàn thành picking, gọi OMS callback
2. OMS đang restart/deploy → connection refused
3. WMS catch exception, log warning, continue
4. OMS không bao giờ biết order đã picked

Kết quả: Status không đồng bộ giữa OMS và WMS
```

---

## Giải Pháp Đề Xuất

### Option A: Redis Streams (Recommended)

**Tại sao Redis Streams:**
- Đã cần Redis cho caching (TODO #10)
- Lightweight, không cần thêm infrastructure
- Durable, persistent messages
- Consumer groups cho load balancing
- Đủ cho scale hiện tại

**Architecture:**

```
┌─────────┐      ┌──────────────┐      ┌─────────┐
│   OMS   │──────│ Redis Stream │◄─────│   WMS   │
└─────────┘      │              │      └─────────┘
     │           │ order.events │           │
     │           │ fulfillment. │           │
     │           │    events    │           │
     ▼           └──────────────┘           ▼
  Consumer                              Consumer
  (process                              (process
   status                                order
   updates)                              events)
```

**Events:**

| Stream | Event | Producer | Consumer |
|--------|-------|----------|----------|
| `order.events` | `order.confirmed` | OMS | WMS |
| `order.events` | `order.cancelled` | OMS | WMS |
| `fulfillment.events` | `fulfillment.created` | WMS | OMS |
| `fulfillment.events` | `fulfillment.picked` | WMS | OMS |
| `fulfillment.events` | `fulfillment.packed` | WMS | OMS |
| `fulfillment.events` | `fulfillment.shipped` | WMS | OMS |
| `inventory.events` | `stock.updated` | WMS | PMI (optional) |

---

## Implementation Plan

### Step 1: Add Redis to Infrastructure

```yaml
# docker-compose.yml (root level shared)
services:
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    networks:
      - shared_network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
```

### Step 2: Create Event Publisher Module

```python
# shared/event_bus.py (new shared module)
import redis
import json
from datetime import datetime
from typing import Any, Dict

class EventBus:
    def __init__(self, redis_url: str = "redis://redis:6379"):
        self.redis = redis.from_url(redis_url)
    
    def publish(self, stream: str, event_type: str, data: Dict[str, Any]):
        """Publish event to Redis Stream"""
        event = {
            "type": event_type,
            "timestamp": datetime.utcnow().isoformat(),
            "data": json.dumps(data),
        }
        message_id = self.redis.xadd(stream, event)
        return message_id
    
    def subscribe(self, stream: str, group: str, consumer: str, callback):
        """Subscribe to stream with consumer group"""
        # Create group if not exists
        try:
            self.redis.xgroup_create(stream, group, mkstream=True)
        except redis.ResponseError:
            pass  # Group already exists
        
        while True:
            messages = self.redis.xreadgroup(
                group, consumer, {stream: ">"}, count=10, block=5000
            )
            for _, entries in messages:
                for message_id, data in entries:
                    try:
                        callback(json.loads(data[b"data"]))
                        self.redis.xack(stream, group, message_id)
                    except Exception as e:
                        # Message will be retried
                        logging.error(f"Failed to process {message_id}: {e}")
```

### Step 3: Update OMS to Publish Events

```python
# OMS/backend/main.py

from shared.event_bus import EventBus

event_bus = EventBus()

@app.post("/api/orders/{order_id}/confirm")
async def confirm_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).get(order_id)
    
    # Update local state
    order.status = "CONFIRMED"
    db.commit()
    
    # Publish event (async, non-blocking)
    event_bus.publish(
        stream="order.events",
        event_type="order.confirmed",
        data={
            "order_id": order.id,
            "order_number": order.order_number,
            "items": [{"sku": i.sku_code, "qty": i.quantity} for i in order.items],
            "warehouse_code": order.warehouse_code,
        }
    )
    
    return {"status": "confirmed"}
```

### Step 4: Create WMS Event Consumer

```python
# WMS/backend/consumers/order_consumer.py

from shared.event_bus import EventBus
from models import FulfillmentOrder

def handle_order_confirmed(event_data: dict):
    """Process order.confirmed event"""
    db = get_db()
    
    # Create fulfillment order
    fo = FulfillmentOrder(
        oms_order_id=event_data["order_id"],
        oms_order_number=event_data["order_number"],
        status="PENDING",
    )
    db.add(fo)
    
    # Reserve inventory
    for item in event_data["items"]:
        reserve_inventory(item["sku"], item["qty"])
    
    db.commit()
    
    # Publish fulfillment.created event
    event_bus.publish(
        stream="fulfillment.events",
        event_type="fulfillment.created",
        data={"fulfillment_id": fo.id, "oms_order_id": fo.oms_order_id}
    )

# Run consumer as background worker
if __name__ == "__main__":
    event_bus = EventBus()
    event_bus.subscribe(
        stream="order.events",
        group="wms-workers",
        consumer="wms-worker-1",
        callback=handle_order_confirmed
    )
```

### Step 5: Create OMS Event Consumer

```python
# OMS/backend/consumers/fulfillment_consumer.py

def handle_fulfillment_status(event_data: dict):
    """Process fulfillment status updates"""
    db = get_db()
    
    order = db.query(Order).filter(
        Order.id == event_data["oms_order_id"]
    ).first()
    
    # Update fulfillment status
    fo = next(f for f in order.fulfillment_orders 
              if f.id == event_data["fulfillment_id"])
    fo.status = event_data["status"]
    
    # Update order status based on all fulfillments
    update_order_status(order)
    
    db.commit()
```

---

## Backwards Compatibility

Giữ HTTP endpoints hiện tại hoạt động trong giai đoạn chuyển đổi:

```python
# WMS can still receive direct HTTP calls
@app.post("/api/fulfillment-orders")
async def create_fulfillment_http(payload: FulfillmentCreate, ...):
    # Log deprecation warning
    logger.warning("Direct HTTP call deprecated, use event bus")
    
    # Process normally
    return create_fulfillment(payload)
```

---

## Files Cần Tạo/Modify

### New Files
| File | Description |
|------|-------------|
| `shared/event_bus.py` | Event bus client |
| `OMS/backend/consumers/fulfillment_consumer.py` | OMS event consumer |
| `WMS/backend/consumers/order_consumer.py` | WMS event consumer |
| `docker-compose.events.yml` | Redis + consumer workers |

### Modified Files
| File | Action |
|------|--------|
| `OMS/backend/main.py` | Publish events after state changes |
| `WMS/backend/main.py` | Publish events after state changes |
| `docker-compose.yml` | Add Redis service |

---

## Verification

```bash
# Monitor Redis streams
redis-cli XINFO STREAM order.events
redis-cli XINFO GROUPS order.events

# Test event flow
1. Confirm order in OMS
2. Check Redis: XREAD STREAMS order.events 0
3. Verify WMS received and processed event
4. Check Redis: XREAD STREAMS fulfillment.events 0
5. Verify OMS received status update
```

---

## Alternative: RabbitMQ

Nếu cần features phức tạp hơn (routing, dead letter queues, priorities):

```yaml
services:
  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "5672:5672"
      - "15672:15672"  # Management UI
```

**Trade-offs:**
| Feature | Redis Streams | RabbitMQ |
|---------|--------------|----------|
| Setup complexity | Low | Medium |
| Message routing | Basic | Advanced |
| Dead letter queue | Manual | Built-in |
| Management UI | No | Yes |
| Memory footprint | Low | Medium |
| Learning curve | Low | Medium |

**Recommendation:** Start with Redis Streams, migrate to RabbitMQ if needed.
