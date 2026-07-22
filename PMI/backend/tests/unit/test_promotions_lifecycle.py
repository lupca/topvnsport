import datetime
import uuid
import pytest
from fastapi import status
from models import Promotion, PromotionStatus, DiscountType


def test_activate_draft_immediate(client, db_session):
    """Activate draft promo with past or no start date -> status becomes ACTIVE."""
    promo = Promotion(
        id=str(uuid.uuid4()),
        code=f"LIFE_ACT_NOW_{uuid.uuid4().hex[:6].upper()}",
        name="Activate Now Test",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=15.0,
        status=PromotionStatus.DRAFT,
        starts_at=None
    )
    db_session.add(promo)
    db_session.flush()

    res = client.post(f"/api/promotions/{promo.id}/activate")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["status"] == "ACTIVE"

    db_session.refresh(promo)
    assert promo.status == PromotionStatus.ACTIVE


def test_activate_draft_scheduled(client, db_session):
    """Activate draft promo with future start date -> status becomes SCHEDULED."""
    future = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=5)
    promo = Promotion(
        id=str(uuid.uuid4()),
        code=f"LIFE_ACT_SCHED_{uuid.uuid4().hex[:6].upper()}",
        name="Activate Scheduled Test",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=15.0,
        status=PromotionStatus.DRAFT,
        starts_at=future
    )
    db_session.add(promo)
    db_session.flush()

    res = client.post(f"/api/promotions/{promo.id}/activate")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["status"] == "SCHEDULED"

    db_session.refresh(promo)
    assert promo.status == PromotionStatus.SCHEDULED


def test_pause_active_promotion(client, db_session):
    """Pause active promotion -> status becomes PAUSED."""
    promo = Promotion(
        id=str(uuid.uuid4()),
        code=f"LIFE_PAUSE_{uuid.uuid4().hex[:6].upper()}",
        name="Pause Active Test",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=20.0,
        status=PromotionStatus.ACTIVE
    )
    db_session.add(promo)
    db_session.flush()

    res = client.post(f"/api/promotions/{promo.id}/pause")
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["status"] == "PAUSED"

    db_session.refresh(promo)
    assert promo.status == PromotionStatus.PAUSED


def test_resume_paused_promotion(client, db_session):
    """Resume paused promotion -> status becomes ACTIVE."""
    promo = Promotion(
        id=str(uuid.uuid4()),
        code=f"LIFE_RESUME_{uuid.uuid4().hex[:6].upper()}",
        name="Resume Paused Test",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=20.0,
        status=PromotionStatus.PAUSED
    )
    db_session.add(promo)
    db_session.flush()

    res = client.post(f"/api/promotions/{promo.id}/resume")
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["status"] == "ACTIVE"

    db_session.refresh(promo)
    assert promo.status == PromotionStatus.ACTIVE


def test_end_active_promotion(client, db_session):
    """Terminate active promotion -> status becomes ENDED."""
    promo = Promotion(
        id=str(uuid.uuid4()),
        code=f"LIFE_END_{uuid.uuid4().hex[:6].upper()}",
        name="End Active Test",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=25.0,
        status=PromotionStatus.ACTIVE
    )
    db_session.add(promo)
    db_session.flush()

    res = client.post(f"/api/promotions/{promo.id}/end")
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["status"] == "ENDED"

    db_session.refresh(promo)
    assert promo.status == PromotionStatus.ENDED


def test_end_paused_promotion(client, db_session):
    """Terminate paused promotion -> status becomes ENDED."""
    promo = Promotion(
        id=str(uuid.uuid4()),
        code=f"LIFE_END_PAUSED_{uuid.uuid4().hex[:6].upper()}",
        name="End Paused Test",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=25.0,
        status=PromotionStatus.PAUSED
    )
    db_session.add(promo)
    db_session.flush()

    res = client.post(f"/api/promotions/{promo.id}/end")
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["status"] == "ENDED"


def test_invalid_transition_pause_draft(client, db_session):
    """Attempt to pause a DRAFT promotion -> 400 Bad Request."""
    promo = Promotion(
        id=str(uuid.uuid4()),
        code=f"LIFE_INV_PAUSE_{uuid.uuid4().hex[:6].upper()}",
        name="Invalid Pause Draft",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=10.0,
        status=PromotionStatus.DRAFT
    )
    db_session.add(promo)
    db_session.flush()

    res = client.post(f"/api/promotions/{promo.id}/pause")
    assert res.status_code == status.HTTP_400_BAD_REQUEST


def test_invalid_transition_resume_draft(client, db_session):
    """Attempt to resume a DRAFT promotion -> 400 Bad Request."""
    promo = Promotion(
        id=str(uuid.uuid4()),
        code=f"LIFE_INV_RESUME_{uuid.uuid4().hex[:6].upper()}",
        name="Invalid Resume Draft",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=10.0,
        status=PromotionStatus.DRAFT
    )
    db_session.add(promo)
    db_session.flush()

    res = client.post(f"/api/promotions/{promo.id}/resume")
    assert res.status_code == status.HTTP_400_BAD_REQUEST


def test_invalid_transition_activate_ended(client, db_session):
    """Attempt to reactivate an ENDED promotion -> 400 Bad Request."""
    promo = Promotion(
        id=str(uuid.uuid4()),
        code=f"LIFE_INV_ACT_END_{uuid.uuid4().hex[:6].upper()}",
        name="Invalid Activate Ended",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=10.0,
        status=PromotionStatus.ENDED
    )
    db_session.add(promo)
    db_session.flush()

    res = client.post(f"/api/promotions/{promo.id}/activate")
    assert res.status_code == status.HTTP_400_BAD_REQUEST


def test_full_lifecycle_sequence(client, db_session):
    """Sequence: DRAFT -> ACTIVE -> PAUSED -> ACTIVE -> ENDED."""
    promo = Promotion(
        id=str(uuid.uuid4()),
        code=f"LIFE_FULL_{uuid.uuid4().hex[:6].upper()}",
        name="Full Lifecycle Sequence",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=30.0,
        status=PromotionStatus.DRAFT
    )
    db_session.add(promo)
    db_session.flush()

    # 1. Activate
    res = client.post(f"/api/promotions/{promo.id}/activate")
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["status"] == "ACTIVE"

    # 2. Pause
    res = client.post(f"/api/promotions/{promo.id}/pause")
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["status"] == "PAUSED"

    # 3. Resume
    res = client.post(f"/api/promotions/{promo.id}/resume")
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["status"] == "ACTIVE"

    # 4. End
    res = client.post(f"/api/promotions/{promo.id}/end")
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["status"] == "ENDED"
