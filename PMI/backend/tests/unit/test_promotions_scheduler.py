import datetime
import uuid
import pytest
from models import Promotion, PromotionStatus, DiscountType
from services.promotion_scheduler import process_promotion_schedule, PromotionScheduler


def test_scheduler_transitions_scheduled_to_active(db_session):
    """Verify that SCHEDULED promotions with starts_at <= now are transitioned to ACTIVE."""
    now = datetime.datetime.now(datetime.timezone.utc)
    past_start = now - datetime.timedelta(minutes=10)

    promo = Promotion(
        id=str(uuid.uuid4()),
        code=f"TEST_SCHED_ACTIVE_{uuid.uuid4().hex[:6]}",
        name="Scheduled to Active Test",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=15.0,
        status=PromotionStatus.SCHEDULED,
        starts_at=past_start,
        ends_at=now + datetime.timedelta(days=1),
    )
    db_session.add(promo)
    db_session.flush()

    result = process_promotion_schedule(db_session)

    assert result["activated"] >= 1
    db_session.refresh(promo)
    assert promo.status == PromotionStatus.ACTIVE


def test_scheduler_does_not_activate_future_scheduled(db_session):
    """Verify that SCHEDULED promotions with starts_at > now remain SCHEDULED."""
    now = datetime.datetime.now(datetime.timezone.utc)
    future_start = now + datetime.timedelta(hours=2)

    promo = Promotion(
        id=str(uuid.uuid4()),
        code=f"TEST_FUTURE_SCHED_{uuid.uuid4().hex[:6]}",
        name="Future Scheduled Test",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=10.0,
        status=PromotionStatus.SCHEDULED,
        starts_at=future_start,
        ends_at=now + datetime.timedelta(days=2),
    )
    db_session.add(promo)
    db_session.flush()

    result = process_promotion_schedule(db_session)

    db_session.refresh(promo)
    assert promo.status == PromotionStatus.SCHEDULED


def test_scheduler_transitions_active_to_ended(db_session):
    """Verify that ACTIVE promotions with ends_at <= now are transitioned to ENDED."""
    now = datetime.datetime.now(datetime.timezone.utc)
    past_start = now - datetime.timedelta(days=2)
    past_end = now - datetime.timedelta(minutes=5)

    promo = Promotion(
        id=str(uuid.uuid4()),
        code=f"TEST_ACTIVE_ENDED_{uuid.uuid4().hex[:6]}",
        name="Active to Ended Test",
        discount_type=DiscountType.FIXED_AMOUNT,
        discount_value=50000.0,
        status=PromotionStatus.ACTIVE,
        starts_at=past_start,
        ends_at=past_end,
    )
    db_session.add(promo)
    db_session.flush()

    result = process_promotion_schedule(db_session)

    assert result["ended"] >= 1
    db_session.refresh(promo)
    assert promo.status == PromotionStatus.ENDED


def test_scheduler_does_not_end_active_promotions_without_end_date(db_session):
    """Verify that ACTIVE promotions with ends_at = None remain ACTIVE."""
    promo = Promotion(
        id=str(uuid.uuid4()),
        code=f"TEST_NO_END_DATE_{uuid.uuid4().hex[:6]}",
        name="Active No End Date Test",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=20.0,
        status=PromotionStatus.ACTIVE,
        starts_at=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1),
        ends_at=None,
    )
    db_session.add(promo)
    db_session.flush()

    process_promotion_schedule(db_session)

    db_session.refresh(promo)
    assert promo.status == PromotionStatus.ACTIVE


def test_scheduler_run_once_class_method(db_session):
    """Verify that PromotionScheduler.run_once executes process_promotion_schedule using factory."""
    now = datetime.datetime.now(datetime.timezone.utc)
    past_start = now - datetime.timedelta(minutes=15)

    promo = Promotion(
        id=str(uuid.uuid4()),
        code=f"TEST_SCHED_CLASS_{uuid.uuid4().hex[:6]}",
        name="Scheduler Class Test",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=25.0,
        status=PromotionStatus.SCHEDULED,
        starts_at=past_start,
        ends_at=now + datetime.timedelta(days=5),
    )
    db_session.add(promo)
    db_session.flush()

    orig_close = db_session.close
    db_session.close = lambda: None

    try:
        scheduler = PromotionScheduler(db_factory=lambda: db_session)
        result = scheduler.run_once()

        assert result["activated"] >= 1
        db_session.refresh(promo)
        assert promo.status == PromotionStatus.ACTIVE
    finally:
        db_session.close = orig_close


def test_scheduler_exception_rollback():
    """Verify that exception in run_once triggers rollback."""
    class FaultyDBSession:
        def query(self, *args, **kwargs):
            raise RuntimeError("Database query failed")
        def rollback(self):
            self.rolled_back = True
        def close(self):
            pass

    faulty_session = FaultyDBSession()
    scheduler = PromotionScheduler(db_factory=lambda: faulty_session)

    with pytest.raises(RuntimeError):
        scheduler.run_once()
    assert getattr(faulty_session, "rolled_back", False) is True
