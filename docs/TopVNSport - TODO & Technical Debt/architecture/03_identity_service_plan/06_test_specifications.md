# Test Specifications

## Tổng quan
Document này mô tả các test cases cho toàn bộ Identity Service và các integration points.

---

## 1. Identity Service Backend Tests

### 1.1 Auth Tests (`tests/test_auth.py`)

| Test ID | Test Case | Input | Expected Output |
|---------|-----------|-------|-----------------|
| AUTH-001 | Login thành công | `{"username": "admin", "password": "Admin@123"}` | 200 + `{access_token, refresh_token}` |
| AUTH-002 | Login sai password | `{"username": "admin", "password": "wrong"}` | 401 + `{"detail": "Invalid credentials"}` |
| AUTH-003 | Login user không tồn tại | `{"username": "unknown", "password": "any"}` | 401 + `{"detail": "Invalid credentials"}` |
| AUTH-004 | Login user bị deactivate | `{"username": "inactive_user", ...}` | 401 + `{"detail": "Account is deactivated"}` |
| AUTH-005 | Refresh token thành công | `{"refresh_token": "<valid>"}` | 200 + new tokens |
| AUTH-006 | Refresh token hết hạn | `{"refresh_token": "<expired>"}` | 401 + `{"detail": "Token expired"}` |
| AUTH-007 | Refresh token đã revoke | `{"refresh_token": "<revoked>"}` | 401 + `{"detail": "Token revoked"}` |
| AUTH-008 | Verify endpoint - valid token | `Authorization: Bearer <valid>` | 200 + `X-User-*` headers |
| AUTH-009 | Verify endpoint - invalid token | `Authorization: Bearer invalid` | 401 |
| AUTH-010 | Verify endpoint - no token | (no header) | 401 |
| AUTH-011 | Logout thành công | `POST /auth/logout` with valid token | 200 + refresh token revoked |
| AUTH-012 | Change password thành công | `{current, new}` | 200 |
| AUTH-013 | Change password - wrong current | `{wrong_current, new}` | 400 |

```python
# tests/test_auth.py

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

class TestLogin:
    def test_login_success(self, seed_admin_user):
        """AUTH-001: Login với credentials hợp lệ"""
        response = client.post("/auth/login", json={
            "username": "admin",
            "password": "Admin@123"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["expires_in"] > 0

    def test_login_wrong_password(self, seed_admin_user):
        """AUTH-002: Login với password sai"""
        response = client.post("/auth/login", json={
            "username": "admin",
            "password": "wrong_password"
        })
        
        assert response.status_code == 401
        assert "Invalid credentials" in response.json()["detail"]

    def test_login_user_not_found(self):
        """AUTH-003: Login với user không tồn tại"""
        response = client.post("/auth/login", json={
            "username": "nonexistent",
            "password": "any"
        })
        
        assert response.status_code == 401

    def test_login_inactive_user(self, seed_inactive_user):
        """AUTH-004: Login với user bị deactivate"""
        response = client.post("/auth/login", json={
            "username": "inactive",
            "password": "password"
        })
        
        assert response.status_code == 401
        assert "deactivated" in response.json()["detail"].lower()


class TestVerify:
    def test_verify_valid_token(self, auth_token):
        """AUTH-008: Verify với token hợp lệ"""
        response = client.get(
            "/auth/verify",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        assert "X-User-Id" in response.headers
        assert "X-User-Username" in response.headers
        assert "X-User-Role" in response.headers

    def test_verify_invalid_token(self):
        """AUTH-009: Verify với token không hợp lệ"""
        response = client.get(
            "/auth/verify",
            headers={"Authorization": "Bearer invalid_token"}
        )
        
        assert response.status_code == 401

    def test_verify_no_token(self):
        """AUTH-010: Verify không có token"""
        response = client.get("/auth/verify")
        
        assert response.status_code == 401


class TestRefreshToken:
    def test_refresh_success(self, auth_tokens):
        """AUTH-005: Refresh token thành công"""
        response = client.post("/auth/refresh", json={
            "refresh_token": auth_tokens["refresh_token"]
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["access_token"] != auth_tokens["access_token"]

    def test_refresh_expired_token(self, expired_refresh_token):
        """AUTH-006: Refresh với token hết hạn"""
        response = client.post("/auth/refresh", json={
            "refresh_token": expired_refresh_token
        })
        
        assert response.status_code == 401

    def test_refresh_revoked_token(self, revoked_refresh_token):
        """AUTH-007: Refresh với token đã revoke"""
        response = client.post("/auth/refresh", json={
            "refresh_token": revoked_refresh_token
        })
        
        assert response.status_code == 401
```

### 1.2 Staff CRUD Tests (`tests/test_staff.py`)

| Test ID | Test Case | Input | Expected Output |
|---------|-----------|-------|-----------------|
| STAFF-001 | List staff | GET /staff | 200 + paginated list |
| STAFF-002 | List staff với filter | GET /staff?role_id=1 | 200 + filtered list |
| STAFF-003 | Get staff by ID | GET /staff/1 | 200 + staff details |
| STAFF-004 | Get staff - not found | GET /staff/999 | 404 |
| STAFF-005 | Create staff | POST /staff | 201 + created staff |
| STAFF-006 | Create staff - duplicate username | POST /staff | 409 |
| STAFF-007 | Create staff - duplicate email | POST /staff | 409 |
| STAFF-008 | Create staff - invalid role | POST /staff with role_id=999 | 400 |
| STAFF-009 | Update staff | PUT /staff/1 | 200 + updated staff |
| STAFF-010 | Deactivate staff | PUT /staff/1 `{is_active: false}` | 200 |
| STAFF-011 | Delete staff | DELETE /staff/1 | 204 |
| STAFF-012 | Reset password | POST /staff/1/reset-password | 200 |

```python
# tests/test_staff.py

import pytest
from fastapi.testclient import TestClient

class TestStaffCRUD:
    def test_list_staff(self, client, admin_auth_header):
        """STAFF-001: Lấy danh sách staff"""
        response = client.get("/staff", headers=admin_auth_header)
        
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data

    def test_create_staff(self, client, admin_auth_header, test_role):
        """STAFF-005: Tạo staff mới"""
        response = client.post("/staff", headers=admin_auth_header, json={
            "username": "new_staff",
            "email": "new@example.com",
            "password": "Password@123",
            "role_id": test_role.id
        })
        
        assert response.status_code == 201
        data = response.json()
        assert data["username"] == "new_staff"
        assert data["is_active"] == True

    def test_create_staff_duplicate_username(self, client, admin_auth_header, existing_staff):
        """STAFF-006: Tạo staff với username đã tồn tại"""
        response = client.post("/staff", headers=admin_auth_header, json={
            "username": existing_staff.username,
            "email": "different@example.com",
            "password": "Password@123",
            "role_id": existing_staff.role_id
        })
        
        assert response.status_code == 409

    def test_update_staff(self, client, admin_auth_header, existing_staff):
        """STAFF-009: Cập nhật staff"""
        response = client.put(
            f"/staff/{existing_staff.id}",
            headers=admin_auth_header,
            json={"full_name": "Updated Name"}
        )
        
        assert response.status_code == 200
        assert response.json()["full_name"] == "Updated Name"

    def test_deactivate_staff(self, client, admin_auth_header, existing_staff):
        """STAFF-010: Vô hiệu hóa staff"""
        response = client.put(
            f"/staff/{existing_staff.id}",
            headers=admin_auth_header,
            json={"is_active": False}
        )
        
        assert response.status_code == 200
        assert response.json()["is_active"] == False
```

### 1.3 Role Tests (`tests/test_roles.py`)

| Test ID | Test Case | Input | Expected Output |
|---------|-----------|-------|-----------------|
| ROLE-001 | List roles | GET /roles | 200 + list |
| ROLE-002 | Get role by ID | GET /roles/1 | 200 + role details |
| ROLE-003 | Create role | POST /roles | 201 |
| ROLE-004 | Create role - duplicate code | POST /roles | 409 |
| ROLE-005 | Update role | PUT /roles/1 | 200 |
| ROLE-006 | Delete role - no staff | DELETE /roles/1 | 204 |
| ROLE-007 | Delete role - has staff | DELETE /roles/1 | 400 |

---

## 2. Nginx Gateway Tests

### 2.1 Auth Flow Tests

| Test ID | Test Case | Command | Expected |
|---------|-----------|---------|----------|
| GW-001 | Auth endpoint bypass | `curl /auth/login` | 200 (no auth_request) |
| GW-002 | Protected endpoint - valid token | `curl /api/pmi/products -H "Auth..."` | 200 + X-User headers |
| GW-003 | Protected endpoint - no token | `curl /api/pmi/products` | 401 |
| GW-004 | Protected endpoint - invalid token | `curl /api/pmi/products -H "Auth: invalid"` | 401 |
| GW-005 | Header spoofing blocked | `curl -H "X-User-Id: 999"` | X-User-Id from token, not request |
| GW-006 | Internal endpoint - from docker | `curl /internal/pmi/products` (from OMS) | 200 |
| GW-007 | Internal endpoint - from outside | `curl /internal/pmi/products` (external) | 403 |

```bash
# tests/gateway/test_auth_flow.sh

#!/bin/bash
set -e

GATEWAY_URL="http://localhost:8080"
IDENTITY_URL="http://localhost:18110"

echo "=== Gateway Auth Flow Tests ==="

# GW-001: Auth endpoint bypass
echo "Test GW-001: Auth endpoint bypass"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/auth/login" \
  -X POST -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}')
[ "$RESPONSE" = "200" ] && echo "PASS" || echo "FAIL: Expected 200, got $RESPONSE"

# Get token for next tests
TOKEN=$(curl -s "$GATEWAY_URL/auth/login" \
  -X POST -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}' | jq -r '.access_token')

# GW-002: Protected endpoint with valid token
echo "Test GW-002: Protected endpoint with valid token"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/api/pmi/products" \
  -H "Authorization: Bearer $TOKEN")
[ "$RESPONSE" = "200" ] && echo "PASS" || echo "FAIL: Expected 200, got $RESPONSE"

# GW-003: Protected endpoint without token
echo "Test GW-003: Protected endpoint without token"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/api/pmi/products")
[ "$RESPONSE" = "401" ] && echo "PASS" || echo "FAIL: Expected 401, got $RESPONSE"

# GW-004: Protected endpoint with invalid token
echo "Test GW-004: Protected endpoint with invalid token"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/api/pmi/products" \
  -H "Authorization: Bearer invalid_token_here")
[ "$RESPONSE" = "401" ] && echo "PASS" || echo "FAIL: Expected 401, got $RESPONSE"

# GW-005: Header spoofing prevention
echo "Test GW-005: Header spoofing prevention"
# This test needs to check that X-User-Id comes from token, not from request
# Implementation: Backend logs or returns the X-User-Id it received
RESPONSE=$(curl -s "$GATEWAY_URL/api/pmi/auth/me" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-User-Id: 9999" \
  -H "X-User-Username: hacker")
ACTUAL_USER_ID=$(echo "$RESPONSE" | jq -r '.actor_id')
[ "$ACTUAL_USER_ID" != "9999" ] && echo "PASS" || echo "FAIL: Header spoofing not blocked"

echo "=== All Gateway Tests Complete ==="
```

---

## 3. PMI Integration Tests

### 3.1 Backend Auth Tests

| Test ID | Test Case | Input | Expected |
|---------|-----------|-------|----------|
| PMI-001 | API với X-User headers | Headers từ Gateway | 200 + user context set |
| PMI-002 | API với X-API-Key | Service token | 200 + service context set |
| PMI-003 | API không có auth | No headers | 401 |
| PMI-004 | Permission check - allowed | User có pmi:write | 200 |
| PMI-005 | Permission check - denied | User chỉ có pmi:read | 403 |

```python
# PMI/backend/tests/test_identity_integration.py

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

class TestIdentityIntegration:
    def test_api_with_user_headers(self):
        """PMI-001: API với X-User headers từ Gateway"""
        response = client.get(
            "/api/products",
            headers={
                "X-User-Id": "1",
                "X-User-Username": "admin",
                "X-User-Role": "admin",
                "X-User-Permissions": "pmi:*"
            }
        )
        
        assert response.status_code == 200

    def test_api_with_service_token(self):
        """PMI-002: API với X-API-Key (service-to-service)"""
        response = client.get(
            "/api/products",
            headers={
                "X-API-Key": "oms_wms_internal_api_key_secret_2026",
                "X-Service-Name": "OMS"
            }
        )
        
        assert response.status_code == 200

    def test_api_without_auth(self):
        """PMI-003: API không có auth headers"""
        response = client.get("/api/products")
        
        assert response.status_code == 401

    def test_permission_allowed(self):
        """PMI-004: User có permission pmi:write"""
        response = client.post(
            "/api/products",
            headers={
                "X-User-Id": "1",
                "X-User-Username": "admin",
                "X-User-Role": "admin",
                "X-User-Permissions": "pmi:write"
            },
            json={"name": "Test Product", "product_code": "TEST001", ...}
        )
        
        assert response.status_code in [200, 201]

    def test_permission_denied(self):
        """PMI-005: User chỉ có pmi:read, không có pmi:write"""
        response = client.post(
            "/api/products",
            headers={
                "X-User-Id": "2",
                "X-User-Username": "viewer",
                "X-User-Role": "viewer",
                "X-User-Permissions": "pmi:read"
            },
            json={"name": "Test Product", ...}
        )
        
        assert response.status_code == 403
```

### 3.2 Frontend Auth Tests (Vitest)

```typescript
// PMI/frontend/src/__tests__/auth.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchWithAuth } from '@/utils/apiClient';

describe('Auth Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should redirect to login when no token', async () => {
    const mockLocation = { href: '' };
    vi.stubGlobal('location', mockLocation);
    
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ detail: 'Unauthorized' })
    });

    try {
      await fetchWithAuth('/api/products');
    } catch (e) {
      // Expected
    }

    expect(mockLocation.href).toContain('/login');
  });

  it('should include Bearer token in requests', async () => {
    localStorage.setItem('access_token', 'test_token');
    
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ data: [] })
    });

    await fetchWithAuth('/api/products');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.any(Headers)
      })
    );

    const callArgs = (global.fetch as any).mock.calls[0];
    const headers = callArgs[1].headers;
    expect(headers.get('Authorization')).toBe('Bearer test_token');
  });

  it('should refresh token on 401', async () => {
    localStorage.setItem('access_token', 'old_token');
    localStorage.setItem('refresh_token', 'refresh_token');
    
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/auth/refresh')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            access_token: 'new_token',
            refresh_token: 'new_refresh'
          })
        });
      }
      
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ detail: 'Token expired' })
        });
      }
      
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ data: [] })
      });
    });

    await fetchWithAuth('/api/products');

    expect(localStorage.getItem('access_token')).toBe('new_token');
  });
});
```

---

## 4. E2E Tests (Playwright)

### 4.1 Login Flow

```typescript
// e2e_tests/identity/login.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Identity Login Flow', () => {
  test('should login successfully and redirect', async ({ page }) => {
    // Go to PMI
    await page.goto('http://localhost:13100');
    
    // Should redirect to Identity login
    await expect(page).toHaveURL(/localhost:13110\/login/);
    
    // Fill login form
    await page.fill('[name="username"]', 'admin');
    await page.fill('[name="password"]', 'Admin@123');
    await page.click('button[type="submit"]');
    
    // Should redirect back to PMI
    await expect(page).toHaveURL(/localhost:13100/);
    
    // Should show user info in header
    await expect(page.locator('[data-testid="user-info"]')).toContainText('admin');
  });

  test('should show error on invalid credentials', async ({ page }) => {
    await page.goto('http://localhost:13110/login');
    
    await page.fill('[name="username"]', 'admin');
    await page.fill('[name="password"]', 'wrong_password');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('.error-message')).toBeVisible();
  });

  test('should logout and redirect to login', async ({ page }) => {
    // Login first
    await page.goto('http://localhost:13110/login');
    await page.fill('[name="username"]', 'admin');
    await page.fill('[name="password"]', 'Admin@123');
    await page.click('button[type="submit"]');
    
    // Wait for redirect
    await page.waitForURL(/localhost:13100/);
    
    // Click logout
    await page.click('[data-testid="logout-button"]');
    
    // Should redirect to login
    await expect(page).toHaveURL(/localhost:13110\/login/);
    
    // Token should be cleared
    const token = await page.evaluate(() => localStorage.getItem('access_token'));
    expect(token).toBeNull();
  });
});
```

### 4.2 Cross-System Navigation

```typescript
// e2e_tests/identity/cross_system.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Cross-System SSO', () => {
  test.beforeEach(async ({ page }) => {
    // Login via Identity Service
    await page.goto('http://localhost:13110/login');
    await page.fill('[name="username"]', 'admin');
    await page.fill('[name="password"]', 'Admin@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
  });

  test('should access PMI without re-login', async ({ page }) => {
    await page.goto('http://localhost:13100');
    
    // Should NOT redirect to login
    await expect(page).not.toHaveURL(/login/);
    
    // Should show PMI dashboard
    await expect(page.locator('h1')).toContainText(/PMI|Sản phẩm/);
  });

  test('should access OMS without re-login', async ({ page }) => {
    await page.goto('http://localhost:13101');
    
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('h1')).toContainText(/OMS|Đơn hàng/);
  });

  test('should access WMS without re-login', async ({ page }) => {
    await page.goto('http://localhost:13102');
    
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('h1')).toContainText(/WMS|Kho/);
  });
});
```

### 4.3 Permission Tests

```typescript
// e2e_tests/identity/permissions.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Permission Enforcement', () => {
  test('admin can access all systems', async ({ page }) => {
    await loginAs(page, 'admin', 'Admin@123');
    
    // Can access Identity management
    await page.goto('http://localhost:13110/staff');
    await expect(page.locator('h1')).toContainText('Nhân sự');
    
    // Can access PMI
    await page.goto('http://localhost:13100/products');
    await expect(page).not.toHaveURL(/403|forbidden/i);
  });

  test('pmi_staff cannot access OMS', async ({ page }) => {
    await loginAs(page, 'pmi_staff', 'Staff@123');
    
    // Can access PMI
    await page.goto('http://localhost:13100');
    await expect(page).not.toHaveURL(/login/);
    
    // Cannot access OMS (permission denied)
    await page.goto('http://localhost:13101');
    await expect(page.locator('body')).toContainText(/403|Forbidden|Không có quyền/i);
  });

  test('viewer cannot create products', async ({ page }) => {
    await loginAs(page, 'viewer', 'Viewer@123');
    
    // Can view products
    await page.goto('http://localhost:13100/products');
    await expect(page.locator('table')).toBeVisible();
    
    // Create button should be disabled or hidden
    const createButton = page.locator('[data-testid="create-product"]');
    const isDisabled = await createButton.isDisabled().catch(() => true);
    const isHidden = await createButton.isHidden().catch(() => true);
    
    expect(isDisabled || isHidden).toBe(true);
  });
});

async function loginAs(page, username: string, password: string) {
  await page.goto('http://localhost:13110/login');
  await page.fill('[name="username"]', username);
  await page.fill('[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
}
```

---

## 5. Test Fixtures & Utilities

### `conftest.py` (pytest)

```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from testcontainers.postgres import PostgresContainer

from database import Base
from models import Role, StaffAccount
from utils.password import get_password_hash

@pytest.fixture(scope="session")
def postgres_container():
    with PostgresContainer("postgres:15-alpine") as postgres:
        yield postgres

@pytest.fixture(scope="session")
def engine(postgres_container):
    engine = create_engine(postgres_container.get_connection_url())
    Base.metadata.create_all(engine)
    return engine

@pytest.fixture
def db_session(engine):
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.rollback()
    session.close()

@pytest.fixture
def seed_admin_user(db_session):
    role = Role(code="admin", name="Admin", permissions=["*"])
    db_session.add(role)
    db_session.commit()
    
    user = StaffAccount(
        username="admin",
        email="admin@test.com",
        hashed_password=get_password_hash("Admin@123"),
        role_id=role.id,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    return user

@pytest.fixture
def auth_token(seed_admin_user, client):
    response = client.post("/auth/login", json={
        "username": "admin",
        "password": "Admin@123"
    })
    return response.json()["access_token"]

@pytest.fixture
def admin_auth_header(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}
```

---

## 6. Test Coverage Requirements

| Component | Minimum Coverage | Critical Paths |
|-----------|------------------|----------------|
| Identity Backend - Auth | 95% | login, verify, refresh |
| Identity Backend - Staff | 90% | CRUD operations |
| Identity Backend - Roles | 90% | CRUD, permission checks |
| Nginx Gateway | 100% (config tests) | auth_request, header injection |
| PMI Backend - Auth | 90% | header parsing, permission checks |
| PMI Frontend - Auth | 85% | login redirect, token refresh |
| E2E - Login Flow | N/A | Full flow coverage |
| E2E - Cross-System | N/A | SSO verification |
