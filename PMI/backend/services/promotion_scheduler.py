import datetime
import logging
import threading
import os
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import StaleDataError
from database import SessionLocal
from models import Promotion, PromotionStatus

logger = logging.getLogger(__name__)
from services.promotion_service import _recompute_lock


def process_promotion_schedule(db: Session) -> dict:
    """
    Scans promotions table and performs status transitions:
    - SCHEDULED -> ACTIVE if starts_at <= now
    - ACTIVE -> ENDED if ends_at <= now

    Returns summary count dict: {"activated": int, "ended": int}
    """
    with _recompute_lock:
        now = datetime.datetime.now(datetime.timezone.utc)
        try:
            # 1. Activate scheduled promotions whose starts_at timestamp has passed
            scheduled_promos = db.query(Promotion).filter(
                Promotion.status == PromotionStatus.SCHEDULED,
                Promotion.starts_at.isnot(None),
                Promotion.starts_at <= now
            ).with_for_update(skip_locked=True).all()

            activated_count = 0
            for promo in scheduled_promos:
                promo.status = PromotionStatus.ACTIVE
                promo.updated_at = now
                activated_count += 1
                logger.info(f"[PromotionScheduler] Promotion '{promo.name}' (ID: {promo.id}, Code: {promo.code}) transitioned SCHEDULED -> ACTIVE")

            if activated_count > 0:
                db.flush()

            # 2. End active promotions whose ends_at timestamp has passed
            active_promos = db.query(Promotion).filter(
                Promotion.status == PromotionStatus.ACTIVE,
                Promotion.ends_at.isnot(None),
                Promotion.ends_at <= now
            ).with_for_update(skip_locked=True).all()

            ended_count = 0
            for promo in active_promos:
                promo.status = PromotionStatus.ENDED
                promo.updated_at = now
                ended_count += 1
                logger.info(f"[PromotionScheduler] Promotion '{promo.name}' (ID: {promo.id}, Code: {promo.code}) transitioned ACTIVE -> ENDED")

            if activated_count > 0 or ended_count > 0:
                from services.promotion_service import recompute_variant_prices
                recompute_variant_prices(db)
                db.commit()

            return {"activated": activated_count, "ended": ended_count}
        except Exception as e:
            db.rollback()
            logger.warning(f"[PromotionScheduler] Exception in process_promotion_schedule: {e}")
            raise e


from services.promotion_service import _recompute_lock


class PromotionScheduler:
    def __init__(self, interval: float = 10.0, db_factory=SessionLocal):
        self.interval = interval
        self.db_factory = db_factory
        self._stop_event = threading.Event()
        self._lock = threading.Lock()
        self._is_running = False

    def run_once(self) -> dict:
        """Executes a single processing pass. Designed for unit tests and manual triggers."""
        with _recompute_lock:
            db = self.db_factory()
            try:
                return process_promotion_schedule(db)
            except StaleDataError as e:
                db.rollback()
                logger.warning(f"[PromotionScheduler] StaleDataError in run_once: {e}")
                return {"activated": 0, "ended": 0}
            except Exception as e:
                db.rollback()
                logger.error(f"[PromotionScheduler] Error in run_once: {e}", exc_info=True)
                raise e
            finally:
                db.close()

    def start_loop(self):
        """Main execution loop for background thread."""
        logger.info(f"[PromotionScheduler] Starting service loop (interval={self.interval}s)")
        self._stop_event.clear()
        self._is_running = True

        while not self._stop_event.is_set():
            try:
                with self._lock:
                    self.run_once()
            except Exception as e:
                logger.error(f"[PromotionScheduler] Loop iteration failed: {e}")

            # Wait for interval or stop signal
            self._stop_event.wait(self.interval)

        self._is_running = False
        logger.info("[PromotionScheduler] Service loop stopped.")

    def stop_loop(self):
        """Signals stop and waits for current active iteration to release lock."""
        logger.info("[PromotionScheduler] Stopping service loop...")
        self._stop_event.set()
        with self._lock:
            pass
