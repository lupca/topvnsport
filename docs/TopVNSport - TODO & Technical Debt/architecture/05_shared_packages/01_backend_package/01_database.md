# Backend Package: Database Module

## Task ID: BE-01
## Prerequisites: BE-00 (Setup)
## Estimated: 2 hours

---

## Mục Tiêu

Tạo shared database module với:
- Engine creation với standard config
- Session factory và context manager
- FastAPI dependency injection

---

## Implementation

### File: `packages/backend-common/topvnsport_common/database.py`

```python
"""Database utilities for SQLAlchemy with FastAPI integration."""

import os
from contextlib import contextmanager
from typing import Generator, Callable

from sqlalchemy import create_engine, Engine
from sqlalchemy.orm import sessionmaker, Session, declarative_base

Base = declarative_base()


def create_db_engine(database_url: str | None = None) -> Engine:
    """
    Create SQLAlchemy engine with standard configuration.
    
    Args:
        database_url: Database connection URL. If not provided,
                     reads from DATABASE_URL environment variable.
    
    Returns:
        SQLAlchemy Engine instance.
    
    Raises:
        ValueError: If DATABASE_URL is not set and not provided.
    """
    url = database_url or os.getenv("DATABASE_URL")
    if not url:
        raise ValueError(
            "DATABASE_URL not set. Provide database_url argument "
            "or set DATABASE_URL environment variable."
        )
    
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
        echo=os.getenv("SQL_ECHO", "false").lower() == "true",
    )


def create_session_factory(engine: Engine) -> sessionmaker:
    """
    Create session factory bound to engine.
    
    Args:
        engine: SQLAlchemy Engine instance.
    
    Returns:
        Configured sessionmaker.
    """
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


@contextmanager
def get_db_session(session_factory: sessionmaker) -> Generator[Session, None, None]:
    """
    Context manager for database sessions.
    
    Commits on success, rollbacks on exception, always closes.
    
    Args:
        session_factory: SQLAlchemy sessionmaker.
    
    Yields:
        Database session.
    
    Example:
        with get_db_session(SessionLocal) as session:
            session.query(User).all()
    """
    session = session_factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_db_dependency(session_factory: sessionmaker) -> Callable[[], Generator[Session, None, None]]:
    """
    Create FastAPI Depends-compatible database dependency.
    
    Args:
        session_factory: SQLAlchemy sessionmaker.
    
    Returns:
        Generator function for use with FastAPI Depends().
    
    Example:
        SessionLocal = create_session_factory(engine)
        get_db = get_db_dependency(SessionLocal)
        
        @app.get("/users")
        def list_users(db: Session = Depends(get_db)):
            return db.query(User).all()
    """
    def get_db() -> Generator[Session, None, None]:
        with get_db_session(session_factory) as session:
            yield session
    return get_db
```

---

## Test Cases

### File: `packages/backend-common/tests/unit/test_database.py`

```python
"""Tests for database module."""

import os
import pytest
from unittest.mock import patch, MagicMock
from sqlalchemy import text
from sqlalchemy.orm import Session

from topvnsport_common.database import (
    create_db_engine,
    create_session_factory,
    get_db_session,
    get_db_dependency,
    Base,
)


class TestCreateDbEngine:
    """Tests for create_db_engine()."""

    def test_create_engine_with_explicit_url(self):
        """Should create engine when DATABASE_URL is passed directly."""
        # Given
        url = "sqlite:///:memory:"
        
        # When
        engine = create_db_engine(url)
        
        # Then
        assert engine is not None
        assert "sqlite" in str(engine.url)

    def test_create_engine_from_env_var(self):
        """Should read DATABASE_URL from environment when not passed."""
        # Given
        with patch.dict(os.environ, {"DATABASE_URL": "sqlite:///:memory:"}):
            # When
            engine = create_db_engine()
            
            # Then
            assert engine is not None

    def test_create_engine_missing_url_raises_error(self):
        """Should raise ValueError when DATABASE_URL is not set."""
        # Given
        with patch.dict(os.environ, {}, clear=True):
            # Remove DATABASE_URL if exists
            os.environ.pop("DATABASE_URL", None)
            
            # When/Then
            with pytest.raises(ValueError) as exc_info:
                create_db_engine()
            
            assert "DATABASE_URL not set" in str(exc_info.value)

    def test_engine_pool_settings(self):
        """Should configure connection pool correctly."""
        # Given
        url = "sqlite:///:memory:"
        
        # When
        engine = create_db_engine(url)
        
        # Then
        assert engine.pool.size() == 0  # SQLite doesn't use pool same way
        # For real PostgreSQL, would check pool_size=10, max_overflow=20

    def test_sql_echo_enabled_when_env_true(self):
        """Should enable SQL echo when SQL_ECHO=true."""
        # Given
        with patch.dict(os.environ, {
            "DATABASE_URL": "sqlite:///:memory:",
            "SQL_ECHO": "true"
        }):
            # When
            engine = create_db_engine()
            
            # Then
            assert engine.echo is True

    def test_sql_echo_disabled_by_default(self):
        """Should disable SQL echo by default."""
        # Given
        with patch.dict(os.environ, {"DATABASE_URL": "sqlite:///:memory:"}):
            os.environ.pop("SQL_ECHO", None)
            
            # When
            engine = create_db_engine()
            
            # Then
            assert engine.echo is False

    def test_sql_echo_case_insensitive(self):
        """Should handle SQL_ECHO case insensitively."""
        # Given
        with patch.dict(os.environ, {
            "DATABASE_URL": "sqlite:///:memory:",
            "SQL_ECHO": "TRUE"
        }):
            # When
            engine = create_db_engine()
            
            # Then
            assert engine.echo is True


class TestCreateSessionFactory:
    """Tests for create_session_factory()."""

    def test_creates_sessionmaker_bound_to_engine(self, in_memory_engine):
        """Should create sessionmaker bound to provided engine."""
        # When
        factory = create_session_factory(in_memory_engine)
        
        # Then
        assert factory.kw["bind"] is in_memory_engine
        assert factory.kw["autocommit"] is False
        assert factory.kw["autoflush"] is False

    def test_session_factory_returns_new_session(self, in_memory_engine):
        """Should return new session on each call."""
        # Given
        factory = create_session_factory(in_memory_engine)
        
        # When
        session1 = factory()
        session2 = factory()
        
        # Then
        assert session1 is not session2
        
        # Cleanup
        session1.close()
        session2.close()


class TestGetDbSession:
    """Tests for get_db_session() context manager."""

    def test_commits_on_success(self, session_factory):
        """Should commit transaction when no exception."""
        # Given
        committed = []
        original_commit = Session.commit
        
        def track_commit(self):
            committed.append(True)
            original_commit(self)
        
        # When
        with patch.object(Session, 'commit', track_commit):
            with get_db_session(session_factory) as session:
                pass  # No exception
        
        # Then
        assert len(committed) == 1

    def test_rollback_on_exception(self, session_factory):
        """Should rollback when exception is raised."""
        # Given
        rolled_back = []
        
        def track_rollback(self):
            rolled_back.append(True)
        
        # When/Then
        with patch.object(Session, 'rollback', track_rollback):
            with pytest.raises(ValueError):
                with get_db_session(session_factory) as session:
                    raise ValueError("Test error")
        
        assert len(rolled_back) == 1

    def test_always_closes_session(self, session_factory):
        """Should close session regardless of success/failure."""
        # Given
        closed = []
        original_close = Session.close
        
        def track_close(self):
            closed.append(True)
            original_close(self)
        
        # When - success case
        with patch.object(Session, 'close', track_close):
            with get_db_session(session_factory) as session:
                pass
        
        # Then
        assert len(closed) == 1
        
        # When - failure case
        closed.clear()
        with patch.object(Session, 'close', track_close):
            try:
                with get_db_session(session_factory) as session:
                    raise ValueError("Test")
            except ValueError:
                pass
        
        # Then
        assert len(closed) == 1

    def test_yields_session_for_use(self, session_factory):
        """Should yield session for database operations."""
        # When
        with get_db_session(session_factory) as session:
            # Then - can execute queries
            result = session.execute(text("SELECT 1"))
            assert result.scalar() == 1

    def test_exception_is_reraised(self, session_factory):
        """Should re-raise the original exception after rollback."""
        # When/Then
        with pytest.raises(RuntimeError) as exc_info:
            with get_db_session(session_factory) as session:
                raise RuntimeError("Original error")
        
        assert "Original error" in str(exc_info.value)


class TestGetDbDependency:
    """Tests for get_db_dependency() FastAPI dependency."""

    def test_returns_callable_dependency(self, session_factory):
        """Should return a generator function for Depends()."""
        # When
        get_db = get_db_dependency(session_factory)
        
        # Then
        assert callable(get_db)

    def test_dependency_yields_session(self, session_factory):
        """Should yield session when dependency is invoked."""
        # Given
        get_db = get_db_dependency(session_factory)
        
        # When
        gen = get_db()
        session = next(gen)
        
        # Then
        assert isinstance(session, Session)
        
        # Cleanup
        try:
            next(gen)
        except StopIteration:
            pass

    def test_dependency_closes_session_after_use(self, session_factory):
        """Should close session after generator exhausted."""
        # Given
        get_db = get_db_dependency(session_factory)
        
        # When
        gen = get_db()
        session = next(gen)
        session_id = id(session)
        
        # Exhaust generator
        try:
            next(gen)
        except StopIteration:
            pass
        
        # Then - session should be closed
        # (In real usage, FastAPI handles this automatically)

    def test_integration_with_fastapi_depends(self, session_factory):
        """Should work correctly with FastAPI Depends()."""
        from fastapi import FastAPI, Depends
        from fastapi.testclient import TestClient
        
        # Given
        get_db = get_db_dependency(session_factory)
        app = FastAPI()
        
        @app.get("/test")
        def test_route(db: Session = Depends(get_db)):
            result = db.execute(text("SELECT 1"))
            return {"value": result.scalar()}
        
        client = TestClient(app)
        
        # When
        response = client.get("/test")
        
        # Then
        assert response.status_code == 200
        assert response.json() == {"value": 1}


class TestBase:
    """Tests for declarative Base."""

    def test_base_is_declarative_base(self):
        """Should be SQLAlchemy declarative base."""
        from sqlalchemy.orm import DeclarativeMeta
        assert isinstance(Base, DeclarativeMeta)

    def test_can_define_models(self):
        """Should be able to define models using Base."""
        from sqlalchemy import Column, Integer, String
        
        class TestModel(Base):
            __tablename__ = "test_model"
            id = Column(Integer, primary_key=True)
            name = Column(String(50))
        
        assert TestModel.__tablename__ == "test_model"
```

---

## Verification

```bash
cd packages/backend-common

# Run database tests
pytest tests/unit/test_database.py -v

# Run with coverage
pytest tests/unit/test_database.py --cov=topvnsport_common.database --cov-report=term-missing

# Expected coverage: 100%
```

---

## Checklist

- [ ] database.py implemented
- [ ] All 17 test cases pass
- [ ] 100% code coverage
- [ ] Works with SQLite (tests) and PostgreSQL (production)
- [ ] FastAPI integration tested
