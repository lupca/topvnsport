# TODO: Layer Violations - Service Layer Exceptions

## Mức độ: HIGH
## Estimated Effort: Medium (4-6 hours)

---

## Mô Tả Vấn Đề

Service layer đang raise `HTTPException` trực tiếp, vi phạm Separation of Concerns. Services không nên biết về HTTP - chúng nên raise business exceptions để có thể reuse cho CLI tools, background jobs, hoặc different transports (gRPC, WebSocket).

### Vị trí cụ thể:

**PMI/backend/services/product_service.py:**

```python
# Line 94
raise HTTPException(status_code=404, detail="Product not found")

# Line 143
raise HTTPException(status_code=400, detail="Invalid category")

# Line 264
raise HTTPException(status_code=409, detail="SKU already exists")
```

**PMI/backend/services/category_service.py:**
```python
raise HTTPException(...)  # Similar pattern
```

---

## Impact

- **Tight Coupling:** Services coupled to HTTP transport
- **Not Reusable:** Cannot use services from CLI tools or background workers
- **Testing Complexity:** Tests need to catch HTTPException instead of domain exceptions
- **Inconsistent Error Messages:** HTTP details mixed with business logic

---

## Proposed Solution

### Pattern: Business Exceptions + Exception Handler

```
Service Layer          Router Layer           Client
     │                      │                   │
     ├─ raise               │                   │
     │  ProductNotFound     │                   │
     │        │             │                   │
     │        └────────────►│ catch + convert   │
     │                      │ to HTTPException  │
     │                      │        │          │
     │                      │        └─────────►│ 404 JSON
```

---

## Steps to Implement

### Step 1: Create Business Exceptions Module

**File: PMI/backend/exceptions.py** (NEW)

```python
"""
Business exceptions for the PMI system.
These are transport-agnostic and can be used by services, CLI, workers, etc.
"""

class PMIException(Exception):
    """Base exception for all PMI business errors"""
    def __init__(self, message: str, code: str = None):
        self.message = message
        self.code = code or self.__class__.__name__
        super().__init__(self.message)


# Product exceptions
class ProductNotFoundError(PMIException):
    """Raised when a product cannot be found"""
    pass

class ProductSKUExistsError(PMIException):
    """Raised when trying to create a product with duplicate SKU"""
    pass

class ProductValidationError(PMIException):
    """Raised when product data fails validation"""
    pass


# Category exceptions
class CategoryNotFoundError(PMIException):
    """Raised when a category cannot be found"""
    pass

class CategoryHasChildrenError(PMIException):
    """Raised when trying to delete a category with children"""
    pass


# Channel exceptions
class ChannelNotFoundError(PMIException):
    """Raised when a channel cannot be found"""
    pass


# Generic
class ResourceNotFoundError(PMIException):
    """Generic not found error"""
    pass

class DuplicateResourceError(PMIException):
    """Raised when trying to create a duplicate resource"""
    pass

class ValidationError(PMIException):
    """Raised when validation fails"""
    pass
```

### Step 2: Create Exception Handler

**File: PMI/backend/utils/exception_handlers.py** (NEW)

```python
from fastapi import Request, status
from fastapi.responses import JSONResponse
from exceptions import (
    PMIException,
    ProductNotFoundError,
    CategoryNotFoundError,
    ProductSKUExistsError,
    ValidationError,
)

# Map exceptions to HTTP status codes
EXCEPTION_STATUS_MAP = {
    ProductNotFoundError: status.HTTP_404_NOT_FOUND,
    CategoryNotFoundError: status.HTTP_404_NOT_FOUND,
    ProductSKUExistsError: status.HTTP_409_CONFLICT,
    ValidationError: status.HTTP_400_BAD_REQUEST,
}

async def pmi_exception_handler(request: Request, exc: PMIException):
    """Convert business exceptions to HTTP responses"""
    status_code = EXCEPTION_STATUS_MAP.get(
        type(exc), 
        status.HTTP_500_INTERNAL_SERVER_ERROR
    )
    
    return JSONResponse(
        status_code=status_code,
        content={
            "error": exc.code,
            "message": exc.message,
        }
    )
```

### Step 3: Register Handler in Main

**File: PMI/backend/main.py** (UPDATE)

```python
from exceptions import PMIException
from utils.exception_handlers import pmi_exception_handler

# Add exception handler
app.add_exception_handler(PMIException, pmi_exception_handler)
```

### Step 4: Update Services

**File: PMI/backend/services/product_service.py** (UPDATE)

```python
# Before
from fastapi import HTTPException

def get_product(self, product_id: int):
    product = self.db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

# After
from exceptions import ProductNotFoundError

def get_product(self, product_id: int):
    product = self.db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise ProductNotFoundError(f"Product with ID {product_id} not found")
    return product
```

### Step 5: Update All Service Methods

**Changes needed in product_service.py:**

| Line | Before | After |
|------|--------|-------|
| ~94 | `HTTPException(404, "Product not found")` | `ProductNotFoundError(...)` |
| ~143 | `HTTPException(400, "Invalid category")` | `CategoryNotFoundError(...)` |
| ~264 | `HTTPException(409, "SKU exists")` | `ProductSKUExistsError(...)` |

**Similar changes in:**
- `category_service.py`
- `channel_service.py`
- `attribute_service.py`

---

## Files Cần Tạo/Modify

### New Files
| File | Description |
|------|-------------|
| `PMI/backend/exceptions.py` | Business exception definitions |
| `PMI/backend/utils/exception_handlers.py` | FastAPI exception handlers |

### Modified Files
| File | Action |
|------|--------|
| `PMI/backend/main.py` | Register exception handler |
| `PMI/backend/services/product_service.py` | Use business exceptions |
| `PMI/backend/services/category_service.py` | Use business exceptions |
| `PMI/backend/services/channel_service.py` | Use business exceptions |
| `PMI/backend/services/attribute_service.py` | Use business exceptions |

---

## Verification

### Unit Tests

```python
# tests/unit/test_product_service.py

def test_get_product_not_found_raises_business_exception():
    service = ProductService(db)
    
    with pytest.raises(ProductNotFoundError) as exc_info:
        service.get_product(99999)
    
    assert "99999" in str(exc_info.value.message)

def test_create_product_duplicate_sku_raises_business_exception():
    service = ProductService(db)
    
    with pytest.raises(ProductSKUExistsError):
        service.create_product({"sku": "existing-sku", ...})
```

### Integration Tests

```python
# tests/integration/test_product_api.py

def test_get_product_not_found_returns_404():
    response = client.get("/api/v1/products/99999")
    
    assert response.status_code == 404
    assert response.json()["error"] == "ProductNotFoundError"
```

---

## Benefits After Implementation

1. **Reusability:** Services can be used from CLI tools
   ```python
   # scripts/import_products.py
   try:
       service.create_product(data)
   except ProductSKUExistsError:
       print(f"Skipping duplicate: {data['sku']}")
   ```

2. **Cleaner Tests:** Test business logic, not HTTP details
3. **Consistent Errors:** All errors follow same structure
4. **Type Safety:** IDE can help with exception types
