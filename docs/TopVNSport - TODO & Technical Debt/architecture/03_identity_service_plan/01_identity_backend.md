# Phase 1: Identity Service Backend

## Tổng quan
Tạo service mới `identity-service/` trong root project, cấu trúc tương tự PMI backend.

## Cấu trúc thư mục

```
identity-service/
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── staff.py
│   │   └── role.py
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── staff.py
│   │   └── roles.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── auth_service.py
│   │   └── staff_service.py
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── jwt.py
│   │   ├── password.py
│   │   └── seed.py
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_auth.py
│   │   ├── test_staff.py
│   │   └── test_roles.py
│   ├── alembic/
│   │   └── versions/
│   ├── alembic.ini
│   ├── requirements.txt
│   ├── Dockerfile
│   └── Dockerfile.dev
├── docker-compose.yml
└── docker-compose.dev.yml
```

---

## 1. Database Models

### File: `models.py`

```python
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from database import Base
import datetime

class Role(Base):
    __tablename__ = "roles"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)  # admin, staff, viewer
    name = Column(String(100), nullable=False)  # Quản trị viên, Nhân viên, Người xem
    description = Column(String(500), nullable=True)
    
    # Permissions as simple JSON array
    permissions = Column(JSON, default=list)  # ["pmi:read", "pmi:write", "oms:read", ...]
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    staff_accounts = relationship("StaffAccount", back_populates="role")


class StaffAccount(Base):
    __tablename__ = "staff_accounts"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Audit fields
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    last_login_at = Column(DateTime, nullable=True)
    
    role = relationship("Role", back_populates="staff_accounts")
    sessions = relationship("StaffSession", back_populates="staff", cascade="all, delete-orphan")


class StaffSession(Base):
    __tablename__ = "staff_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("staff_accounts.id", ondelete="CASCADE"), nullable=False)
    
    refresh_token_hash = Column(String(255), nullable=False, index=True)
    user_agent = Column(String(500), nullable=True)
    ip_address = Column(String(45), nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    
    staff = relationship("StaffAccount", back_populates="sessions")
```

---

## 2. Schemas

### File: `schemas/auth.py`

```python
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=1)

class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class VerifyResponse(BaseModel):
    valid: bool
    user_id: Optional[int] = None
    username: Optional[str] = None
    role: Optional[str] = None
    permissions: Optional[list[str]] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)
```

### File: `schemas/staff.py`

```python
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

class StaffBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    email: EmailStr
    full_name: Optional[str] = Field(None, max_length=255)
    role_id: int

class StaffCreate(StaffBase):
    password: str = Field(..., min_length=8, max_length=128)

class StaffUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = Field(None, max_length=255)
    role_id: Optional[int] = None
    is_active: Optional[bool] = None

class StaffOut(StaffBase):
    id: int
    is_active: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None
    role_code: str
    role_name: str
    
    class Config:
        from_attributes = True

class StaffListResponse(BaseModel):
    items: list[StaffOut]
    total: int
    page: int
    page_size: int
```

### File: `schemas/role.py`

```python
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class RoleBase(BaseModel):
    code: str = Field(..., min_length=2, max_length=50, pattern=r"^[a-z_]+$")
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    permissions: list[str] = Field(default_factory=list)

class RoleCreate(RoleBase):
    pass

class RoleUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    permissions: Optional[list[str]] = None

class RoleOut(RoleBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True
```

---

## 3. API Endpoints

### File: `routers/auth.py`

| Method | Endpoint | Mô tả | Auth Required |
|--------|----------|-------|---------------|
| POST | `/auth/login` | Đăng nhập, trả về access + refresh token | No |
| POST | `/auth/refresh` | Đổi refresh token lấy access token mới | No |
| GET | `/auth/verify` | Nginx gọi để verify token (internal) | No (token in header) |
| POST | `/auth/logout` | Revoke refresh token | Yes |
| GET | `/auth/me` | Lấy thông tin user hiện tại | Yes |
| POST | `/auth/change-password` | Đổi mật khẩu | Yes |

#### Chi tiết endpoint `/auth/verify`

```python
@router.get("/verify")
async def verify_token(
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """
    Endpoint cho Nginx auth_request.
    - Input: Authorization header (Bearer token)
    - Output nếu valid: 200 OK + custom headers
    - Output nếu invalid: 401 Unauthorized
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing or invalid token")
    
    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    
    if not payload:
        raise HTTPException(401, "Invalid or expired token")
    
    staff = db.query(StaffAccount).filter(
        StaffAccount.id == payload.get("sub"),
        StaffAccount.is_active == True
    ).first()
    
    if not staff:
        raise HTTPException(401, "User not found or inactive")
    
    # Return headers for Nginx to inject
    return Response(
        status_code=200,
        headers={
            "X-User-Id": str(staff.id),
            "X-User-Username": staff.username,
            "X-User-Role": staff.role.code,
            "X-User-Permissions": ",".join(staff.role.permissions or [])
        }
    )
```

### File: `routers/staff.py`

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/staff` | Danh sách staff (paginated) |
| GET | `/staff/{id}` | Chi tiết staff |
| POST | `/staff` | Tạo staff mới |
| PUT | `/staff/{id}` | Cập nhật staff |
| DELETE | `/staff/{id}` | Xóa staff |
| POST | `/staff/{id}/reset-password` | Admin reset password |

### File: `routers/roles.py`

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/roles` | Danh sách roles |
| GET | `/roles/{id}` | Chi tiết role |
| POST | `/roles` | Tạo role mới |
| PUT | `/roles/{id}` | Cập nhật role |
| DELETE | `/roles/{id}` | Xóa role (nếu không có staff) |

---

## 4. JWT Configuration

### File: `utils/jwt.py`

```python
import os
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from typing import Optional

JWT_SECRET_KEY = os.environ["JWT_SECRET_KEY"]
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))  # 1 hour
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

def create_access_token(staff_id: int, username: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": staff_id,
        "username": username,
        "role": role,
        "type": "access",
        "exp": expire,
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

def create_refresh_token(staff_id: int) -> tuple[str, datetime]:
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": staff_id,
        "type": "refresh",
        "exp": expire,
        "iat": datetime.now(timezone.utc)
    }
    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return token, expire

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            return None
        return payload
    except JWTError:
        return None
```

---

## 5. Seed Data

### File: `utils/seed.py`

```python
def seed_initial_data(db: Session):
    # Create default roles
    roles_data = [
        {
            "code": "admin",
            "name": "Quản trị viên",
            "description": "Toàn quyền trên tất cả hệ thống",
            "permissions": ["pmi:*", "oms:*", "wms:*", "identity:*"]
        },
        {
            "code": "pmi_staff",
            "name": "Nhân viên PMI",
            "description": "Quản lý sản phẩm",
            "permissions": ["pmi:read", "pmi:write"]
        },
        {
            "code": "oms_staff",
            "name": "Nhân viên OMS",
            "description": "Quản lý đơn hàng",
            "permissions": ["oms:read", "oms:write", "pmi:read"]
        },
        {
            "code": "wms_staff",
            "name": "Nhân viên WMS",
            "description": "Quản lý kho",
            "permissions": ["wms:read", "wms:write", "pmi:read"]
        },
        {
            "code": "viewer",
            "name": "Người xem",
            "description": "Chỉ xem, không chỉnh sửa",
            "permissions": ["pmi:read", "oms:read", "wms:read"]
        }
    ]
    
    for role_data in roles_data:
        existing = db.query(Role).filter(Role.code == role_data["code"]).first()
        if not existing:
            db.add(Role(**role_data))
    
    db.commit()
    
    # Create default admin account
    admin_role = db.query(Role).filter(Role.code == "admin").first()
    existing_admin = db.query(StaffAccount).filter(StaffAccount.username == "admin").first()
    
    if not existing_admin and admin_role:
        admin = StaffAccount(
            username="admin",
            email="admin@topvnsport.com",
            hashed_password=get_password_hash("Admin@123"),
            full_name="System Administrator",
            role_id=admin_role.id,
            is_active=True
        )
        db.add(admin)
        db.commit()
```

---

## 6. Docker Configuration

### File: `docker-compose.yml`

```yaml
services:
  identity-db:
    image: postgres:15-alpine
    container_name: identity-db
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=identity_db
    ports:
      - "15436:5432"
    volumes:
      - identity_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  identity-api:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    container_name: identity-api
    ports:
      - "18110:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@identity-db:5432/identity_db
      - JWT_SECRET_KEY=identity_jwt_secret_key_2026_change_me_in_prod
      - JWT_ALGORITHM=HS256
      - ACCESS_TOKEN_EXPIRE_MINUTES=60
      - REFRESH_TOKEN_EXPIRE_DAYS=7
    depends_on:
      identity-db:
        condition: service_healthy
    develop:
      watch:
        - action: sync
          path: ./backend
          target: /app
          ignore:
            - __pycache__/
            - "*.pyc"
        - action: rebuild
          path: ./backend/requirements.txt
    networks:
      - identity_network
      - pmi_default
      - oms_default
      - wms_default

volumes:
  identity_pgdata:

networks:
  identity_network:
    driver: bridge
  pmi_default:
    external: true
  oms_default:
    external: true
  wms_default:
    external: true
```

### File: `requirements.txt`

```
fastapi==0.109.0
uvicorn[standard]==0.27.0
sqlalchemy==2.0.25
psycopg2-binary==2.9.9
alembic==1.13.1
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
pydantic[email]==2.5.3
python-multipart==0.0.6
httpx==0.26.0

# Testing
pytest==7.4.4
pytest-asyncio==0.23.3
testcontainers[postgres]==3.7.1
httpx==0.26.0
factory-boy==3.3.0
```

---

## 7. Checklist triển khai Phase 1

- [ ] Tạo thư mục `identity-service/`
- [ ] Khởi tạo `database.py`, `models.py`
- [ ] Tạo Alembic migrations
- [ ] Implement `utils/jwt.py`, `utils/password.py`
- [ ] Implement `routers/auth.py` với đầy đủ endpoints
- [ ] Implement `routers/staff.py`
- [ ] Implement `routers/roles.py`
- [ ] Viết seed data script
- [ ] Viết unit tests cho auth
- [ ] Viết unit tests cho staff CRUD
- [ ] Viết unit tests cho roles CRUD
- [ ] Setup Docker Compose
- [ ] Test manual với curl/Postman
- [ ] Document API với OpenAPI (auto-generated)
