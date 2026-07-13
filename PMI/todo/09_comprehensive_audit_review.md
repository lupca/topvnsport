# Todo 09: Comprehensive Audit Log Feature Review

**Ngày review**: 2026-07-13  
**Reviewer**: Claude Code (3 parallel agents)

---

## Tổng Quan

Đây là review toàn diện tính năng Audit Log mới. Phát hiện **6 CRITICAL + 8 HIGH + 10 MEDIUM + 10 LOW** issues cần xử lý.

---

## CRITICAL ISSUES (Phải sửa ngay)

### C1. Hardcoded Fallback Secret Keys
**Files:** `utils/auth.py` (lines 13, 16)
```python
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super_secret_jwt_key_pmi_2026_change_me")
INTERNAL_SERVICE_TOKEN = os.getenv("INTERNAL_SERVICE_TOKEN", "oms_wms_internal_api_key_secret_2026")
```
**Vấn đề:** Nếu env vars không được set, ứng dụng sử dụng default values dễ đoán. Attacker có thể forge JWT tokens hoặc authenticate như service.

**Cách sửa:** 
```python
JWT_SECRET_KEY = os.environ["JWT_SECRET_KEY"]  # Fail nếu không có
INTERNAL_SERVICE_TOKEN = os.environ["INTERNAL_SERVICE_TOKEN"]
```

---

### C2. Debug Statement Leaking JWT Tokens
**File:** `utils/dependency.py` (line 36)
```python
print("DEBUG_BE_GET_IDENTITY: token=", token.credentials if token else None)
```
**Vấn đề:** Print JWT tokens ra stdout/logs trong production, có thể bị intercept và reuse.

**Cách sửa:** Xóa dòng này hoặc dùng `logger.debug()` với proper log level.

---

### C3. Hardcoded Default API Key
**File:** `routers/audit.py` (line 18)
```python
ALLOWED_SERVICE_KEYS = set(os.getenv("ALLOWED_SERVICE_KEYS", "valid-service-api-key-123").split(","))
```
**Vấn đề:** Giống C1 - default API key sẽ được dùng nếu env var không set.

**Cách sửa:** 
```python
ALLOWED_SERVICE_KEYS = set(os.environ.get("ALLOWED_SERVICE_KEYS", "").split(","))
if not ALLOWED_SERVICE_KEYS or ALLOWED_SERVICE_KEYS == {""}:
    raise RuntimeError("ALLOWED_SERVICE_KEYS must be configured")
```

---

### C4. Transaction Atomicity Violation in @audit_action
**File:** `utils/audit.py` (lines 168-169, 225-226)
```python
# Always commit the outbox event after successful execution
db.commit()
```
**Vấn đề:** Decorator luôn gọi `commit()` sau khi wrapped function return. Nếu endpoint đã commit trước đó, audit record được ghi trong transaction riêng, phá vỡ outbox pattern guarantee.

**Impact:** Audit records có thể bị mất nếu commit thứ 2 fail, hoặc business changes thành công mà không có audit trail.

**Cách sửa:** Chỉ commit nếu `read_only=True` hoặc endpoint chưa commit:
```python
if read_only or own_session:
    db.commit()
```

---

### C5. Detached Object Access After Commit
**File:** `services/audit_worker.py` (lines 102-103)
```python
for record in records:
    record.__dict__['id'] = record_id_map[id(record)]
```
**Vấn đề:** Sau `db_session.commit()` line 70, các ORM objects trong `records` bị detached. Code này cố manipulate detached objects và không có tác dụng gì.

**Cách sửa:** Xóa 2 dòng này (dead code).

---

### C6. Session Reuse After Rollback
**File:** `services/audit_worker.py` (lines 106-146)
**Vấn đề:** Sau `db_session.rollback()` line 107, cùng session được dùng cho query mới line 113-116. Session state có thể inconsistent sau rollback.

**Cách sửa:** Tạo session mới cho error recovery block:
```python
except Exception as e:
    try:
        db_session.rollback()
    except Exception:
        pass
    
    # Use a new session for status updates
    recovery_session = SessionLocal()
    try:
        failed_records = recovery_session.query(AuditOutbox).filter(...)
        # ... update statuses
        recovery_session.commit()
    finally:
        recovery_session.close()
```

---

## HIGH SEVERITY ISSUES

### H1. IP Address Spoofing via X-Forwarded-For
**File:** `utils/middleware.py` (lines 14-19)
```python
x_forwarded_for = request.headers.get("X-Forwarded-For")
if x_forwarded_for:
    parts = [p.strip() for p in x_forwarded_for.split(",") if p.strip()]
    if parts:
        ip_addr = parts[0]
```
**Vấn đề:** Middleware tin tưởng X-Forwarded-For header mà không verify. Clients có thể spoof IP trong audit logs.

**Cách sửa:** Chỉ trust header khi request đến từ known proxy IPs, hoặc dùng rightmost-untrusted IP algorithm.

---

### H2. Middleware Does Not Validate User State
**File:** `utils/middleware.py` (lines 43-49)
**Vấn đề:** Middleware decode JWT và set context vars mà không check user exists/active trong DB. Deactivated user's token vẫn populate context vars.

**Cách sửa:** Bỏ JWT validation trong middleware (chỉ để dependency xử lý), hoặc thêm DB validation.

---

### H3. Unauthenticated Context Endpoint
**File:** `routers/auth.py` (lines 58-67)
```python
@router.get("/context")
async def get_context():
```
**Vấn đề:** Endpoint expose internal request context vars mà không cần authentication.

**Cách sửa:** Thêm `Depends(get_current_identity)` hoặc xóa endpoint.

---

### H4. Missing actor_id Population
**File:** `utils/audit.py` (lines 46-59)
**Vấn đề:** Field `actor_id` được define trong model nhưng không bao giờ được populate. Context module chỉ có `actor_username`.

**Cách sửa:** Thêm `actor_id` vào context module và populate từ JWT token payload.

---

### H5. Unused read_only Parameter
**File:** `utils/audit.py` (line 65)
**Vấn đề:** Parameter `read_only=False` không được sử dụng trong decorator logic.

**Cách sửa:** Implement read_only logic như đề xuất ở C4.

---

### H6. Missing Indexes for Worker Queries
**File:** Worker query filters on `status`, `next_retry_at`, `locked_at`, `locked_by` nhưng chỉ `status` có index.

**Cách sửa:** Thêm migration:
```sql
CREATE INDEX ix_audit_outbox_retry ON audit_outbox (status, next_retry_at) 
    WHERE status IN ('PENDING', 'FAILED');
CREATE INDEX ix_audit_outbox_locked ON audit_outbox (locked_by, locked_at) 
    WHERE status = 'PROCESSING';
```

---

### H7. Redundant and Inconsistent Context Variable Setting
**Files:** `utils/middleware.py` (lines 52-55), `utils/dependency.py` (lines 27-28, 65-66)
**Vấn đề:** Context vars được set ở cả middleware và dependency. Middleware set trước (không có DB validation), dependency có thể overwrite (có DB validation). Gây confusion về values nào là authoritative.

**Cách sửa:** Middleware chỉ set IP và correlation ID; dependency set actor identity.

---

### H8. Hardcoded Service Name
**Files:** `utils/dependency.py` (line 26), `utils/middleware.py` (line 38)
```python
service_name = "OMS"
```
**Vấn đề:** Tất cả service authentications đều appear là "OMS" trong audit logs.

**Cách sửa:** Support multiple service tokens với distinct identities, hoặc derive từ header `X-Service-Name`.

---

## MEDIUM SEVERITY ISSUES

### M1. Missing Admin Check on Security Logging Endpoint
**File:** `routers/audit.py` (lines 186-207)
**Vấn đề:** `/api/audit-logs/security` accepts any authenticated user nhưng không verify admin role. Any user có thể tạo security audit entries.

**Cách sửa:** Thêm admin role check giống `/api/audit-logs`.

---

### M2. Pagination Missing Boundary Checks
**File:** `frontend/src/app/settings/audit/page.tsx` (lines 497-515)
**Vấn đề:** Pagination buttons không có boundary checks. User có thể navigate to page 0 hoặc beyond totalPages.

**Cách sửa:**
```tsx
<button disabled={loading || currentPage <= 1} onClick={() => setCurrentPage(currentPage - 1)}>
<button disabled={loading || currentPage >= totalPages} onClick={() => setCurrentPage(currentPage + 1)}>
```

---

### M3. Silent Exception Swallowing
**File:** `utils/middleware.py` (lines 40-41)
```python
except Exception:
    pass
```
**Vấn đề:** Exceptions during service token verification silently ignored.

**Cách sửa:** Log exception (không log sensitive data) trước khi continue.

---

### M4. Deprecated datetime.utcnow() Usage
**File:** `utils/auth.py` (lines 30, 32)
**Vấn đề:** `datetime.utcnow()` deprecated trong Python 3.12+.

**Cách sửa:** Dùng `datetime.datetime.now(datetime.timezone.utc)`.

---

### M5. Timezone Handling Inconsistency
**File:** `services/audit_worker.py` (lines 20, 68)
```python
now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
```
**Vấn đề:** Tạo UTC datetime rồi strip timezone info. Model có `created_at` với `DateTime(timezone=True)` nhưng `locked_at` là `DateTime` không có timezone.

**Cách sửa:** Consistent timezone handling - hoặc tất cả timezone-aware hoặc tất cả naive.

---

### M6. Set/Frozenset Reconstruction Failure in Masking
**File:** `utils/masking.py` (lines 33-39)
**Vấn đề:** Nếu input có set với nested dicts, code fail vì dicts không hashable. Falls back to list, changing data structure type silently.

**Cách sửa:** Log warning khi type changes.

---

### M7. Large Payload Performance in Semantic Diffing
**File:** `services/product_service.py` (lines 364-461)
**Vấn đề:** Entire before/after state stored trong `changes` JSONB. Products với 100+ variants có thể tạo payloads hàng MB.

**Cách sửa:** Truncate `changes` nếu exceed size limit (e.g., 100KB), store reference to external storage.

---

### M8. Stale Lock Timeout Too Aggressive
**File:** `services/audit_worker.py` (lines 30-33)
**Vấn đề:** 5-minute stale lock timeout có thể quá aggressive nếu processing large batch mất lâu hơn.

**Cách sửa:** Tăng timeout lên 15-30 minutes hoặc make configurable.

---

### M9. Backend/Frontend Role Inconsistency
**Files:** 
- Backend `routers/audit.py` line 46: accepts `admin` AND `administrator`
- Frontend `audit/page.tsx` line 85: only accepts `admin`
- Frontend `Sidebar.tsx` line 41: only checks `admin`

**Vấn đề:** Users với role `administrator` sẽ bị block ở frontend nhưng allowed ở backend.

**Cách sửa:** Đồng bộ role checking - chọn một convention và apply everywhere.

---

### M10. Missing selectedModule in useEffect Dependencies
**File:** `frontend/src/app/settings/audit/page.tsx` (line 180)
**Vấn đề:** `selectedModule` được dùng trong `fetchLogs` nhưng missing từ dependency array. Polling dùng stale module filter values.

**Cách sửa:** Thêm `selectedModule` vào dependency array.

---

## LOW SEVERITY ISSUES

| # | File | Issue |
|---|------|-------|
| L1 | `utils/auth.py` | Missing auth failure logs - JWT decode failures không logged |
| L2 | `utils/context.py` | Default values ("guest", "unknown") có thể mask bugs |
| L3 | `utils/context.py` | No input validation on actor_type - accepts any string |
| L4 | `DashboardLayout.tsx` | Auth guard trusts token existence only, không validate |
| L5 | `audit_worker.py` | Lock held during entire processing, blocks graceful shutdown |
| L6 | `product_service.py` | Lazy loading after expire causes N+1 queries |
| L7 | `product_service.py` | N+1 query in media serialization (m.variant.sku_code) |
| L8 | `product_service.py` | No size limit on changes field before storing |
| L9 | `audit_e2e.spec.ts` | Multiple test synchronization issues (see 08_review_fixes.md) |
| L10 | `utils/auth.py` lines 30,32 | datetime.utcnow() deprecated |

---

## Verification Commands

```bash
# Run all backend tests
docker compose -f PMI/docker-compose.yml exec api pytest -v

# Specifically audit tests
docker compose -f PMI/docker-compose.yml exec api pytest tests/test_audit.py tests/test_worker.py tests/test_auth.py -v

# E2E tests
cd PMI/frontend && npx playwright test --headed
```

---

## Priority Order

1. **Immediate (Block deploy):** C1, C2, C3, C4, C5, C6
2. **This sprint:** H1-H8
3. **Next sprint:** M1-M10
4. **Backlog:** L1-L10
