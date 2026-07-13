# Workspace Configuration: Python Packages

## Task ID: WS-02
## Prerequisites: BE-00 (Backend Setup)
## Estimated: 1 hour

---

## Mục Tiêu

Cấu hình Python packages cho 2 môi trường:
1. **Non-Docker development** (IDE, pytest trực tiếp) - dùng editable install
2. **Docker development/production** - dùng COPY trong Dockerfile

> **Note:** Phần lớn thời gian sẽ dùng Docker. Editable install chỉ cần khi chạy Python trực tiếp trên host.

---

## Implementation

### 1. File: `pyproject.toml` (root)

```toml
[project]
name = "topvnsport"
version = "1.0.0"
description = "TopVNSport Monorepo"
requires-python = ">=3.11"

[tool.setuptools]
packages = []

[tool.pytest.ini_options]
testpaths = ["packages/backend-common/tests"]
python_files = ["test_*.py"]
python_functions = ["test_*"]
asyncio_mode = "auto"

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I", "UP"]
ignore = ["E501"]
```

### 2. requirements.txt - KHÔNG thêm -e path

```txt
# PMI/backend/requirements.txt

# Dependencies bình thường
fastapi>=0.104.0
sqlalchemy>=2.0.0
pydantic>=2.0.0
# ... other deps

# KHÔNG thêm dòng này vì không work trong Docker:
# -e ../../packages/backend-common  ❌

# topvnsport-common được install qua Dockerfile
```

### 3. Dockerfile - COPY packages vào image

```dockerfile
# PMI/backend/Dockerfile

FROM python:3.11-slim

WORKDIR /app

# 1. Copy shared package TRƯỚC (better layer caching)
COPY packages/backend-common /app/packages/backend-common

# 2. Install shared package (KHÔNG dùng -e trong Docker)
RUN pip install --no-cache-dir /app/packages/backend-common

# 3. Copy service requirements và install
COPY PMI/backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# 4. Copy service code
COPY PMI/backend /app

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 4. docker-compose.yml - Root context + volumes

```yaml
# PMI/docker-compose.yml

version: '3.8'

services:
  api:
    build:
      context: ..                    # Root để access packages/
      dockerfile: PMI/backend/Dockerfile
    volumes:
      # Hot reload trong development
      - ./backend:/app
      - ../packages/backend-common:/app/packages/backend-common
```

### 5. (Optional) Non-Docker Development

Chỉ cần khi chạy pytest hoặc Python trực tiếp trên host (không qua Docker):

```bash
# Install shared package (editable mode)
cd packages/backend-common
pip install -e ".[dev]"

# Sau đó có thể chạy pytest trực tiếp
cd PMI/backend
pytest tests/ -v
```

---

## Test Cases

### File: `tests/workspace/test_python_packages.sh`

```bash
#!/bin/bash
set -e

echo "=== Test: Python package configuration ==="

# Test 1: Package has pyproject.toml
echo "Test 1: backend-common has pyproject.toml"
test -f packages/backend-common/pyproject.toml && echo "PASS" || (echo "FAIL" && exit 1)

# Test 2: Package is installable (local, non-Docker)
echo "Test 2: Package installs successfully"
cd packages/backend-common
pip install -e ".[dev]" && echo "PASS" || (echo "FAIL" && exit 1)
cd ../..

# Test 3: Import works
echo "Test 3: Package is importable"
python -c "from topvnsport_common import paginate; print('PASS')" || (echo "FAIL" && exit 1)

# Test 4: All modules importable
echo "Test 4: All modules importable"
python -c "
from topvnsport_common.database import create_db_engine
from topvnsport_common.pagination import paginate
from topvnsport_common.exceptions import NotFoundError
from topvnsport_common.crypto import hash_password
from topvnsport_common.phone import normalize_phone
from topvnsport_common.auth import create_access_token
from topvnsport_common.logging import get_logger
print('PASS')
" || (echo "FAIL" && exit 1)

# Test 5: Run package tests
echo "Test 5: Package tests pass"
cd packages/backend-common
pytest tests/ -v && echo "PASS" || (echo "FAIL" && exit 1)
cd ../..

echo "=== All Python package tests passed ==="
```

### File: `tests/workspace/test_docker_python.sh`

```bash
#!/bin/bash
set -e

echo "=== Test: Python packages trong Docker ==="

# Test 1: PMI Docker build thành công
echo "Test 1: PMI API Docker build"
docker compose -f PMI/docker-compose.yml build api && echo "PASS" || (echo "FAIL" && exit 1)

# Test 2: Import shared package trong container
echo "Test 2: Import trong container"
docker compose -f PMI/docker-compose.yml run --rm api \
    python -c "from topvnsport_common import paginate; print('PASS')" || (echo "FAIL" && exit 1)

# Test 3: Tất cả modules importable
echo "Test 3: All modules importable trong Docker"
docker compose -f PMI/docker-compose.yml run --rm api python -c "
from topvnsport_common.database import create_db_engine
from topvnsport_common.pagination import paginate
from topvnsport_common.exceptions import NotFoundError
from topvnsport_common.crypto import hash_password
from topvnsport_common.phone import normalize_phone
from topvnsport_common.auth import create_access_token
from topvnsport_common.logging import get_logger
print('PASS')
" || (echo "FAIL" && exit 1)

# Test 4: Run tests trong Docker
echo "Test 4: Run pytest trong Docker"
docker compose -f PMI/docker-compose.yml run --rm api \
    pytest tests/unit/ -v && echo "PASS" || (echo "FAIL" && exit 1)

echo "=== All Docker Python tests passed ==="
```

### Integration Test

```python
# packages/backend-common/tests/integration/test_package_integration.py

import pytest

class TestPackageImports:
    """Verify all modules are importable."""
    
    def test_import_database(self):
        from topvnsport_common.database import (
            create_db_engine,
            create_session_factory,
            get_db_session,
            get_db_dependency,
            Base,
        )
        assert callable(create_db_engine)

    def test_import_pagination(self):
        from topvnsport_common.pagination import paginate, PaginatedResponse
        assert callable(paginate)

    def test_import_exceptions(self):
        from topvnsport_common.exceptions import (
            AppException,
            NotFoundError,
            ValidationError,
            ConflictError,
            UnauthorizedError,
            ForbiddenError,
            register_exception_handlers,
        )
        assert issubclass(NotFoundError, AppException)

    def test_import_crypto(self):
        from topvnsport_common.crypto import (
            encrypt,
            decrypt,
            hash_password,
            verify_password,
            generate_secret,
        )
        assert callable(hash_password)

    def test_import_phone(self):
        from topvnsport_common.phone import (
            normalize_phone,
            validate_phone,
            format_phone,
            get_carrier,
        )
        assert callable(normalize_phone)

    def test_import_auth(self):
        from topvnsport_common.auth import (
            TokenConfig,
            create_access_token,
            create_refresh_token,
            verify_token,
            get_current_user_dependency,
        )
        assert callable(create_access_token)

    def test_import_logging(self):
        from topvnsport_common.logging import (
            configure_logging,
            get_logger,
            setup_request_logging,
        )
        assert callable(get_logger)


class TestCrossModuleIntegration:
    """Test modules work together."""

    def test_database_with_exceptions(self):
        """Database operations raise proper exceptions."""
        from topvnsport_common.database import create_db_engine
        from topvnsport_common.exceptions import AppException
        
        # Should raise ValueError (not AppException) for missing URL
        with pytest.raises(ValueError):
            create_db_engine()

    def test_auth_with_exceptions(self):
        """Auth operations raise UnauthorizedError."""
        from topvnsport_common.auth import verify_token, TokenConfig
        from topvnsport_common.exceptions import UnauthorizedError
        
        config = TokenConfig(secret_key="test-secret")
        
        with pytest.raises(UnauthorizedError):
            verify_token("invalid-token", config)

    def test_crypto_password_flow(self):
        """Hash and verify password flow."""
        from topvnsport_common.crypto import hash_password, verify_password
        
        password = "test-password-123"
        hashed = hash_password(password)
        
        assert verify_password(password, hashed)
        assert not verify_password("wrong-password", hashed)

    def test_phone_normalize_validate_flow(self):
        """Normalize and validate phone flow."""
        from topvnsport_common.phone import normalize_phone, validate_phone
        
        raw = "+84 912 345 678"
        normalized = normalize_phone(raw)
        
        assert normalized == "84912345678"
        assert validate_phone(normalized)
```

---

## Verification

```bash
# 1. Test package trực tiếp (non-Docker, optional)
cd packages/backend-common
pip install -e ".[dev]"
pytest tests/ -v

# 2. Test Docker build (primary method)
chmod +x tests/workspace/test_docker_python.sh
./tests/workspace/test_docker_python.sh

# 3. Start services và verify
docker compose -f PMI/docker-compose.yml up -d
curl http://localhost:18100/health
```

---

## Checklist

- [ ] Root pyproject.toml created
- [ ] backend-common pyproject.toml complete
- [ ] PMI/backend/Dockerfile copies packages/ trước
- [ ] OMS/backend/Dockerfile copies packages/ trước
- [ ] WMS/backend/Dockerfile copies packages/ trước
- [ ] docker-compose.yml dùng context: ..
- [ ] requirements.txt KHÔNG có -e paths
- [ ] Docker build thành công
- [ ] Import trong container hoạt động
- [ ] Hot reload với volumes hoạt động
- [ ] Package tests pass (trong Docker)
