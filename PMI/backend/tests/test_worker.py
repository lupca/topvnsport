import pytest
import time
import threading
import datetime
from sqlalchemy.orm import Session
import uuid

# ==========================================
# Tier 1 - F7: Background Worker
# ==========================================

def test_f7_31_worker_processes_unprocessed_entries(db_session: Session):
    """Worker processes outbox entries where status = PENDING."""
    from services.worker import process_outbox_batch
    from models import AuditOutbox, ActorType, OutboxStatus

    # Add a pending outbox entry
    entry = AuditOutbox(
        correlation_id=uuid.uuid4(),
        actor_username="test_actor",
        actor_type=ActorType.USER,
        module="Product",
        action_type="CREATE",
        entity_type="Product",
        entity_id="1",
        status=OutboxStatus.PENDING
    )
    db_session.add(entry)
    db_session.commit()
    
    entry_id = entry.id

    # Process outbox
    count = process_outbox_batch(db_session)
    assert count == 1
    
    # Verify it was removed from outbox
    retrieved = db_session.query(AuditOutbox).filter_by(id=entry_id).first()
    assert retrieved is None


def test_f7_32_worker_copies_to_audit_logs(db_session: Session):
    """Worker copies entries from audit_outbox to audit_logs."""
    from services.worker import process_outbox_batch
    from models import AuditOutbox, AuditLog, ActorType, OutboxStatus

    # Clear existing logs
    db_session.query(AuditLog).delete()
    db_session.commit()
    
    entry_id = uuid.uuid4()
    entry = AuditOutbox(
        id=entry_id,
        correlation_id=uuid.uuid4(),
        actor_username="test_actor",
        actor_type=ActorType.USER,
        module="Product",
        action_type="UPDATE",
        entity_type="Product",
        entity_id="1",
        status=OutboxStatus.PENDING
    )
    db_session.add(entry)
    db_session.commit()
    
    count = process_outbox_batch(db_session)
    assert count == 1
    
    # Check that it exists in AuditLog now with same ID
    log = db_session.query(AuditLog).filter_by(id=entry_id).first()
    assert log is not None
    assert log.actor_username == "test_actor"
    assert log.entity_id == "1"
    assert log.action_type == "UPDATE"


def test_f7_33_worker_updates_or_removes_outbox(db_session: Session):
    """Worker updates or removes processed outbox entries."""
    from services.worker import process_outbox_batch
    from models import AuditOutbox, ActorType, OutboxStatus

    entry = AuditOutbox(
        correlation_id=uuid.uuid4(),
        actor_username="test_actor",
        actor_type=ActorType.USER,
        module="Product",
        action_type="DELETE",
        entity_type="Product",
        entity_id="2",
        status=OutboxStatus.PENDING
    )
    db_session.add(entry)
    db_session.commit()
    
    entry_id = entry.id
    process_outbox_batch(db_session)
    
    # Verify entry is removed from outbox
    retrieved = db_session.query(AuditOutbox).filter_by(id=entry_id).first()
    assert retrieved is None


def test_f7_34_worker_runs_periodic_loop():
    """Worker runs continuously in a periodic loop."""
    from services.worker import AuditWorker

    # Verify that worker can start in a background thread and shut down gracefully
    worker = AuditWorker(interval=0.01)
    
    t = threading.Thread(target=worker.start_loop, daemon=True)
    t.start()
    time.sleep(0.03)
    worker.stop_loop()
    t.join(timeout=1.0)
    assert not t.is_alive()


def test_f7_35_concurrent_workers_skip_locked(db_session: Session):
    """Multiple concurrent workers do not double-process entries (SKIP LOCKED)."""
    from services.worker import process_outbox_batch
    from models import AuditOutbox, ActorType, OutboxStatus
    from database import SessionLocal

    # Clear existing outbox using SessionLocal to ensure it commits to the actual DB
    setup_sess = SessionLocal()
    setup_sess.query(AuditOutbox).delete()
    setup_sess.commit()

    # Add several outbox items using SessionLocal so they are visible to concurrent connections
    for i in range(10):
        entry = AuditOutbox(
            correlation_id=uuid.uuid4(),
            actor_username="user",
            actor_type=ActorType.USER,
            module="Product",
            action_type="UPDATE",
            entity_type="Product",
            entity_id=str(i),
            status=OutboxStatus.PENDING
        )
        setup_sess.add(entry)
    setup_sess.commit()
    setup_sess.close()

    # Try processing in parallel with threads representing multiple worker instances
    processed_counts = []
    errors = []
    
    def run_worker(worker_id):
        sess = SessionLocal()
        try:
            count = process_outbox_batch(sess, batch_size=4, worker_id=worker_id)
            processed_counts.append(count)
        except Exception as e:
            errors.append(e)
        finally:
            sess.close()

    threads = [threading.Thread(target=run_worker, args=(f"worker-{i}",)) for i in range(3)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
        
    # Clean up at the end of the test
    cleanup_sess = SessionLocal()
    cleanup_sess.query(AuditOutbox).delete()
    cleanup_sess.commit()
    cleanup_sess.close()

    assert len(errors) == 0
    assert sum(processed_counts) == 10


# ==========================================
# Tier 2 - F7: Background Worker
# ==========================================

def test_f7_71_worker_retry_on_log_failure(db_session: Session):
    """Worker retries outbox entry if DB insert to audit_logs fails."""
    from services.worker import process_outbox_batch
    from models import AuditOutbox, AuditLog, ActorType, OutboxStatus

    # Add a pending outbox entry
    entry = AuditOutbox(
        correlation_id=uuid.uuid4(),
        actor_username="test_actor",
        actor_type=ActorType.USER,
        module="Product",
        action_type="UPDATE",
        entity_type="Product",
        entity_id="1",
        status=OutboxStatus.PENDING
    )
    db_session.add(entry)
    db_session.commit()
    
    # Mock db_session.add to fail for AuditLog
    original_add = db_session.add
    def mock_add(instance):
        if isinstance(instance, AuditLog):
            raise Exception("Mock database failure")
        original_add(instance)
        
    db_session.add = mock_add
    
    try:
        process_outbox_batch(db_session)
    finally:
        db_session.add = original_add
        
    # Verify the entry status is now FAILED and attempt_count is 1
    db_session.refresh(entry)
    assert entry.status == OutboxStatus.FAILED
    assert entry.attempt_count == 1
    assert "Mock database failure" in entry.last_error
    assert entry.next_retry_at is not None


def test_f7_72_worker_updates_retry_and_backoff(db_session: Session):
    """Worker updates retry count and backoff timestamp."""
    from services.worker import process_outbox_batch
    from models import AuditOutbox, AuditLog, ActorType, OutboxStatus

    # Add a pending outbox entry
    entry = AuditOutbox(
        correlation_id=uuid.uuid4(),
        actor_username="test_actor",
        actor_type=ActorType.USER,
        module="Product",
        action_type="UPDATE",
        entity_type="Product",
        entity_id="1",
        status=OutboxStatus.PENDING
    )
    db_session.add(entry)
    db_session.commit()
    
    original_add = db_session.add
    def mock_add(instance):
        if isinstance(instance, AuditLog):
            raise Exception("Retry failure")
        original_add(instance)
        
    db_session.add = mock_add
    
    try:
        # 1st failure: attempt_count becomes 1
        process_outbox_batch(db_session)
        db_session.refresh(entry)
        assert entry.attempt_count == 1
        assert entry.next_retry_at is not None
        time1 = entry.next_retry_at
        
        # We manually change next_retry_at to the past to process it again
        entry.next_retry_at = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - datetime.timedelta(seconds=1)
        db_session.commit()
        
        # 2nd failure: attempt_count becomes 2
        process_outbox_batch(db_session)
        db_session.refresh(entry)
        assert entry.attempt_count == 2
        assert entry.next_retry_at is not None
        # Backoff for Attempt 2 is 5 minutes, which is larger than 1 minute
        assert entry.next_retry_at > time1
    finally:
        db_session.add = original_add


def test_f7_73_worker_moves_to_dead_letter(db_session: Session):
    """Worker moves entry to dead-letter/failed after max attempts."""
    from services.worker import process_outbox_batch
    from models import AuditOutbox, AuditLog, ActorType, OutboxStatus

    # Add an outbox entry already at 4 attempts, status = FAILED, and next_retry_at in past
    entry = AuditOutbox(
        correlation_id=uuid.uuid4(),
        actor_username="test_actor",
        actor_type=ActorType.USER,
        module="Product",
        action_type="UPDATE",
        entity_type="Product",
        entity_id="1",
        status=OutboxStatus.FAILED,
        attempt_count=4,
        next_retry_at=datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - datetime.timedelta(seconds=1)
    )
    db_session.add(entry)
    db_session.commit()
    
    # Mock db_session.add to fail
    original_add = db_session.add
    def mock_add(instance):
        if isinstance(instance, AuditLog):
            raise Exception("Log failure")
        original_add(instance)
    db_session.add = mock_add
    
    try:
        process_outbox_batch(db_session, max_attempts=5)
    finally:
        db_session.add = original_add
        
    db_session.refresh(entry)
    assert entry.status == OutboxStatus.FAILED
    assert entry.attempt_count == 5
    assert entry.next_retry_at is None  # Moved to dead-letter


def test_f7_74_worker_db_disconnect_reconnect(db_session: Session):
    """Worker handles DB disconnect and reconnects gracefully."""
    from services.worker import AuditWorker
    from sqlalchemy.exc import OperationalError
    import services.audit_worker
    
    call_count = 0
    original_session_local = services.audit_worker.SessionLocal
    
    class MockBrokenSession:
        def __init__(self, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                # First attempt raises database disconnection exception
                raise OperationalError("select", {}, "Mock DB Disconnected")
            self.session = original_session_local()
            
        def __getattr__(self, name):
            return getattr(self.session, name)
            
        def close(self):
            if hasattr(self, "session"):
                self.session.close()

    services.audit_worker.SessionLocal = MockBrokenSession
    
    # Create worker
    worker = AuditWorker(interval=0.01)
    
    # Start periodic loop in background thread
    t = threading.Thread(target=worker.start_loop, daemon=True)
    t.start()
    
    # Let it run for a bit
    time.sleep(0.05)
    
    worker.stop_loop()
    t.join(timeout=1.0)
    
    # Restore original SessionLocal
    services.audit_worker.SessionLocal = original_session_local
    
    assert call_count >= 2


def test_f7_75_worker_large_batches(db_session: Session):
    """Large batches (1000+) processed correctly within limits."""
    from services.worker import process_outbox_batch
    from models import AuditOutbox, AuditLog, ActorType, OutboxStatus

    # Clear existing logs and outbox
    db_session.query(AuditLog).delete()
    db_session.query(AuditOutbox).delete()
    db_session.commit()
    
    # Add 1100 outbox items
    for i in range(1100):
        entry = AuditOutbox(
            correlation_id=uuid.uuid4(),
            actor_username="user",
            actor_type=ActorType.USER,
            module="Product",
            action_type="UPDATE",
            entity_type="Product",
            entity_id=str(i),
            status=OutboxStatus.PENDING
        )
        db_session.add(entry)
    db_session.commit()
    
    # Process first batch of size 500
    count_1 = process_outbox_batch(db_session, batch_size=500)
    assert count_1 == 500
    
    # Verify 600 remaining in outbox
    remaining = db_session.query(AuditOutbox).count()
    assert remaining == 600
    
    # Process remaining
    count_2 = process_outbox_batch(db_session, batch_size=1000)
    assert count_2 == 600
    
    # Verify outbox is empty and all are in AuditLog
    assert db_session.query(AuditOutbox).count() == 0
    assert db_session.query(AuditLog).count() == 1100


# ==========================================
# Tier 3 - Cross-Feature Combinations
# ==========================================

def test_f3_85_lock_contention_deadlock_prevention(db_session: Session):
    """Lock Contention: Multiple workers and clients simultaneously write and process without deadlock."""
    import random
    from services.worker import process_outbox_batch
    from models import AuditOutbox, ActorType, OutboxStatus
    from database import SessionLocal

    # Clear table using SessionLocal
    setup_sess = SessionLocal()
    setup_sess.query(AuditOutbox).delete()
    setup_sess.commit()
    setup_sess.close()

    stop_flag = threading.Event()
    errors = []

    def writer_client():
        sess = SessionLocal()
        try:
            while not stop_flag.is_set():
                try:
                    entry = AuditOutbox(
                        correlation_id=uuid.uuid4(),
                        actor_username="client_user",
                        actor_type=ActorType.USER,
                        module="Product",
                        action_type="CREATE",
                        entity_type="Product",
                        entity_id=str(random.randint(10000, 99999)),
                        status=OutboxStatus.PENDING
                    )
                    sess.add(entry)
                    sess.commit()
                except Exception as e:
                    errors.append(e)
                    try:
                        sess.rollback()
                    except Exception:
                        pass
                time.sleep(0.02)
        finally:
            sess.close()

    def worker_processor(worker_id):
        sess = SessionLocal()
        try:
            while not stop_flag.is_set():
                try:
                    process_outbox_batch(sess, batch_size=10, worker_id=worker_id)
                except Exception as e:
                    errors.append(e)
                    try:
                        sess.rollback()
                    except Exception:
                        pass
                time.sleep(0.02)
        finally:
            sess.close()

    writer_threads = [threading.Thread(target=writer_client) for _ in range(3)]
    worker_threads = [threading.Thread(target=worker_processor, args=(f"worker-{i}",)) for i in range(3)]

    for t in writer_threads + worker_threads:
        t.start()

    time.sleep(0.2)
    stop_flag.set()

    for t in writer_threads + worker_threads:
        t.join()

    # Clean up table using SessionLocal
    cleanup_sess = SessionLocal()
    cleanup_sess.query(AuditOutbox).delete()
    cleanup_sess.commit()
    cleanup_sess.close()

    assert len(errors) == 0


# ==========================================
# Tier 4 - Real-World Application Scenarios
# ==========================================

def test_f4_93_disaster_recovery_worker(db_session: Session):
    """Disaster Recovery Worker Recovery: Stop worker, accumulate outbox entries, simulate DB lock, restart worker, verify eventual consistency."""
    from services.worker import process_outbox_batch
    from models import AuditOutbox, AuditLog, ActorType, OutboxStatus
    from database import SessionLocal

    # Clear everything using SessionLocal so it commits to the actual DB
    setup_sess = SessionLocal()
    setup_sess.query(AuditOutbox).delete()
    setup_sess.query(AuditLog).delete()
    setup_sess.commit()

    # 1. Accumulate outbox entries using SessionLocal
    for i in range(5):
        entry = AuditOutbox(
            correlation_id=uuid.uuid4(),
            actor_username="disaster_user",
            actor_type=ActorType.USER,
            module="Product",
            action_type="CREATE",
            entity_type="Product",
            entity_id=f"dr-{i}",
            status=OutboxStatus.PENDING
        )
        setup_sess.add(entry)
    setup_sess.commit()
    setup_sess.close()

    # 2. Simulate DB lock on these records in a separate session/transaction
    lock_sess = SessionLocal()
    locked_records = lock_sess.query(AuditOutbox).filter(
        AuditOutbox.entity_id.in_(["dr-0", "dr-1", "dr-2"])
    ).with_for_update().all()

    # 3. Call process_outbox_batch in another session
    # It should skip the locked records and process dr-3 and dr-4.
    process_sess = SessionLocal()
    try:
        processed_count = process_outbox_batch(process_sess, batch_size=10)
        assert processed_count == 2
    finally:
        process_sess.close()

    # Check logs/outbox states using a new session
    verify_sess = SessionLocal()
    try:
        assert verify_sess.query(AuditLog).count() == 2
        assert verify_sess.query(AuditOutbox).count() == 3
    finally:
        verify_sess.close()

    # 4. Release lock by closing the lock session
    lock_sess.close()

    # 5. Process again - now remaining records should be processed
    process_sess2 = SessionLocal()
    try:
        processed_count2 = process_outbox_batch(process_sess2, batch_size=10)
        assert processed_count2 == 3
    finally:
        process_sess2.close()

    # 6. Verify eventual consistency
    verify_sess2 = SessionLocal()
    try:
        assert verify_sess2.query(AuditOutbox).count() == 0
        assert verify_sess2.query(AuditLog).count() == 5
    finally:
        verify_sess2.close()


def test_f7_76_worker_reclaims_stuck_processing(db_session: Session):
    """Worker reclaims outbox entries stuck in PROCESSING state for >5 minutes."""
    from services.worker import process_outbox_batch
    from models import AuditOutbox, AuditLog, ActorType, OutboxStatus
    import datetime

    # Clear existing logs and outbox
    db_session.query(AuditLog).delete()
    db_session.query(AuditOutbox).delete()
    db_session.commit()

    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)

    # 1. Stuck record: PROCESSING, locked 6 minutes ago
    stuck_id = uuid.uuid4()
    stuck_entry = AuditOutbox(
        id=stuck_id,
        correlation_id=uuid.uuid4(),
        actor_username="stuck_actor",
        actor_type=ActorType.USER,
        module="Product",
        action_type="CREATE",
        entity_type="Product",
        entity_id="stuck-1",
        status=OutboxStatus.PROCESSING,
        locked_by="dead-worker",
        locked_at=now - datetime.timedelta(minutes=6),
        created_at=now - datetime.timedelta(minutes=10)
    )

    # 2. Recent record: PROCESSING, locked 2 minutes ago
    recent_id = uuid.uuid4()
    recent_entry = AuditOutbox(
        id=recent_id,
        correlation_id=uuid.uuid4(),
        actor_username="recent_actor",
        actor_type=ActorType.USER,
        module="Product",
        action_type="CREATE",
        entity_type="Product",
        entity_id="recent-1",
        status=OutboxStatus.PROCESSING,
        locked_by="live-worker",
        locked_at=now - datetime.timedelta(minutes=2),
        created_at=now - datetime.timedelta(minutes=3)
    )

    db_session.add(stuck_entry)
    db_session.add(recent_entry)
    db_session.commit()

    # Process outbox
    count = process_outbox_batch(db_session)
    # Only the stuck entry should be processed
    assert count == 1

    # Verify stuck entry was removed from outbox and exists in AuditLog
    retrieved_stuck = db_session.query(AuditOutbox).filter_by(id=stuck_id).first()
    assert retrieved_stuck is None

    log_entry = db_session.query(AuditLog).filter_by(id=stuck_id).first()
    assert log_entry is not None
    assert log_entry.actor_username == "stuck_actor"

    # Verify recent entry is still in outbox as PROCESSING
    retrieved_recent = db_session.query(AuditOutbox).filter_by(id=recent_id).first()
    assert retrieved_recent is not None
    assert retrieved_recent.status == OutboxStatus.PROCESSING
    assert retrieved_recent.locked_by == "live-worker"


def test_audit_worker_unique_default_id():
    """Verify unique worker ID is generated when initialized with 'worker-default'."""
    from services.worker import AuditWorker
    import socket
    import os

    worker = AuditWorker()
    assert worker.worker_id.startswith(f"worker-{socket.gethostname()}-{os.getpid()}-")
    assert len(worker.worker_id) > len(f"worker-{socket.gethostname()}-{os.getpid()}-")

    # If worker_id is explicitly passed, it should be used as is
    worker_custom = AuditWorker(worker_id="my-custom-worker")
    assert worker_custom.worker_id == "my-custom-worker"


def test_lock_holding_validation_in_exception_handler(db_session: Session):
    """Verify failed status updates only affect records still locked by the worker."""
    from services.worker import process_outbox_batch
    from models import AuditOutbox, ActorType, OutboxStatus, AuditLog
    import uuid

    # Clear existing logs and outbox
    db_session.query(AuditLog).delete()
    db_session.query(AuditOutbox).delete()
    db_session.commit()

    # Add two records
    entry1 = AuditOutbox(
        id=uuid.uuid4(),
        correlation_id=uuid.uuid4(),
        actor_username="user1",
        actor_type=ActorType.USER,
        module="Product",
        action_type="CREATE",
        entity_type="Product",
        entity_id="p1",
        status=OutboxStatus.PENDING
    )
    entry2 = AuditOutbox(
        id=uuid.uuid4(),
        correlation_id=uuid.uuid4(),
        actor_username="user2",
        actor_type=ActorType.USER,
        module="Product",
        action_type="CREATE",
        entity_type="Product",
        entity_id="p2",
        status=OutboxStatus.PENDING
    )
    db_session.add(entry1)
    db_session.add(entry2)
    db_session.commit()

    # We will simulate a failure during logging, but we will mock db_session.add to fail.
    # We will also intercept db_session.add, and right before processing fails,
    # we simulate another worker stealing the lock on entry2.
    original_add = db_session.add
    def mock_add(instance):
        if isinstance(instance, AuditLog):
            # Change entry2 lock to someone else in the database
            db_session.query(AuditOutbox).filter_by(id=entry2.id).update({
                "locked_by": "other-worker",
                "status": OutboxStatus.PROCESSING
            })
            db_session.commit()
            raise Exception("Simulated processing failure")
        original_add(instance)

    db_session.add = mock_add

    try:
        process_outbox_batch(db_session, worker_id="my-worker")
    except Exception:
        pass
    finally:
        db_session.add = original_add

    # Verify entry1 status is FAILED (since it was locked by my-worker and failed)
    db_session.refresh(entry1)
    assert entry1.status == OutboxStatus.FAILED
    assert entry1.locked_by is None

    # Verify entry2 status is STILL PROCESSING and locked by other-worker
    db_session.refresh(entry2)
    assert entry2.status == OutboxStatus.PROCESSING
    assert entry2.locked_by == "other-worker"


def test_worker_stable_sorting(db_session: Session):
    """Verify that outbox entries are processed in a stable, deterministic sort order (created_at ASC, id ASC)."""
    from services.worker import process_outbox_batch
    from models import AuditOutbox, ActorType, OutboxStatus, AuditLog
    import uuid

    # Clear existing logs and outbox
    db_session.query(AuditLog).delete()
    db_session.query(AuditOutbox).delete()
    db_session.commit()

    # Create multiple records with the same created_at timestamp
    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)

    # We will generate uuid IDs and pre-sort them to see if the query returns them in ID order
    ids = sorted([uuid.uuid4() for _ in range(5)])

    for uid in ids:
        entry = AuditOutbox(
            id=uid,
            correlation_id=uuid.uuid4(),
            actor_username="user",
            actor_type=ActorType.USER,
            module="Product",
            action_type="CREATE",
            entity_type="Product",
            entity_id="p",
            status=OutboxStatus.PENDING,
            created_at=now
        )
        db_session.add(entry)
    db_session.commit()

    # We can inspect the order of logs added to AuditLog by mocking db_session.add
    added_ids = []
    original_add = db_session.add
    def mock_add(instance):
        if isinstance(instance, AuditLog):
            added_ids.append(instance.id)
        original_add(instance)
    db_session.add = mock_add

    try:
        process_outbox_batch(db_session, batch_size=10)
    finally:
        db_session.add = original_add

    # The order of added logs must exactly match the pre-sorted IDs
    assert added_ids == ids
