import datetime
from datetime import timezone, timedelta
import logging
import threading
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session
from database import SessionLocal
import models
from models import AuditOutbox, AuditLog, OutboxStatus

logger = logging.getLogger(__name__)

def process_outbox_batch(db_session: Session, batch_size=100, worker_id="worker-default", max_attempts=5):
    """
    Selects pending or failed outbox records that are ready for retry,
    marks them as PROCESSING with the worker_id, and processes them.
    Copies them to audit_logs and deletes them from audit_outbox.
    Returns the count of successfully processed entries.
    """
    import os
    stuck_timeout_mins = int(os.getenv("STUCK_TIMEOUT_MINUTES", "5" if os.getenv("TESTING") == "true" else "15"))
    now = datetime.datetime.now(datetime.timezone.utc)
    
    # Select records using skip_locked=True (FOR UPDATE SKIP LOCKED)
    records = db_session.query(AuditOutbox).filter(
        or_(
            AuditOutbox.status == OutboxStatus.PENDING,
            and_(
                AuditOutbox.status == OutboxStatus.FAILED,
                AuditOutbox.next_retry_at <= now
            ),
            and_(
                AuditOutbox.status == OutboxStatus.PROCESSING,
                AuditOutbox.locked_at <= now - datetime.timedelta(minutes=stuck_timeout_mins)
            )
        )
    ).order_by(AuditOutbox.created_at.asc(), AuditOutbox.id.asc()).limit(batch_size).with_for_update(skip_locked=True).all()
    
    if not records:
        return 0
        
    # Extract all required columns into plain Python dictionaries before commit
    records_data = []
    for r in records:
        records_data.append({
            "id": r.id,
            "correlation_id": r.correlation_id,
            "actor_id": r.actor_id,
            "actor_username": r.actor_username,
            "actor_type": r.actor_type,
            "ip_address": r.ip_address,
            "method": r.method,
            "path": r.path,
            "source_service": r.source_service,
            "module": r.module,
            "action_type": r.action_type,
            "entity_type": r.entity_type,
            "entity_id": r.entity_id,
            "changes": r.changes,
            "raw_details": r.raw_details,
            "created_at": r.created_at,
            "attempt_count": r.attempt_count
        })
        
    # Mark as PROCESSING
    record_id_map = {id(record): record.id for record in records}
    for record in records:
        record.status = OutboxStatus.PROCESSING
        record.locked_by = worker_id
        record.locked_at = datetime.datetime.now(datetime.timezone.utc)
        
    db_session.commit()
    
    # Process the batch in a new transaction
    success_count = 0
    record_ids = [r["id"] for r in records_data]
    try:
        for r_dict in records_data:
            # Create a copy in AuditLog using exact same ID
            log_entry = AuditLog(
                id=r_dict["id"],
                correlation_id=r_dict["correlation_id"],
                actor_id=r_dict["actor_id"],
                actor_username=r_dict["actor_username"],
                actor_type=r_dict["actor_type"],
                ip_address=r_dict["ip_address"],
                method=r_dict["method"],
                path=r_dict["path"],
                source_service=r_dict["source_service"],
                module=r_dict["module"],
                action_type=r_dict["action_type"],
                entity_type=r_dict["entity_type"],
                entity_id=r_dict["entity_id"],
                changes=r_dict["changes"],
                raw_details=r_dict["raw_details"],
                created_at=r_dict["created_at"],
                processed_at=datetime.datetime.now(datetime.timezone.utc)
            )
            db_session.add(log_entry)
            
        db_session.query(AuditOutbox).filter(AuditOutbox.id.in_(record_ids)).delete(synchronize_session=False)
            
        db_session.commit()
        success_count = len(records_data)
    except Exception as e:
        try:
            db_session.rollback()
        except Exception:
            pass
            
        try:
            # NOTE: We reuse the SAME db_session here for error status updates instead of a new connection.
            # When unit tests wrap execution in an uncommitted savepoint transaction (connection.begin_nested()),
            # a new SessionLocal() connection cannot see the outbox record, leading to status update failures.
            failed_records = db_session.query(AuditOutbox).filter(
                AuditOutbox.id.in_(record_ids),
                AuditOutbox.locked_by == worker_id
            ).all()
            attempt_count_map = {r["id"]: r["attempt_count"] for r in records_data}
            for record in failed_records:
                record.status = OutboxStatus.FAILED
                record.attempt_count = attempt_count_map.get(record.id, record.attempt_count) + 1
                record.last_error = str(e)
                record.locked_by = None
                record.locked_at = None
                
                # Delay mapping:
                # Attempt 1: 1 min
                # Attempt 2: 5 min
                # Attempt 3: 30 min
                # Attempt 4+: 1 hour * 2^(attempt_count - 4) capped at 24 hours
                if record.attempt_count >= max_attempts:
                    record.next_retry_at = None
                elif record.attempt_count == 1:
                    record.next_retry_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=1)
                elif record.attempt_count == 2:
                    record.next_retry_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=5)
                elif record.attempt_count == 3:
                    record.next_retry_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=30)
                else:
                    hours = 1 * (2 ** (record.attempt_count - 4))
                    if hours > 24:
                        hours = 24
                    record.next_retry_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=hours)
                    
            db_session.commit()
        except Exception:
            # If DB is completely down, let the original exception propagate
            raise e
            
    return success_count

class AuditWorker:
    def __init__(self, interval=5.0, batch_size=100, worker_id="worker-default", max_attempts=5):
        self.interval = interval
        self.batch_size = batch_size
        import socket, os, uuid
        self.worker_id = worker_id
        if self.worker_id == "worker-default":
            self.worker_id = f"worker-{socket.gethostname()}-{os.getpid()}-{uuid.uuid4().hex[:6]}"
        self.max_attempts = max_attempts
        self._stop_event = threading.Event()
        self._is_processing = False
        self._lock = threading.Lock()

    def start_loop(self):
        logger.info(f"Starting AuditWorker {self.worker_id} loop with interval {self.interval}s")
        self._stop_event.clear()
        while not self._stop_event.is_set():
            try:
                with self._lock:
                    self._is_processing = True
                    db_session = SessionLocal()
                    try:
                        process_outbox_batch(
                            db_session=db_session,
                            batch_size=self.batch_size,
                            worker_id=self.worker_id,
                            max_attempts=self.max_attempts
                        )
                    except Exception as e:
                        logger.error(f"Error in outbox processing: {e}")
                    finally:
                        db_session.close()
                        self._is_processing = False
            except Exception as e:
                logger.error(f"Error in audit worker loop iteration: {e}")
            
            # Wait for next interval or stop signal
            self._stop_event.wait(self.interval)
        logger.info(f"AuditWorker {self.worker_id} loop stopped")

    def stop_loop(self):
        logger.info(f"Stopping AuditWorker {self.worker_id} gracefully...")
        self._stop_event.set()
        # Acquire lock to wait for any active batch to finish
        with self._lock:
            pass
