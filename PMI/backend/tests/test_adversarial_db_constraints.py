import pytest
import uuid
import datetime
from sqlalchemy.exc import IntegrityError, DataError, StatementError
from models import AuditOutbox, AuditLog, ActorType, OutboxStatus

def test_db_non_nullable_constraints(db_session):
    # 1. Null correlation_id
    entry = AuditOutbox(
        correlation_id=None,  # Nullable=False
        actor_username="test_actor",
        actor_type=ActorType.USER,
        module="Product",
        action_type="CREATE",
    )
    db_session.add(entry)
    with pytest.raises((IntegrityError, StatementError)):
        db_session.commit()
    db_session.rollback()

    # 2. Null actor_username
    entry = AuditOutbox(
        correlation_id=uuid.uuid4(),
        actor_username=None,  # Nullable=False
        actor_type=ActorType.USER,
        module="Product",
        action_type="CREATE",
    )
    db_session.add(entry)
    with pytest.raises((IntegrityError, StatementError)):
        db_session.commit()
    db_session.rollback()

    # 3. Null actor_type
    entry = AuditOutbox(
        correlation_id=uuid.uuid4(),
        actor_username="test_actor",
        actor_type=None,  # Nullable=False
        module="Product",
        action_type="CREATE",
    )
    db_session.add(entry)
    with pytest.raises((IntegrityError, StatementError)):
        db_session.commit()
    db_session.rollback()

def test_db_varchar_length_limits(db_session):
    # actor_username is String(255)
    long_username = "a" * 256
    entry = AuditOutbox(
        correlation_id=uuid.uuid4(),
        actor_username=long_username,
        actor_type=ActorType.USER,
        module="Product",
        action_type="CREATE",
    )
    db_session.add(entry)
    with pytest.raises(DataError):
        db_session.commit()
    db_session.rollback()

    # method is String(10)
    long_method = "A" * 11
    entry = AuditOutbox(
        correlation_id=uuid.uuid4(),
        actor_username="test_actor",
        actor_type=ActorType.USER,
        module="Product",
        action_type="CREATE",
        method=long_method,
    )
    db_session.add(entry)
    with pytest.raises(DataError):
        db_session.commit()
    db_session.rollback()

    # path is String(1024)
    long_path = "/" + "p" * 1024
    entry = AuditOutbox(
        correlation_id=uuid.uuid4(),
        actor_username="test_actor",
        actor_type=ActorType.USER,
        module="Product",
        action_type="CREATE",
        path=long_path,
    )
    db_session.add(entry)
    with pytest.raises(DataError):
        db_session.commit()
    db_session.rollback()

def test_db_invalid_enum_values(db_session):
    # actor_type is Enum(ActorType)
    # SQLAlchemy might reject invalid enum values client-side, raising a StatementError
    # or it might pass to Postgres, raising an IntegrityError/DataError.
    entry = AuditOutbox(
        correlation_id=uuid.uuid4(),
        actor_username="test_actor",
        actor_type="INVALID_ACTOR_TYPE",
        module="Product",
        action_type="CREATE",
    )
    db_session.add(entry)
    with pytest.raises((StatementError, DataError)):
        db_session.commit()
    db_session.rollback()

def test_db_datetime_defaults_and_tz(db_session):
    # Verify created_at default on insert (should default in python)
    corr_id = uuid.uuid4()
    entry = AuditOutbox(
        correlation_id=corr_id,
        actor_username="test_actor",
        actor_type=ActorType.USER,
        module="Product",
        action_type="CREATE",
        # created_at is omitted to test default
    )
    db_session.add(entry)
    db_session.commit()

    retrieved = db_session.query(AuditOutbox).filter_by(correlation_id=corr_id).first()
    assert retrieved.created_at is not None
    
    # Check if timezone is timezone-aware
    assert retrieved.created_at.tzinfo is not None
    
    # Check if the time difference from UTC now is very small (confirming it's UTC-based)
    now_tz = datetime.datetime.now(datetime.timezone.utc)
    diff = abs((now_tz - retrieved.created_at).total_seconds())
    assert diff < 10.0, f"Expected UTC time, got {retrieved.created_at} vs now {now_tz} (diff: {diff})"

def test_db_server_default_presence(db_session):
    # Verify that there IS now a server-side default for created_at
    # If we insert using raw SQL without providing created_at, it should succeed
    from sqlalchemy import text
    
    corr_id = str(uuid.uuid4())
    sql = text("""
        INSERT INTO audit_outbox (id, correlation_id, actor_username, actor_type, source_service, module, action_type, status, attempt_count)
        VALUES (:id, :correlation_id, :actor_username, 'USER', 'PMI', :module, :action_type, 'PENDING', 0)
    """)
    db_session.execute(sql, {
        "id": corr_id,
        "correlation_id": corr_id,
        "actor_username": "raw_sql_actor",
        "module": "Product",
        "action_type": "CREATE"
    })
    db_session.commit()
    
    # Retrieve and verify it was populated
    retrieved = db_session.query(AuditOutbox).filter_by(correlation_id=uuid.UUID(corr_id)).first()
    assert retrieved is not None
    assert retrieved.created_at is not None
    assert retrieved.created_at.tzinfo is not None
