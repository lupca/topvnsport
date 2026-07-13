# Backend Package: Setup

## Task ID: BE-00
## Prerequisites: None
## Estimated: 1 hour

---

## Mục Tiêu

Tạo structure cho Python shared package `topvnsport-common`.

---

## Implementation

### 1. Tạo Directory Structure

```bash
mkdir -p packages/backend-common/topvnsport_common
mkdir -p packages/backend-common/tests/{unit,integration}
```

### 2. File: `packages/backend-common/pyproject.toml`

```toml
[project]
name = "topvnsport-common"
version = "1.0.0"
description = "Shared utilities for TopVNSport backend services"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.104.0",
    "sqlalchemy>=2.0.0",
    "pydantic>=2.0.0",
    "structlog>=23.2.0",
    "cryptography>=41.0.0",
    "python-jose[cryptography]>=3.3.0",
    "passlib[bcrypt]>=1.7.4",
    "phonenumbers>=8.13.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.4.0",
    "pytest-asyncio>=0.21.0",
    "pytest-cov>=4.1.0",
    "httpx>=0.25.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"

[tool.coverage.run]
source = ["topvnsport_common"]
branch = true

[tool.coverage.report]
fail_under = 90
```

### 3. File: `packages/backend-common/topvnsport_common/__init__.py`

```python
"""TopVNSport Common - Shared utilities for backend services."""

__version__ = "1.0.0"

from .database import (
    create_db_engine,
    create_session_factory,
    get_db_session,
    get_db_dependency,
    Base,
)
from .pagination import paginate, PaginatedResponse
from .exceptions import (
    AppException,
    NotFoundError,
    ValidationError,
    ConflictError,
    UnauthorizedError,
    ForbiddenError,
    register_exception_handlers,
)

__all__ = [
    # Database
    "create_db_engine",
    "create_session_factory", 
    "get_db_session",
    "get_db_dependency",
    "Base",
    # Pagination
    "paginate",
    "PaginatedResponse",
    # Exceptions
    "AppException",
    "NotFoundError",
    "ValidationError",
    "ConflictError",
    "UnauthorizedError",
    "ForbiddenError",
    "register_exception_handlers",
]
```

### 4. File: `packages/backend-common/tests/__init__.py`

```python
"""Test package for topvnsport-common."""
```

### 5. File: `packages/backend-common/tests/conftest.py`

```python
"""Shared test fixtures."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from topvnsport_common.database import Base


@pytest.fixture
def in_memory_engine():
    """Create in-memory SQLite engine for testing."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)


@pytest.fixture
def session_factory(in_memory_engine):
    """Create session factory for testing."""
    return sessionmaker(autocommit=False, autoflush=False, bind=in_memory_engine)


@pytest.fixture
def db_session(session_factory):
    """Create database session for testing."""
    session = session_factory()
    yield session
    session.rollback()
    session.close()
```

### 6. File: `packages/backend-common/README.md`

```markdown
# topvnsport-common

Shared utilities for TopVNSport backend services.

## Installation

```bash
# Development (editable install)
pip install -e packages/backend-common

# Or add to requirements.txt
-e ../packages/backend-common
```

## Modules

- `database` - SQLAlchemy engine, session management, FastAPI dependency
- `pagination` - Query pagination with standard response format
- `exceptions` - Consistent error handling across services
- `auth` - JWT token creation and verification
- `crypto` - Encryption/decryption utilities
- `phone` - Phone number normalization and validation
- `logging` - Structured logging with structlog

## Usage

```python
from topvnsport_common import (
    create_db_engine,
    create_session_factory,
    get_db_dependency,
    paginate,
    NotFoundError,
    register_exception_handlers,
)

# Database setup
engine = create_db_engine()
SessionLocal = create_session_factory(engine)
get_db = get_db_dependency(SessionLocal)

# FastAPI app
app = FastAPI()
register_exception_handlers(app)

@app.get("/items/{item_id}")
def get_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(Item).get(item_id)
    if not item:
        raise NotFoundError("Item", item_id)
    return item
```

## Testing

```bash
cd packages/backend-common
pip install -e ".[dev]"
pytest
pytest --cov  # with coverage
```
```

---

## Test Cases

### File: `packages/backend-common/tests/test_package.py`

```python
"""Tests for package setup and imports."""

import pytest


class TestPackageImports:
    """Test all modules are importable."""

    def test_import_package(self):
        """Should import main package."""
        import topvnsport_common
        assert topvnsport_common.__version__ == "1.0.0"

    def test_import_database(self):
        """Should import database module."""
        from topvnsport_common import (
            create_db_engine,
            create_session_factory,
            get_db_session,
            get_db_dependency,
            Base,
        )
        assert callable(create_db_engine)
        assert callable(create_session_factory)

    def test_import_pagination(self):
        """Should import pagination module."""
        from topvnsport_common import paginate, PaginatedResponse
        assert callable(paginate)

    def test_import_exceptions(self):
        """Should import exceptions module."""
        from topvnsport_common import (
            AppException,
            NotFoundError,
            ValidationError,
            ConflictError,
            UnauthorizedError,
            ForbiddenError,
            register_exception_handlers,
        )
        assert issubclass(NotFoundError, AppException)


class TestPackageMetadata:
    """Test package metadata."""

    def test_version_format(self):
        """Version should be semantic versioning format."""
        import topvnsport_common
        parts = topvnsport_common.__version__.split(".")
        assert len(parts) == 3
        assert all(part.isdigit() for part in parts)
```

---

## Verification

```bash
# Install package in development mode
cd packages/backend-common
pip install -e ".[dev]"

# Run setup tests
pytest tests/test_package.py -v

# Verify imports work
python -c "from topvnsport_common import paginate; print('OK')"
```

---

## Checklist

- [ ] Directory structure created
- [ ] pyproject.toml configured
- [ ] __init__.py with all exports
- [ ] conftest.py with shared fixtures
- [ ] README.md written
- [ ] test_package.py passes
- [ ] Package installable with pip install -e
