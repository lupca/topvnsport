# ARCHITECTURE: Centralized Identity Service

## Mức độ: MEDIUM
## Estimated Effort: High (2-3 weeks)

---

## Vấn Đề Hiện Tại

### Phân Mảnh Identity

| System | User Model | Auth Method | Location |
|--------|------------|-------------|----------|
| PMI | `User` (admin/staff) | JWT | `PMI/backend/models.py:348` |
| OMS | `Customer` (buyers) | OTP SMS | `OMS/backend/models.py:9-19` |
| WMS | None | No auth | - |
| Web | None (uses OMS) | OTP via OMS | - |

### Vấn Đề Cụ Thể

1. **No SSO:** Admin phải login riêng vào PMI, OMS, WMS frontends
2. **Duplicate User Data:** PMI Users và OMS Customers là hoàn toàn riêng biệt
3. **No Role Sharing:** PMI roles không áp dụng được cho OMS/WMS
4. **Service Auth:** Inter-service calls không có authentication
5. **Session Not Shared:** JWT từ PMI không valid ở OMS

---

## Giải Pháp Đề Xuất

### New: Identity Service (auth-service)

```
┌──────────────┐
│   Identity   │
│   Service    │
│              │
│ - Users      │
│ - Roles      │
│ - Customers  │
│ - Sessions   │
│ - API Keys   │
└──────┬───────┘
       │
   ┌───┴───┐
   │       │
┌──┴──┐ ┌──┴──┐ ┌─────┐ ┌─────┐
│ PMI │ │ OMS │ │ WMS │ │ Web │
└─────┘ └─────┘ └─────┘ └─────┘
```

### Unified User Model

```python
# identity-service/models.py

class Account(Base):
    """Base account for all users"""
    __tablename__ = "accounts"
    
    id = Column(UUID, primary_key=True, default=uuid4)
    email = Column(String, unique=True, index=True)
    phone = Column(String, unique=True, index=True)
    hashed_password = Column(String, nullable=True)  # Null for OTP-only users
    account_type = Column(Enum("staff", "customer"), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    roles = relationship("AccountRole", back_populates="account")
    sessions = relationship("Session", back_populates="account")


class Role(Base):
    """System roles"""
    __tablename__ = "roles"
    
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True)  # admin, product_manager, warehouse_staff, customer
    permissions = Column(JSON)  # ["pmi:read", "pmi:write", "oms:read", ...]


class AccountRole(Base):
    """Many-to-many account-role"""
    __tablename__ = "account_roles"
    
    account_id = Column(UUID, ForeignKey("accounts.id"), primary_key=True)
    role_id = Column(Integer, ForeignKey("roles.id"), primary_key=True)


class Session(Base):
    """Active sessions"""
    __tablename__ = "sessions"
    
    id = Column(UUID, primary_key=True, default=uuid4)
    account_id = Column(UUID, ForeignKey("accounts.id"))
    token_hash = Column(String)  # Hashed refresh token
    device_info = Column(JSON)
    ip_address = Column(String)
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)


class ApiKey(Base):
    """Service-to-service API keys"""
    __tablename__ = "api_keys"
    
    id = Column(UUID, primary_key=True, default=uuid4)
    name = Column(String)  # "pmi-service", "oms-service"
    key_hash = Column(String)
    permissions = Column(JSON)  # ["inventory:read", "order:write"]
    is_active = Column(Boolean, default=True)
```

---

## API Endpoints

### Authentication

```python
# identity-service/routers/auth.py

@router.post("/auth/login")
async def login(credentials: LoginRequest):
    """Login with email/password"""
    account = verify_credentials(credentials.email, credentials.password)
    tokens = create_tokens(account)
    return {
        "access_token": tokens.access_token,
        "refresh_token": tokens.refresh_token,
        "token_type": "bearer",
        "expires_in": 3600,
    }

@router.post("/auth/otp/send")
async def send_otp(request: OtpRequest):
    """Send OTP to phone"""
    # Rate limiting, OTP generation, SMS sending
    
@router.post("/auth/otp/verify")
async def verify_otp(request: OtpVerifyRequest):
    """Verify OTP and return tokens"""
    # Find or create customer account
    account = get_or_create_customer(request.phone)
    tokens = create_tokens(account)
    return tokens

@router.post("/auth/refresh")
async def refresh_token(request: RefreshRequest):
    """Refresh access token"""
    
@router.post("/auth/logout")
async def logout(request: LogoutRequest):
    """Invalidate session"""
```

### User Management

```python
@router.get("/users/me")
async def get_current_user(account: Account = Depends(get_current_account)):
    """Get current user profile"""
    return {
        "id": account.id,
        "email": account.email,
        "phone": account.phone,
        "roles": [r.name for r in account.roles],
        "permissions": get_all_permissions(account),
    }

@router.get("/users/{user_id}")
async def get_user(user_id: UUID, _: Account = Depends(require_admin)):
    """Get user by ID (admin only)"""

@router.post("/users")
async def create_user(data: CreateUserRequest, _: Account = Depends(require_admin)):
    """Create new staff user (admin only)"""
```

### Service Authentication

```python
@router.post("/service/verify")
async def verify_service_key(request: ServiceKeyRequest):
    """Verify API key for service-to-service auth"""
    api_key = verify_api_key(request.api_key)
    return {
        "valid": True,
        "service": api_key.name,
        "permissions": api_key.permissions,
    }
```

---

## Integration with Existing Services

### PMI Integration

```python
# PMI/backend/utils/auth.py

from httpx import AsyncClient

IDENTITY_SERVICE_URL = os.getenv("IDENTITY_SERVICE_URL")

async def verify_token(token: str) -> dict:
    """Verify JWT with identity service"""
    async with AsyncClient() as client:
        response = await client.get(
            f"{IDENTITY_SERVICE_URL}/users/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code == 200:
            return response.json()
        raise HTTPException(401, "Invalid token")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    user = await verify_token(token)
    return user

def require_permission(permission: str):
    async def check(user: dict = Depends(get_current_user)):
        if permission not in user.get("permissions", []):
            raise HTTPException(403, f"Permission {permission} required")
        return user
    return check

# Usage in routers
@router.post("/products")
async def create_product(
    data: ProductCreate,
    user: dict = Depends(require_permission("pmi:product:write"))
):
    ...
```

### OMS Integration

```python
# OMS/backend/main.py

# Replace local OTP handling with identity service calls

@app.post("/api/orders")
async def create_order(payload: OrderCreate, db: Session = Depends(get_db)):
    # Verify token with identity service
    if payload.verification_token:
        async with AsyncClient() as client:
            response = await client.post(
                f"{IDENTITY_SERVICE_URL}/auth/otp/verify",
                json={"token": payload.verification_token}
            )
            if response.status_code != 200:
                raise HTTPException(401, "Invalid verification token")
            customer_data = response.json()
    
    # Create order with verified customer
    ...
```

### Service-to-Service Auth

```python
# OMS calling WMS with service auth

async def call_wms_api(endpoint: str, method: str = "GET", data: dict = None):
    async with AsyncClient() as client:
        response = await client.request(
            method,
            f"{WMS_API_URL}{endpoint}",
            headers={
                "X-API-Key": os.getenv("WMS_API_KEY"),
                "X-Service": "oms",
            },
            json=data,
        )
        return response.json()
```

---

## Migration Plan

### Phase 1: Deploy Identity Service (Week 1)

1. Create identity-service with basic auth
2. Migrate PMI Users to identity service
3. PMI validates tokens against identity service
4. Keep OMS OTP handling temporarily

### Phase 2: Migrate OMS Auth (Week 2)

1. Move OTP logic to identity service
2. OMS Customers become identity service accounts
3. Web uses identity service for auth
4. Remove OMS local OTP handling

### Phase 3: Add Service Auth (Week 3)

1. Generate API keys for each service
2. Update inter-service calls to use X-API-Key
3. Identity service validates service keys
4. Remove any hardcoded tokens

---

## Files Cần Tạo

### New Service Structure

```
identity-service/
├── main.py
├── models.py
├── schemas/
│   ├── auth.py
│   ├── user.py
│   └── service.py
├── routers/
│   ├── auth.py
│   ├── users.py
│   └── service.py
├── services/
│   ├── auth_service.py
│   ├── otp_service.py
│   └── token_service.py
├── utils/
│   ├── security.py
│   └── sms.py
├── requirements.txt
├── Dockerfile
└── alembic/
```

### Docker Compose Addition

```yaml
# docker-compose.yml
services:
  identity:
    build: ./identity-service
    environment:
      DATABASE_URL: postgresql://...
      JWT_SECRET: ${JWT_SECRET}
      SMS_API_KEY: ${SMS_API_KEY}
    ports:
      - "18103:8000"
    networks:
      - shared_network
```

---

## Verification

```bash
# Test staff login
curl -X POST http://localhost:18103/auth/login \
  -d '{"email": "admin@topvnsport.com", "password": "xxx"}'

# Test OTP flow
curl -X POST http://localhost:18103/auth/otp/send \
  -d '{"phone": "0901234567"}'
  
curl -X POST http://localhost:18103/auth/otp/verify \
  -d '{"phone": "0901234567", "otp": "123456"}'

# Test token validation from PMI
curl http://localhost:18100/api/v1/products \
  -H "Authorization: Bearer <token_from_identity_service>"

# Test service auth
curl http://localhost:18102/api/inventory \
  -H "X-API-Key: <wms_api_key>"
```
