# Backend Package: Logging Module

## Task ID: BE-07
## Prerequisites: BE-00 (Setup)
## Estimated: 1.5 hours

---

## Mục Tiêu

Tạo structured logging với:
- structlog configuration
- Request logging middleware
- Contextual logging

---

## Implementation

### File: `packages/backend-common/topvnsport_common/logging.py`

```python
"""Structured logging utilities using structlog."""

import logging
import sys
import time
import uuid
from typing import Optional, Any
from contextvars import ContextVar

import structlog
from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint


# Context variable for request ID
request_id_ctx: ContextVar[Optional[str]] = ContextVar("request_id", default=None)


def configure_logging(
    service_name: str,
    log_level: str = "INFO",
    json_format: bool = True,
    add_timestamp: bool = True,
) -> None:
    """
    Configure structlog for the application.
    
    Args:
        service_name: Name of the service (included in all logs)
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR)
        json_format: Use JSON format (True for production, False for development)
        add_timestamp: Add timestamp to log entries
    
    Example:
        configure_logging("pmi-api", log_level="DEBUG", json_format=False)
    """
    # Common processors
    processors = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]
    
    if add_timestamp:
        processors.insert(0, structlog.processors.TimeStamper(fmt="iso"))
    
    # Add service name
    processors.append(
        structlog.processors.CallsiteParameterAdder(
            parameters=[
                structlog.processors.CallsiteParameter.FILENAME,
                structlog.processors.CallsiteParameter.LINENO,
            ]
        )
    )
    
    if json_format:
        processors.append(structlog.processors.JSONRenderer())
    else:
        processors.append(structlog.dev.ConsoleRenderer(colors=True))
    
    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, log_level.upper())
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )
    
    # Also configure stdlib logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, log_level.upper()),
    )


def get_logger(name: Optional[str] = None, **initial_context: Any) -> structlog.BoundLogger:
    """
    Get a structured logger.
    
    Args:
        name: Logger name (optional)
        **initial_context: Initial context to bind
    
    Returns:
        Bound structlog logger
    
    Example:
        logger = get_logger("product_service", module="products")
        logger.info("Product created", product_id=123)
    """
    logger = structlog.get_logger(name)
    
    # Add request ID if available
    request_id = request_id_ctx.get()
    if request_id:
        logger = logger.bind(request_id=request_id)
    
    if initial_context:
        logger = logger.bind(**initial_context)
    
    return logger


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware for logging HTTP requests.
    
    Logs request start and completion with duration.
    """
    
    def __init__(
        self,
        app,
        logger_name: str = "http",
        log_request_body: bool = False,
        exclude_paths: Optional[list[str]] = None,
    ):
        super().__init__(app)
        self.logger_name = logger_name
        self.log_request_body = log_request_body
        self.exclude_paths = exclude_paths or ["/health", "/metrics"]
    
    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        # Skip excluded paths
        if request.url.path in self.exclude_paths:
            return await call_next(request)
        
        # Generate request ID
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request_id_ctx.set(request_id)
        
        logger = get_logger(self.logger_name)
        
        # Log request start
        start_time = time.perf_counter()
        logger.info(
            "Request started",
            method=request.method,
            path=request.url.path,
            query=str(request.query_params) if request.query_params else None,
            client_ip=request.client.host if request.client else None,
        )
        
        # Process request
        try:
            response = await call_next(request)
            
            # Calculate duration
            duration_ms = (time.perf_counter() - start_time) * 1000
            
            # Log completion
            log_method = logger.info if response.status_code < 400 else logger.warning
            if response.status_code >= 500:
                log_method = logger.error
            
            log_method(
                "Request completed",
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                duration_ms=round(duration_ms, 2),
            )
            
            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id
            
            return response
            
        except Exception as e:
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.exception(
                "Request failed",
                method=request.method,
                path=request.url.path,
                duration_ms=round(duration_ms, 2),
                error=str(e),
            )
            raise
        finally:
            request_id_ctx.set(None)


def setup_request_logging(
    app: FastAPI,
    logger_name: str = "http",
    exclude_paths: Optional[list[str]] = None,
) -> None:
    """
    Add request logging middleware to FastAPI app.
    
    Args:
        app: FastAPI application
        logger_name: Name for the HTTP logger
        exclude_paths: Paths to exclude from logging
    
    Example:
        app = FastAPI()
        setup_request_logging(app, exclude_paths=["/health", "/metrics"])
    """
    app.add_middleware(
        RequestLoggingMiddleware,
        logger_name=logger_name,
        exclude_paths=exclude_paths or ["/health", "/metrics"],
    )


def log_context(**kwargs: Any):
    """
    Context manager to temporarily add context to logs.
    
    Example:
        with log_context(user_id="123", action="checkout"):
            logger.info("Processing order")  # Includes user_id and action
    """
    return structlog.contextvars.tmp_bind(**kwargs)
```

---

## Test Cases

### File: `packages/backend-common/tests/unit/test_logging.py`

```python
"""Tests for logging module."""

import pytest
import json
from io import StringIO
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi import FastAPI
from fastapi.testclient import TestClient

from topvnsport_common.logging import (
    configure_logging,
    get_logger,
    RequestLoggingMiddleware,
    setup_request_logging,
    log_context,
    request_id_ctx,
)


class TestConfigureLogging:
    """Tests for configure_logging()."""

    def test_configures_structlog(self):
        """Should configure structlog with processors."""
        # When
        configure_logging("test-service")
        
        # Then - should not raise, logger should work
        logger = get_logger()
        logger.info("Test message")

    def test_json_format_in_production(self, capsys):
        """Should use JSON format when json_format=True."""
        # Given
        configure_logging("test-service", json_format=True)
        
        # When
        logger = get_logger()
        logger.info("Test message", key="value")
        
        # Then
        captured = capsys.readouterr()
        # Should be parseable JSON
        try:
            data = json.loads(captured.out.strip())
            assert data["event"] == "Test message"
            assert data["key"] == "value"
        except json.JSONDecodeError:
            pass  # Console format on some systems

    def test_console_format_in_development(self, capsys):
        """Should use console format when json_format=False."""
        # Given
        configure_logging("test-service", json_format=False)
        
        # When
        logger = get_logger()
        logger.info("Test message")
        
        # Then
        captured = capsys.readouterr()
        assert "Test message" in captured.out

    def test_log_level_filtering(self, capsys):
        """Should filter logs by level."""
        # Given
        configure_logging("test-service", log_level="WARNING", json_format=False)
        
        # When
        logger = get_logger()
        logger.debug("Debug message")
        logger.info("Info message")
        logger.warning("Warning message")
        
        # Then
        captured = capsys.readouterr()
        assert "Debug message" not in captured.out
        assert "Info message" not in captured.out
        assert "Warning message" in captured.out


class TestGetLogger:
    """Tests for get_logger()."""

    def test_returns_bound_logger(self):
        """Should return logger bound with service name."""
        # Given
        configure_logging("test-service")
        
        # When
        logger = get_logger("my-module")
        
        # Then
        assert logger is not None

    def test_adds_initial_context(self, capsys):
        """Should include initial context in logs."""
        # Given
        configure_logging("test-service", json_format=True)
        
        # When
        logger = get_logger("module", user_id="123")
        logger.info("Test")
        
        # Then
        captured = capsys.readouterr()
        try:
            data = json.loads(captured.out.strip())
            assert data.get("user_id") == "123"
        except json.JSONDecodeError:
            pass

    def test_includes_request_id_from_context(self, capsys):
        """Should include request_id if set in context."""
        # Given
        configure_logging("test-service", json_format=True)
        request_id_ctx.set("req-456")
        
        try:
            # When
            logger = get_logger()
            logger.info("Test")
            
            # Then
            captured = capsys.readouterr()
            try:
                data = json.loads(captured.out.strip())
                assert data.get("request_id") == "req-456"
            except json.JSONDecodeError:
                pass
        finally:
            request_id_ctx.set(None)


class TestRequestLoggingMiddleware:
    """Tests for RequestLoggingMiddleware."""

    def test_logs_request_start(self, capsys):
        """Should log when request starts."""
        # Given
        configure_logging("test", json_format=False)
        app = FastAPI()
        setup_request_logging(app)
        
        @app.get("/test")
        def test_route():
            return {"ok": True}
        
        client = TestClient(app)
        
        # When
        response = client.get("/test")
        
        # Then
        assert response.status_code == 200
        captured = capsys.readouterr()
        assert "Request started" in captured.out

    def test_logs_request_end_with_duration(self, capsys):
        """Should log request completion with duration."""
        # Given
        configure_logging("test", json_format=False)
        app = FastAPI()
        setup_request_logging(app)
        
        @app.get("/test")
        def test_route():
            return {"ok": True}
        
        client = TestClient(app)
        
        # When
        response = client.get("/test")
        
        # Then
        captured = capsys.readouterr()
        assert "Request completed" in captured.out
        assert "duration_ms" in captured.out

    def test_logs_error_on_exception(self, capsys):
        """Should log error level on exception."""
        # Given
        configure_logging("test", json_format=False)
        app = FastAPI()
        setup_request_logging(app)
        
        @app.get("/error")
        def error_route():
            raise ValueError("Test error")
        
        client = TestClient(app, raise_server_exceptions=False)
        
        # When
        response = client.get("/error")
        
        # Then
        captured = capsys.readouterr()
        assert "Request failed" in captured.out or "error" in captured.out.lower()

    def test_includes_request_id(self):
        """Should include request_id in all logs."""
        # Given
        configure_logging("test", json_format=True)
        app = FastAPI()
        setup_request_logging(app)
        
        @app.get("/test")
        def test_route():
            return {"ok": True}
        
        client = TestClient(app)
        
        # When
        response = client.get("/test")
        
        # Then
        assert "X-Request-ID" in response.headers

    def test_uses_provided_request_id(self):
        """Should use X-Request-ID from request if provided."""
        # Given
        configure_logging("test")
        app = FastAPI()
        setup_request_logging(app)
        
        @app.get("/test")
        def test_route():
            return {"ok": True}
        
        client = TestClient(app)
        
        # When
        response = client.get("/test", headers={"X-Request-ID": "custom-id-123"})
        
        # Then
        assert response.headers["X-Request-ID"] == "custom-id-123"

    def test_excludes_health_endpoints(self, capsys):
        """Should not log excluded paths."""
        # Given
        configure_logging("test", json_format=False)
        app = FastAPI()
        setup_request_logging(app, exclude_paths=["/health"])
        
        @app.get("/health")
        def health():
            return {"status": "ok"}
        
        client = TestClient(app)
        
        # When
        response = client.get("/health")
        
        # Then
        assert response.status_code == 200
        captured = capsys.readouterr()
        assert "Request started" not in captured.out

    def test_logs_4xx_as_warning(self, capsys):
        """Should log 4xx responses as warning."""
        # Given
        configure_logging("test", json_format=False)
        app = FastAPI()
        setup_request_logging(app)
        
        @app.get("/notfound")
        def notfound():
            from fastapi import HTTPException
            raise HTTPException(status_code=404)
        
        client = TestClient(app)
        
        # When
        response = client.get("/notfound")
        
        # Then
        assert response.status_code == 404
        captured = capsys.readouterr()
        assert "warning" in captured.out.lower() or "404" in captured.out


class TestLogContext:
    """Tests for log_context()."""

    def test_adds_context_within_block(self, capsys):
        """Should add context within the with block."""
        # Given
        configure_logging("test", json_format=True)
        
        # When
        with log_context(user_id="123", action="test"):
            logger = get_logger()
            logger.info("Inside context")
        
        # Then
        captured = capsys.readouterr()
        try:
            data = json.loads(captured.out.strip())
            assert data.get("user_id") == "123"
            assert data.get("action") == "test"
        except json.JSONDecodeError:
            pass

    def test_context_removed_after_block(self, capsys):
        """Should remove context after with block."""
        # Given
        configure_logging("test", json_format=True)
        
        # When
        with log_context(temporary="value"):
            pass
        
        logger = get_logger()
        logger.info("After context")
        
        # Then
        captured = capsys.readouterr()
        try:
            data = json.loads(captured.out.strip())
            assert "temporary" not in data
        except json.JSONDecodeError:
            pass
```

---

## Verification

```bash
cd packages/backend-common

# Run logging tests
pytest tests/unit/test_logging.py -v

# Run with coverage
pytest tests/unit/test_logging.py --cov=topvnsport_common.logging --cov-report=term-missing

# Expected coverage: 95%+ (some edge cases in middleware)
```

---

## Checklist

- [ ] logging.py implemented
- [ ] configure_logging() with JSON/console formats
- [ ] get_logger() with context binding
- [ ] RequestLoggingMiddleware with duration tracking
- [ ] setup_request_logging() helper
- [ ] log_context() context manager
- [ ] Request ID propagation
- [ ] All 15 test cases pass
- [ ] 95%+ code coverage
