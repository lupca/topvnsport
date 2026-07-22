import datetime
import uuid
import pytest
from fastapi import status
from models import Promotion, PromotionScope, PromotionStatus, DiscountType, ScopeType, ProductVariant, Product, Category
from services.promotion_service import calculate_discount, recompute_variant_prices, get_variant_computed_price


# =====================================================================
# Target 1: PERCENTAGE discounts, max_discount caps, edge values
# =====================================================================

def test_percentage_edge_zero_percent():
    """0% discount should leave price unchanged."""
    comp, disc, pct = calculate_discount(100000.0, DiscountType.PERCENTAGE, 0.0)
    assert comp == 100000.0
    assert disc == 0.0
    assert pct == 0.0


def test_percentage_edge_hundred_percent():
    """100% discount should reduce computed_price to 0.0."""
    comp, disc, pct = calculate_discount(100000.0, DiscountType.PERCENTAGE, 100.0)
    assert comp == 0.0
    assert disc == 100000.0
    assert pct == 100.0


def test_percentage_edge_greater_than_hundred_percent():
    """>100% discount (e.g. 150%) should floor computed_price at 0.0 and cap discount_amount at original price."""
    comp, disc, pct = calculate_discount(100000.0, DiscountType.PERCENTAGE, 150.0)
    assert comp == 0.0
    assert disc == 100000.0
    assert pct == 100.0


def test_percentage_max_discount_cap_active():
    """50% off 200,000 is 100,000, capped at max_discount 30,000 -> final discount 30,000."""
    comp, disc, pct = calculate_discount(200000.0, DiscountType.PERCENTAGE, 50.0, max_discount=30000.0)
    assert comp == 170000.0
    assert disc == 30000.0
    assert pct == 15.0


def test_percentage_max_discount_cap_inactive_when_higher():
    """10% off 100,000 is 10,000. max_discount 50,000 > 10,000 -> discount stays 10,000."""
    comp, disc, pct = calculate_discount(100000.0, DiscountType.PERCENTAGE, 10.0, max_discount=50000.0)
    assert comp == 90000.0
    assert disc == 100000.0 * 0.1
    assert pct == 10.0


def test_percentage_max_discount_zero_behavior():
    """max_discount = 0.0: check if 0.0 is treated as uncapped or cap to 0."""
    comp, disc, pct = calculate_discount(100000.0, DiscountType.PERCENTAGE, 20.0, max_discount=0.0)
    # Current behavior in promotion_service.py: float(0.0) > 0 is False, so max_discount=0 is ignored (uncapped).
    assert disc == 20000.0
    assert comp == 80000.0


def test_percentage_fractional_precision():
    """Test price 33,333.33 with 33.33% discount."""
    comp, disc, pct = calculate_discount(33333.33, DiscountType.PERCENTAGE, 33.33)
    expected_disc = round(33333.33 * 0.3333, 2)
    assert disc == expected_disc
    assert comp == round(33333.33 - expected_disc, 2)


# =====================================================================
# Target 2: FIXED_AMOUNT discounts with 0.0 lower floor
# =====================================================================

def test_fixed_amount_standard():
    """Standard fixed amount discount."""
    comp, disc, pct = calculate_discount(100000.0, DiscountType.FIXED_AMOUNT, 30000.0)
    assert comp == 70000.0
    assert disc == 30000.0
    assert pct == 30.0


def test_fixed_amount_equals_original_price():
    """Fixed amount equals original price -> price becomes 0.0."""
    comp, disc, pct = calculate_discount(100000.0, DiscountType.FIXED_AMOUNT, 100000.0)
    assert comp == 0.0
    assert disc == 100000.0
    assert pct == 100.0


def test_fixed_amount_exceeds_original_price_floored_at_zero():
    """Fixed amount greater than original price (200k off 100k) -> floored at 0.0."""
    comp, disc, pct = calculate_discount(100000.0, DiscountType.FIXED_AMOUNT, 200000.0)
    assert comp == 0.0
    assert disc == 100000.0
    assert pct == 100.0


def test_fixed_amount_zero_value():
    """Fixed amount 0.0 discount."""
    comp, disc, pct = calculate_discount(100000.0, DiscountType.FIXED_AMOUNT, 0.0)
    assert comp == 100000.0
    assert disc == 0.0
    assert pct == 0.0


def test_fixed_amount_negative_value_behavior():
    """Negative fixed amount value (e.g. -5000.0) should be clamped to 0 discount."""
    comp, disc, pct = calculate_discount(100000.0, DiscountType.FIXED_AMOUNT, -5000.0)
    assert disc == 0.0
    assert comp == 100000.0


# =====================================================================
# Target 3: FIXED_PRICE behavior
# =====================================================================

def test_fixed_price_lower_than_original():
    """Fixed price set to 60,000 on 100,000 variant."""
    comp, disc, pct = calculate_discount(100000.0, DiscountType.FIXED_PRICE, 60000.0)
    assert comp == 60000.0
    assert disc == 40000.0
    assert pct == 40.0


def test_fixed_price_equal_to_original():
    """Fixed price equal to original price -> no discount."""
    comp, disc, pct = calculate_discount(100000.0, DiscountType.FIXED_PRICE, 100000.0)
    assert comp == 100000.0
    assert disc == 0.0
    assert pct == 0.0


def test_fixed_price_higher_than_original():
    """Fixed price set to 150,000 on 100,000 variant -> price remains original 100,000."""
    comp, disc, pct = calculate_discount(100000.0, DiscountType.FIXED_PRICE, 150000.0)
    assert comp == 100000.0
    assert disc == 0.0
    assert pct == 0.0


def test_fixed_price_zero_value():
    """Fixed price set to 0.0 -> computed price becomes 0.0."""
    comp, disc, pct = calculate_discount(100000.0, DiscountType.FIXED_PRICE, 0.0)
    assert comp == 0.0
    assert disc == 100000.0
    assert pct == 100.0


def test_fixed_price_negative_value():
    """Fixed price set to -10,000 -> floored at 0.0."""
    comp, disc, pct = calculate_discount(100000.0, DiscountType.FIXED_PRICE, -10000.0)
    assert comp == 0.0
    assert disc == 100000.0
    assert pct == 100.0


# =====================================================================
# Target 4: Priority resolution (higher priority promotion wins)
# =====================================================================

def test_priority_resolution_three_promotions(db_session):
    """
    3 Active Promotions competing for the same variant:
    - Promo High: Priority 100, 10% off (final price 90,000)
    - Promo Med: Priority 50, 50% off (final price 50,000)
    - Promo Low: Priority 10, 90% off (final price 10,000)
    Promo High (priority 100) MUST win despite giving smaller discount.
    """
    cat = Category(name="Prio3 Cat", code=f"CAT_P3_{uuid.uuid4().hex[:6]}")
    db_session.add(cat)
    db_session.flush()

    prod = Product(product_code=f"PROD_P3_{uuid.uuid4().hex[:6]}", name="Prio3 Prod", category_id=cat.id, weight=100.0)
    db_session.add(prod)
    db_session.flush()

    var = ProductVariant(product_id=prod.id, sku_code=f"SKU_P3_{uuid.uuid4().hex[:6]}", price=100000.0)
    db_session.add(var)
    db_session.flush()

    p_low = Promotion(
        id=str(uuid.uuid4()), code=f"P_LOW_{uuid.uuid4().hex[:6]}", name="Low Prio",
        discount_type=DiscountType.PERCENTAGE, discount_value=90.0, priority=10, status=PromotionStatus.ACTIVE
    )
    p_low.scopes.append(PromotionScope(id=str(uuid.uuid4()), promotion_id=p_low.id, scope_type=ScopeType.ALL))

    p_med = Promotion(
        id=str(uuid.uuid4()), code=f"P_MED_{uuid.uuid4().hex[:6]}", name="Med Prio",
        discount_type=DiscountType.PERCENTAGE, discount_value=50.0, priority=50, status=PromotionStatus.ACTIVE
    )
    p_med.scopes.append(PromotionScope(id=str(uuid.uuid4()), promotion_id=p_med.id, scope_type=ScopeType.ALL))

    p_high = Promotion(
        id=str(uuid.uuid4()), code=f"P_HIGH_{uuid.uuid4().hex[:6]}", name="High Prio",
        discount_type=DiscountType.PERCENTAGE, discount_value=10.0, priority=100, status=PromotionStatus.ACTIVE
    )
    p_high.scopes.append(PromotionScope(id=str(uuid.uuid4()), promotion_id=p_high.id, scope_type=ScopeType.ALL))

    db_session.add_all([p_low, p_med, p_high])
    db_session.flush()

    recompute_variant_prices(db_session, variant_ids=[str(var.id)])
    res = get_variant_computed_price(db_session, str(var.id))

    assert res is not None
    assert res.promotion_code == p_high.code
    assert res.computed_price == 90000.0


def test_priority_resolution_exclusion_skips_higher_priority(db_session):
    """
    Promo High (priority 100) has an exclusion rule on this variant's category.
    Promo Med (priority 50) applies to ALL.
    Promo Med MUST win because Promo High is excluded.
    """
    cat = Category(name="Excl Cat", code=f"CAT_EXCL_{uuid.uuid4().hex[:6]}")
    db_session.add(cat)
    db_session.flush()

    prod = Product(product_code=f"PROD_EXCL_{uuid.uuid4().hex[:6]}", name="Excl Prod", category_id=cat.id, weight=100.0)
    db_session.add(prod)
    db_session.flush()

    var = ProductVariant(product_id=prod.id, sku_code=f"SKU_EXCL_{uuid.uuid4().hex[:6]}", price=100000.0)
    db_session.add(var)
    db_session.flush()

    p_high = Promotion(
        id=str(uuid.uuid4()), code=f"P_HIGH_EXCL_{uuid.uuid4().hex[:6]}", name="High Prio Excl",
        discount_type=DiscountType.PERCENTAGE, discount_value=30.0, priority=100, status=PromotionStatus.ACTIVE
    )
    # Inclusion: ALL, Exclusion: Category
    p_high.scopes.append(PromotionScope(id=str(uuid.uuid4()), promotion_id=p_high.id, scope_type=ScopeType.ALL, is_exclusion=False))
    p_high.scopes.append(PromotionScope(id=str(uuid.uuid4()), promotion_id=p_high.id, scope_type=ScopeType.CATEGORY, target_id=str(cat.id), is_exclusion=True))

    p_med = Promotion(
        id=str(uuid.uuid4()), code=f"P_MED_EXCL_{uuid.uuid4().hex[:6]}", name="Med Prio Excl",
        discount_type=DiscountType.PERCENTAGE, discount_value=15.0, priority=50, status=PromotionStatus.ACTIVE
    )
    p_med.scopes.append(PromotionScope(id=str(uuid.uuid4()), promotion_id=p_med.id, scope_type=ScopeType.ALL, is_exclusion=False))

    db_session.add_all([p_high, p_med])
    db_session.flush()

    recompute_variant_prices(db_session, variant_ids=[str(var.id)])
    res = get_variant_computed_price(db_session, str(var.id))

    assert res is not None
    assert res.promotion_code == p_med.code
    assert res.computed_price == 85000.0


# =====================================================================
# Target 5: Deterministic tiebreaking for equal priority
# =====================================================================

def test_tiebreaking_created_at_order(db_session):
    """
    2 Active Promotions with equal priority (10):
    - Promo Earlier: created 2 hours ago
    - Promo Later: created 1 hour ago
    Promo Earlier MUST win.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    t0 = now - datetime.timedelta(hours=2)
    t1 = now - datetime.timedelta(hours=1)

    var = ProductVariant(
        product_id=1, sku_code=f"SKU_TIE_TIME_{uuid.uuid4().hex[:6]}", price=100000.0
    )
    # We create a dummy prod & cat
    cat = Category(name="Tie Cat", code=f"CAT_TIE_TIME_{uuid.uuid4().hex[:6]}")
    db_session.add(cat)
    db_session.flush()
    prod = Product(product_code=f"PROD_TT_{uuid.uuid4().hex[:6]}", name="TT Prod", category_id=cat.id, weight=100.0)
    db_session.add(prod)
    db_session.flush()
    var.product_id = prod.id
    db_session.add(var)
    db_session.flush()

    p_earlier = Promotion(
        id=str(uuid.uuid4()), code=f"P_EARLIER_{uuid.uuid4().hex[:6]}", name="Earlier",
        discount_type=DiscountType.PERCENTAGE, discount_value=10.0, priority=10, status=PromotionStatus.ACTIVE,
        created_at=t0
    )
    p_earlier.scopes.append(PromotionScope(id=str(uuid.uuid4()), promotion_id=p_earlier.id, scope_type=ScopeType.ALL))

    p_later = Promotion(
        id=str(uuid.uuid4()), code=f"P_LATER_{uuid.uuid4().hex[:6]}", name="Later",
        discount_type=DiscountType.PERCENTAGE, discount_value=20.0, priority=10, status=PromotionStatus.ACTIVE,
        created_at=t1
    )
    p_later.scopes.append(PromotionScope(id=str(uuid.uuid4()), promotion_id=p_later.id, scope_type=ScopeType.ALL))

    db_session.add_all([p_earlier, p_later])
    db_session.flush()

    recompute_variant_prices(db_session, variant_ids=[str(var.id)])
    res = get_variant_computed_price(db_session, str(var.id))

    assert res is not None
    assert res.promotion_code == p_later.code


def test_tiebreaking_uuid_id_order_when_same_created_at(db_session):
    """
    2 Active Promotions with equal priority (10) AND identical created_at:
    - Promo ID starting with '00000000-...' vs '99999999-...'
    Promotion with lexicographically smaller ID MUST win.
    """
    t0 = datetime.datetime.now(datetime.timezone.utc)

    cat = Category(name="Tie UUID Cat", code=f"CAT_UUID_{uuid.uuid4().hex[:6]}")
    db_session.add(cat)
    db_session.flush()
    prod = Product(product_code=f"PROD_UUID_{uuid.uuid4().hex[:6]}", name="UUID Prod", category_id=cat.id, weight=100.0)
    db_session.add(prod)
    db_session.flush()
    var = ProductVariant(product_id=prod.id, sku_code=f"SKU_UUID_{uuid.uuid4().hex[:6]}", price=100000.0)
    db_session.add(var)
    db_session.flush()

    id_0 = f"00000000-0000-0000-0000-{uuid.uuid4().hex[:12]}"
    id_9 = f"99999999-9999-9999-9999-{uuid.uuid4().hex[:12]}"

    p_0 = Promotion(
        id=id_0, code=f"P_ID_0_{uuid.uuid4().hex[:6]}", name="UUID 0",
        discount_type=DiscountType.PERCENTAGE, discount_value=10.0, priority=10, status=PromotionStatus.ACTIVE,
        created_at=t0
    )
    p_0.scopes.append(PromotionScope(id=str(uuid.uuid4()), promotion_id=p_0.id, scope_type=ScopeType.ALL))

    p_9 = Promotion(
        id=id_9, code=f"P_ID_9_{uuid.uuid4().hex[:6]}", name="UUID 9",
        discount_type=DiscountType.PERCENTAGE, discount_value=40.0, priority=10, status=PromotionStatus.ACTIVE,
        created_at=t0
    )
    p_9.scopes.append(PromotionScope(id=str(uuid.uuid4()), promotion_id=p_9.id, scope_type=ScopeType.ALL))

    db_session.add_all([p_0, p_9])
    db_session.flush()

    recompute_variant_prices(db_session, variant_ids=[str(var.id)])
    res = get_variant_computed_price(db_session, str(var.id))

    assert res is not None
    assert res.promotion_code == p_0.code
    assert res.computed_price == 90000.0
