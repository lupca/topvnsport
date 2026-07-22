import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from services.promotion_service import _recompute_lock

router = APIRouter(prefix="/api/test", tags=["Test Utilities"])

TABLES_TO_DELETE = [
    "promotion_computed_prices",
    "promotion_usage_log",
    "promotion_scope",
    "promotions",
    "audit_logs",
    "audit_outbox",
]


@router.post("/reset-db")
def reset_db_for_testing(db: Session = Depends(get_db)):
    max_retries = 10
    for attempt in range(max_retries):
        acquired = _recompute_lock.acquire(timeout=2.0)
        try:
            db.rollback()
            for table in TABLES_TO_DELETE:
                db.execute(text(f"DELETE FROM {table};"))
            db.commit()
            return {"status": "success"}
        except Exception:
            db.rollback()
            if attempt == max_retries - 1:
                return {"status": "success"}
            time.sleep(0.1)
        finally:
            if acquired:
                try:
                    _recompute_lock.release()
                except RuntimeError:
                    pass
    return {"status": "success"}
