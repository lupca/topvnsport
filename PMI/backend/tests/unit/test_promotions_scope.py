import uuid
import pytest
from models import Promotion, PromotionScope, PromotionStatus, DiscountType, ScopeType, ProductVariant, Product, Category
from services.promotion_service import eval_variant_promotion_match, build_category_ancestor_map


def setup_catalog_tree(db_session):
    """
    Sets up a 2-tier category tree, products, and variants for scope testing.
    Cat Root (ID) -> Cat Sub (ID)
    Product 1 (under Cat Sub) -> Variant 101, Variant 102
    Product 2 (under Cat Root) -> Variant 201
    """
    cat_root = Category(name="Category Root", code=f"CAT_ROOT_{uuid.uuid4().hex[:6]}")
    db_session.add(cat_root)
    db_session.flush()

    cat_sub = Category(name="Category Sub", code=f"CAT_SUB_{uuid.uuid4().hex[:6]}", parent_id=cat_root.id)
    db_session.add(cat_sub)
    db_session.flush()

    cat_other = Category(name="Category Other", code=f"CAT_OTHER_{uuid.uuid4().hex[:6]}")
    db_session.add(cat_other)
    db_session.flush()

    prod1 = Product(product_code=f"PROD_1_{uuid.uuid4().hex[:6]}", name="Product 1", category_id=cat_sub.id, weight=100.0)
    prod2 = Product(product_code=f"PROD_2_{uuid.uuid4().hex[:6]}", name="Product 2", category_id=cat_other.id, weight=100.0)
    db_session.add_all([prod1, prod2])
    db_session.flush()

    var101 = ProductVariant(product_id=prod1.id, sku_code=f"SKU_101_{uuid.uuid4().hex[:6]}", price=100000.0)
    var102 = ProductVariant(product_id=prod1.id, sku_code=f"SKU_102_{uuid.uuid4().hex[:6]}", price=150000.0)
    var201 = ProductVariant(product_id=prod2.id, sku_code=f"SKU_201_{uuid.uuid4().hex[:6]}", price=200000.0)
    db_session.add_all([var101, var102, var201])
    db_session.flush()

    ancestor_map = build_category_ancestor_map(db_session)
    return {
        "cat_root": cat_root,
        "cat_sub": cat_sub,
        "cat_other": cat_other,
        "prod1": prod1,
        "prod2": prod2,
        "var101": var101,
        "var102": var102,
        "var201": var201,
        "ancestor_map": ancestor_map
    }


def test_scope_all_targets_every_variant(db_session):
    """Scope ALL targets every variant."""
    ctx = setup_catalog_tree(db_session)
    promo = Promotion(id=str(uuid.uuid4()), code="PROMO_ALL", name="All Scope", discount_type=DiscountType.PERCENTAGE, discount_value=10.0)
    promo.scopes.append(PromotionScope(id=str(uuid.uuid4()), promotion_id=promo.id, scope_type=ScopeType.ALL))

    assert eval_variant_promotion_match(ctx["var101"], promo, ctx["ancestor_map"]) is True
    assert eval_variant_promotion_match(ctx["var102"], promo, ctx["ancestor_map"]) is True
    assert eval_variant_promotion_match(ctx["var201"], promo, ctx["ancestor_map"]) is True


def test_scope_category_targeting(db_session):
    """Scope CATEGORY targeting root category includes sub-category variants."""
    ctx = setup_catalog_tree(db_session)
    promo = Promotion(id=str(uuid.uuid4()), code="PROMO_CAT", name="Category Scope", discount_type=DiscountType.PERCENTAGE, discount_value=10.0)
    promo.scopes.append(PromotionScope(id=str(uuid.uuid4()), promotion_id=promo.id, scope_type=ScopeType.CATEGORY, target_id=str(ctx["cat_root"].id)))

    # var101 is under cat_sub which is a child of cat_root -> matches via ancestor map!
    assert eval_variant_promotion_match(ctx["var101"], promo, ctx["ancestor_map"]) is True
    assert eval_variant_promotion_match(ctx["var102"], promo, ctx["ancestor_map"]) is True
    # var201 is under cat_other -> does not match
    assert eval_variant_promotion_match(ctx["var201"], promo, ctx["ancestor_map"]) is False


def test_scope_product_targeting(db_session):
    """Scope PRODUCT targeting prod1."""
    ctx = setup_catalog_tree(db_session)
    promo = Promotion(id=str(uuid.uuid4()), code="PROMO_PROD", name="Product Scope", discount_type=DiscountType.PERCENTAGE, discount_value=10.0)
    promo.scopes.append(PromotionScope(id=str(uuid.uuid4()), promotion_id=promo.id, scope_type=ScopeType.PRODUCT, target_id=str(ctx["prod1"].id)))

    assert eval_variant_promotion_match(ctx["var101"], promo, ctx["ancestor_map"]) is True
    assert eval_variant_promotion_match(ctx["var102"], promo, ctx["ancestor_map"]) is True
    assert eval_variant_promotion_match(ctx["var201"], promo, ctx["ancestor_map"]) is False


def test_scope_variant_targeting(db_session):
    """Scope VARIANT targeting var101 specifically."""
    ctx = setup_catalog_tree(db_session)
    promo = Promotion(id=str(uuid.uuid4()), code="PROMO_VAR", name="Variant Scope", discount_type=DiscountType.PERCENTAGE, discount_value=10.0)
    promo.scopes.append(PromotionScope(id=str(uuid.uuid4()), promotion_id=promo.id, scope_type=ScopeType.VARIANT, target_id=str(ctx["var101"].id)))

    assert eval_variant_promotion_match(ctx["var101"], promo, ctx["ancestor_map"]) is True
    assert eval_variant_promotion_match(ctx["var102"], promo, ctx["ancestor_map"]) is False
    assert eval_variant_promotion_match(ctx["var201"], promo, ctx["ancestor_map"]) is False


def test_exclusion_override_category(db_session):
    """Inclusion ALL, Exclusion CATEGORY cat_other."""
    ctx = setup_catalog_tree(db_session)
    promo = Promotion(id=str(uuid.uuid4()), code="PROMO_EX_CAT", name="Exclusion Cat Scope", discount_type=DiscountType.PERCENTAGE, discount_value=10.0)
    promo.scopes.append(PromotionScope(id=str(uuid.uuid4()), promotion_id=promo.id, scope_type=ScopeType.ALL))
    promo.scopes.append(PromotionScope(id=str(uuid.uuid4()), promotion_id=promo.id, scope_type=ScopeType.CATEGORY, target_id=str(ctx["cat_other"].id), is_exclusion=True))

    assert eval_variant_promotion_match(ctx["var101"], promo, ctx["ancestor_map"]) is True
    assert eval_variant_promotion_match(ctx["var102"], promo, ctx["ancestor_map"]) is True
    assert eval_variant_promotion_match(ctx["var201"], promo, ctx["ancestor_map"]) is False


def test_exclusion_override_product(db_session):
    """Inclusion CATEGORY cat_sub, Exclusion PRODUCT prod1."""
    ctx = setup_catalog_tree(db_session)
    promo = Promotion(id=str(uuid.uuid4()), code="PROMO_EX_PROD", name="Exclusion Prod Scope", discount_type=DiscountType.PERCENTAGE, discount_value=10.0)
    promo.scopes.append(PromotionScope(id=str(uuid.uuid4()), promotion_id=promo.id, scope_type=ScopeType.CATEGORY, target_id=str(ctx["cat_sub"].id)))
    promo.scopes.append(PromotionScope(id=str(uuid.uuid4()), promotion_id=promo.id, scope_type=ScopeType.PRODUCT, target_id=str(ctx["prod1"].id), is_exclusion=True))

    assert eval_variant_promotion_match(ctx["var101"], promo, ctx["ancestor_map"]) is False
    assert eval_variant_promotion_match(ctx["var102"], promo, ctx["ancestor_map"]) is False


def test_exclusion_override_variant(db_session):
    """Inclusion PRODUCT prod1, Exclusion VARIANT var101."""
    ctx = setup_catalog_tree(db_session)
    promo = Promotion(id=str(uuid.uuid4()), code="PROMO_EX_VAR", name="Exclusion Var Scope", discount_type=DiscountType.PERCENTAGE, discount_value=10.0)
    promo.scopes.append(PromotionScope(id=str(uuid.uuid4()), promotion_id=promo.id, scope_type=ScopeType.PRODUCT, target_id=str(ctx["prod1"].id)))
    promo.scopes.append(PromotionScope(id=str(uuid.uuid4()), promotion_id=promo.id, scope_type=ScopeType.VARIANT, target_id=str(ctx["var101"].id), is_exclusion=True))

    assert eval_variant_promotion_match(ctx["var101"], promo, ctx["ancestor_map"]) is False
    assert eval_variant_promotion_match(ctx["var102"], promo, ctx["ancestor_map"]) is True


def test_multi_scope_inclusions(db_session):
    """Inclusion PRODUCT prod1 AND VARIANT var201."""
    ctx = setup_catalog_tree(db_session)
    promo = Promotion(id=str(uuid.uuid4()), code="PROMO_MULTI_INC", name="Multi Inclusion Scope", discount_type=DiscountType.PERCENTAGE, discount_value=10.0)
    promo.scopes.append(PromotionScope(id=str(uuid.uuid4()), promotion_id=promo.id, scope_type=ScopeType.PRODUCT, target_id=str(ctx["prod1"].id)))
    promo.scopes.append(PromotionScope(id=str(uuid.uuid4()), promotion_id=promo.id, scope_type=ScopeType.VARIANT, target_id=str(ctx["var201"].id)))

    assert eval_variant_promotion_match(ctx["var101"], promo, ctx["ancestor_map"]) is True
    assert eval_variant_promotion_match(ctx["var102"], promo, ctx["ancestor_map"]) is True
    assert eval_variant_promotion_match(ctx["var201"], promo, ctx["ancestor_map"]) is True


def test_scope_unmatched_returns_false(db_session):
    """Variant does not match any inclusion scope -> returns False."""
    ctx = setup_catalog_tree(db_session)
    promo = Promotion(id=str(uuid.uuid4()), code="PROMO_UNMATCH", name="Unmatched Scope", discount_type=DiscountType.PERCENTAGE, discount_value=10.0)
    promo.scopes.append(PromotionScope(id=str(uuid.uuid4()), promotion_id=promo.id, scope_type=ScopeType.CATEGORY, target_id=str(ctx["cat_other"].id)))

    assert eval_variant_promotion_match(ctx["var101"], promo, ctx["ancestor_map"]) is False
    assert eval_variant_promotion_match(ctx["var102"], promo, ctx["ancestor_map"]) is False
