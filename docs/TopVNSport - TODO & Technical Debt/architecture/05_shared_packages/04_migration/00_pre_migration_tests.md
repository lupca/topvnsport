# Pre-Migration Tests (Characterization Tests)

## Task ID: MIG-00
## Prerequisites: None
## Estimated: 4-6 hours

---

## Mục Tiêu

Viết test cases capture behavior **hiện tại** của code TRƯỚC KHI refactor. Đảm bảo:
1. Tests PASS với code hiện tại
2. Sau khi refactor, chạy lại CÙNG tests → vẫn PASS

> **Tại sao cần?** Nếu chỉ viết test sau refactor, không thể biết refactor có làm hỏng behavior cũ không.

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: Viết characterization tests                          │
│  - Test behavior hiện tại của database, pagination, errors...  │
│  - Chạy tests → MUST PASS                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2: Implement shared packages                             │
│  - Tạo packages/backend-common, packages/ui-kit                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 3: Migrate services                                      │
│  - Thay imports sang shared packages                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 4: Run SAME characterization tests                       │
│  - Chạy lại tests từ Phase 1 → MUST PASS                        │
│  - Nếu FAIL → refactor đã break behavior                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## PMI Backend - Characterization Tests

### 1. Database Connection Tests

```python
# PMI/backend/tests/characterization/test_database_current.py

import pytest
from sqlalchemy.orm import Session
from database import engine, SessionLocal, get_db, Base
from models import Product, Category


class TestDatabaseConnection:
    """Capture current database behavior."""

    def test_engine_connects(self):
        """Engine can connect to database."""
        with engine.connect() as conn:
            result = conn.execute("SELECT 1")
            assert result.scalar() == 1

    def test_session_factory_creates_session(self):
        """SessionLocal creates valid session."""
        session = SessionLocal()
        try:
            assert isinstance(session, Session)
            # Can execute query
            session.execute("SELECT 1")
        finally:
            session.close()

    def test_get_db_yields_and_closes(self):
        """get_db dependency yields session and closes."""
        gen = get_db()
        session = next(gen)
        
        assert isinstance(session, Session)
        assert session.is_active
        
        # Simulate request completion
        try:
            next(gen)
        except StopIteration:
            pass
        
        # Session should be closed
        assert not session.is_active

    def test_base_metadata_has_tables(self):
        """Base.metadata knows about our models."""
        table_names = Base.metadata.tables.keys()
        assert "products" in table_names
        assert "categories" in table_names


class TestDatabaseOperations:
    """Capture current CRUD behavior."""

    def test_create_and_read_product(self, db_session):
        """Can create and read a product."""
        product = Product(
            name="Test Product",
            sku="TEST-001",
            price=100000,
        )
        db_session.add(product)
        db_session.commit()
        
        # Read back
        found = db_session.query(Product).filter_by(sku="TEST-001").first()
        assert found is not None
        assert found.name == "Test Product"

    def test_update_product(self, db_session, sample_product):
        """Can update a product."""
        sample_product.name = "Updated Name"
        db_session.commit()
        
        # Read back
        db_session.refresh(sample_product)
        assert sample_product.name == "Updated Name"

    def test_delete_product(self, db_session, sample_product):
        """Can delete a product."""
        product_id = sample_product.id
        db_session.delete(sample_product)
        db_session.commit()
        
        # Should not exist
        found = db_session.query(Product).get(product_id)
        assert found is None
```

### 2. Pagination Tests

```python
# PMI/backend/tests/characterization/test_pagination_current.py

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


class TestPaginationBehavior:
    """Capture current pagination behavior."""

    def test_pagination_default_values(self, seed_products):
        """Default pagination parameters."""
        response = client.get("/api/products")
        data = response.json()
        
        # Capture current structure
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)
        assert isinstance(data["total"], int)

    def test_pagination_with_page_param(self, seed_products):
        """Page parameter works."""
        response = client.get("/api/products?page=1")
        assert response.status_code == 200
        
        response = client.get("/api/products?page=2")
        assert response.status_code == 200

    def test_pagination_with_page_size(self, seed_products):
        """page_size parameter limits results."""
        response = client.get("/api/products?page_size=5")
        data = response.json()
        
        assert len(data["items"]) <= 5

    def test_pagination_empty_page(self):
        """Empty result when page exceeds total."""
        response = client.get("/api/products?page=9999")
        data = response.json()
        
        assert data["items"] == []

    def test_pagination_response_structure(self, seed_products):
        """Capture exact response structure."""
        response = client.get("/api/products?page=1&page_size=10")
        data = response.json()
        
        # Document current keys
        current_keys = set(data.keys())
        print(f"Current pagination keys: {current_keys}")
        
        # Must have at minimum
        assert "items" in current_keys
        assert "total" in current_keys
```

### 3. Error Response Tests

```python
# PMI/backend/tests/characterization/test_errors_current.py

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


class TestErrorResponses:
    """Capture current error response formats."""

    def test_404_not_found_format(self):
        """Capture 404 response format."""
        response = client.get("/api/products/99999")
        
        assert response.status_code == 404
        data = response.json()
        
        # Document current format
        print(f"404 response format: {data}")
        
        # Must have some error indicator
        assert "detail" in data or "error" in data or "message" in data

    def test_422_validation_error_format(self):
        """Capture validation error format."""
        response = client.post("/api/products", json={})
        
        # Could be 422 or 400
        assert response.status_code in [400, 422]
        data = response.json()
        
        print(f"Validation error format: {data}")

    def test_401_unauthorized_format(self):
        """Capture unauthorized error format."""
        response = client.get("/api/products", headers={})
        # Or protected endpoint without token
        
        # Document whatever the current behavior is
        print(f"Status: {response.status_code}")

    def test_duplicate_sku_error(self, db_session, sample_product):
        """Capture duplicate constraint error."""
        response = client.post("/api/products", json={
            "name": "Another Product",
            "sku": sample_product.sku,  # Duplicate
            "price": 50000,
        })
        
        # Could be 400, 409, or 422
        assert response.status_code in [400, 409, 422]
        print(f"Duplicate error format: {response.json()}")
```

### 4. Auth Tests

```python
# PMI/backend/tests/characterization/test_auth_current.py

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


class TestAuthBehavior:
    """Capture current auth behavior."""

    def test_login_returns_token(self):
        """Login returns access token."""
        response = client.post("/api/auth/login", json={
            "username": "admin",
            "password": "admin123",
        })
        
        if response.status_code == 200:
            data = response.json()
            assert "access_token" in data
            print(f"Token response keys: {data.keys()}")

    def test_token_structure(self, auth_token):
        """Capture token structure."""
        # Token is JWT
        parts = auth_token.split(".")
        assert len(parts) == 3  # header.payload.signature

    def test_protected_endpoint_requires_token(self):
        """Protected endpoints require auth."""
        # Find a protected endpoint
        response = client.get("/api/admin/users")
        
        # Should be 401 or 403 without token
        assert response.status_code in [401, 403]

    def test_protected_endpoint_with_token(self, auth_token):
        """Protected endpoints work with valid token."""
        response = client.get(
            "/api/admin/users",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        # Should succeed or return data
        print(f"Protected endpoint status: {response.status_code}")
```

---

## PMI Frontend - Characterization Tests

### 1. DataTable Tests

```typescript
// PMI/frontend/src/__tests__/characterization/DataTable.current.test.tsx

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataTable } from '@/components/ui/DataTable';

describe('DataTable - Current Behavior', () => {
  const mockData = [
    { id: 1, name: 'Product A', price: 100000 },
    { id: 2, name: 'Product B', price: 200000 },
  ];

  const columns = [
    { key: 'name', header: 'Tên sản phẩm' },
    { key: 'price', header: 'Giá' },
  ];

  it('renders table with data', () => {
    render(<DataTable data={mockData} columns={columns} />);
    
    expect(screen.getByText('Product A')).toBeInTheDocument();
    expect(screen.getByText('Product B')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    render(<DataTable data={mockData} columns={columns} />);
    
    expect(screen.getByText('Tên sản phẩm')).toBeInTheDocument();
    expect(screen.getByText('Giá')).toBeInTheDocument();
  });

  it('renders empty state when no data', () => {
    render(<DataTable data={[]} columns={columns} />);
    
    // Capture current empty state text
    const emptyText = screen.queryByText(/không có/i) || 
                      screen.queryByText(/empty/i) ||
                      screen.queryByText(/no data/i);
    console.log('Empty state element:', emptyText?.textContent);
  });

  it('handles row click if supported', () => {
    const onRowClick = vi.fn();
    render(
      <DataTable 
        data={mockData} 
        columns={columns} 
        onRowClick={onRowClick}
      />
    );
    
    const row = screen.getByText('Product A').closest('tr');
    if (row) {
      fireEvent.click(row);
      console.log('onRowClick called:', onRowClick.mock.calls.length);
    }
  });

  it('supports sorting if implemented', () => {
    render(<DataTable data={mockData} columns={columns} />);
    
    const header = screen.getByText('Tên sản phẩm');
    fireEvent.click(header);
    
    // Document if sorting happens
    console.log('After header click - check if sorted');
  });
});
```

### 2. Popup Service Tests

```typescript
// PMI/frontend/src/__tests__/characterization/popupService.current.test.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { popupService } from '@/services/popupService';
import { SystemPopupProvider } from '@/components/SystemPopup';

describe('popupService - Current Behavior', () => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <SystemPopupProvider>{children}</SystemPopupProvider>
  );

  it('success shows success message', async () => {
    render(<div />, { wrapper: Wrapper });
    
    popupService.success('Thành công!');
    
    await waitFor(() => {
      const popup = screen.queryByText('Thành công!');
      expect(popup).toBeInTheDocument();
    });
  });

  it('error shows error message', async () => {
    render(<div />, { wrapper: Wrapper });
    
    popupService.error('Có lỗi xảy ra');
    
    await waitFor(() => {
      expect(screen.getByText('Có lỗi xảy ra')).toBeInTheDocument();
    });
  });

  it('confirm returns promise', async () => {
    render(<div />, { wrapper: Wrapper });
    
    const confirmPromise = popupService.confirm('Bạn có chắc?');
    
    expect(confirmPromise).toBeInstanceOf(Promise);
  });

  it('popup auto-dismisses after timeout', async () => {
    vi.useFakeTimers();
    render(<div />, { wrapper: Wrapper });
    
    popupService.success('Auto dismiss test');
    
    // Check current auto-dismiss timing
    vi.advanceTimersByTime(3000);
    
    await waitFor(() => {
      const popup = screen.queryByText('Auto dismiss test');
      console.log('After 3s, popup visible:', !!popup);
    });
    
    vi.advanceTimersByTime(5000);
    
    await waitFor(() => {
      const popup = screen.queryByText('Auto dismiss test');
      console.log('After 8s, popup visible:', !!popup);
    });
    
    vi.useRealTimers();
  });
});
```

### 3. Layout Components Tests

```typescript
// PMI/frontend/src/__tests__/characterization/Layout.current.test.tsx

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';

describe('Sidebar - Current Behavior', () => {
  const menuItems = [
    { id: 'products', label: 'Sản phẩm', path: '/products', icon: 'box' },
    { id: 'categories', label: 'Danh mục', path: '/categories', icon: 'folder' },
  ];

  it('renders menu items', () => {
    render(
      <Sidebar 
        menuItems={menuItems} 
        currentPath="/products"
        onNavigate={() => {}}
      />
    );
    
    expect(screen.getByText('Sản phẩm')).toBeInTheDocument();
    expect(screen.getByText('Danh mục')).toBeInTheDocument();
  });

  it('highlights current path', () => {
    render(
      <Sidebar 
        menuItems={menuItems} 
        currentPath="/products"
        onNavigate={() => {}}
      />
    );
    
    const activeItem = screen.getByText('Sản phẩm').closest('a, li, button');
    console.log('Active item classes:', activeItem?.className);
  });

  it('calls onNavigate when clicking item', () => {
    const onNavigate = vi.fn();
    render(
      <Sidebar 
        menuItems={menuItems} 
        currentPath="/products"
        onNavigate={onNavigate}
      />
    );
    
    fireEvent.click(screen.getByText('Danh mục'));
    
    expect(onNavigate).toHaveBeenCalledWith('/categories');
  });
});

describe('Topbar - Current Behavior', () => {
  it('renders user info', () => {
    render(
      <Topbar 
        userName="Admin User"
        onLogout={() => {}}
      />
    );
    
    expect(screen.getByText(/Admin/i)).toBeInTheDocument();
  });

  it('calls onLogout when clicking logout', () => {
    const onLogout = vi.fn();
    render(
      <Topbar 
        userName="Admin"
        onLogout={onLogout}
      />
    );
    
    // Find logout button
    const logoutBtn = screen.getByRole('button', { name: /logout|đăng xuất/i });
    fireEvent.click(logoutBtn);
    
    expect(onLogout).toHaveBeenCalled();
  });
});
```

### 4. Hooks Tests

```typescript
// PMI/frontend/src/__tests__/characterization/hooks.current.test.ts

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '@/hooks/useDebounce';

describe('useDebounce - Current Behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500));
    
    expect(result.current).toBe('initial');
  });

  it('does not update value before delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'initial' } }
    );
    
    rerender({ value: 'updated' });
    
    // Before delay
    expect(result.current).toBe('initial');
  });

  it('updates value after delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'initial' } }
    );
    
    rerender({ value: 'updated' });
    
    act(() => {
      vi.advanceTimersByTime(500);
    });
    
    expect(result.current).toBe('updated');
  });

  it('resets timer on rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'a' } }
    );
    
    rerender({ value: 'b' });
    act(() => vi.advanceTimersByTime(300));
    
    rerender({ value: 'c' });
    act(() => vi.advanceTimersByTime(300));
    
    // Still should be 'a' because timer keeps resetting
    expect(result.current).toBe('a');
    
    act(() => vi.advanceTimersByTime(200));
    
    // Now should be 'c'
    expect(result.current).toBe('c');
  });
});
```

---

## Test Fixtures

### Backend Fixtures

```python
# PMI/backend/tests/characterization/conftest.py

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base
from models import Product, Category, User
from main import app
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def test_engine():
    """Create test database engine."""
    # Use test database
    TEST_DATABASE_URL = "postgresql://pmi:pmi@localhost:15433/pmi_test"
    engine = create_engine(TEST_DATABASE_URL)
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session(test_engine):
    """Create a fresh session for each test."""
    Session = sessionmaker(bind=test_engine)
    session = Session()
    yield session
    session.rollback()
    session.close()


@pytest.fixture
def sample_product(db_session):
    """Create a sample product."""
    product = Product(
        name="Sample Product",
        sku="SAMPLE-001",
        price=150000,
    )
    db_session.add(product)
    db_session.commit()
    yield product
    db_session.delete(product)
    db_session.commit()


@pytest.fixture
def seed_products(db_session):
    """Seed multiple products for pagination tests."""
    products = []
    for i in range(25):
        product = Product(
            name=f"Product {i+1}",
            sku=f"PROD-{i+1:03d}",
            price=10000 * (i + 1),
        )
        db_session.add(product)
        products.append(product)
    db_session.commit()
    yield products
    for p in products:
        db_session.delete(p)
    db_session.commit()


@pytest.fixture
def auth_token():
    """Get auth token for protected endpoints."""
    client = TestClient(app)
    response = client.post("/api/auth/login", json={
        "username": "admin",
        "password": "admin123",
    })
    if response.status_code == 200:
        return response.json()["access_token"]
    return None
```

---

## Running Characterization Tests

### Before Refactoring

```bash
# Backend
cd PMI/backend
pytest tests/characterization/ -v --tb=short

# Expected: ALL PASS
# If any fail, fix the test to match current behavior (not fix the code!)

# Frontend
cd PMI/frontend
pnpm test src/__tests__/characterization/

# Expected: ALL PASS
```

### After Refactoring

```bash
# Same commands, same tests
cd PMI/backend
pytest tests/characterization/ -v --tb=short

# Expected: ALL PASS
# If any fail → refactoring broke something!

cd PMI/frontend
pnpm test src/__tests__/characterization/

# Expected: ALL PASS
```

---

## Checklist

### Before Starting Migration

- [ ] All characterization tests written
- [ ] Backend characterization tests PASS
- [ ] Frontend characterization tests PASS
- [ ] Test output documented (for comparison later)
- [ ] Git commit: "Add characterization tests before shared packages migration"

### After Migration Complete

- [ ] Run SAME characterization tests
- [ ] Backend characterization tests still PASS
- [ ] Frontend characterization tests still PASS
- [ ] Compare test output with before
- [ ] No behavior changes detected

---

## Notes

1. **Characterization tests capture CURRENT behavior**, không phải desired behavior
2. Nếu test fail với code hiện tại → sửa TEST, không sửa code
3. Sau khi refactor, nếu test fail → refactor đã break behavior
4. Giữ nguyên tests này để regression testing trong tương lai
