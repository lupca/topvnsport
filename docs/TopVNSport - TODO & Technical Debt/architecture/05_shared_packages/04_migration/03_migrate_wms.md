# Migration: WMS to Shared Packages

## Task ID: MIG-03
## Prerequisites: MIG-01 (PMI Migration complete)
## Estimated: 3 hours

---

## Mục Tiêu

Migrate WMS to use shared packages (following PMI pattern).

---

## Backend Migration

### 1. Update requirements.txt

```txt
# WMS/backend/requirements.txt
-e ../../packages/backend-common
```

### 2. Update database.py

```python
# WMS/backend/database.py

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

### 3. Update main.py

```python
# WMS/backend/main.py

from topvnsport_common.exceptions import register_exception_handlers
from topvnsport_common.logging import configure_logging, setup_request_logging

configure_logging(
    service_name="wms-api",
    log_level=os.getenv("LOG_LEVEL", "INFO"),
    json_format=os.getenv("ENVIRONMENT") == "production",
)

app = FastAPI(title="WMS API")
register_exception_handlers(app)
setup_request_logging(app)
```

### 4. Update routers

```python
# WMS/backend/routers/inventory.py

from topvnsport_common.exceptions import NotFoundError, ValidationError
from topvnsport_common.pagination import paginate

@router.get("/{location_id}")
def get_location(location_id: int, db: Session = Depends(get_db)):
    location = db.query(Location).get(location_id)
    if not location:
        raise NotFoundError("Location", location_id)
    return location

@router.get("/")
def list_inventory(page: int = 1, page_size: int = 20, db: Session = Depends(get_db)):
    query = db.query(Inventory).order_by(Inventory.updated_at.desc())
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

### 2. Update imports

```tsx
// BEFORE
import { DataTable } from '@/components/ui/DataTable';
import { useDebounce } from '@/hooks/useDebounce';

// AFTER
import { DataTable, useDebounce, popupService } from '@topvnsport/ui-kit';
```

---

## Test Cases

### WMS Backend Migration Tests

```python
# WMS/backend/tests/migration/test_migration.py

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


class TestDatabaseMigration:
    """Verify database works after migration."""
    
    def test_health_check(self):
        response = client.get("/health")
        assert response.status_code == 200

    def test_inventory_list(self, seed_inventory):
        response = client.get("/api/inventory")
        assert response.status_code == 200
        assert "items" in response.json()


class TestPaginationMigration:
    """Verify pagination after migration."""
    
    def test_pagination_structure(self, seed_inventory):
        response = client.get("/api/inventory?page=1&page_size=10")
        data = response.json()
        
        assert "items" in data
        assert "total" in data
        assert "pages" in data
        assert "has_next" in data
        assert "has_prev" in data


class TestExceptionMigration:
    """Verify exception handling."""
    
    def test_not_found_format(self):
        response = client.get("/api/locations/99999")
        assert response.status_code == 404
        assert response.json()["error"] == "NOT_FOUND"

    def test_request_id_header(self):
        response = client.get("/api/inventory")
        assert "X-Request-ID" in response.headers
```

### WMS Frontend Migration Tests

```typescript
// WMS/frontend/src/__tests__/migration/migration.test.tsx

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('WMS Frontend Migration', () => {
  it('DataTable from ui-kit renders', async () => {
    const { DataTable } = await import('@topvnsport/ui-kit');
    
    render(
      <DataTable
        data={[{ id: 1, location: 'A-01-01' }]}
        columns={[{ key: 'location', header: 'Vị trí' }]}
      />
    );
    
    expect(screen.getByText('A-01-01')).toBeInTheDocument();
  });

  it('popupService works', async () => {
    const { popupService } = await import('@topvnsport/ui-kit');
    expect(popupService.success).toBeDefined();
  });
});
```

---

## Verification

```bash
# Backend
cd WMS/backend
pip install -r requirements.txt
pytest tests/migration/ -v

# Frontend
cd WMS/frontend
pnpm install
pnpm test src/__tests__/migration/

# Docker
docker compose -f WMS/docker-compose.yml build
docker compose -f WMS/docker-compose.yml up -d
curl http://localhost:18102/health
```

---

## Files to Delete After Migration

```
WMS/frontend/src/components/ui/DataTable.tsx
WMS/frontend/src/services/popupService.ts
WMS/frontend/src/hooks/useDebounce.ts
```

---

## Checklist

### Backend
- [ ] requirements.txt updated
- [ ] database.py uses shared module
- [ ] main.py uses shared exception handlers
- [ ] main.py uses shared logging
- [ ] All routers use shared pagination
- [ ] All routers use shared exceptions
- [ ] Backend tests pass

### Frontend
- [ ] package.json references @topvnsport/ui-kit
- [ ] All imports updated
- [ ] Duplicate files deleted
- [ ] Frontend tests pass

### Integration
- [ ] Docker build succeeds
- [ ] All existing tests pass
