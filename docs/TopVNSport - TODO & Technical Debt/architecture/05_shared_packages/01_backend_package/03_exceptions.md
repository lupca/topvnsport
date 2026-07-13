# Backend Package: Exceptions Module

## Task ID: BE-03
## Prerequisites: BE-00 (Setup)
## Estimated: 1.5 hours

---

## Mục Tiêu

Tạo consistent exception handling với:
- Base exception class
- Common HTTP error types
- FastAPI exception handler integration

---

## Implementation

### File: `packages/backend-common/topvnsport_common/exceptions.py`

```python
"""Exception classes and handlers for FastAPI applications."""

from typing import Any
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppException(Exception):
    """
    Base application exception.
    
    All custom exceptions should inherit from this class.
    
    Attributes:
        message: Human-readable error message
        code: Machine-readable error code
        status_code: HTTP status code
        details: Optional additional error details
    """
    
    def __init__(
        self,
        message: str,
        code: str | None = None,
        status_code: int = 400,
        details: dict[str, Any] | None = None,
    ):
        self.message = message
        self.code = code or self.__class__.__name__.upper()
        self.status_code = status_code
        self.details = details
        super().__init__(self.message)

    def to_dict(self) -> dict[str, Any]:
        """Convert exception to dictionary for JSON response."""
        result = {
            "error": self.code,
            "message": self.message,
        }
        if self.details:
            result["details"] = self.details
        return result


class NotFoundError(AppException):
    """Resource not found (404)."""
    
    def __init__(self, resource: str, identifier: Any):
        super().__init__(
            message=f"{resource} with id '{identifier}' not found",
            code="NOT_FOUND",
            status_code=404,
        )
        self.resource = resource
        self.identifier = identifier


class ValidationError(AppException):
    """Validation error (400)."""
    
    def __init__(self, message: str, field: str | None = None):
        details = {"field": field} if field else None
        super().__init__(
            message=message,
            code="VALIDATION_ERROR",
            status_code=400,
            details=details,
        )
        self.field = field


class ConflictError(AppException):
    """Resource conflict (409)."""
    
    def __init__(self, message: str):
        super().__init__(
            message=message,
            code="CONFLICT",
            status_code=409,
        )


class UnauthorizedError(AppException):
    """Unauthorized access (401)."""
    
    def __init__(self, message: str = "Unauthorized"):
        super().__init__(
            message=message,
            code="UNAUTHORIZED",
            status_code=401,
        )


class ForbiddenError(AppException):
    """Forbidden access (403)."""
    
    def __init__(self, message: str = "Forbidden"):
        super().__init__(
            message=message,
            code="FORBIDDEN",
            status_code=403,
        )


class BadRequestError(AppException):
    """Bad request (400)."""
    
    def __init__(self, message: str):
        super().__init__(
            message=message,
            code="BAD_REQUEST",
            status_code=400,
        )


class ServiceUnavailableError(AppException):
    """Service unavailable (503)."""
    
    def __init__(self, message: str = "Service temporarily unavailable"):
        super().__init__(
            message=message,
            code="SERVICE_UNAVAILABLE",
            status_code=503,
        )


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """
    FastAPI exception handler for AppException.
    
    Returns JSON response with error details.
    """
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict(),
    )


def register_exception_handlers(app: FastAPI) -> None:
    """
    Register exception handlers with FastAPI app.
    
    Call this during app initialization:
    
        app = FastAPI()
        register_exception_handlers(app)
    """
    app.add_exception_handler(AppException, app_exception_handler)
```

---

## Test Cases

### File: `packages/backend-common/tests/unit/test_exceptions.py`

```python
"""Tests for exceptions module."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from topvnsport_common.exceptions import (
    AppException,
    NotFoundError,
    ValidationError,
    ConflictError,
    UnauthorizedError,
    ForbiddenError,
    BadRequestError,
    ServiceUnavailableError,
    app_exception_handler,
    register_exception_handlers,
)


class TestAppException:
    """Tests for base AppException."""

    def test_exception_with_all_params(self):
        """Should store message, code, and status_code."""
        # Given/When
        exc = AppException(
            message="Something went wrong",
            code="CUSTOM_ERROR",
            status_code=500,
            details={"key": "value"},
        )
        
        # Then
        assert exc.message == "Something went wrong"
        assert exc.code == "CUSTOM_ERROR"
        assert exc.status_code == 500
        assert exc.details == {"key": "value"}

    def test_default_code_is_class_name(self):
        """Should use class name as default code."""
        # Given/When
        exc = AppException(message="Error")
        
        # Then
        assert exc.code == "APPEXCEPTION"

    def test_default_status_code_is_400(self):
        """Should default to 400 status code."""
        # Given/When
        exc = AppException(message="Error")
        
        # Then
        assert exc.status_code == 400

    def test_to_dict_basic(self):
        """Should convert to dict with error and message."""
        # Given
        exc = AppException(message="Error", code="TEST")
        
        # When
        result = exc.to_dict()
        
        # Then
        assert result == {"error": "TEST", "message": "Error"}

    def test_to_dict_with_details(self):
        """Should include details in dict."""
        # Given
        exc = AppException(
            message="Error",
            code="TEST",
            details={"field": "email"},
        )
        
        # When
        result = exc.to_dict()
        
        # Then
        assert result["details"] == {"field": "email"}

    def test_exception_is_raisable(self):
        """Should be raisable and catchable."""
        # When/Then
        with pytest.raises(AppException) as exc_info:
            raise AppException("Test error")
        
        assert str(exc_info.value) == "Test error"


class TestNotFoundError:
    """Tests for NotFoundError."""

    def test_formats_message_with_resource_and_id(self):
        """Should format message with resource and identifier."""
        # Given/When
        exc = NotFoundError(resource="Product", identifier="123")
        
        # Then
        assert exc.message == "Product with id '123' not found"
        assert exc.resource == "Product"
        assert exc.identifier == "123"

    def test_status_code_is_404(self):
        """Should have status_code=404."""
        exc = NotFoundError("Item", 1)
        assert exc.status_code == 404

    def test_code_is_not_found(self):
        """Should have code='NOT_FOUND'."""
        exc = NotFoundError("Item", 1)
        assert exc.code == "NOT_FOUND"

    def test_accepts_various_id_types(self):
        """Should accept string, int, UUID identifiers."""
        # String
        exc1 = NotFoundError("User", "abc-123")
        assert "abc-123" in exc1.message
        
        # Integer
        exc2 = NotFoundError("Order", 42)
        assert "42" in exc2.message


class TestValidationError:
    """Tests for ValidationError."""

    def test_custom_message(self):
        """Should accept custom validation message."""
        exc = ValidationError("Email format is invalid")
        assert exc.message == "Email format is invalid"

    def test_status_code_is_400(self):
        """Should have status_code=400."""
        exc = ValidationError("Invalid")
        assert exc.status_code == 400

    def test_code_is_validation_error(self):
        """Should have code='VALIDATION_ERROR'."""
        exc = ValidationError("Invalid")
        assert exc.code == "VALIDATION_ERROR"

    def test_field_in_details(self):
        """Should include field in details."""
        exc = ValidationError("Invalid email", field="email")
        assert exc.field == "email"
        assert exc.details == {"field": "email"}

    def test_no_field_no_details(self):
        """Should have no details when field not provided."""
        exc = ValidationError("Invalid input")
        assert exc.details is None


class TestConflictError:
    """Tests for ConflictError."""

    def test_status_code_is_409(self):
        """Should have status_code=409."""
        exc = ConflictError("Resource already exists")
        assert exc.status_code == 409

    def test_code_is_conflict(self):
        """Should have code='CONFLICT'."""
        exc = ConflictError("Duplicate")
        assert exc.code == "CONFLICT"


class TestUnauthorizedError:
    """Tests for UnauthorizedError."""

    def test_default_message(self):
        """Should default message to 'Unauthorized'."""
        exc = UnauthorizedError()
        assert exc.message == "Unauthorized"

    def test_custom_message(self):
        """Should accept custom message."""
        exc = UnauthorizedError("Invalid token")
        assert exc.message == "Invalid token"

    def test_status_code_is_401(self):
        """Should have status_code=401."""
        exc = UnauthorizedError()
        assert exc.status_code == 401

    def test_code_is_unauthorized(self):
        """Should have code='UNAUTHORIZED'."""
        exc = UnauthorizedError()
        assert exc.code == "UNAUTHORIZED"


class TestForbiddenError:
    """Tests for ForbiddenError."""

    def test_default_message(self):
        """Should default message to 'Forbidden'."""
        exc = ForbiddenError()
        assert exc.message == "Forbidden"

    def test_custom_message(self):
        """Should accept custom message."""
        exc = ForbiddenError("Admin access required")
        assert exc.message == "Admin access required"

    def test_status_code_is_403(self):
        """Should have status_code=403."""
        exc = ForbiddenError()
        assert exc.status_code == 403

    def test_code_is_forbidden(self):
        """Should have code='FORBIDDEN'."""
        exc = ForbiddenError()
        assert exc.code == "FORBIDDEN"


class TestBadRequestError:
    """Tests for BadRequestError."""

    def test_status_code_is_400(self):
        """Should have status_code=400."""
        exc = BadRequestError("Invalid parameters")
        assert exc.status_code == 400

    def test_code_is_bad_request(self):
        """Should have code='BAD_REQUEST'."""
        exc = BadRequestError("Bad")
        assert exc.code == "BAD_REQUEST"


class TestServiceUnavailableError:
    """Tests for ServiceUnavailableError."""

    def test_default_message(self):
        """Should have default message."""
        exc = ServiceUnavailableError()
        assert exc.message == "Service temporarily unavailable"

    def test_status_code_is_503(self):
        """Should have status_code=503."""
        exc = ServiceUnavailableError()
        assert exc.status_code == 503


class TestAppExceptionHandler:
    """Tests for app_exception_handler()."""

    @pytest.mark.asyncio
    async def test_returns_json_response(self):
        """Should return JSONResponse with error details."""
        # Given
        from unittest.mock import MagicMock
        request = MagicMock()
        exc = AppException(message="Test error", code="TEST", status_code=400)
        
        # When
        response = await app_exception_handler(request, exc)
        
        # Then
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_response_body_format(self):
        """Should format response body correctly."""
        # Given
        from unittest.mock import MagicMock
        import json
        
        request = MagicMock()
        exc = AppException(message="Test", code="TEST_CODE", status_code=400)
        
        # When
        response = await app_exception_handler(request, exc)
        body = json.loads(response.body)
        
        # Then
        assert body == {"error": "TEST_CODE", "message": "Test"}


class TestRegisterExceptionHandlers:
    """Tests for register_exception_handlers()."""

    def test_registers_appexception_handler(self):
        """Should register handler for AppException."""
        # Given
        app = FastAPI()
        
        # When
        register_exception_handlers(app)
        
        # Then
        assert AppException in app.exception_handlers

    def test_integration_appexception_in_route(self):
        """Should handle AppException raised in routes."""
        # Given
        app = FastAPI()
        register_exception_handlers(app)
        
        @app.get("/test")
        def test_route():
            raise NotFoundError("Product", 123)
        
        client = TestClient(app)
        
        # When
        response = client.get("/test")
        
        # Then
        assert response.status_code == 404
        assert response.json() == {
            "error": "NOT_FOUND",
            "message": "Product with id '123' not found",
        }

    def test_subclass_exceptions_handled(self):
        """Should handle all AppException subclasses."""
        # Given
        app = FastAPI()
        register_exception_handlers(app)
        
        @app.get("/validation")
        def validation_route():
            raise ValidationError("Invalid email", field="email")
        
        @app.get("/unauthorized")
        def unauthorized_route():
            raise UnauthorizedError()
        
        @app.get("/forbidden")
        def forbidden_route():
            raise ForbiddenError()
        
        @app.get("/conflict")
        def conflict_route():
            raise ConflictError("Already exists")
        
        client = TestClient(app)
        
        # When/Then - ValidationError
        response = client.get("/validation")
        assert response.status_code == 400
        assert response.json()["error"] == "VALIDATION_ERROR"
        assert response.json()["details"] == {"field": "email"}
        
        # When/Then - UnauthorizedError
        response = client.get("/unauthorized")
        assert response.status_code == 401
        
        # When/Then - ForbiddenError
        response = client.get("/forbidden")
        assert response.status_code == 403
        
        # When/Then - ConflictError
        response = client.get("/conflict")
        assert response.status_code == 409

    def test_non_app_exceptions_not_affected(self):
        """Should not affect non-AppException errors."""
        # Given
        app = FastAPI()
        register_exception_handlers(app)
        
        @app.get("/error")
        def error_route():
            raise ValueError("Standard error")
        
        client = TestClient(app)
        
        # When
        response = client.get("/error")
        
        # Then - Should be 500 Internal Server Error (FastAPI default)
        assert response.status_code == 500
```

---

## Verification

```bash
cd packages/backend-common

# Run exception tests
pytest tests/unit/test_exceptions.py -v

# Run with coverage
pytest tests/unit/test_exceptions.py --cov=topvnsport_common.exceptions --cov-report=term-missing

# Expected coverage: 100%
```

---

## Checklist

- [ ] exceptions.py implemented
- [ ] AppException base class with to_dict()
- [ ] NotFoundError (404)
- [ ] ValidationError (400) with field support
- [ ] ConflictError (409)
- [ ] UnauthorizedError (401)
- [ ] ForbiddenError (403)
- [ ] BadRequestError (400)
- [ ] ServiceUnavailableError (503)
- [ ] FastAPI handler and registration
- [ ] All 32 test cases pass
- [ ] 100% code coverage
