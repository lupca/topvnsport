# TODO: RBAC - Role-Based Access Control

## Mức độ: CRITICAL
## Estimated Effort: High (1-2 days)

---

## Mô Tả Vấn Đề

Hiện tại hệ thống chỉ có authentication (xác thực danh tính) nhưng **không có authorization** (phân quyền). Bất kỳ user đã đăng nhập nào cũng có thể thực hiện mọi thao tác.

### Vị trí cụ thể:

**PMI/backend/utils/dependency.py:**
```python
async def get_current_identity(token: str = Depends(oauth2_scheme)) -> Identity:
    # Chỉ verify token và return identity
    # KHÔNG kiểm tra role hay permissions
    ...
    return Identity(...)
```

**PMI/backend/main.py (lines 92-97):**
```python
# Auth applied globally nhưng không phân biệt role
app.include_router(products.router, dependencies=[Depends(get_current_identity)])
app.include_router(categories.router, dependencies=[Depends(get_current_identity)])
```

---

## Impact

- **Data Risk:** User thường có thể xóa products, categories
- **Business Risk:** Có thể modify pricing, inventory data
- **Audit Risk:** Không track được ai có quyền làm gì

---

## Proposed Role Model

```
Roles:
├── admin          # Full access to everything
├── product_manager # CRUD products, categories, attributes
├── inventory_staff # View products, update inventory only
└── viewer         # Read-only access
```

---

## Steps to Implement

### Step 1: Update User Model

**File: PMI/backend/models.py**

```python
from enum import Enum

class UserRole(str, Enum):
    ADMIN = "admin"
    PRODUCT_MANAGER = "product_manager"
    INVENTORY_STAFF = "inventory_staff"
    VIEWER = "viewer"

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default=UserRole.VIEWER)  # ADD THIS
    is_active = Column(Boolean, default=True)
```

### Step 2: Create Permission Definitions

**File: PMI/backend/utils/permissions.py** (NEW FILE)

```python
from enum import Enum
from functools import wraps
from fastapi import HTTPException, status

class Permission(str, Enum):
    # Products
    PRODUCT_VIEW = "product:view"
    PRODUCT_CREATE = "product:create"
    PRODUCT_UPDATE = "product:update"
    PRODUCT_DELETE = "product:delete"
    
    # Categories
    CATEGORY_VIEW = "category:view"
    CATEGORY_MANAGE = "category:manage"
    
    # Users
    USER_MANAGE = "user:manage"

# Role -> Permissions mapping
ROLE_PERMISSIONS = {
    "admin": [p.value for p in Permission],  # All permissions
    
    "product_manager": [
        Permission.PRODUCT_VIEW,
        Permission.PRODUCT_CREATE,
        Permission.PRODUCT_UPDATE,
        Permission.PRODUCT_DELETE,
        Permission.CATEGORY_VIEW,
        Permission.CATEGORY_MANAGE,
    ],
    
    "inventory_staff": [
        Permission.PRODUCT_VIEW,
        Permission.PRODUCT_UPDATE,  # Only for inventory fields
        Permission.CATEGORY_VIEW,
    ],
    
    "viewer": [
        Permission.PRODUCT_VIEW,
        Permission.CATEGORY_VIEW,
    ],
}

def has_permission(role: str, permission: Permission) -> bool:
    return permission.value in ROLE_PERMISSIONS.get(role, [])
```

### Step 3: Create Authorization Dependency

**File: PMI/backend/utils/dependency.py** (UPDATE)

```python
from .permissions import Permission, has_permission

def require_permission(permission: Permission):
    """Dependency that checks if current user has required permission"""
    async def check_permission(identity: Identity = Depends(get_current_identity)):
        if not has_permission(identity.role, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {permission.value} required"
            )
        return identity
    return check_permission
```

### Step 4: Apply to Routers

**File: PMI/backend/routers/products.py** (UPDATE)

```python
from utils.permissions import Permission
from utils.dependency import require_permission

@router.get("/")
async def list_products(
    identity: Identity = Depends(require_permission(Permission.PRODUCT_VIEW))
):
    ...

@router.post("/")
async def create_product(
    identity: Identity = Depends(require_permission(Permission.PRODUCT_CREATE))
):
    ...

@router.delete("/{product_id}")
async def delete_product(
    identity: Identity = Depends(require_permission(Permission.PRODUCT_DELETE))
):
    ...
```

### Step 5: Database Migration

```bash
cd PMI/backend
alembic revision --autogenerate -m "add user role column"
alembic upgrade head
```

### Step 6: Seed Default Admin

**File: PMI/backend/utils/startup.py** (UPDATE)

```python
async def seed_admin_user(db: Session):
    admin = db.query(User).filter(User.username == "admin").first()
    if not admin:
        admin = User(
            username="admin",
            hashed_password=hash_password("change_me"),
            role="admin"
        )
        db.add(admin)
        db.commit()
```

---

## Files Cần Modify

| File | Action |
|------|--------|
| `PMI/backend/models.py` | Add role column to User |
| `PMI/backend/utils/permissions.py` | NEW - Permission definitions |
| `PMI/backend/utils/dependency.py` | Add require_permission() |
| `PMI/backend/routers/products.py` | Apply permission checks |
| `PMI/backend/routers/categories.py` | Apply permission checks |
| `PMI/backend/routers/channels.py` | Apply permission checks |
| `PMI/backend/routers/attributes.py` | Apply permission checks |
| `PMI/backend/utils/startup.py` | Seed admin user with role |
| `alembic/versions/xxx_add_role.py` | Migration for role column |

---

## Verification

```python
# Test cases to add:

def test_viewer_cannot_delete_product():
    # Login as viewer
    token = login_as("viewer_user")
    
    # Try to delete product
    response = client.delete(
        "/api/v1/products/1",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    assert response.status_code == 403
    assert "Permission denied" in response.json()["detail"]

def test_admin_can_delete_product():
    token = login_as("admin")
    response = client.delete("/api/v1/products/1", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
```

### Manual Testing

1. Login as viewer -> Try delete product -> Should get 403
2. Login as admin -> Delete product -> Should succeed
3. Login as product_manager -> Create product -> Should succeed
4. Login as product_manager -> Manage users -> Should get 403

---

## Notes

- Cân nhắc thêm API endpoint để admin assign roles cho users
- Cân nhắc thêm UI trong frontend để manage user roles
- OMS và WMS cũng cần implement tương tự
- Có thể dùng library như `fastapi-permissions` hoặc `casbin` cho complex RBAC
