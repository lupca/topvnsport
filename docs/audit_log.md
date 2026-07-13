# Audit Log System (PMI)

## Tổng quan

Hệ thống Audit Log ghi lại tất cả các thao tác quan trọng trong PMI, bao gồm:
- Tạo/sửa/xóa sản phẩm, danh mục, kênh bán hàng
- Đăng nhập/đăng xuất
- Truy cập trái phép (security events)
- Đồng bộ dữ liệu từ OMS/WMS

## Kiến trúc

```
┌─────────────────────────────────────────────────────────────────┐
│                         PMI Backend                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │   Routers    │───▶│ @audit_action│───▶│  audit_outbox    │  │
│  │  (Products,  │    │  decorator   │    │    (table)       │  │
│  │  Categories) │    └──────────────┘    └────────┬─────────┘  │
│  └──────────────┘                                  │            │
│                                                    ▼            │
│                                         ┌──────────────────┐   │
│                                         │   AuditWorker    │   │
│                                         │  (background)    │   │
│                                         └────────┬─────────┘   │
│                                                    │            │
│                                                    ▼            │
│                                         ┌──────────────────┐   │
│                                         │   audit_logs     │   │
│                                         │    (table)       │   │
│                                         └──────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Outbox Pattern

Sử dụng Outbox Pattern để đảm bảo transaction atomicity:

1. **Business operation + Audit record** commit cùng 1 transaction
2. **AuditWorker** (background thread) xử lý outbox → audit_logs
3. Nếu worker fail, record retry với exponential backoff

## Database Schema

### audit_outbox (transient)

```sql
CREATE TABLE audit_outbox (
    id UUID PRIMARY KEY,
    correlation_id VARCHAR,
    actor_id VARCHAR,
    actor_username VARCHAR NOT NULL,
    actor_type VARCHAR NOT NULL,  -- USER, SERVICE, GUEST
    ip_address VARCHAR,
    method VARCHAR,
    path VARCHAR,
    source_service VARCHAR,
    module VARCHAR NOT NULL,
    action_type VARCHAR NOT NULL,
    entity_type VARCHAR,
    entity_id VARCHAR,
    changes JSONB,
    raw_details TEXT,
    status VARCHAR DEFAULT 'PENDING',  -- PENDING, PROCESSING, FAILED, DONE
    attempt_count INTEGER DEFAULT 0,
    last_error TEXT,
    locked_by VARCHAR,
    locked_at TIMESTAMP WITH TIME ZONE,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### audit_logs (permanent)

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    correlation_id VARCHAR,
    actor_id VARCHAR,
    actor_username VARCHAR NOT NULL,
    actor_type VARCHAR NOT NULL,
    ip_address VARCHAR,
    method VARCHAR,
    path VARCHAR,
    source_service VARCHAR,
    module VARCHAR NOT NULL,
    action_type VARCHAR NOT NULL,
    entity_type VARCHAR,
    entity_id VARCHAR,
    changes JSONB,
    raw_details TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Actor Types

| Type | Description | Example |
|------|-------------|---------|
| `USER` | Human user với JWT token | Admin đăng nhập |
| `SERVICE` | Internal service với API key | OMS sync stock |
| `GUEST` | Anonymous request | Public API access |

## Action Types

| Action | Description |
|--------|-------------|
| `CREATE` | Tạo mới entity |
| `UPDATE` | Cập nhật entity |
| `DELETE` | Xóa entity |
| `LOGIN` | Đăng nhập thành công |
| `LOGOUT` | Đăng xuất |
| `SECURITY` | Security event (unauthorized access) |

## Sử dụng @audit_action Decorator

```python
from utils.audit import audit_action

@router.post("/products")
@audit_action(module="Product", action_type="CREATE")
def create_product(product_in: ProductCreate, db: Session = Depends(get_db)):
    # Business logic
    db_product = models.Product(...)
    db.add(db_product)
    db.commit()  # Audit record tự động được thêm vào transaction
    return db_product
```

## Manual Audit Logging

```python
from utils.audit import record_audit_event

record_audit_event(
    db_session=db,
    module="Security",
    action_type="SECURITY",
    entity_type="Page",
    entity_id="/admin/users",
    path="/admin/users",
    raw_details="Unauthorized access attempt"
)
db.commit()  # Commit cùng business transaction
```

## AuditWorker

Background worker chạy trong main.py:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    worker = AuditWorker(interval=0.5)  # 500ms interval
    worker_thread = threading.Thread(target=worker.start_loop, daemon=True)
    worker_thread.start()
    yield
    worker.stop_loop()
```

### Worker Features

- **FOR UPDATE SKIP LOCKED**: Concurrent workers không conflict
- **Retry với exponential backoff**: 1m → 5m → 30m → 1h → 2h...
- **Max attempts**: 5 (configurable)
- **Stuck detection**: Records locked > 15 minutes được reset

## API Endpoints

### Lấy Audit Logs (Admin only)

```
GET /api/audit-logs
```

**Query Parameters:**
- `page`, `limit`: Pagination
- `module`: Filter by module (Product, Category, etc.)
- `actor`: Filter by username
- `action`: Filter by action type
- `correlation_id`: Filter by correlation ID
- `keyword`: Full-text search

### Log Security Event (Admin/Service only)

```
POST /api/audit-logs/security
Content-Type: application/json

{
  "path": "/admin/sensitive-page"
}
```

## Frontend UI

Audit logs UI tại `/settings/audit` (admin only):

- Table với pagination
- Filters: module, actor, action
- Search bar
- Detail modal với JSON diff viewer

## Context Variables

Request context được track qua ContextVars:

```python
from utils.context import (
    actor_id_var,
    actor_username_var,
    actor_type_var,
    ip_address_var,
    correlation_id_var
)
```

Middleware tự động set các context vars từ JWT token hoặc API key.

## Testing

```bash
# Run audit tests
docker compose -f PMI/docker-compose.yml exec api pytest tests/test_audit.py -v
docker compose -f PMI/docker-compose.yml exec api pytest tests/test_worker.py -v
docker compose -f PMI/docker-compose.yml exec api pytest tests/test_auth.py -v
```

## Troubleshooting

### 1. Audit logs không xuất hiện

**Check:**
- AuditWorker đang chạy? (logs: "Starting AuditWorker")
- Records trong audit_outbox? (status = PENDING/FAILED)

### 2. Worker stuck

**Check:**
- Records với status = PROCESSING và locked_at > 15 minutes
- Worker sẽ tự động reset sau stuck timeout

### 3. Missing actor info

**Check:**
- Middleware RequestContextMiddleware được register
- JWT token valid và có subject claim
