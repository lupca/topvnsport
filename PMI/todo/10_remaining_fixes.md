# Todo 10: Remaining Fixes After Verification

**Ngày tạo**: 2026-07-13  
**Trạng thái**: Pending

---

## Tổng Quan

Sau khi verify các fixes từ `09_comprehensive_audit_review.md`, còn lại các vấn đề sau cần xử lý:

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| M1 | Security endpoint không check admin | MEDIUM | ❌ Chưa fix |
| H6 | Missing database indexes | HIGH | ❓ Cần verify |
| C5 | Detached object manipulation | LOW | ⚠️ Cần review |
| C6 | Session reuse after rollback | LOW | ⚠️ Cần review |

---

## Issue 1: Security Endpoint Không Check Admin Role

### Mô tả
Endpoint `POST /api/audit-logs/security` cho phép BẤT KỲ authenticated user nào tạo security audit entries. Điều này có thể bị lợi dụng để:
- Flood audit log với fake security events
- Tạo misleading entries để che dấu intrusion thực sự
- DOS attack vào database

### File cần sửa
`PMI/backend/routers/audit.py` (lines 186-210)

### Code hiện tại
```python
@router.post("/audit-logs/security")
def log_security_intrusion(
    body: SecurityLogRequest,
    current_identity: dict = Depends(get_current_identity),
    db: Session = Depends(get_db)
):
    username = current_identity.get("actor_username")
    user = current_identity.get("user")
    # ... creates security event without admin check
```

### Code cần sửa
```python
@router.post("/audit-logs/security")
def log_security_intrusion(
    body: SecurityLogRequest,
    current_identity: dict = Depends(get_current_identity),
    db: Session = Depends(get_db)
):
    # Only allow admin users or internal services to manually log security events
    user = current_identity.get("user")
    actor_type = current_identity.get("actor_type")
    
    # Services (OMS/WMS) are allowed
    if actor_type == "SERVICE":
        pass
    # Admins are allowed
    elif user and user.role.lower() in ["admin", "administrator"]:
        pass
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only admin users or services can log security events"
        )
    
    username = current_identity.get("actor_username")
    # ... rest of the function
```

### Test case cần thêm
```python
# File: tests/test_audit.py

def test_security_endpoint_rejects_non_admin(client_no_auth_override, db_session):
    """Non-admin users cannot create security audit entries."""
    from utils.auth import create_access_token
    import models
    
    # Create staff user
    staff = models.User(
        username="staff_sec_test",
        email="staff_sec@test.com",
        hashed_password="hash",
        role="staff",
        is_active=True
    )
    db_session.add(staff)
    db_session.commit()
    
    token = create_access_token({"sub": "staff_sec_test"})
    headers = {"Authorization": f"Bearer {token}"}
    
    response = client_no_auth_override.post(
        "/api/audit-logs/security",
        json={"path": "/test/path"},
        headers=headers
    )
    
    assert response.status_code == 403


def test_security_endpoint_allows_admin(client_no_auth_override, db_session):
    """Admin users can create security audit entries."""
    from utils.auth import create_access_token
    import models
    
    # Create admin user
    admin = models.User(
        username="admin_sec_test",
        email="admin_sec@test.com",
        hashed_password="hash",
        role="admin",
        is_active=True
    )
    db_session.add(admin)
    db_session.commit()
    
    token = create_access_token({"sub": "admin_sec_test"})
    headers = {"Authorization": f"Bearer {token}"}
    
    response = client_no_auth_override.post(
        "/api/audit-logs/security",
        json={"path": "/test/path"},
        headers=headers
    )
    
    assert response.status_code == 200
```

---

## Issue 2: Missing Database Indexes

### Mô tả
Worker query tại `services/audit_worker.py` lines 25-37 filter trên nhiều columns nhưng chỉ có `status` được index. Thiếu indexes sẽ gây slow query khi outbox table grow lớn.

### Columns cần index
1. `next_retry_at` - used in retry query
2. `locked_at` - used in stale lock detection
3. Composite index `(status, next_retry_at)` - common query pattern

### File cần tạo
`PMI/backend/alembic/versions/xxxx_add_outbox_indexes.py`

### Migration code
```python
"""Add performance indexes to audit_outbox

Revision ID: xxxx
Revises: e1364ba31fda
Create Date: 2026-07-13

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = 'xxxx_add_outbox_indexes'
down_revision = 'e1364ba31fda'  # Update to latest revision
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Composite index for retry queries (most common pattern)
    op.create_index(
        'ix_audit_outbox_status_retry',
        'audit_outbox',
        ['status', 'next_retry_at'],
        unique=False,
        postgresql_where=sa.text("status IN ('PENDING', 'FAILED')")
    )
    
    # Index for stale lock detection
    op.create_index(
        'ix_audit_outbox_locked',
        'audit_outbox',
        ['locked_by', 'locked_at'],
        unique=False,
        postgresql_where=sa.text("status = 'PROCESSING'")
    )


def downgrade() -> None:
    op.drop_index('ix_audit_outbox_locked', table_name='audit_outbox')
    op.drop_index('ix_audit_outbox_status_retry', table_name='audit_outbox')
```

### Tạo migration
```bash
cd PMI/backend
alembic revision -m "add_outbox_indexes"
# Copy code trên vào file được tạo
alembic upgrade head
```

---

## Issue 3: Detached Object Manipulation (C5)

### Mô tả
`services/audit_worker.py` lines 104-105 và 152-153 manipulate ORM objects sau khi session đã commit (objects bị detached).

### Code hiện tại
```python
# Line 104-105 (after success commit)
for record in records:
    record.__dict__['id'] = record_id_map[id(record)]
success_count = len(records_data)

# Line 152-153 (in finally block)
for record in records:
    record.__dict__['id'] = record_id_map[id(record)]
```

### Phân tích
- Comment line 151 giải thích: "Clean up the record ID map to satisfy test session refresh expectation"
- Code này có vẻ được giữ lại để pass certain tests
- Tuy nhiên, manipulate `__dict__` của detached objects là code smell

### Đề xuất
**Option A: Keep as-is** (nếu tests pass và không có side effects)
- Thêm comment rõ ràng hơn giải thích WHY

**Option B: Remove và fix tests** (clean code)
```python
# Remove lines 104-105 và 152-153
# Fix tests để không depend on this behavior
```

### Action cần làm
1. Verify tests vẫn pass khi remove lines 104-105, 152-153
2. Nếu tests fail, check xem tests có đang depend on incorrect behavior không
3. Quyết định keep hoặc remove

---

## Issue 4: Session Reuse After Rollback (C6)

### Mô tả
`services/audit_worker.py` lines 107-154 reuse cùng session sau `db_session.rollback()`.

### Code hiện tại
```python
except Exception as e:
    try:
        db_session.rollback()  # Line 109
    except Exception:
        pass
        
    try:
        # Same session used for status update (line 115)
        failed_records = db_session.query(AuditOutbox).filter(...)
```

### Phân tích
- SQLAlchemy session có thể ở inconsistent state sau rollback
- Tuy nhiên, trong trường hợp này:
  - Rollback clears pending changes
  - New query starts fresh transaction
  - Nếu query fails, exception được raise (line 149)

### Đề xuất
**Option A: Keep as-is** (pragmatic)
- Session reuse sau rollback thường OK trong SQLAlchemy
- Code đã có proper exception handling

**Option B: Use fresh session** (defensive)
```python
except Exception as e:
    try:
        db_session.rollback()
    except Exception:
        pass
        
    try:
        # Use fresh session for error recovery
        recovery_session = SessionLocal()
        try:
            failed_records = recovery_session.query(AuditOutbox).filter(...)
            # ... update statuses
            recovery_session.commit()
        finally:
            recovery_session.close()
    except Exception:
        raise e
```

### Action cần làm
1. Test under high load to see if session reuse causes issues
2. Nếu có issues, implement Option B
3. Nếu không có issues, add comment explaining why reuse is acceptable

---

## Verification Checklist

Sau khi sửa, verify bằng cách:

```bash
# 1. Run all backend tests
docker compose -f PMI/docker-compose.yml exec api pytest -v

# 2. Specifically audit tests
docker compose -f PMI/docker-compose.yml exec api pytest tests/test_audit.py -v

# 3. Run E2E tests
cd PMI/frontend && npx playwright test tests/e2e/audit_e2e.spec.ts --headed

# 4. Verify indexes created
docker compose -f PMI/docker-compose.yml exec db psql -U postgres -d pim_db -c "\d audit_outbox"
```

---

## Priority Order

1. **Issue 1 (M1)** - Security vulnerability, fix ngay
2. **Issue 2 (H6)** - Performance, fix trong sprint này
3. **Issue 3 (C5)** - Code quality, có thể defer
4. **Issue 4 (C6)** - Code quality, có thể defer

---

## Estimated Effort

| Issue | Time | Complexity |
|-------|------|------------|
| M1 | 30 mins | Low |
| H6 | 1 hour | Low |
| C5 | 2 hours | Medium (need test investigation) |
| C6 | 1 hour | Low |

**Total**: ~4.5 hours
