# Migration: PMI to Shared Packages

## Task ID: MIG-01
## Prerequisites: WS-01, WS-02 (Workspace Config)
## Estimated: 4 hours

---

## Mục Tiêu

Migrate PMI (pilot service) to use shared packages:
- Backend: `topvnsport-common`
- Frontend: `@topvnsport/ui-kit`

---

## Backend Migration

### 1. Update requirements.txt

```txt
# PMI/backend/requirements.txt

# Core dependencies (giữ nguyên)
fastapi>=0.104.0
uvicorn[standard]>=0.24.0
sqlalchemy>=2.0.0
psycopg2-binary>=2.9.9
alembic>=1.12.0
pydantic>=2.5.0

# NOTE: topvnsport-common được install qua Dockerfile
# KHÔNG thêm -e path ở đây vì sẽ không work trong Docker

# Có thể remove nếu đã có trong shared package:
# - passlib (có trong crypto)
# - python-jose (có trong auth)
# - structlog (có trong logging)
```

### 2. Update Dockerfile

```dockerfile
# PMI/backend/Dockerfile

FROM python:3.11-slim

WORKDIR /app

# Copy shared package TRƯỚC
COPY packages/backend-common /app/packages/backend-common

# Install shared package
RUN pip install --no-cache-dir /app/packages/backend-common

# Copy và install service dependencies
COPY PMI/backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy service code
COPY PMI/backend /app

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 3. Update docker-compose.yml

```yaml
# PMI/docker-compose.yml

services:
  api:
    build:
      context: ..                    # Root để access packages/
      dockerfile: PMI/backend/Dockerfile
    volumes:
      # Hot reload trong development
      - ./backend:/app
      - ../packages/backend-common:/app/packages/backend-common
    # ...
```

### 2. Update database.py

```python
# PMI/backend/database.py

# BEFORE
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# AFTER
from topvnsport_common.database import (
    create_db_engine,
    create_session_factory,
    get_db_dependency,
    Base,  # Re-export for models
)

engine = create_db_engine()
SessionLocal = create_session_factory(engine)
get_db = get_db_dependency(SessionLocal)

# Re-export Base for backward compatibility
__all__ = ["engine", "SessionLocal", "get_db", "Base"]
```

### 3. Update main.py

```python
# PMI/backend/main.py

from fastapi import FastAPI
from topvnsport_common.exceptions import register_exception_handlers
from topvnsport_common.logging import configure_logging, setup_request_logging

# Configure logging before app creation
configure_logging(
    service_name="pmi-api",
    log_level=os.getenv("LOG_LEVEL", "INFO"),
    json_format=os.getenv("ENVIRONMENT") == "production",
)

app = FastAPI(title="PMI API")

# Register shared exception handlers
register_exception_handlers(app)

# Add request logging middleware
setup_request_logging(app, exclude_paths=["/health", "/docs", "/openapi.json"])

# ... rest of app setup
```

### 4. Update routers to use shared exceptions

```python
# PMI/backend/routers/products.py

# BEFORE
from fastapi import HTTPException

@router.get("/{product_id}")
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

# AFTER
from topvnsport_common.exceptions import NotFoundError

@router.get("/{product_id}")
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).get(product_id)
    if not product:
        raise NotFoundError("Product", product_id)
    return product
```

### 5. Update pagination usage

```python
# PMI/backend/routers/products.py

# BEFORE
def get_products(page: int = 1, page_size: int = 20, db: Session = Depends(get_db)):
    query = db.query(Product)
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return {"items": items, "total": total, "page": page}

# AFTER
from topvnsport_common.pagination import paginate

def get_products(page: int = 1, page_size: int = 20, db: Session = Depends(get_db)):
    query = db.query(Product).filter(Product.is_deleted == False)
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

### 2. Replace DataTable imports

```tsx
// PMI/frontend/src/components/ProductsTable.tsx

// BEFORE
import { DataTable } from '@/components/ui/DataTable';

// AFTER
import { DataTable } from '@topvnsport/ui-kit';
```

### 3. Replace popupService imports

```tsx
// PMI/frontend/src/services/popupService.ts

// BEFORE - Delete this file
// export const popupService = { ... }

// PMI/frontend/src/app/layout.tsx

// BEFORE
import { SystemPopupProvider } from '@/components/SystemPopup';

// AFTER
import { SystemPopupProvider } from '@topvnsport/ui-kit';
```

### 4. Replace Layout components

```tsx
// PMI/frontend/src/components/Layout.tsx

// BEFORE
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';

// AFTER
import { Sidebar, Topbar, MobileNav } from '@topvnsport/ui-kit';
```

### 5. Replace hook imports

```tsx
// BEFORE
import { useDebounce } from '@/hooks/useDebounce';

// AFTER
import { useDebounce } from '@topvnsport/ui-kit';
```

---

## Test Cases

### Backend Migration Tests

```python
# PMI/backend/tests/migration/test_migration.py

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


class TestDatabaseMigration:
    """Verify database still works after migration."""
    
    def test_health_check(self):
        """Health endpoint returns database status."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["database"] == "connected"

    def test_products_list(self, seed_products):
        """Product listing still works."""
        response = client.get("/api/products")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data

    def test_product_not_found(self):
        """NotFoundError format is correct."""
        response = client.get("/api/products/99999")
        assert response.status_code == 404
        data = response.json()
        assert data["error"] == "NOT_FOUND"
        assert "99999" in data["message"]


class TestPaginationMigration:
    """Verify pagination works after migration."""
    
    def test_pagination_structure(self, seed_products):
        """Pagination returns new structure."""
        response = client.get("/api/products?page=1&page_size=10")
        data = response.json()
        
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "pages" in data
        assert "has_next" in data
        assert "has_prev" in data

    def test_pagination_page_2(self, seed_many_products):
        """Page 2 works correctly."""
        response = client.get("/api/products?page=2&page_size=10")
        data = response.json()
        
        assert data["page"] == 2
        assert data["has_prev"] is True


class TestExceptionMigration:
    """Verify exception handling after migration."""
    
    def test_validation_error_format(self):
        """Validation errors have correct format."""
        response = client.post("/api/products", json={})
        assert response.status_code == 422 or response.status_code == 400

    def test_not_found_error_format(self):
        """NotFound errors have correct format."""
        response = client.get("/api/products/0")
        assert response.status_code == 404
        assert "error" in response.json()


class TestLoggingMigration:
    """Verify logging after migration."""
    
    def test_request_includes_request_id(self):
        """Responses include X-Request-ID header."""
        response = client.get("/api/products")
        assert "X-Request-ID" in response.headers

    def test_custom_request_id_used(self):
        """Custom X-Request-ID is echoed back."""
        response = client.get(
            "/api/products",
            headers={"X-Request-ID": "custom-123"}
        )
        assert response.headers["X-Request-ID"] == "custom-123"
```

### Frontend Migration Tests

```typescript
// PMI/frontend/src/__tests__/migration/migration.test.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('Frontend Migration', () => {
  describe('DataTable Migration', () => {
    it('DataTable from ui-kit works', async () => {
      const { DataTable } = await import('@topvnsport/ui-kit');
      
      render(
        <DataTable
          data={[{ id: 1, name: 'Test' }]}
          columns={[{ key: 'name', header: 'Name' }]}
        />
      );
      
      expect(screen.getByText('Test')).toBeInTheDocument();
    });
  });

  describe('PopupService Migration', () => {
    it('popupService from ui-kit works', async () => {
      const { popupService } = await import('@topvnsport/ui-kit');
      
      expect(popupService.success).toBeInstanceOf(Function);
      expect(popupService.error).toBeInstanceOf(Function);
      expect(popupService.confirm).toBeInstanceOf(Function);
    });
  });

  describe('Hooks Migration', () => {
    it('useDebounce from ui-kit works', async () => {
      const { useDebounce } = await import('@topvnsport/ui-kit');
      expect(useDebounce).toBeInstanceOf(Function);
    });

    it('usePagination from ui-kit works', async () => {
      const { usePagination } = await import('@topvnsport/ui-kit');
      expect(usePagination).toBeInstanceOf(Function);
    });
  });

  describe('Layout Migration', () => {
    it('Sidebar from ui-kit works', async () => {
      const { Sidebar } = await import('@topvnsport/ui-kit');
      
      render(
        <Sidebar
          menuItems={[{ id: 'home', label: 'Home', path: '/' }]}
          currentPath="/"
          onNavigate={() => {}}
        />
      );
      
      expect(screen.getByText('Home')).toBeInTheDocument();
    });
  });
});
```

### E2E Migration Verification

```typescript
// e2e_tests/pmi/migration_verification.spec.ts

import { test, expect } from '@playwright/test';

test.describe('PMI Migration Verification', () => {
  test('products page loads with DataTable', async ({ page }) => {
    await page.goto('/products');
    
    // Table should render
    await expect(page.locator('table')).toBeVisible();
    
    // Pagination should work
    await expect(page.getByText(/Trang \d+ \/ \d+/)).toBeVisible();
  });

  test('popup shows on product save', async ({ page }) => {
    await page.goto('/products/new');
    
    await page.fill('[name="name"]', 'Test Product');
    // ... fill other fields
    
    await page.click('button[type="submit"]');
    
    // Success popup from ui-kit should appear
    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('sidebar navigation works', async ({ page }) => {
    await page.goto('/');
    
    // Click sidebar item
    await page.click('[data-testid="nav-products"]');
    
    await expect(page).toHaveURL(/\/products/);
  });
});
```

---

## Verification Checklist

```bash
# Backend verification
cd PMI/backend
pip install -r requirements.txt
pytest tests/migration/ -v

# Frontend verification
cd PMI/frontend
pnpm install
pnpm test src/__tests__/migration/

# Full E2E verification
docker compose -f PMI/docker-compose.yml up -d
pytest e2e_tests/pmi/migration_verification.spec.ts
```

---

## Rollback Plan

If migration fails, revert:

```bash
# Revert requirements.txt
git checkout PMI/backend/requirements.txt

# Revert frontend package.json
git checkout PMI/frontend/package.json

# Reinstall
cd PMI/backend && pip install -r requirements.txt
cd PMI/frontend && pnpm install
```

---

## Checklist

### Backend
- [ ] requirements.txt updated
- [ ] database.py uses shared module
- [ ] main.py registers shared exception handlers
- [ ] main.py sets up shared logging
- [ ] All routers use shared exceptions
- [ ] All routers use shared pagination
- [ ] Backend tests pass
- [ ] No duplicate code remaining

### Frontend
- [ ] package.json references @topvnsport/ui-kit
- [ ] DataTable imports updated
- [ ] popupService imports updated
- [ ] Layout component imports updated
- [ ] Hook imports updated
- [ ] Old duplicate files deleted
- [ ] Frontend tests pass

### Integration
- [ ] Docker build succeeds
- [ ] All existing tests pass
- [ ] E2E tests pass
- [ ] Manual smoke test passed
