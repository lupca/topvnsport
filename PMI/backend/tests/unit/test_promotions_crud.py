import datetime
import uuid
import pytest
from fastapi import status
from models import Promotion, PromotionScope, PromotionStatus, DiscountType, ScopeType


def test_create_promotion_success(client, db_session):
    """Create promotion with valid scope rules."""
    payload = {
        "code": f"PROMO_CREATE_{uuid.uuid4().hex[:6].upper()}",
        "name": "Summer Promotion 2026",
        "description": "Discount for all products",
        "discount_type": "PERCENTAGE",
        "discount_value": 20.0,
        "max_discount": 200000.0,
        "priority": 10,
        "status": "DRAFT",
        "scopes": [
            {
                "scope_type": "ALL",
                "target_id": None,
                "is_exclusion": False
            }
        ]
    }
    response = client.post("/api/promotions", json=payload)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["code"] == payload["code"]
    assert data["name"] == payload["name"]
    assert data["discount_value"] == 20.0
    assert len(data["scopes"]) == 1
    assert data["scopes"][0]["scope_type"] == "ALL"

    db_promo = db_session.query(Promotion).filter(Promotion.code == payload["code"]).first()
    assert db_promo is not None
    assert db_promo.priority == 10


def test_create_promotion_duplicate_code(client, db_session):
    """Attempt to create promotion with already existing code."""
    code = f"DUP_CODE_{uuid.uuid4().hex[:6].upper()}"
    promo = Promotion(
        id=str(uuid.uuid4()),
        code=code,
        name="Existing Promo",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=10.0,
        status=PromotionStatus.DRAFT
    )
    db_session.add(promo)
    db_session.flush()

    payload = {
        "code": code,
        "name": "Duplicate Code Promo",
        "discount_type": "PERCENTAGE",
        "discount_value": 15.0,
        "scopes": []
    }
    response = client.post("/api/promotions", json=payload)
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "already exists" in response.json()["detail"]


def test_create_promotion_invalid_percentage(client):
    """Percentage discount value > 100 or <= 0."""
    payload = {
        "code": f"INV_PCT_{uuid.uuid4().hex[:6].upper()}",
        "name": "Invalid Percentage Promo",
        "discount_type": "PERCENTAGE",
        "discount_value": 150.0,
        "scopes": []
    }
    response = client.post("/api/promotions", json=payload)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    payload["discount_value"] = -10.0
    response = client.post("/api/promotions", json=payload)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_create_promotion_invalid_dates(client):
    """End date earlier than or equal to start date."""
    now = datetime.datetime.now(datetime.timezone.utc)
    payload = {
        "code": f"INV_DATES_{uuid.uuid4().hex[:6].upper()}",
        "name": "Invalid Dates Promo",
        "discount_type": "PERCENTAGE",
        "discount_value": 10.0,
        "starts_at": (now + datetime.timedelta(days=10)).isoformat(),
        "ends_at": now.isoformat(),
        "scopes": []
    }
    response = client.post("/api/promotions", json=payload)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_create_scope_missing_target_id(client):
    """scope_type="CATEGORY" without target_id."""
    payload = {
        "code": f"MISS_TARGET_{uuid.uuid4().hex[:6].upper()}",
        "name": "Missing Target ID Scope",
        "discount_type": "PERCENTAGE",
        "discount_value": 10.0,
        "scopes": [
            {
                "scope_type": "CATEGORY",
                "target_id": None,
                "is_exclusion": False
            }
        ]
    }
    response = client.post("/api/promotions", json=payload)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_list_promotions_pagination_filter(client, db_session):
    """List promotions with status filter, search query, and pagination."""
    prefix = f"LIST_PROMO_{uuid.uuid4().hex[:4].upper()}"
    p1 = Promotion(
        id=str(uuid.uuid4()),
        code=f"{prefix}_ACTIVE_1",
        name=f"Filter Match Active {prefix}",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=10.0,
        status=PromotionStatus.ACTIVE
    )
    p2 = Promotion(
        id=str(uuid.uuid4()),
        code=f"{prefix}_DRAFT_1",
        name=f"Filter Match Draft {prefix}",
        discount_type=DiscountType.FIXED_AMOUNT,
        discount_value=50000.0,
        status=PromotionStatus.DRAFT
    )
    db_session.add_all([p1, p2])
    db_session.flush()

    res = client.get(f"/api/promotions?status=ACTIVE&search={prefix}&page=1&limit=10")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["total"] == 1
    assert data["items"][0]["code"] == p1.code
    assert data["items"][0]["status"] == "ACTIVE"


def test_get_promotion_detail_success(client, db_session):
    """Retrieve single promotion detail with scope rules and affected count."""
    p = Promotion(
        id=str(uuid.uuid4()),
        code=f"DETAIL_PROMO_{uuid.uuid4().hex[:6].upper()}",
        name="Detail Test Promo",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=15.0,
        status=PromotionStatus.ACTIVE
    )
    db_session.add(p)
    db_session.flush()

    s = PromotionScope(
        id=str(uuid.uuid4()),
        promotion_id=p.id,
        scope_type=ScopeType.ALL,
        target_id=None,
        is_exclusion=False
    )
    db_session.add(s)
    db_session.flush()

    res = client.get(f"/api/promotions/{p.id}")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["id"] == p.id
    assert data["code"] == p.code
    assert len(data["scopes"]) == 1
    assert "affected_variants_count" in data


def test_get_promotion_detail_404(client):
    """Request non-existent promotion ID."""
    res = client.get(f"/api/promotions/{uuid.uuid4()}")
    assert res.status_code == status.HTTP_404_NOT_FOUND


def test_update_promotion_success(client, db_session):
    """Update name, priority, and scope rules."""
    p = Promotion(
        id=str(uuid.uuid4()),
        code=f"UPD_PROMO_{uuid.uuid4().hex[:6].upper()}",
        name="Original Name",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=10.0,
        priority=0,
        status=PromotionStatus.DRAFT
    )
    db_session.add(p)
    db_session.flush()

    update_payload = {
        "name": "Updated Promotion Name",
        "priority": 25,
        "discount_value": 15.0,
        "scopes": [
            {
                "scope_type": "CATEGORY",
                "target_id": "1",
                "is_exclusion": False
            }
        ]
    }
    res = client.put(f"/api/promotions/{p.id}", json=update_payload)
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["name"] == "Updated Promotion Name"
    assert data["priority"] == 25
    assert len(data["scopes"]) == 1
    assert data["scopes"][0]["target_id"] == "1"


def test_update_promotion_404(client):
    """Update non-existent promotion ID."""
    res = client.put(f"/api/promotions/{uuid.uuid4()}", json={"name": "Ghost Promo"})
    assert res.status_code == status.HTTP_404_NOT_FOUND


def test_delete_draft_promotion(client, db_session):
    """Delete a promotion in DRAFT status."""
    promo_id = str(uuid.uuid4())
    p = Promotion(
        id=promo_id,
        code=f"DEL_DRAFT_{uuid.uuid4().hex[:6].upper()}",
        name="Draft to Delete",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=10.0,
        status=PromotionStatus.DRAFT
    )
    db_session.add(p)
    db_session.flush()

    res = client.delete(f"/api/promotions/{promo_id}")
    assert res.status_code == status.HTTP_200_OK
    assert "deleted successfully" in res.json()["message"]

    deleted_p = db_session.query(Promotion).filter(Promotion.id == promo_id).first()
    assert deleted_p is None


def test_delete_active_promotion(client, db_session):
    """Delete active promotion."""
    promo_id = str(uuid.uuid4())
    p = Promotion(
        id=promo_id,
        code=f"DEL_ACTIVE_{uuid.uuid4().hex[:6].upper()}",
        name="Active to Delete",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=10.0,
        status=PromotionStatus.ACTIVE
    )
    db_session.add(p)
    db_session.commit()

    res = client.delete(f"/api/promotions/{promo_id}")
    assert res.status_code == status.HTTP_400_BAD_REQUEST

    deleted_p = db_session.query(Promotion).filter(Promotion.id == promo_id).first()
    assert deleted_p is not None


def test_preview_promotion_impact(client):
    """Dry-run preview endpoint without saving promo."""
    payload = {
        "code": f"PREVIEW_{uuid.uuid4().hex[:6].upper()}",
        "name": "Preview Campaign",
        "discount_type": "PERCENTAGE",
        "discount_value": 20.0,
        "status": "ACTIVE",
        "scopes": [
            {
                "scope_type": "ALL",
                "target_id": None,
                "is_exclusion": False
            }
        ]
    }
    res = client.post("/api/promotions/preview", json=payload)
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert "affected_variants_count" in data
    assert "total_discount_amount" in data
    assert "sample_variants" in data


def test_parse_intent_success(client):
    """AI natural language prompt to promotion schema."""
    payload = {
        "prompt": "Giảm 15% tối đa 100k cho tất cả sản phẩm từ 01/08/2026 đến 15/08/2026",
        "created_by": "AI_AGENT"
    }
    res = client.post("/api/promotions/parse-intent", json=payload)
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["discount_type"] == "PERCENTAGE"
    assert data["discount_value"] == 15.0
    assert data["max_discount"] == 100000.0
    assert "reasoning" in data
    assert data["confidence_score"] > 0


def test_get_variant_computed_price_404(client):
    res = client.get("/api/variants/99999999/computed-price")
    assert res.status_code == status.HTTP_404_NOT_FOUND


def test_update_promotion_code_conflict(client, db_session):
    p1 = Promotion(
        id=str(uuid.uuid4()),
        code=f"CODE_EXIST_1_{uuid.uuid4().hex[:6].upper()}",
        name="P1",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=10.0
    )
    p2 = Promotion(
        id=str(uuid.uuid4()),
        code=f"CODE_EXIST_2_{uuid.uuid4().hex[:6].upper()}",
        name="P2",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=10.0
    )
    db_session.add_all([p1, p2])
    db_session.flush()

    res = client.put(f"/api/promotions/{p2.id}", json={"code": p1.code})
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert "already exists" in res.json()["detail"]


def test_lifecycle_404_endpoints(client):
    fake_id = str(uuid.uuid4())
    assert client.post(f"/api/promotions/{fake_id}/activate").status_code == status.HTTP_404_NOT_FOUND
    assert client.post(f"/api/promotions/{fake_id}/pause").status_code == status.HTTP_404_NOT_FOUND
    assert client.post(f"/api/promotions/{fake_id}/resume").status_code == status.HTTP_404_NOT_FOUND
    assert client.post(f"/api/promotions/{fake_id}/end").status_code == status.HTTP_404_NOT_FOUND
    assert client.delete(f"/api/promotions/{fake_id}").status_code == status.HTTP_404_NOT_FOUND

