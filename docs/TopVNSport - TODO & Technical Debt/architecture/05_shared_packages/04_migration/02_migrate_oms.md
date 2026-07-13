# Migration: OMS to Shared Packages

## Task ID: MIG-02
## Prerequisites: MIG-01 (PMI Migration complete)
## Estimated: 3 hours

---

## Mục Tiêu

Migrate OMS to use shared packages (following PMI pattern).

---

## Backend Migration

### 1. Update requirements.txt

```txt
# OMS/backend/requirements.txt
-e ../../packages/backend-common
# Remove: passlib, python-jose, structlog, cryptography
```

### 2. Update database.py

```python
# OMS/backend/database.py

from topvnsport_common.database import (
    create_db_engine,
    create_session_factory,
    get_db_dependency,
    Base,
)

engine = create_db_engine()
SessionLocal = create_session_factory(engine)
get_db = get_db_dependency(SessionLocal)

__all__ = ["engine", "SessionLocal", "get_db", "Base"]
```

### 3. Migrate crypto.py (OMS-specific)

OMS has custom crypto - migrate to shared:

```python
# OMS/backend/utils/crypto.py

# BEFORE - Delete this file
# from cryptography.fernet import Fernet
# def encrypt(...): ...

# AFTER - Use shared
from topvnsport_common.crypto import (
    encrypt,
    decrypt,
    encrypt_with_password,
    decrypt_with_password,
    hash_password,
    verify_password,
)

# Re-export for backward compatibility
__all__ = [
    "encrypt",
    "decrypt", 
    "encrypt_with_password",
    "decrypt_with_password",
    "hash_password",
    "verify_password",
]
```

### 4. Migrate phone_helper.py

```python
# OMS/backend/utils/phone_helper.py

# BEFORE - Delete this file
# def normalize_phone(...): ...

# AFTER - Use shared
from topvnsport_common.phone import (
    normalize_phone,
    validate_phone,
    validate_mobile,
    format_phone,
    get_carrier,
)

__all__ = [
    "normalize_phone",
    "validate_phone",
    "validate_mobile",
    "format_phone",
    "get_carrier",
]
```

### 5. Update main.py

```python
# OMS/backend/main.py

from topvnsport_common.exceptions import register_exception_handlers
from topvnsport_common.logging import configure_logging, setup_request_logging

configure_logging(
    service_name="oms-api",
    log_level=os.getenv("LOG_LEVEL", "INFO"),
    json_format=os.getenv("ENVIRONMENT") == "production",
)

app = FastAPI(title="OMS API")
register_exception_handlers(app)
setup_request_logging(app)
```

### 6. Update routers

```python
# OMS/backend/routers/orders.py

from topvnsport_common.exceptions import NotFoundError, ValidationError
from topvnsport_common.pagination import paginate

@router.get("/{order_id}")
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).get(order_id)
    if not order:
        raise NotFoundError("Order", order_id)
    return order

@router.get("/")
def list_orders(page: int = 1, page_size: int = 20, db: Session = Depends(get_db)):
    query = db.query(Order).order_by(Order.created_at.desc())
    return paginate(query, page, page_size)
```

---

## Frontend Migration

### 1. Update package.json

```json
{
  "dependencies": {
    "@topvnsport/ui-kit": "workspace:*"
  }
}
```

### 2. Update imports (same pattern as PMI)

```tsx
// BEFORE
import { DataTable } from '@/components/ui/DataTable';
import { useDebounce } from '@/hooks/useDebounce';

// AFTER
import { DataTable, useDebounce, popupService } from '@topvnsport/ui-kit';
```

---

## Test Cases

### OMS Backend Migration Tests

```python
# OMS/backend/tests/migration/test_migration.py

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


class TestDatabaseMigration:
    """Verify database works after migration."""
    
    def test_health_check(self):
        response = client.get("/health")
        assert response.status_code == 200

    def test_orders_list(self, seed_orders):
        response = client.get("/api/orders")
        assert response.status_code == 200
        assert "items" in response.json()


class TestCryptoMigration:
    """Verify crypto functions after migration."""
    
    def test_password_hash_verify(self):
        from topvnsport_common.crypto import hash_password, verify_password
        
        password = "test123"
        hashed = hash_password(password)
        
        assert verify_password(password, hashed)
        assert not verify_password("wrong", hashed)

    def test_encrypt_decrypt(self):
        from topvnsport_common.crypto import encrypt_with_password, decrypt_with_password
        
        secret = "my-secret-data"
        encrypted = encrypt_with_password(secret, "password")
        decrypted = decrypt_with_password(encrypted, "password")
        
        assert decrypted == secret


class TestPhoneMigration:
    """Verify phone functions after migration."""
    
    def test_normalize_phone(self):
        from topvnsport_common.phone import normalize_phone
        
        assert normalize_phone("+84 912 345 678") == "84912345678"
        assert normalize_phone("0912345678") == "84912345678"

    def test_validate_phone(self):
        from topvnsport_common.phone import validate_phone
        
        assert validate_phone("84912345678") is True
        assert validate_phone("123") is False


class TestPaginationMigration:
    """Verify pagination after migration."""
    
    def test_pagination_structure(self, seed_orders):
        response = client.get("/api/orders?page=1&page_size=10")
        data = response.json()
        
        assert "items" in data
        assert "total" in data
        assert "pages" in data
        assert "has_next" in data
        assert "has_prev" in data


class TestExceptionMigration:
    """Verify exception handling."""
    
    def test_not_found_format(self):
        response = client.get("/api/orders/99999")
        assert response.status_code == 404
        assert response.json()["error"] == "NOT_FOUND"

    def test_request_id_header(self):
        response = client.get("/api/orders")
        assert "X-Request-ID" in response.headers
```

### OMS Frontend Migration Tests

```typescript
// OMS/frontend/src/__tests__/migration/migration.test.tsx

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('OMS Frontend Migration', () => {
  it('DataTable from ui-kit renders', async () => {
    const { DataTable } = await import('@topvnsport/ui-kit');
    
    render(
      <DataTable
        data={[{ id: 1, order_number: 'ORD-001' }]}
        columns={[{ key: 'order_number', header: 'Mã đơn' }]}
      />
    );
    
    expect(screen.getByText('ORD-001')).toBeInTheDocument();
  });

  it('popupService works', async () => {
    const { popupService } = await import('@topvnsport/ui-kit');
    expect(popupService.success).toBeDefined();
  });

  it('hooks work', async () => {
    const { useDebounce, usePagination } = await import('@topvnsport/ui-kit');
    expect(useDebounce).toBeDefined();
    expect(usePagination).toBeDefined();
  });
});
```

---

## Verification

```bash
# Backend
cd OMS/backend
pip install -r requirements.txt
pytest tests/migration/ -v

# Frontend
cd OMS/frontend
pnpm install
pnpm test src/__tests__/migration/

# Docker
docker compose -f OMS/docker-compose.yml build
docker compose -f OMS/docker-compose.yml up -d
curl http://localhost:18101/health
```

---

## Files to Delete After Migration

```
OMS/backend/utils/crypto.py (if custom implementation)
OMS/backend/utils/phone_helper.py
OMS/frontend/src/components/ui/DataTable.tsx
OMS/frontend/src/services/popupService.ts
OMS/frontend/src/hooks/useDebounce.ts
```

---

## Checklist

### Backend
- [ ] requirements.txt updated with -e path
- [ ] database.py uses shared module
- [ ] crypto.py migrated to shared
- [ ] phone_helper.py migrated to shared
- [ ] main.py uses shared exception handlers
- [ ] main.py uses shared logging
- [ ] All routers use shared pagination
- [ ] All routers use shared exceptions
- [ ] Backend tests pass

### Frontend
- [ ] package.json references @topvnsport/ui-kit
- [ ] All component imports updated
- [ ] All hook imports updated
- [ ] All service imports updated
- [ ] Duplicate files deleted
- [ ] Frontend tests pass

### Integration
- [ ] Docker build succeeds
- [ ] All existing tests pass
- [ ] Manual smoke test passed
