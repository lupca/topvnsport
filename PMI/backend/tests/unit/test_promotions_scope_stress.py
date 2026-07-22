import uuid
import pytest
from models import Promotion, PromotionScope, PromotionStatus, DiscountType, ScopeType, ProductVariant, Product, Category
from services.promotion_service import eval_variant_promotion_match, build_category_ancestor_map, matches_single_scope


def setup_deep_category_tree(db_session):
    """
    Sets up a 5-tier category tree:
    L1 (Root) -> L2 -> L3 -> L4 -> L5
    Product 1 (under L1) -> Var1_1
    Product 3 (under L3) -> Var3_1, Var3_2
    Product 5 (under L5) -> Var5_1, Var5_2
    Uncategorized Product -> VarUncat
    """
    l1 = Category(name="Cat L1", code=f"L1_{uuid.uuid4().hex[:6]}")
    db_session.add(l1)
    db_session.flush()

    l2 = Category(name="Cat L2", code=f"L2_{uuid.uuid4().hex[:6]}", parent_id=l1.id)
    db_session.add(l2)
    db_session.flush()

    l3 = Category(name="Cat L3", code=f"L3_{uuid.uuid4().hex[:6]}", parent_id=l2.id)
    db_session.add(l3)
    db_session.flush()

    l4 = Category(name="Cat L4", code=f"L4_{uuid.uuid4().hex[:6]}", parent_id=l3.id)
    db_session.add(l4)
    db_session.flush()

    l5 = Category(name="Cat L5", code=f"L5_{uuid.uuid4().hex[:6]}", parent_id=l4.id)
    db_session.add(l5)
    db_session.flush()

    # Products
    prod1 = Product(product_code=f"P1_{uuid.uuid4().hex[:6]}", name="Prod 1", category_id=l1.id, weight=10.0)
    prod3 = Product(product_code=f"P3_{uuid.uuid4().hex[:6]}", name="Prod 3", category_id=l3.id, weight=10.0)
    prod5 = Product(product_code=f"P5_{uuid.uuid4().hex[:6]}", name="Prod 5", category_id=l5.id, weight=10.0)
    prod_uncat = Product(product_code=f"PUNCAT_{uuid.uuid4().hex[:6]}", name="Prod Uncat", category_id=None, weight=10.0)
    db_session.add_all([prod1, prod3, prod5, prod_uncat])
    db_session.flush()

    # Variants
    var1_1 = ProductVariant(product_id=prod1.id, sku_code=f"SKU_1_1_{uuid.uuid4().hex[:6]}", price=100.0)
    var3_1 = ProductVariant(product_id=prod3.id, sku_code=f"SKU_3_1_{uuid.uuid4().hex[:6]}", price=300.0)
    var3_2 = ProductVariant(product_id=prod3.id, sku_code=f"SKU_3_2_{uuid.uuid4().hex[:6]}", price=350.0)
    var5_1 = ProductVariant(product_id=prod5.id, sku_code=f"SKU_5_1_{uuid.uuid4().hex[:6]}", price=500.0)
    var5_2 = ProductVariant(product_id=prod5.id, sku_code=f"SKU_5_2_{uuid.uuid4().hex[:6]}", price=550.0)
    var_uncat = ProductVariant(product_id=prod_uncat.id, sku_code=f"SKU_UNCAT_{uuid.uuid4().hex[:6]}", price=900.0)
    db_session.add_all([var1_1, var3_1, var3_2, var5_1, var5_2, var_uncat])
    db_session.flush()

    ancestor_map = build_category_ancestor_map(db_session)
    return {
        "l1": l1, "l2": l2, "l3": l3, "l4": l4, "l5": l5,
        "prod1": prod1, "prod3": prod3, "prod5": prod5, "prod_uncat": prod_uncat,
        "var1_1": var1_1, "var3_1": var3_1, "var3_2": var3_2, "var5_1": var5_1, "var5_2": var5_2, "var_uncat": var_uncat,
        "ancestor_map": ancestor_map
    }


def test_deep_category_ancestor_matching(db_session):
    """Test 5-level deep category hierarchy matching."""
    ctx = setup_deep_category_tree(db_session)
    
    # Target Root L1 -> should match var1_1, var3_1, var3_2, var5_1, var5_2
    promo_l1 = Promotion(id=str(uuid.uuid4()), code="PROMO_L1", name="L1 Scope", discount_type=DiscountType.PERCENTAGE, discount_value=10.0)
    promo_l1.scopes.append(PromotionScope(id=str(uuid.uuid4()), promotion_id=promo_l1.id, scope_type=ScopeType.CATEGORY, target_id=str(ctx["l1"].id)))

    assert eval_variant_promotion_match(ctx["var1_1"], promo_l1, ctx["ancestor_map"]) is True
    assert eval_variant_promotion_match(ctx["var3_1"], promo_l1, ctx["ancestor_map"]) is True
    assert eval_variant_promotion_match(ctx["var5_1"], promo_l1, ctx["ancestor_map"]) is True
    assert eval_variant_promotion_match(ctx["var_uncat"], promo_l1, ctx["ancestor_map"]) is False

    # Target Mid-level L4 -> should match var5_1 (under L5->L4), but NOT var3_1 (under L3) or var1_1 (under L1)
    promo_l4 = Promotion(id=str(uuid.uuid4()), code="PROMO_L4", name="L4 Scope", discount_type=DiscountType.PERCENTAGE, discount_value=10.0)
    promo_l4.scopes.append(PromotionScope(id=str(uuid.uuid4()), promotion_id=promo_l4.id, scope_type=ScopeType.CATEGORY, target_id=str(ctx["l4"].id)))

    assert eval_variant_promotion_match(ctx["var5_1"], promo_l4, ctx["ancestor_map"]) is True
    assert eval_variant_promotion_match(ctx["var3_1"], promo_l4, ctx["ancestor_map"]) is False
    assert eval_variant_promotion_match(ctx["var1_1"], promo_l4, ctx["ancestor_map"]) is False


def test_ancestor_map_cycle_resilience(db_session):
    """Test ancestor map builder resilience when parent_id forms a loop."""
    c1 = Category(name="Cycle 1", code=f"CYC1_{uuid.uuid4().hex[:6]}")
    c2 = Category(name="Cycle 2", code=f"CYC2_{uuid.uuid4().hex[:6]}")
    db_session.add_all([c1, c2])
    db_session.flush()
    
    # Create cycle: c1 -> c2 -> c1
    c1.parent_id = c2.id
    c2.parent_id = c1.id
    db_session.flush()

    # Build ancestor map should terminate without RecursionError or infinite loop
    ancestor_map = build_category_ancestor_map(db_session)
    assert c2.id in ancestor_map.get(c1.id, set())
    assert c1.id in ancestor_map.get(c2.id, set())


def test_exclusion_overrides_across_hierarchy_levels(db_session):
    """Test exclusion rules overriding inclusion across root/mid/leaf/product/variant levels."""
    ctx = setup_deep_category_tree(db_session)

    # 1. Inclusion L1 (root category), Exclusion L4 (mid category)
    # var5_1 is under L5->L4->L3->L2->L1 -> excluded by L4
    # var3_1 is under L3->L2->L1 -> included (not under L4)
    promo1 = Promotion(id=str(uuid.uuid4()), code="PROMO_EX_MID", name="Exclusion Mid", discount_type=DiscountType.PERCENTAGE, discount_value=10.0)
    promo1.scopes.append(PromotionScope(id=str(uuid.uuid4()), promotion_id=promo1.id, scope_type=ScopeType.CATEGORY, target_id=str(ctx["l1"].id)))
    promo1.scopes.append(PromotionScope(id=str(uuid.uuid4()), promotion_id=promo1.id, scope_type=ScopeType.CATEGORY, target_id=str(ctx["l4"].id), is_exclusion=True))

    assert eval_variant_promotion_match(ctx["var3_1"], promo1, ctx["ancestor_map"]) is True
    assert eval_variant_promotion_match(ctx["var5_1"], promo1, ctx["ancestor_map"]) is False

    # 2. Inclusion L5 (leaf category), Exclusion L1 (root category)
    # Ancestor exclusion on root level should override leaf inclusion!
    promo2 = Promotion(id=str(uuid.uuid4()), code="PROMO_EX_ROOT", name="Exclusion Root", discount_type=DiscountType.PERCENTAGE, discount_value=10.0)
    promo2.scopes.append(PromotionScope(id=str(uuid.uuid4()), promotion_id=promo2.id, scope_type=ScopeType.CATEGORY, target_id=str(ctx["l5"].id)))
    promo2.scopes.append(PromotionScope(id=str(uuid.uuid4()), promotion_id=promo2.id, scope_type=ScopeType.CATEGORY, target_id=str(ctx["l1"].id), is_exclusion=True))

    assert eval_variant_promotion_match(ctx["var5_1"], promo2, ctx["ancestor_map"]) is False

    # 3. Inclusion ALL, Exclusion VARIANT var5_1
    promo3 = Promotion(id=str(uuid.uuid4()), code="PROMO_EX_VAR_ALL", name="Exclusion Var All", discount_type=DiscountType.PERCENTAGE, discount_value=10.0)
    promo3.scopes.append(PromotionScope(id=str(uuid.uuid4()), promotion_id=promo3.id, scope_type=ScopeType.ALL))
    promo3.scopes.append(PromotionScope(id=str(uuid.uuid4()), promotion_id=promo3.id, scope_type=ScopeType.VARIANT, target_id=str(ctx["var5_1"].id), is_exclusion=True))

    assert eval_variant_promotion_match(ctx["var5_1"], promo3, ctx["ancestor_map"]) is False
    assert eval_variant_promotion_match(ctx["var5_2"], promo3, ctx["ancestor_map"]) is True
    assert eval_variant_promotion_match(ctx["var_uncat"], promo3, ctx["ancestor_map"]) is True

    # 4. Inclusion VARIANT var5_1, Exclusion ALL
    # Global exclusion overrides specific variant inclusion
    promo4 = Promotion(id=str(uuid.uuid4()), code="PROMO_EX_ALL_VAR", name="Exclusion All Specific Var", discount_type=DiscountType.PERCENTAGE, discount_value=10.0)
    promo4.scopes.append(PromotionScope(id=str(uuid.uuid4()), promotion_id=promo4.id, scope_type=ScopeType.VARIANT, target_id=str(ctx["var5_1"].id)))
    promo4.scopes.append(PromotionScope(id=str(uuid.uuid4()), promotion_id=promo4.id, scope_type=ScopeType.ALL, is_exclusion=True))

    assert eval_variant_promotion_match(ctx["var5_1"], promo4, ctx["ancestor_map"]) is False


def test_dict_scope_structures(db_session):
    """Test eval_variant_promotion_match with dict scopes (as passed from JSON payloads or previews)."""
    ctx = setup_deep_category_tree(db_session)

    promo_dict = {
        "scopes": [
            {"scope_type": "CATEGORY", "target_id": str(ctx["l3"].id), "is_exclusion": False},
            {"scope_type": "PRODUCT", "target_id": str(ctx["prod3"].id), "is_exclusion": True}
        ]
    }

    # var3_1 is under prod3 -> excluded
    assert eval_variant_promotion_match(ctx["var3_1"], promo_dict, ctx["ancestor_map"]) is False
    # var5_1 is under L5->L4->L3 -> included by L3 category, not excluded by prod3
    assert eval_variant_promotion_match(ctx["var5_1"], promo_dict, ctx["ancestor_map"]) is True
