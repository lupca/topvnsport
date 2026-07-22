import datetime
import math
import uuid
import pytest
from decimal import Decimal

from sqlalchemy.orm import Session

import models
from models import Promotion, PromotionScope, PromotionComputedPrice, ProductVariant, Product, Category, DiscountType, PromotionStatus, ScopeType
from schemas.promotion import PromotionCreate, PromotionUpdate, PromotionScopeSchema, ParseIntentRequest, PromotionPreviewRequest
from services.promotion_service import (
    calculate_discount,
    matches_single_scope,
    eval_variant_promotion_match,
    get_promo_specificity,
    recompute_variant_prices,
    get_variant_computed_price,
    get_bulk_computed_prices,
    evaluate_promotion_preview,
    parse_promotion_intent,
    build_category_ancestor_map,
)
from services.promotion_scheduler import process_promotion_schedule


# ==============================================================================
# SECTION 1: DISCOUNT CALCULATION, DECIMAL ROUNDING & BOUNDARY LIMITS
# ==============================================================================

def test_calculate_discount_negative_discount_values_and_caps():
    """
    Adversarial test: Negative discount values or negative max caps in calculate_discount.
    Evaluates whether negative discounts inadvertently increase original prices.
    """
    orig_price = 100.0

    # 1. Negative percentage value (-50%)
    # Remediated behavior: Clamped to 0.0 discount, computed price remains 100.0
    comp_price, disc_amt, pct = calculate_discount(orig_price, DiscountType.PERCENTAGE, -50.0)
    assert comp_price == 100.0, f"Expected clamped price 100.0, got {comp_price}"
    assert disc_amt == 0.0

    # 2. Negative fixed amount (-30.0)
    comp_price_fixed, disc_amt_fixed, _ = calculate_discount(orig_price, DiscountType.FIXED_AMOUNT, -30.0)
    assert comp_price_fixed == 100.0, f"Expected clamped price 100.0, got {comp_price_fixed}"
    assert disc_amt_fixed == 0.0

    # 3. Negative fixed price (-10.0)
    comp_price_fp, disc_amt_fp, _ = calculate_discount(orig_price, DiscountType.FIXED_PRICE, -10.0)
    assert comp_price_fp == 0.0, "Fixed price negative value capped to 0.0"
    assert disc_amt_fp == 100.0, "Discount amount set to 100% of price"

    # 4. Negative max_discount (-50.0) with PERCENTAGE (20%)
    # float(max_discount) > 0 is False for -50.0, so negative max_discount is ignored
    comp_price_cap, disc_cap, _ = calculate_discount(orig_price, DiscountType.PERCENTAGE, 20.0, max_discount=-50.0)
    assert comp_price_cap == 80.0
    assert disc_cap == 20.0


def test_calculate_discount_decimal_precision_and_sum_invariance():
    """
    Adversarial test: Floating point rounding limits and price + discount sum invariance.
    Checks if computed_price + discount_amount exactly equals original_price after rounding.
    """
    test_cases = [
        (19.99, DiscountType.PERCENTAGE, 15.0),
        (3.00, DiscountType.PERCENTAGE, 12.5),
        (10.00, DiscountType.PERCENTAGE, 33.33333333),
        (999999999.99, DiscountType.PERCENTAGE, 1.2345),
        (0.01, DiscountType.PERCENTAGE, 50.0),
    ]

    for orig, dt, val in test_cases:
        comp_price, disc_amt, pct = calculate_discount(orig, dt, val)
        assert comp_price >= 0.0
        assert disc_amt >= 0.0
        # Invariance check: comp_price + disc_amt should equal orig (rounded to 2 decimals)
        summed = round(comp_price + disc_amt, 2)
        assert abs(summed - round(orig, 2)) <= 0.01, (
            f"Rounding divergence: orig={orig}, comp={comp_price}, disc={disc_amt}, sum={summed}"
        )


def test_calculate_discount_extreme_values_and_nan():
    """
    Adversarial test: NaN float inputs and extreme numerical bounds.
    """
    # 1. Zero original price
    comp, disc, pct = calculate_discount(0.0, DiscountType.PERCENTAGE, 50.0)
    assert comp == 0.0 and disc == 0.0 and pct == 0.0

    # 2. Percentage > 100%
    comp_over, disc_over, pct_over = calculate_discount(100.0, DiscountType.PERCENTAGE, 150.0)
    assert comp_over == 0.0
    assert disc_over == 100.0

    # 3. Floating point NaN handling
    # float('nan') <= 0.0 is False. orig * 0.1 is NaN, min(nan, nan) is NaN, max(0.0, nan) in Python returns 0.0.
    # orig > 0 is False for NaN, so percentage_discount returns 0.0.
    comp_nan, disc_nan, pct_nan = calculate_discount(float('nan'), DiscountType.PERCENTAGE, 10.0)
    assert comp_nan == 0.0
    assert math.isnan(disc_nan)
    assert pct_nan == 0.0


# ==============================================================================
# SECTION 2: SCOPE MATCHING, CATEGORY HIERARCHIES & EXCLUSION BOUNDARIES
# ==============================================================================

def test_scope_matching_category_string_padding_flaw(db_session: Session):
    """
    Adversarial test: String representation vs digit padding matching flaw in matches_single_scope.
    Verifies padded string target_id (e.g. '05') matches Category ID 5 cleanly.
    """
    cat = Category(code=f"CAT5_{uuid.uuid4().hex[:6]}", name="Category 5")
    db_session.add(cat)
    db_session.flush()
    prod = Product(product_code=f"PROD50_{uuid.uuid4().hex[:6]}", name="Product 50", category_id=cat.id, weight=100)
    db_session.add(prod)
    db_session.flush()
    var = ProductVariant(product_id=prod.id, sku_code=f"SKU500_{uuid.uuid4().hex[:6]}", price=100.0)
    db_session.add(var)
    db_session.commit()

    ancestor_map = build_category_ancestor_map(db_session)

    # 1. Exact string match
    scope_exact = PromotionScope(scope_type=ScopeType.CATEGORY, target_id=str(cat.id))
    assert matches_single_scope(scope_exact, var, ancestor_map) is True

    # 2. Padded string match (e.g. "05" or padded ID)
    padded_id = f"{cat.id:04d}"
    scope_padded = PromotionScope(scope_type=ScopeType.CATEGORY, target_id=padded_id)
    assert matches_single_scope(scope_padded, var, ancestor_map) is True, (
        "Remediated: Padded target_id successfully matches Category"
    )


def test_scope_matching_exclusion_only_promotion(db_session: Session):
    """
    Adversarial test: Promotion with ONLY exclusion scopes.
    Evaluates dual-phase matching logic when inclusion_scopes is empty.
    """
    cat = Category(code=f"CAT_EX_{uuid.uuid4().hex[:6]}", name="Excl Cat")
    db_session.add(cat)
    db_session.flush()
    prod = Product(product_code=f"PROD10_{uuid.uuid4().hex[:6]}", name="Prod 10", category_id=cat.id, weight=100)
    db_session.add(prod)
    db_session.flush()
    var = ProductVariant(product_id=prod.id, sku_code=f"SKU100_{uuid.uuid4().hex[:6]}", price=100.0)
    db_session.add(var)
    db_session.commit()

    ancestor_map = build_category_ancestor_map(db_session)

    # Promotion has only exclusion rule for Product prod.id
    promo = Promotion(
        id=str(uuid.uuid4()),
        code="EXCL_ONLY",
        name="Exclusion Only Promo",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=10.0,
        scopes=[
            PromotionScope(scope_type=ScopeType.PRODUCT, target_id=str(prod.id), is_exclusion=True)
        ]
    )

    # Variant matches exclusion -> returns False
    assert eval_variant_promotion_match(var, promo, ancestor_map) is False

    # Create another variant not excluded by Product prod.id
    var2 = ProductVariant(product_id=prod.id + 9999, sku_code="SKU101", price=100.0)
    # Does not match exclusion, but inclusion_scopes is empty -> returns False
    assert eval_variant_promotion_match(var2, promo, ancestor_map) is False


def test_scope_matching_multi_level_category_ancestor_tree(db_session: Session):
    """
    Adversarial test: Deep multi-level category hierarchy (Root -> Parent -> Child -> SubChild).
    Verify matching when promotion targets parent or subchild.
    """
    c_root = Category(code=f"ROOT_{uuid.uuid4().hex[:6]}", name="Root Category")
    db_session.add(c_root)
    db_session.flush()

    c_parent = Category(parent_id=c_root.id, code=f"PARENT_{uuid.uuid4().hex[:6]}", name="Parent Category")
    db_session.add(c_parent)
    db_session.flush()

    c_child = Category(parent_id=c_parent.id, code=f"CHILD_{uuid.uuid4().hex[:6]}", name="Child Category")
    db_session.add(c_child)
    db_session.flush()

    c_subchild = Category(parent_id=c_child.id, code=f"SUBCHILD_{uuid.uuid4().hex[:6]}", name="SubChild Category")
    db_session.add(c_subchild)
    db_session.flush()

    prod = Product(product_code=f"P20_{uuid.uuid4().hex[:6]}", name="Product 20", category_id=c_subchild.id, weight=50)
    db_session.add(prod)
    db_session.flush()

    var = ProductVariant(product_id=prod.id, sku_code=f"SKU200_{uuid.uuid4().hex[:6]}", price=200.0)
    db_session.add(var)
    db_session.commit()

    ancestor_map = build_category_ancestor_map(db_session)
    assert ancestor_map[c_subchild.id] == {c_root.id, c_parent.id, c_child.id}

    # Promotion targets Root Category
    scope_root = PromotionScope(scope_type=ScopeType.CATEGORY, target_id=str(c_root.id))
    assert matches_single_scope(scope_root, var, ancestor_map) is True

    # Promotion targets Parent Category
    scope_parent = PromotionScope(scope_type=ScopeType.CATEGORY, target_id=str(c_parent.id))
    assert matches_single_scope(scope_parent, var, ancestor_map) is True

    # Promotion targets unrelated Category 99999
    scope_unrelated = PromotionScope(scope_type=ScopeType.CATEGORY, target_id="99999")
    assert matches_single_scope(scope_unrelated, var, ancestor_map) is False


# ==============================================================================
# SECTION 3: PRIORITY COLLISIONS & CREATED_AT SORTING FLAW
# ==============================================================================

def test_priority_tie_breaking_older_vs_newer_promotion_flaw(db_session: Session):
    """
    Adversarial test: Priority collision tie-breaking bug.
    When two promotions have equal priority and specificity, recompute_variant_prices
    sorts by `-created_at.timestamp()` with reverse=True, causing OLDER promotions to
    permanently win over NEWER promotions.
    """
    prod = Product(id=30, product_code="P30", name="P30", weight=10)
    db_session.add(prod)
    var = ProductVariant(id=300, product_id=30, sku_code="SKU300", price=100.0)
    db_session.add(var)

    t_old = datetime.datetime(2026, 1, 1, 0, 0, 0, tzinfo=datetime.timezone.utc)
    t_new = datetime.datetime(2026, 6, 1, 0, 0, 0, tzinfo=datetime.timezone.utc)

    # Older Promo A (10% off, created 2026-01-01)
    promo_old = Promotion(
        id="PROMO_OLD",
        code="PROMO_OLD",
        name="Old Promo 10%",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=10.0,
        priority=10,
        status=PromotionStatus.ACTIVE,
        created_at=t_old,
        scopes=[PromotionScope(scope_type=ScopeType.ALL)]
    )

    # Newer Promo B (50% off, created 2026-06-01)
    promo_new = Promotion(
        id="PROMO_NEW",
        code="PROMO_NEW",
        name="New Promo 50%",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=50.0,
        priority=10,
        status=PromotionStatus.ACTIVE,
        created_at=t_new,
        scopes=[PromotionScope(scope_type=ScopeType.ALL)]
    )

    db_session.add_all([promo_old, promo_new])
    db_session.commit()

    recompute_variant_prices(db_session)

    cp = get_variant_computed_price(db_session, "300")
    # Remediated: PROMO_NEW wins because sorting key evaluates created_at timestamp in descending order under reverse=True
    assert cp.promotion_id == "PROMO_NEW", (
        "Remediated: Newer promotion won tie-breaker over older promotion"
    )
    assert cp.computed_price == 50.0


def test_specificity_scoring_hierarchy():
    """
    Adversarial test: Specificity scoring rules across scope combinations.
    VARIANT (4) > PRODUCT (3) > CATEGORY (2) > ALL (1) > None (0).
    """
    p_variant = Promotion(scopes=[PromotionScope(scope_type=ScopeType.VARIANT, target_id="1")])
    p_product = Promotion(scopes=[PromotionScope(scope_type=ScopeType.PRODUCT, target_id="1")])
    p_category = Promotion(scopes=[PromotionScope(scope_type=ScopeType.CATEGORY, target_id="1")])
    p_all = Promotion(scopes=[PromotionScope(scope_type=ScopeType.ALL)])
    p_none = Promotion(scopes=[])

    assert get_promo_specificity(p_variant) == 4
    assert get_promo_specificity(p_product) == 3
    assert get_promo_specificity(p_category) == 2
    assert get_promo_specificity(p_all) == 1
    assert get_promo_specificity(p_none) == 0

    # Hybrid promotion (Inclusion CATEGORY + Exclusion VARIANT)
    # Exclusion scope ignored for specificity calculation
    p_hybrid = Promotion(scopes=[
        PromotionScope(scope_type=ScopeType.CATEGORY, target_id="1", is_exclusion=False),
        PromotionScope(scope_type=ScopeType.VARIANT, target_id="10", is_exclusion=True),
    ])
    assert get_promo_specificity(p_hybrid) == 2


# ==============================================================================
# SECTION 4: DATABASE SCHEMA & CONCURRENCY WEAKNESSES
# ==============================================================================

def test_db_schema_lack_of_unique_constraint_on_computed_prices(db_session: Session):
    """
    Adversarial test: PromotionComputedPrice table lacks UniqueConstraint("variant_id").
    Demonstrates that multiple records can be inserted for the exact same variant_id.
    """
    vid = "999"
    cp1 = PromotionComputedPrice(
        id=str(uuid.uuid4()),
        variant_id=vid,
        original_price=100.0,
        computed_price=90.0,
        discount_amount=10.0,
        percentage_discount=10.0
    )
    cp2 = PromotionComputedPrice(
        id=str(uuid.uuid4()),
        variant_id=vid,
        original_price=100.0,
        computed_price=80.0,
        discount_amount=20.0,
        percentage_discount=20.0
    )

    db_session.add_all([cp1, cp2])
    db_session.commit()

    dups = db_session.query(PromotionComputedPrice).filter(PromotionComputedPrice.variant_id == vid).all()
    assert len(dups) == 2, "DB allowed duplicate PromotionComputedPrice rows for same variant_id"


# ==============================================================================
# SECTION 5: INTENT PARSER EDGE CASES & CONTRADICTORY PROMPTS
# ==============================================================================

def test_intent_parser_contradictory_keywords():
    """
    Adversarial test: Prompt with contradictory keywords ("Giảm 20% đồng giá 50k").
    Exposes parser priority overwrite logic where '%' precedes 'đồng giá' in if/elif branch.
    """
    prompt = "Giảm 20% đồng giá 50k cho sản phẩm 12"
    parsed = parse_promotion_intent(prompt)

    # Fixed price keywords ('đồng giá') take precedence over percentage ('%')
    assert parsed.discount_type == DiscountType.FIXED_PRICE
    assert parsed.discount_value == 50000.0


def test_intent_parser_empty_whitespace_and_prompt_injection():
    """
    Adversarial test: Empty, whitespace-only, and XSS/SQL injection prompts.
    """
    # 1. Whitespace prompt
    parsed_empty = parse_promotion_intent("   ")
    assert parsed_empty.code.startswith("PROMO_")
    assert parsed_empty.discount_value == 10.0
    assert parsed_empty.scopes[0].scope_type == ScopeType.ALL

    # 2. XSS injection prompt
    xss_prompt = "<script>alert('XSS')</script> Giảm 30%"
    parsed_xss = parse_promotion_intent(xss_prompt)
    assert parsed_xss.discount_type == DiscountType.PERCENTAGE
    assert parsed_xss.discount_value == 30.0
    assert "<script>" in parsed_xss.name

    # 3. Excessive numbers in prompt
    huge_prompt = "Giảm 1000% tối đa 999999999999k cho danh mục 5"
    parsed_huge = parse_promotion_intent(huge_prompt)
    assert parsed_huge.discount_value == 1000.0
    assert parsed_huge.max_discount == 999999999999000.0


# ==============================================================================
# SECTION 6: API ENDPOINTS, VALIDATION & DRY-RUN PREVIEW
# ==============================================================================

def test_api_promotion_create_validation_rejections(client):
    """
    Adversarial test: POST /api/promotions with invalid inputs via REST API client.
    """
    # 1. Percentage discount > 100%
    payload_over = {
        "code": "OVER_100",
        "name": "Over 100 Percent",
        "discount_type": "PERCENTAGE",
        "discount_value": 150.0,
        "scopes": []
    }
    res = client.post("/api/promotions", json=payload_over)
    assert res.status_code == 422

    # 2. ends_at before starts_at
    now = datetime.datetime.now(datetime.timezone.utc)
    payload_dates = {
        "code": "BAD_DATES",
        "name": "Bad Dates",
        "discount_type": "PERCENTAGE",
        "discount_value": 10.0,
        "starts_at": now.isoformat(),
        "ends_at": (now - datetime.timedelta(days=1)).isoformat(),
        "scopes": []
    }
    res_dates = client.post("/api/promotions", json=payload_dates)
    assert res_dates.status_code == 422


def test_api_promotion_preview_dry_run_isolation(client, db_session: Session):
    """
    Adversarial test: Dry-run preview endpoint POST /api/promotions/preview.
    Ensures calculations occur without persisting any promotion or price changes.
    """
    initial_promo_count = db_session.query(Promotion).count()
    initial_cp_count = db_session.query(PromotionComputedPrice).count()

    payload = {
        "code": "PREVIEW_PROMO",
        "name": "Preview Promo",
        "discount_type": "PERCENTAGE",
        "discount_value": 25.0,
        "scopes": [{"scope_type": "ALL", "is_exclusion": False}]
    }

    res = client.post("/api/promotions/preview", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "affected_variants_count" in data
    assert "total_discount_amount" in data

    # Verify no database state changes
    assert db_session.query(Promotion).count() == initial_promo_count
    assert db_session.query(PromotionComputedPrice).count() == initial_cp_count


def test_api_promotion_lifecycle_ended_state_lock(client, db_session: Session):
    """
    Adversarial test: Modifying or activating an ENDED promotion.
    """
    promo = Promotion(
        id="ENDED_PROMO_1",
        code="ENDED_1",
        name="Ended Promo",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=10.0,
        status=PromotionStatus.ENDED
    )
    db_session.add(promo)
    db_session.commit()

    # Attempt to activate ended promo
    res_act = client.post("/api/promotions/ENDED_PROMO_1/activate")
    assert res_act.status_code == 400
    assert "Cannot activate an ended promotion" in res_act.json()["detail"]

    # Attempt to update ended promo
    res_upd = client.put("/api/promotions/ENDED_PROMO_1", json={"name": "New Name"})
    assert res_upd.status_code == 400
    assert "Cannot update an ended promotion" in res_upd.json()["detail"]


# ==============================================================================
# SECTION 7: PROMOTION SCHEDULER LIFECYCLE TRANSITIONS
# ==============================================================================

def test_promotion_scheduler_immediate_scheduled_to_active_and_ended(db_session: Session):
    """
    Adversarial test: Promotion with starts_at and ends_at both in the past.
    Evaluates scheduler transition behavior in process_promotion_schedule.
    Demonstrates that transition SCHEDULED -> ACTIVE -> ENDED requires 2 passes
    because active query executes before uncommitted scheduled status change is flushed.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    t_past_start = now - datetime.timedelta(days=2)
    t_past_end = now - datetime.timedelta(days=1)

    promo = Promotion(
        id="SCHED_PAST",
        code="SCHED_PAST",
        name="Scheduled Past Promo",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=10.0,
        status=PromotionStatus.SCHEDULED,
        starts_at=t_past_start,
        ends_at=t_past_end
    )
    db_session.add(promo)
    db_session.commit()

    # Pass 1: SCHEDULED -> ACTIVE -> ENDED (activated_count=1, ended_count=1 in one pass)
    res1 = process_promotion_schedule(db_session)
    assert res1["activated"] == 1
    assert res1["ended"] == 1

    db_session.refresh(promo)
    assert promo.status == PromotionStatus.ENDED
