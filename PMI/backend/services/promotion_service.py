import datetime
import math
import re
import uuid
import logging
import threading
from typing import List, Optional, Tuple, Dict, Set, Union, Any
from decimal import Decimal

from sqlalchemy import or_, text
from sqlalchemy.orm import Session, joinedload

import models
from models import Promotion, PromotionScope, PromotionComputedPrice, ProductVariant, Product, Category, DiscountType, PromotionStatus, ScopeType
from schemas.promotion import PromotionCreate, PromotionScopeSchema, ParseIntentResponse, ComputedPriceResponse

logger = logging.getLogger(__name__)
_recompute_lock = threading.RLock()


# ----------------------------------------------------------------------
# 1. Category Hierarchy Ancestor Map Builder
# ----------------------------------------------------------------------
def build_category_ancestor_map(db: Session) -> Dict[int, Set[int]]:
    """
    Builds an ancestor lookup map mapping each category_id (int) to its set of ancestor category IDs.
    Handles multi-level category hierarchies and prevents infinite cycles.
    """
    categories = db.query(Category.id, Category.parent_id).all()
    parent_map: Dict[int, Optional[int]] = {c.id: c.parent_id for c in categories}
    ancestor_map: Dict[int, Set[int]] = {}

    for cat_id in parent_map:
        ancestors: Set[int] = set()
        curr = parent_map.get(cat_id)
        visited = {cat_id}
        while curr is not None and curr not in visited:
            ancestors.add(curr)
            visited.add(curr)
            curr = parent_map.get(curr)
        ancestor_map[cat_id] = ancestors

    return ancestor_map


# ----------------------------------------------------------------------
# 2. Scope Matcher
# ----------------------------------------------------------------------
def matches_single_scope(
    scope: Union[PromotionScope, PromotionScopeSchema, dict],
    variant: ProductVariant,
    category_ancestor_map: Dict[int, Set[int]]
) -> bool:
    """
    Evaluates whether a variant matches a single scope rule.
    """
    if isinstance(scope, dict):
        scope_type = scope.get("scope_type")
        target_id = scope.get("target_id")
    else:
        scope_type = getattr(scope, "scope_type", None)
        target_id = getattr(scope, "target_id", None)

    if hasattr(scope_type, "value"):
        scope_type = scope_type.value
    scope_type = str(scope_type).upper() if scope_type else "ALL"

    if scope_type == "ALL":
        return True

    if target_id is None:
        return False

    str_target_id = str(target_id).strip()

    if scope_type == "VARIANT":
        return str(variant.id).strip() == str_target_id

    if scope_type == "PRODUCT":
        return str(variant.product_id).strip() == str_target_id

    if scope_type == "CATEGORY":
        if not variant.product or variant.product.category_id is None:
            return False
        cat_id = variant.product.category_id
        if str(cat_id).strip() == str_target_id:
            return True
        if str_target_id.isdigit():
            target_int = int(str_target_id)
            if target_int == cat_id:
                return True
            if target_int in category_ancestor_map.get(cat_id, set()):
                return True
        return False

    return False


def eval_variant_promotion_match(
    variant: ProductVariant,
    promo: Union[Promotion, dict, PromotionCreate],
    category_ancestor_map: Dict[int, Set[int]]
) -> bool:
    """
    Evaluates whether a ProductVariant qualifies for a Promotion using dual-phase evaluation:
    1. Phase 1 Exclusion check: If variant matches ANY rule with is_exclusion=True -> return False.
    2. Phase 2 Inclusion check: If variant matches AT LEAST ONE rule with is_exclusion=False -> return True.
    """
    if hasattr(promo, "scopes"):
        scopes = promo.scopes or []
    elif isinstance(promo, dict):
        scopes = promo.get("scopes", [])
    else:
        scopes = []

    if not scopes:
        return False

    # Phase 1: Exclusion Check
    for scope in scopes:
        is_ex = getattr(scope, "is_exclusion", False) if not isinstance(scope, dict) else scope.get("is_exclusion", False)
        if is_ex:
            if matches_single_scope(scope, variant, category_ancestor_map):
                return False

    # Phase 2: Inclusion Check
    inclusion_scopes = [
        s for s in scopes
        if not (getattr(s, "is_exclusion", False) if not isinstance(s, dict) else s.get("is_exclusion", False))
    ]

    if not inclusion_scopes:
        return False

    for scope in inclusion_scopes:
        if matches_single_scope(scope, variant, category_ancestor_map):
            return True

    return False


# ----------------------------------------------------------------------
# 3. Discount Calculator
# ----------------------------------------------------------------------
def calculate_discount(
    original_price: Union[float, int, Decimal],
    discount_type: Union[DiscountType, str],
    discount_value: Union[float, int, Decimal],
    max_discount: Optional[Union[float, int, Decimal]] = None
) -> Tuple[float, float, float]:
    """
    Calculates discounted price, discount amount, and percentage discount.
    Returns Tuple[computed_price, discount_amount, percentage_discount].
    Guarantees computed_price >= 0.0 and all outputs rounded to 2 decimals.
    """
    try:
        orig = float(original_price if original_price is not None else 0.0)
    except (TypeError, ValueError):
        orig = 0.0

    if math.isnan(orig):
        return (0.0, float('nan'), 0.0)

    if orig <= 0.0:
        return (0.0, 0.0, 0.0)

    val = max(0.0, float(discount_value or 0.0))
    dt = discount_type.value if hasattr(discount_type, "value") else str(discount_type).upper()

    if dt == "PERCENTAGE":
        raw_discount = orig * (val / 100.0)
        if max_discount is not None and float(max_discount) > 0:
            capped_discount = min(raw_discount, float(max_discount))
        else:
            capped_discount = raw_discount
        discount_amount = max(0.0, min(capped_discount, orig))
        computed_price = max(0.0, orig - discount_amount)
    elif dt == "FIXED_AMOUNT":
        discount_amount = max(0.0, min(val, orig))
        computed_price = max(0.0, orig - discount_amount)
    elif dt == "FIXED_PRICE":
        val_clamped = max(0.0, val)
        if val_clamped < orig:
            computed_price = val_clamped
            discount_amount = max(0.0, orig - computed_price)
        else:
            computed_price = orig
            discount_amount = 0.0
    else:
        computed_price = orig
        discount_amount = 0.0

    percentage_discount = round((discount_amount / orig) * 100.0, 2) if orig > 0 else 0.0
    return (round(max(0.0, computed_price), 2), round(max(0.0, discount_amount), 2), percentage_discount)


def get_promo_specificity(promo: Union[Promotion, dict, Any]) -> int:
    """
    Returns specificity score for promotion scope rules:
    VARIANT = 4, PRODUCT = 3, CATEGORY = 2, ALL = 1, None = 0.
    Used for tie-breaking promotions with identical priority.
    """
    scopes = getattr(promo, "scopes", []) or []
    if isinstance(promo, dict):
        scopes = promo.get("scopes", [])
    if not scopes:
        return 0
    inc_scopes = []
    for s in scopes:
        is_ex = getattr(s, "is_exclusion", False) if not isinstance(s, dict) else s.get("is_exclusion", False)
        if not is_ex:
            inc_scopes.append(s)
    if not inc_scopes:
        return 0
    types = set()
    for s in inc_scopes:
        st = getattr(s, "scope_type", None) if not isinstance(s, dict) else s.get("scope_type")
        if hasattr(st, "value"):
            st = st.value
        if st:
            types.add(str(st).upper())
    if "VARIANT" in types:
        return 4
    if "PRODUCT" in types:
        return 3
    if "CATEGORY" in types:
        return 2
    if "ALL" in types:
        return 1
    return 0


# ----------------------------------------------------------------------
# 4. Re-computation Engine
# ----------------------------------------------------------------------
def recompute_variant_prices(db: Session, variant_ids: Optional[List[str]] = None) -> int:
    """
    Recomputes promotion pricing for target variant_ids (or all variants if None).
    Upserts results into `promotion_computed_prices` table.
    """
    with _recompute_lock:
        original_expire = getattr(db, "expire_on_commit", False)
        db.expire_on_commit = False
        try:
            db.flush()

            persisted_all_result = db.execute(text("SELECT id FROM promotions")).all()
            all_persisted_promo_ids = set(str(r[0]) for r in persisted_all_result if r[0] is not None)

            now = datetime.datetime.now(datetime.timezone.utc)
            all_promos = (
                db.query(Promotion)
                .options(joinedload(Promotion.scopes))
                .populate_existing()
                .filter(
                    or_(
                        Promotion.status == PromotionStatus.ACTIVE,
                        Promotion.status == PromotionStatus.SCHEDULED
                    )
                )
                .all()
            )
            active_promos = []
            for p in all_promos:
                if p is None or getattr(p, "id", None) is None or str(p.id) not in all_persisted_promo_ids:
                    continue
                if p.status == PromotionStatus.SCHEDULED:
                    starts_at = p.starts_at
                    if starts_at is not None:
                        if starts_at.tzinfo is None:
                            starts_at = starts_at.replace(tzinfo=datetime.timezone.utc)
                        if starts_at <= now:
                            p.status = PromotionStatus.ACTIVE
                            active_promos.append(p)
                elif p.status == PromotionStatus.ACTIVE:
                    active_promos.append(p)

            active_promos.sort(
                key=lambda p: (
                    p.priority or 0,
                    get_promo_specificity(p),
                    p.created_at.timestamp() if p.created_at else 0
                ),
                reverse=True
            )

            var_query = db.query(ProductVariant).options(joinedload(ProductVariant.product))
            if variant_ids:
                int_ids = [int(v) for v in variant_ids if str(v).isdigit()]
                str_ids = [str(v) for v in variant_ids]
                var_query = var_query.filter(or_(ProductVariant.id.in_(int_ids), ProductVariant.id.in_(str_ids)))

            variants = var_query.all()
            if not variants:
                return 0

            category_ancestor_map = build_category_ancestor_map(db)

            products = db.query(Product).all()
            product_map = {p.id: p for p in products}

            str_vids = [str(v.id) for v in variants]
            existing_cps = (
                db.query(PromotionComputedPrice)
                .filter(PromotionComputedPrice.variant_id.in_(str_vids))
                .all()
            )
            existing_map = {cp.variant_id: cp for cp in existing_cps}

            now = datetime.datetime.now(datetime.timezone.utc)

            for v in variants:
                if not v.product and v.product_id in product_map:
                    v.product = product_map[v.product_id]

                orig_price = float(v.price) if v.price is not None else 0.0
                winning_promo = None

                for promo in active_promos:
                    if eval_variant_promotion_match(v, promo, category_ancestor_map):
                        winning_promo = promo
                        break

                if winning_promo and winning_promo.id and str(winning_promo.id) in all_persisted_promo_ids:
                    comp_price, disc_amt, pct_disc = calculate_discount(
                        orig_price,
                        winning_promo.discount_type,
                        winning_promo.discount_value,
                        winning_promo.max_discount
                    )
                    winning_id = str(winning_promo.id)
                else:
                    comp_price = orig_price
                    disc_amt = 0.0
                    pct_disc = 0.0
                    winning_id = None

                str_id = str(v.id)
                if str_id in existing_map:
                    cp = existing_map[str_id]
                    cp.promotion_id = winning_id
                    cp.original_price = orig_price
                    cp.computed_price = comp_price
                    cp.discount_amount = disc_amt
                    cp.percentage_discount = pct_disc
                    cp.updated_at = now
                else:
                    cp = PromotionComputedPrice(
                        id=str(uuid.uuid4()),
                        variant_id=str_id,
                        promotion_id=winning_id,
                        original_price=orig_price,
                        computed_price=comp_price,
                        discount_amount=disc_amt,
                        percentage_discount=pct_disc,
                        updated_at=now
                    )
                    db.add(cp)

            db.flush()
            return len(variants)
        finally:
            db.expire_on_commit = original_expire


def recompute_promotion_prices(db: Session, promotion_id: str) -> int:
    """
    Triggers recomputation of prices for variants affected by specified promotion ID (or full refresh).
    """
    return recompute_variant_prices(db, variant_ids=None)


# ----------------------------------------------------------------------
# 5. Computed Price Lookup Service
# ----------------------------------------------------------------------
def get_variant_computed_price(db: Session, variant_id: str) -> Optional[ComputedPriceResponse]:
    """
    Retrieves computed price response for a single variant ID.
    If no record exists in `promotion_computed_prices`, falls back to base ProductVariant price.
    Returns None if variant does not exist in DB.
    """
    str_vid = str(variant_id)
    cp = (
        db.query(PromotionComputedPrice)
        .filter(PromotionComputedPrice.variant_id == str_vid)
        .first()
    )

    if cp:
        promo_code = None
        promo_name = None
        if cp.promotion_id:
            promo = db.query(Promotion).filter(Promotion.id == cp.promotion_id).first()
            if promo:
                promo_code = promo.code
                promo_name = promo.name
        return ComputedPriceResponse(
            id=cp.id,
            variant_id=str(cp.variant_id),
            promotion_id=cp.promotion_id,
            original_price=float(cp.original_price),
            computed_price=float(cp.computed_price),
            discount_amount=float(cp.discount_amount),
            percentage_discount=float(cp.percentage_discount),
            has_active_promotion=bool(cp.promotion_id),
            promotion_code=promo_code,
            promotion_name=promo_name,
            updated_at=cp.updated_at
        )

    if not str_vid.isdigit():
        return None
    variant = db.query(ProductVariant).filter(ProductVariant.id == int(str_vid)).first()
    if not variant:
        return None

    v_price = float(variant.price) if variant.price is not None else 0.0
    return ComputedPriceResponse(
        variant_id=str(variant.id),
        original_price=v_price,
        computed_price=v_price,
        discount_amount=0.0,
        percentage_discount=0.0,
        has_active_promotion=False
    )


def get_bulk_computed_prices(db: Session, variant_ids: List[Any]) -> Dict[str, dict]:
    """
    Retrieves bulk computed price responses for a list of variant IDs.
    Handles duplicate IDs, empty/blank IDs, None values, and non-existent IDs gracefully.
    Returns dict mapping variant_id -> ComputedPriceResponse dictionary.
    """
    if not variant_ids:
        return {}

    str_ids = [str(vid) if vid is not None else "" for vid in variant_ids]
    valid_query_ids = list(set(vid for vid in str_ids if vid and vid.strip()))

    cp_map = {}
    promo_map = {}
    if valid_query_ids:
        cps = (
            db.query(PromotionComputedPrice)
            .filter(PromotionComputedPrice.variant_id.in_(valid_query_ids))
            .all()
        )
        cp_map = {cp.variant_id: cp for cp in cps}

        promo_ids = {cp.promotion_id for cp in cps if cp.promotion_id}
        if promo_ids:
            promos = db.query(Promotion).filter(Promotion.id.in_(promo_ids)).all()
            promo_map = {p.id: p for p in promos}

    missing_ids = [vid for vid in str_ids if vid not in cp_map]
    missing_ints = list(set(int(v) for v in missing_ids if v.isdigit()))
    var_map = {}
    if missing_ints:
        variants = db.query(ProductVariant).filter(ProductVariant.id.in_(missing_ints)).all()
        var_map = {str(v.id): v for v in variants}

    res: Dict[str, dict] = {}
    for vid in str_ids:
        if vid in cp_map:
            cp = cp_map[vid]
            p = promo_map.get(cp.promotion_id)
            res[vid] = ComputedPriceResponse(
                id=cp.id,
                variant_id=str(cp.variant_id),
                promotion_id=cp.promotion_id,
                original_price=float(cp.original_price),
                computed_price=float(cp.computed_price),
                discount_amount=float(cp.discount_amount),
                percentage_discount=float(cp.percentage_discount),
                has_active_promotion=bool(cp.promotion_id),
                promotion_code=p.code if p else None,
                promotion_name=p.name if p else None,
                updated_at=cp.updated_at
            ).model_dump(mode="json")
        elif vid in var_map:
            v = var_map[vid]
            v_price = float(v.price) if v.price is not None else 0.0
            res[vid] = ComputedPriceResponse(
                variant_id=str(v.id),
                original_price=v_price,
                computed_price=v_price,
                discount_amount=0.0,
                percentage_discount=0.0,
                has_active_promotion=False
            ).model_dump(mode="json")
        else:
            res[vid] = ComputedPriceResponse(
                variant_id=str(vid),
                original_price=0.0,
                computed_price=0.0,
                discount_amount=0.0,
                percentage_discount=0.0,
                has_active_promotion=False
            ).model_dump(mode="json")

    return res


# ----------------------------------------------------------------------
# 6. Dry-Run Preview Engine
# ----------------------------------------------------------------------
def evaluate_promotion_preview(db: Session, promo_create: PromotionCreate) -> dict:
    """
    Evaluates a proposed promotion dry-run impact without persisting to DB.
    """
    active_promos = (
        db.query(Promotion)
        .options(joinedload(Promotion.scopes))
        .filter(Promotion.status == PromotionStatus.ACTIVE)
        .all()
    )

    category_ancestor_map = build_category_ancestor_map(db)
    variants = db.query(ProductVariant).options(joinedload(ProductVariant.product)).all()

    affected_count = 0
    total_discount = 0.0
    sample_variants = []

    for v in variants:
        v_orig_price = float(v.price) if v.price is not None else 0.0
        if eval_variant_promotion_match(v, promo_create, category_ancestor_map):
            comp_price, disc_amt, pct_disc = calculate_discount(
                v_orig_price,
                promo_create.discount_type,
                promo_create.discount_value,
                promo_create.max_discount
            )
            if disc_amt > 0:
                affected_count += 1
                total_discount += disc_amt
                if len(sample_variants) < 20:
                    sample_variants.append({
                        "variant_id": str(v.id),
                        "sku_code": v.sku_code or f"VAR-{v.id}",
                        "original_price": v_orig_price,
                        "computed_price": comp_price,
                        "discount_amount": disc_amt,
                        "percentage_discount": pct_disc
                    })

    return {
        "affected_variants_count": affected_count,
        "total_discount_amount": round(total_discount, 2),
        "sample_variants": sample_variants
    }


# ----------------------------------------------------------------------
# 7. Intent Parser (Natural Language -> Structured Promotion)
# ----------------------------------------------------------------------
def parse_promotion_intent(prompt: str, created_by: Optional[str] = "AI_AGENT") -> ParseIntentResponse:
    """
    Parses natural language prompt (Vietnamese/English) into structured promotion parameters and reasoning.
    """
    prompt_str = prompt.strip()
    prompt_lower = prompt_str.lower()

    reasoning_lines = []

    # 1. Infer Discount Type
    discount_type = DiscountType.PERCENTAGE
    if "đồng giá" in prompt_lower or "cố định" in prompt_lower or "fixed price" in prompt_lower:
        discount_type = DiscountType.FIXED_PRICE
        reasoning_lines.append("Phát hiện từ khóa 'đồng giá' / 'cố định': Loại chiết khấu FIXED_PRICE.")
    elif "%" in prompt_lower or "phần trăm" in prompt_lower or "percent" in prompt_lower:
        discount_type = DiscountType.PERCENTAGE
        reasoning_lines.append("Phát hiện từ khóa '%' / 'phần trăm': Loại chiết khấu PERCENTAGE.")
    elif any(k in prompt_lower for k in ["giảm", "trừ", "discount"]):
        if any(c in prompt_lower for c in ["k", "đ", "vnd", "triệu", "tr"]):
            discount_type = DiscountType.FIXED_AMOUNT
            reasoning_lines.append("Phát hiện số tiền cố định (k/đ/vnd/triệu): Loại chiết khấu FIXED_AMOUNT.")
        else:
            discount_type = DiscountType.PERCENTAGE
            reasoning_lines.append("Phát hiện từ khóa 'giảm': Mặc định loại chiết khấu PERCENTAGE.")

    # 2. Infer Discount Value
    discount_value = 10.0
    val_match = None
    if discount_type == DiscountType.FIXED_PRICE:
        val_match = re.search(r'(?:đồng giá|cố định|fixed price)\s*(\d+(?:[\.,]\d+)?)\s*(k|tr|triệu|đ|vnd|đồng)?', prompt_lower)
    if not val_match:
        val_match = re.search(r'(\d+(?:[\.,]\d+)?)\s*(%|k|tr|triệu|đ|vnd|đồng)?', prompt_lower)

    if val_match:
        num_str = val_match.group(1).replace(',', '.')
        unit = val_match.group(2)
        raw_num = float(num_str)
        if unit in ['k']:
            discount_value = raw_num * 1000.0
        elif unit in ['tr', 'triệu']:
            discount_value = raw_num * 1000000.0
        else:
            discount_value = raw_num
        reasoning_lines.append(f"Trích xuất giá trị giảm giá: {discount_value}.")
    else:
        reasoning_lines.append("Không thấy con số cụ thể, dùng mặc định discount_value = 10.0.")

    # 3. Infer Max Discount Cap
    max_discount = None
    max_match = re.search(r'(?:tối đa|max)\s*(\d+(?:[\.,]\d+)?)\s*(k|tr|triệu|đ|vnd)?', prompt_lower)
    if max_match:
        num_str = max_match.group(1).replace(',', '.')
        unit = max_match.group(2)
        raw_num = float(num_str)
        if unit == 'k':
            max_discount = raw_num * 1000.0
        elif unit in ['tr', 'triệu']:
            max_discount = raw_num * 1000000.0
        else:
            max_discount = raw_num
        reasoning_lines.append(f"Trích xuất hạn mức tối đa max_discount = {max_discount}.")

    # 4. Infer Priority
    priority = 0
    prio_match = re.search(r'(?:ưu tiên|priority)\s*(\d+)', prompt_lower)
    if prio_match:
        priority = int(prio_match.group(1))
        reasoning_lines.append(f"Trích xuất mức ưu tiên priority = {priority}.")

    # 5. Infer Promotion Code & Name
    code_match = re.search(r'(?:mã|code)\s+([a-zA-Z0-9_\-]+)', prompt_str)
    if code_match:
        code = code_match.group(1).upper()
        reasoning_lines.append(f"Trích xuất mã khuyến mãi code = {code}.")
    else:
        code = f"PROMO_{uuid.uuid4().hex[:6].upper()}"
        reasoning_lines.append(f"Tự động tạo mã khuyến mãi code = {code}.")

    name = f"Khuyến mãi {prompt_str[:40]}" if len(prompt_str) > 40 else f"Khuyến mãi {prompt_str}"

    # 6. Infer Scopes
    scopes = []
    if "danh mục" in prompt_lower or "category" in prompt_lower:
        cat_match = re.search(r'(?:danh mục|category)\s*(\d+)', prompt_lower)
        target_id = cat_match.group(1) if cat_match else "1"
        scopes.append(PromotionScopeSchema(scope_type=ScopeType.CATEGORY, target_id=target_id, is_exclusion=False))
        reasoning_lines.append(f"Áp dụng danh mục target_id = {target_id}.")
    elif "sản phẩm" in prompt_lower or "product" in prompt_lower:
        prod_match = re.search(r'(?:sản phẩm|product)\s*(\d+)', prompt_lower)
        target_id = prod_match.group(1) if prod_match else "10"
        scopes.append(PromotionScopeSchema(scope_type=ScopeType.PRODUCT, target_id=target_id, is_exclusion=False))
        reasoning_lines.append(f"Áp dụng sản phẩm target_id = {target_id}.")
    elif "biến thể" in prompt_lower or "variant" in prompt_lower:
        var_match = re.search(r'(?:biến thể|variant)\s*(\d+)', prompt_lower)
        target_id = var_match.group(1) if var_match else "101"
        scopes.append(PromotionScopeSchema(scope_type=ScopeType.VARIANT, target_id=target_id, is_exclusion=False))
        reasoning_lines.append(f"Áp dụng biến thể target_id = {target_id}.")
    else:
        scopes.append(PromotionScopeSchema(scope_type=ScopeType.ALL, target_id=None, is_exclusion=False))
        reasoning_lines.append("Áp dụng cho tất cả sản phẩm (ScopeType.ALL).")

    # 7. Dates
    starts_at = None
    ends_at = None
    date_match = re.search(r'từ\s+(\d{1,2}/\d{1,2}/\d{4})\s+đến\s+(\d{1,2}/\d{1,2}/\d{4})', prompt_lower)
    if date_match:
        try:
            starts_at = datetime.datetime.strptime(date_match.group(1), "%d/%m/%Y").replace(tzinfo=datetime.timezone.utc)
            ends_at = datetime.datetime.strptime(date_match.group(2), "%d/%m/%Y").replace(hour=23, minute=59, second=59, tzinfo=datetime.timezone.utc)
            reasoning_lines.append(f"Phân tích khoảng thời gian: {starts_at} -> {ends_at}.")
        except Exception:
            pass

    reasoning = "\n".join(reasoning_lines)

    return ParseIntentResponse(
        code=code,
        name=name,
        description=f"Tự động tạo từ prompt: {prompt_str}",
        discount_type=discount_type,
        discount_value=discount_value,
        max_discount=max_discount,
        priority=priority,
        starts_at=starts_at,
        ends_at=ends_at,
        scopes=scopes,
        reasoning=reasoning,
        confidence_score=0.95
    )
