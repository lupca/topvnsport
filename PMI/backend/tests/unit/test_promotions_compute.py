import datetime
import uuid
import pytest
from fastapi import status
from models import Promotion, PromotionScope, PromotionStatus, DiscountType, ScopeType, ProductVariant, Product, Category
from services.promotion_service import calculate_discount, recompute_variant_prices, get_variant_computed_price


def test_compute_percentage_discount():
    """Standard 20% discount on 100,000 VND variant."""
    comp_price, disc_amt, pct_disc = calculate_discount(100000.0, DiscountType.PERCENTAGE, 20.0)
    assert comp_price == 80000.0
    assert disc_amt == 20000.0
    assert pct_disc == 20.0


def test_compute_percentage_with_max_discount_cap():
    """50% discount capped at max 30,000 VND on 100,000 VND variant."""
    comp_price, disc_amt, pct_disc = calculate_discount(100000.0, DiscountType.PERCENTAGE, 50.0, max_discount=30000.0)
    assert disc_amt == 30000.0
    assert comp_price == 70000.0
    assert pct_disc == 30.0


def test_compute_fixed_amount_discount():
    """Fixed amount 25,000 VND discount on 100,000 VND."""
    comp_price, disc_amt, pct_disc = calculate_discount(100000.0, DiscountType.FIXED_AMOUNT, 25000.0)
    assert comp_price == 75000.0
    assert disc_amt == 25000.0
    assert pct_disc == 25.0


def test_compute_fixed_amount_exceeds_price():
    """Fixed amount 60,000 VND discount on 50,000 VND variant -> clamped at 0."""
    comp_price, disc_amt, pct_disc = calculate_discount(50000.0, DiscountType.FIXED_AMOUNT, 60000.0)
    assert comp_price == 0.0
    assert disc_amt == 50000.0
    assert pct_disc == 100.0


def test_compute_fixed_price_discount():
    """Fixed price set to 40,000 VND on 100,000 VND variant."""
    comp_price, disc_amt, pct_disc = calculate_discount(100000.0, DiscountType.FIXED_PRICE, 40000.0)
    assert comp_price == 40000.0
    assert disc_amt == 60000.0
    assert pct_disc == 60.0


def test_compute_fixed_price_higher_than_original():
    """Fixed price set to 120,000 VND on 100,000 VND variant -> original price preserved."""
    comp_price, disc_amt, pct_disc = calculate_discount(100000.0, DiscountType.FIXED_PRICE, 120000.0)
    assert comp_price == 100000.0
    assert disc_amt == 0.0
    assert pct_disc == 0.0


def test_compute_zero_original_price():
    """Variant with price 0.0 VND."""
    comp_price, disc_amt, pct_disc = calculate_discount(0.0, DiscountType.PERCENTAGE, 20.0)
    assert comp_price == 0.0
    assert disc_amt == 0.0
    assert pct_disc == 0.0


def test_priority_competition_higher_wins(db_session):
    """Promo A (priority 10, 10% off) vs Promo B (priority 5, 50% off) -> Promo A wins."""
    cat = Category(name="Cat Priority Test", code=f"CAT_PRIO_{uuid.uuid4().hex[:6]}")
    db_session.add(cat)
    db_session.flush()

    prod = Product(product_code=f"PROD_PRIO_{uuid.uuid4().hex[:6]}", name="Prod Priority Test", category_id=cat.id, weight=100.0)
    db_session.add(prod)
    db_session.flush()

    variant = ProductVariant(product_id=prod.id, sku_code=f"SKU_PRIO_{uuid.uuid4().hex[:6]}", price=100000.0)
    db_session.add(variant)
    db_session.flush()

    # Promo A: priority 10, 10% off
    promo_a = Promotion(
        id=str(uuid.uuid4()),
        code=f"PROMO_HIGH_PRIO_{uuid.uuid4().hex[:6]}",
        name="High Priority Promo A",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=10.0,
        priority=10,
        status=PromotionStatus.ACTIVE
    )
    scope_a = PromotionScope(id=str(uuid.uuid4()), promotion_id=promo_a.id, scope_type=ScopeType.ALL)
    promo_a.scopes.append(scope_a)

    # Promo B: priority 5, 50% off
    promo_b = Promotion(
        id=str(uuid.uuid4()),
        code=f"PROMO_LOW_PRIO_{uuid.uuid4().hex[:6]}",
        name="Low Priority Promo B",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=50.0,
        priority=5,
        status=PromotionStatus.ACTIVE
    )
    scope_b = PromotionScope(id=str(uuid.uuid4()), promotion_id=promo_b.id, scope_type=ScopeType.ALL)
    promo_b.scopes.append(scope_b)

    db_session.add_all([promo_a, promo_b])
    db_session.flush()

    recompute_variant_prices(db_session, variant_ids=[str(variant.id)])

    res = get_variant_computed_price(db_session, str(variant.id))
    assert res is not None
    assert res.has_active_promotion is True
    assert res.promotion_code == promo_a.code
    assert res.computed_price == 90000.0  # 10% off winning promo A


def test_priority_competition_equal_priority_tiebreaker(db_session):
    """Promo A (priority 5, created earlier) vs Promo B (priority 5, created later) -> Promo A wins tiebreaker."""
    now = datetime.datetime.now(datetime.timezone.utc)
    cat = Category(name="Cat Tie Test", code=f"CAT_TIE_{uuid.uuid4().hex[:6]}")
    db_session.add(cat)
    db_session.flush()

    prod = Product(product_code=f"PROD_TIE_{uuid.uuid4().hex[:6]}", name="Prod Tie Test", category_id=cat.id, weight=100.0)
    db_session.add(prod)
    db_session.flush()

    variant = ProductVariant(product_id=prod.id, sku_code=f"SKU_TIE_{uuid.uuid4().hex[:6]}", price=200000.0)
    db_session.add(variant)
    db_session.flush()

    promo_earlier = Promotion(
        id=str(uuid.uuid4()),
        code=f"PROMO_EARLIER_{uuid.uuid4().hex[:6]}",
        name="Earlier Promo",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=10.0,
        priority=5,
        status=PromotionStatus.ACTIVE,
        created_at=now - datetime.timedelta(hours=2)
    )
    promo_earlier.scopes.append(PromotionScope(id=str(uuid.uuid4()), promotion_id=promo_earlier.id, scope_type=ScopeType.ALL))

    promo_later = Promotion(
        id=str(uuid.uuid4()),
        code=f"PROMO_LATER_{uuid.uuid4().hex[:6]}",
        name="Later Promo",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=20.0,
        priority=5,
        status=PromotionStatus.ACTIVE,
        created_at=now
    )
    promo_later.scopes.append(PromotionScope(id=str(uuid.uuid4()), promotion_id=promo_later.id, scope_type=ScopeType.ALL))

    db_session.add_all([promo_earlier, promo_later])
    db_session.flush()

    recompute_variant_prices(db_session, variant_ids=[str(variant.id)])

    res = get_variant_computed_price(db_session, str(variant.id))
    assert res is not None
    assert res.promotion_code == promo_later.code


def test_bulk_computed_prices_endpoint(client, db_session):
    """Bulk pricing endpoint for multiple variant IDs."""
    cat = Category(name="Bulk Test Cat", code=f"CAT_BULK_{uuid.uuid4().hex[:6]}")
    db_session.add(cat)
    db_session.flush()

    prod = Product(product_code=f"PROD_BULK_{uuid.uuid4().hex[:6]}", name="Prod Bulk Test", category_id=cat.id, weight=100.0)
    db_session.add(prod)
    db_session.flush()

    v1 = ProductVariant(product_id=prod.id, sku_code=f"SKU_BULK1_{uuid.uuid4().hex[:6]}", price=100000.0)
    v2 = ProductVariant(product_id=prod.id, sku_code=f"SKU_BULK2_{uuid.uuid4().hex[:6]}", price=300000.0)
    db_session.add_all([v1, v2])
    db_session.flush()

    promo = Promotion(
        id=str(uuid.uuid4()),
        code=f"BULK_PROMO_{uuid.uuid4().hex[:6]}",
        name="Bulk Active Promo",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=10.0,
        status=PromotionStatus.ACTIVE
    )
    scope = PromotionScope(id=str(uuid.uuid4()), promotion_id=promo.id, scope_type=ScopeType.VARIANT, target_id=str(v1.id))
    promo.scopes.append(scope)
    db_session.add(promo)
    db_session.flush()

    recompute_variant_prices(db_session, variant_ids=[str(v1.id), str(v2.id)])

    payload = {"variant_ids": [str(v1.id), str(v2.id)]}
    res = client.post("/api/computed-prices/bulk", json=payload)
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert str(v1.id) in data
    assert str(v2.id) in data
    assert data[str(v1.id)]["has_active_promotion"] is True
    assert data[str(v1.id)]["computed_price"] == 90000.0
    assert data[str(v2.id)]["has_active_promotion"] is False
    assert data[str(v2.id)]["computed_price"] == 300000.0


def test_single_variant_computed_price_endpoint(client, db_session):
    """Get computed price endpoint for single variant."""
    prod = Product(product_code=f"PROD_SINGLE_{uuid.uuid4().hex[:6]}", name="Prod Single Test", weight=100.0)
    db_session.add(prod)
    db_session.flush()

    v = ProductVariant(product_id=prod.id, sku_code=f"SKU_SINGLE_{uuid.uuid4().hex[:6]}", price=150000.0)
    db_session.add(v)
    db_session.flush()

    res = client.get(f"/api/variants/{v.id}/computed-price")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["variant_id"] == str(v.id)
    assert data["original_price"] == 150000.0
    assert data["has_active_promotion"] is False


def test_matches_single_scope_dict_and_edge_cases(db_session):
    from services.promotion_service import matches_single_scope, eval_variant_promotion_match

    prod = Product(product_code=f"PROD_EDGE_{uuid.uuid4().hex[:6]}", name="Prod Edge", category_id=None, weight=50.0)
    db_session.add(prod)
    db_session.flush()

    var = ProductVariant(product_id=prod.id, sku_code=f"SKU_EDGE_{uuid.uuid4().hex[:6]}", price=5000.0)
    db_session.add(var)
    db_session.flush()

    # Scope dict
    scope_dict = {"scope_type": "CATEGORY", "target_id": "999", "is_exclusion": False}
    assert matches_single_scope(scope_dict, var, {}) is False

    # Eval promo dict
    promo_dict = {"scopes": [scope_dict]}
    assert eval_variant_promotion_match(var, promo_dict, {}) is False


def test_calculate_discount_unknown_type():
    comp_price, disc_amt, pct_disc = calculate_discount(100.0, "UNKNOWN_TYPE", 10.0)
    assert comp_price == 100.0
    assert disc_amt == 0.0
    assert pct_disc == 0.0


def test_recompute_variant_prices_empty_list(db_session):
    res = recompute_variant_prices(db_session, variant_ids=[])
    assert res == 0


def test_get_bulk_computed_prices_empty(db_session):
    from services.promotion_service import get_bulk_computed_prices
    res = get_bulk_computed_prices(db_session, [])
    assert res == {}


def test_parse_intent_various_patterns(client):
    # 1. Fixed price with k unit
    res1 = client.post("/api/promotions/parse-intent", json={"prompt": "Đồng giá 50k cho danh mục 5 từ 01/01/2026 đến 10/01/2026", "created_by": "USER"})
    assert res1.status_code == status.HTTP_200_OK
    d1 = res1.json()
    assert d1["discount_type"] == "FIXED_PRICE"
    assert d1["discount_value"] == 50000.0
    assert d1["scopes"][0]["scope_type"] == "CATEGORY"
    assert d1["scopes"][0]["target_id"] == "5"

    # 2. Fixed amount with triệu unit, code, priority
    res2 = client.post("/api/promotions/parse-intent", json={"prompt": "Giảm 2 triệu cho sản phẩm 12 mã MEGA2026 ưu tiên 5", "created_by": "USER"})
    assert res2.status_code == status.HTTP_200_OK
    d2 = res2.json()
    assert d2["discount_type"] == "FIXED_AMOUNT"
    assert d2["discount_value"] == 2000000.0
    assert d2["code"] == "MEGA2026"
    assert d2["priority"] == 5
    assert d2["scopes"][0]["scope_type"] == "PRODUCT"
    assert d2["scopes"][0]["target_id"] == "12"

    # 3. Variant scope
    res3 = client.post("/api/promotions/parse-intent", json={"prompt": "Khuyến mãi 10% cho biến thể 105", "created_by": "USER"})
    assert res3.status_code == status.HTTP_200_OK
    d3 = res3.json()
    assert d3["scopes"][0]["scope_type"] == "VARIANT"
    assert d3["scopes"][0]["target_id"] == "105"

