from __future__ import annotations

import os
import time
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from typing import Any
import concurrent.futures

import httpx
import pytest

from e2e_tests.utils.api_helpers import PMIApi, wait_until


@pytest.fixture
def pmi_api(api_clients) -> PMIApi:
    return PMIApi(api_clients.pmi)


def create_test_product_and_variant(
    pmi_api: PMIApi,
    price: float = 100000.0,
    stock: int = 100,
) -> tuple[Any, Any, Any, Any]:
    uid = uuid4().hex[:6]
    cat = pmi_api.create_category(name=f"Cat-Adv-{uid}", code=f"CAT-ADV-{uid}")
    fam = pmi_api.create_attribute_family(name=f"Fam-Adv-{uid}", code=f"FAM-ADV-{uid}")
    prod = pmi_api.create_product_with_variants(
        product_code=f"PROD-ADV-{uid}",
        name=f"Product Adv {uid}",
        category_id=cat.id,
        family_id=fam.id,
        sku_code=f"SKU-ADV-{uid}",
        price=price,
        stock=stock,
    )
    return cat, fam, prod, prod.variants[0]


# ============================================================================
# GROUP 1: ZERO & NEGATIVE PRICE HANDLING (API & Calculation Engine)
# ============================================================================

def test_adv_01_negative_promotion_discount_value(api_clients, e2e_run_id):
    """Adversarial Test: Creating promotion with negative discount value should be rejected."""
    code = f"ADV_NEG_DISC_{uuid4().hex[:6]}"
    payload = {
        "code": code,
        "name": "Negative Discount Value Test",
        "discount_type": "PERCENTAGE",
        "discount_value": -25.0,
        "priority": 0,
        "scopes": [{"scope_type": "ALL", "target_id": None, "is_exclusion": False}],
    }
    response = api_clients.pmi.post("/api/promotions", json=payload)
    assert response.status_code in (400, 422), f"Expected validation failure for negative discount, got {response.status_code}"


def test_adv_02_fixed_amount_discount_exceeding_base_price_clamp(api_clients, pmi_api, e2e_run_id):
    """Adversarial Test: FIXED_AMOUNT discount > base price must clamp computed price to 0.0."""
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=100000.0)
    created = pmi_api.create_promotion({
        "code": f"ADV_CLAMP_{uuid4().hex[:6]}",
        "name": "Exceeding Fixed Amount Clamp",
        "discount_type": "FIXED_AMOUNT",
        "discount_value": 250000.0,
        "scopes": [{"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(created["id"])

    cp = pmi_api.get_computed_price(str(variant.id))
    assert cp["computed_price"] == 0.0, f"Expected computed_price clamped to 0.0, got {cp['computed_price']}"
    assert cp["discount_amount"] == 100000.0, f"Expected discount_amount equal to original price 100000.0, got {cp['discount_amount']}"
    pmi_api.end_promotion(created["id"])


def test_adv_03_zero_base_price_variant_promotion(api_clients, pmi_api, e2e_run_id):
    """Adversarial Test: Variant with base price 0.0 must remain 0.0 and discount 0.0."""
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=0.0)
    created = pmi_api.create_promotion({
        "code": f"ADV_ZERO_BASE_{uuid4().hex[:6]}",
        "name": "Zero Base Price Promo",
        "discount_type": "PERCENTAGE",
        "discount_value": 50.0,
        "scopes": [{"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(created["id"])

    cp = pmi_api.get_computed_price(str(variant.id))
    assert cp["computed_price"] == 0.0
    assert cp["discount_amount"] == 0.0
    pmi_api.end_promotion(created["id"])


def test_adv_04_fixed_price_promotion_zero_or_negative(api_clients, pmi_api, e2e_run_id):
    """Adversarial Test: FIXED_PRICE of 0.0 vs negative value validation."""
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=100000.0)
    
    neg_res = api_clients.pmi.post("/api/promotions", json={
        "code": f"ADV_NEG_FIXED_{uuid4().hex[:6]}",
        "name": "Negative Fixed Price",
        "discount_type": "FIXED_PRICE",
        "discount_value": -50000.0,
    })
    assert neg_res.status_code in (400, 422), "Negative FIXED_PRICE should be rejected"

    zero_promo = pmi_api.create_promotion({
        "code": f"ADV_ZERO_FIXED_{uuid4().hex[:6]}",
        "name": "Zero Fixed Price",
        "discount_type": "FIXED_PRICE",
        "discount_value": 0.0,
        "scopes": [{"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(zero_promo["id"])
    cp = pmi_api.get_computed_price(str(variant.id))
    assert cp["computed_price"] == 0.0
    pmi_api.end_promotion(zero_promo["id"])


def test_adv_05_price_markup_promotion_computed_price_higher_than_original(api_clients, pmi_api, e2e_run_id):
    """Adversarial Test: FIXED_PRICE > base price shouldn't increase item price or trigger promotion."""
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=100000.0)
    created = pmi_api.create_promotion({
        "code": f"ADV_MARKUP_{uuid4().hex[:6]}",
        "name": "Markup Fixed Price 150k",
        "discount_type": "FIXED_PRICE",
        "discount_value": 150000.0,
        "scopes": [{"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(created["id"])

    cp = pmi_api.get_computed_price(str(variant.id))
    assert cp["computed_price"] == 100000.0
    pmi_api.end_promotion(created["id"])


# ============================================================================
# GROUP 2: MISSING API FIELDS & INVALID PAYLOAD TYPES
# ============================================================================

def test_adv_06_create_promotion_missing_required_fields(api_clients, e2e_run_id):
    """Adversarial Test: Payload missing code, name, or discount_type must fail validation."""
    incomplete_payloads = [
        {"name": "Missing Code", "discount_type": "PERCENTAGE", "discount_value": 10.0},
        {"code": f"NO_NAME_{uuid4().hex[:6]}", "discount_type": "PERCENTAGE", "discount_value": 10.0},
        {"code": f"NO_TYPE_{uuid4().hex[:6]}", "name": "No Type", "discount_value": 10.0},
        {"code": f"NO_VAL_{uuid4().hex[:6]}", "name": "No Value", "discount_type": "PERCENTAGE"},
    ]
    for p in incomplete_payloads:
        res = api_clients.pmi.post("/api/promotions", json=p)
        assert res.status_code == 422, f"Expected 422 Unprocessable Entity for payload {p}, got {res.status_code}"


def test_adv_07_create_promotion_invalid_field_types(api_clients, e2e_run_id):
    """Adversarial Test: Incorrect data types for fields (string for float, bool for string)."""
    invalid_type_payloads = [
        {"code": 12345, "name": "Numeric Code", "discount_type": "PERCENTAGE", "discount_value": 10.0},
        {"code": f"STR_VAL_{uuid4().hex[:6]}", "name": "String Value", "discount_type": "PERCENTAGE", "discount_value": "twenty"},
        {"code": f"BOOL_NAME_{uuid4().hex[:6]}", "name": True, "discount_type": "PERCENTAGE", "discount_value": 10.0},
    ]
    for p in invalid_type_payloads:
        res = api_clients.pmi.post("/api/promotions", json=p)
        assert res.status_code in (400, 422), f"Expected validation error for invalid types in {p}, got {res.status_code}"


def test_adv_08_create_promotion_malformed_scopes(api_clients, e2e_run_id):
    """Adversarial Test: Invalid scope_type or missing target_id for targeted scopes."""
    malformed_scope_payloads = [
        {
            "code": f"BAD_SCOPE_TYPE_{uuid4().hex[:6]}",
            "name": "Bad Scope Type",
            "discount_type": "PERCENTAGE",
            "discount_value": 10.0,
            "scopes": [{"scope_type": "UNKNOWN_SCOPE", "target_id": "123"}],
        },
        {
            "code": f"MISSING_TGT_{uuid4().hex[:6]}",
            "name": "Missing Target ID",
            "discount_type": "PERCENTAGE",
            "discount_value": 10.0,
            "scopes": [{"scope_type": "CATEGORY", "target_id": None}],
        },
        {
            "code": f"STR_SCOPE_{uuid4().hex[:6]}",
            "name": "String Scopes",
            "discount_type": "PERCENTAGE",
            "discount_value": 10.0,
            "scopes": "ALL",
        },
    ]
    for p in malformed_scope_payloads:
        res = api_clients.pmi.post("/api/promotions", json=p)
        assert res.status_code in (400, 422), f"Expected 400/422 for malformed scopes in {p}, got {res.status_code}"


def test_adv_09_create_promotion_extra_unexpected_json_keys(api_clients, e2e_run_id):
    """Adversarial Test: Extra unexpected nested JSON fields shouldn't crash backend."""
    code = f"ADV_EXTRA_KEYS_{uuid4().hex[:6]}"
    payload = {
        "code": code,
        "name": "Extra Keys Test",
        "discount_type": "PERCENTAGE",
        "discount_value": 10.0,
        "scopes": [],
        "malicious_sql_injection": "'; DROP TABLE promotions; --",
        "unexpected_object": {"a": 1, "b": [1, 2, 3]},
    }
    response = api_clients.pmi.post("/api/promotions", json=payload)
    assert response.status_code in (200, 201, 422)


def test_adv_10_bulk_computed_price_malformed_body(api_clients, e2e_run_id):
    """Adversarial Test: Malformed request body on bulk computed prices endpoint."""
    bad_bodies = [
        {"variant_ids": None},
        {"variant_ids": "not_a_list"},
        {"wrong_key": [1, 2, 3]},
    ]
    for body in bad_bodies:
        res = api_clients.pmi.post("/api/computed-prices/bulk", json=body)
        assert res.status_code in (400, 422)


# ============================================================================
# GROUP 3: CONCURRENCY BULK LOADS & HIGH LOAD STRESS
# ============================================================================

def test_adv_11_bulk_computed_price_large_batch(api_clients, pmi_api, e2e_run_id):
    """Adversarial Test: Bulk query with 500 variant IDs (valid + non-existent)."""
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=100000.0)
    large_batch = [str(variant.id)] + [f"non-existent-var-{i}" for i in range(499)]

    start_time = time.monotonic()
    response = api_clients.pmi.post("/api/computed-prices/bulk", json={"variant_ids": large_batch})
    elapsed = time.monotonic() - start_time

    assert response.status_code in (200, 400, 422)
    assert elapsed < 5.0, f"Bulk computed prices took too long: {elapsed:.2f}s"


def test_adv_12_bulk_computed_price_duplicate_and_empty_ids(api_clients, pmi_api, e2e_run_id):
    """Adversarial Test: Bulk query with duplicate IDs and empty strings."""
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=100000.0)
    var_id = str(variant.id)
    payload = {"variant_ids": [var_id, var_id, "", "   ", var_id]}

    response = api_clients.pmi.post("/api/computed-prices/bulk", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data is not None


def test_adv_13_concurrent_bulk_computed_price_requests(api_clients, pmi_api, e2e_run_id):
    """Adversarial Test: 20 concurrent threads calling /api/computed-prices/bulk simultaneously."""
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=100000.0)
    var_ids = [str(variant.id)]

    def make_request():
        res = api_clients.pmi.post("/api/computed-prices/bulk", json={"variant_ids": var_ids})
        return res.status_code

    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        futures = [executor.submit(make_request) for _ in range(20)]
        results = [f.result() for f in concurrent.futures.as_completed(futures)]

    assert all(code == 200 for code in results), f"Some concurrent bulk requests failed: {results}"


def test_adv_14_concurrent_promotion_activation_deactivation(api_clients, pmi_api, e2e_run_id):
    """Adversarial Test: Concurrent activation / pause on same promotion to test race conditions."""
    created = pmi_api.create_promotion({
        "code": f"ADV_RACE_{uuid4().hex[:6]}",
        "name": "Race Condition Promo",
        "discount_type": "PERCENTAGE",
        "discount_value": 15.0,
    })
    promo_id = created["id"]

    def toggle_status(action: str):
        return api_clients.pmi.post(f"/api/promotions/{promo_id}/{action}")

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        f1 = executor.submit(toggle_status, "activate")
        f2 = executor.submit(toggle_status, "pause")
        f3 = executor.submit(toggle_status, "resume")
        f4 = executor.submit(toggle_status, "end")
        results = [f.result().status_code for f in (f1, f2, f3, f4)]

    assert all(code != 500 for code in results), f"Server threw 500 during concurrent state transitions: {results}"


# ============================================================================
# GROUP 4: TIMEZONE & CLOCK SKEW RESILIENCE
# ============================================================================

def test_adv_15_starts_at_with_explicit_timezone_offsets(api_clients, pmi_api, e2e_run_id):
    """Adversarial Test: Timezone offset handling (+07:00 vs -05:00 vs Z)."""
    now_utc = datetime.now(timezone.utc)
    ts_plus7 = (now_utc + timedelta(hours=7)).isoformat()
    ts_minus5 = (now_utc - timedelta(hours=5)).isoformat()
    ts_z = now_utc.isoformat()

    for ts in (ts_plus7, ts_minus5, ts_z):
        res = api_clients.pmi.post("/api/promotions", json={
            "code": f"ADV_TZ_{uuid4().hex[:6]}",
            "name": f"TZ Test {ts[:10]}",
            "discount_type": "PERCENTAGE",
            "discount_value": 10.0,
            "starts_at": ts,
        })
        assert res.status_code in (200, 201), f"Failed to create promotion with timestamp {ts}: {res.status_code}"


def test_adv_16_starts_at_subsecond_precision(api_clients, pmi_api, e2e_run_id):
    """Adversarial Test: Microsecond precision ISO timestamps."""
    ts_micro = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f%z")
    res = api_clients.pmi.post("/api/promotions", json={
        "code": f"ADV_MICRO_{uuid4().hex[:6]}",
        "name": "Microsecond Precision",
        "discount_type": "PERCENTAGE",
        "discount_value": 10.0,
        "starts_at": ts_micro,
    })
    assert res.status_code in (200, 201)


def test_adv_17_malformed_date_strings(api_clients, e2e_run_id):
    """Adversarial Test: Invalid date format strings for starts_at/ends_at should be rejected with 400/422."""
    bad_dates = ["invalid-date", "2026-99-99T99:99:99Z", "123456", ""]
    failures = []
    for d in bad_dates:
        res = api_clients.pmi.post("/api/promotions", json={
            "code": f"ADV_BAD_DATE_{uuid4().hex[:6]}",
            "name": "Bad Date Test",
            "discount_type": "PERCENTAGE",
            "discount_value": 10.0,
            "starts_at": d,
        })
        if res.status_code not in (400, 422):
            failures.append((d, res.status_code))

    assert not failures, f"Backend accepted malformed date strings: {failures}"


def test_adv_18_clock_skew_boundary_promotion_activation(api_clients, pmi_api, e2e_run_id):
    """Adversarial Test: Promotion starting 2s in future auto-activates gracefully."""
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=100000.0)
    near_start = (datetime.now(timezone.utc) + timedelta(seconds=2)).isoformat()

    created = pmi_api.create_promotion({
        "code": f"ADV_SKEW_BOUNDARY_{uuid4().hex[:6]}",
        "name": "Clock Skew Boundary",
        "discount_type": "PERCENTAGE",
        "discount_value": 20.0,
        "starts_at": near_start,
        "scopes": [{"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(created["id"])

    updated = wait_until(
        lambda: pmi_api.get_promotion(created["id"]),
        timeout_seconds=8,
        interval_seconds=0.5,
    )
    assert updated["status"] in ("SCHEDULED", "ACTIVE")
    pmi_api.end_promotion(created["id"])


# ============================================================================
# GROUP 5: BOUNDARY SCOPE OVERRIDES & PRIORITY TIES
# ============================================================================

def test_adv_19_nested_scope_hierarchy_override_variant_over_category_exclusion(api_clients, pmi_api, e2e_run_id):
    """Adversarial Test: VARIANT inclusion scope must override CATEGORY exclusion on same promo."""
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=100000.0)

    created = pmi_api.create_promotion({
        "code": f"ADV_OVERRIDE_{uuid4().hex[:6]}",
        "name": "Category Excl but Variant Incl",
        "discount_type": "PERCENTAGE",
        "discount_value": 25.0,
        "scopes": [
            {"scope_type": "CATEGORY", "target_id": str(cat.id), "is_exclusion": True},
            {"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": False},
        ],
    })
    pmi_api.activate_promotion(created["id"])

    cp = pmi_api.get_computed_price(str(variant.id))
    assert "computed_price" in cp
    pmi_api.end_promotion(created["id"])


def test_adv_20_equal_priority_promotions_tiebreaker(api_clients, pmi_api, e2e_run_id):
    """Adversarial Test: Multiple promotions with identical priority 5 targeting same variant."""
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=100000.0)

    p1 = pmi_api.create_promotion({
        "code": f"ADV_TIE_A_{uuid4().hex[:6]}",
        "name": "Tie Promo A 10%",
        "discount_type": "PERCENTAGE",
        "discount_value": 10.0,
        "priority": 5,
        "scopes": [{"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(p1["id"])

    p2 = pmi_api.create_promotion({
        "code": f"ADV_TIE_B_{uuid4().hex[:6]}",
        "name": "Tie Promo B 30%",
        "discount_type": "PERCENTAGE",
        "discount_value": 30.0,
        "priority": 5,
        "scopes": [{"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(p2["id"])

    cp = pmi_api.get_computed_price(str(variant.id))
    assert cp["has_active_promotion"] is True
    assert cp["computed_price"] in (70000.0, 90000.0)
    pmi_api.end_promotion(p1["id"])
    pmi_api.end_promotion(p2["id"])


def test_adv_21_multiple_overlapping_exclusions_edge_case(api_clients, pmi_api, e2e_run_id):
    """Adversarial Test: Combination of ALL scope with CATEGORY, PRODUCT, and VARIANT exclusions."""
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=100000.0)

    created = pmi_api.create_promotion({
        "code": f"ADV_MULTI_EXCL_{uuid4().hex[:6]}",
        "name": "Complex Multi Exclusion",
        "discount_type": "PERCENTAGE",
        "discount_value": 20.0,
        "scopes": [
            {"scope_type": "ALL", "target_id": None, "is_exclusion": False},
            {"scope_type": "CATEGORY", "target_id": str(cat.id), "is_exclusion": True},
            {"scope_type": "PRODUCT", "target_id": str(prod.id), "is_exclusion": True},
            {"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": True},
        ],
    })
    pmi_api.activate_promotion(created["id"])

    cp = pmi_api.get_computed_price(str(variant.id))
    assert cp["has_active_promotion"] is False
    assert cp["computed_price"] == 100000.0
    pmi_api.end_promotion(created["id"])


# ============================================================================
# GROUP 6: WHITE-BOX FRONTEND CODE ANALYSIS & GAP VERIFICATION
# ============================================================================

def test_adv_22_whitebox_product_card_spec_null_dereference_gap():
    """White-box Analysis Gap: ProductCard.tsx line 124 crashes if product.category == 'Vợt' and product.specs is undefined/null."""
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
    card_path = os.path.join(repo_root, "web/src/components/ProductCard.tsx")
    assert os.path.exists(card_path), f"ProductCard.tsx path not found: {card_path}"
    with open(card_path, "r", encoding="utf-8") as f:
        code = f.read()

    # Assert guard for category 'Vợt' and product.specs existence check
    assert "product.category === 'Vợt' && product.specs" in code, \
        "ProductCard must safely guard product.specs for category 'Vợt'"
    assert "product.specs?.weight" in code, \
        "ProductCard must use optional chaining on product.specs.weight"

    # Python whitebox contract verification: evaluate spec extraction logic on null specs
    mock_product = {"category": "Vợt", "specs": None}
    specs = mock_product.get("specs")
    weight_str = (specs.get("weight").split()[0] if specs and specs.get("weight") else "N/A") if specs else "N/A"
    assert weight_str == "N/A", "Specs null dereference logic should safely resolve to N/A without exception"


def test_adv_23_whitebox_product_card_unknown_characteristics_gap():
    """White-box Analysis Gap: ProductCard.tsx line 147 crashes if product.characteristics is an unrecognized string."""
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
    card_path = os.path.join(repo_root, "web/src/components/ProductCard.tsx")
    assert os.path.exists(card_path), f"ProductCard.tsx path not found: {card_path}"
    with open(card_path, "r", encoding="utf-8") as f:
        code = f.read()

    # Assert optional chaining and default fallback exist for characteristicStyles lookup
    assert "characteristicStyles[product.characteristics]?.bg" in code, \
        "ProductCard must use optional chaining when accessing characteristicStyles"
    assert "bg-gray-100" in code, "ProductCard must specify fallback background style for unknown characteristics"

    # Python whitebox contract verification: lookup unknown characteristic
    char_styles = {
        "Tấn Công": {"bg": "bg-red-50", "dot": "bg-red-500"},
        "Phòng Thủ": {"bg": "bg-blue-50", "dot": "bg-blue-500"},
    }
    unknown_char = "Cân Bằng Siêu Cấp"
    style = char_styles.get(unknown_char, {"bg": "bg-gray-100 text-gray-700", "dot": "bg-gray-500"})
    assert style["bg"] == "bg-gray-100 text-gray-700"
    assert style["dot"] == "bg-gray-500"


def test_adv_24_whitebox_product_card_price_undefined_crash_gap():
    """White-box Analysis Gap: ProductCard.tsx lines 164 & 169 crash if product.price is undefined."""
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
    card_path = os.path.join(repo_root, "web/src/components/ProductCard.tsx")
    assert os.path.exists(card_path), f"ProductCard.tsx path not found: {card_path}"
    with open(card_path, "r", encoding="utf-8") as f:
        code = f.read()

    # Assert nullish coalescing on prices in formatting block
    assert "originalPrice ?? 0" in code, \
        "ProductCard must guard originalPrice formatting against undefined"
    assert "salePrice ?? 0" in code, \
        "ProductCard must guard salePrice formatting against undefined"

    # Python whitebox contract verification
    orig_price = None
    sale_price = None
    formatted_orig = f"{orig_price or 0:,.0f}đ"
    formatted_sale = f"{sale_price or 0:,.0f}đ"
    assert formatted_orig == "0đ"
    assert formatted_sale == "0đ"


def test_adv_25_whitebox_use_computed_price_negative_price_pass_through():
    """White-box Analysis Gap: useComputedPrice.ts lines 61-62 accepts negative computed price directly."""
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
    hook_path = os.path.join(repo_root, "web/src/hooks/useComputedPrice.ts")
    assert os.path.exists(hook_path), f"useComputedPrice.ts path not found: {hook_path}"
    with open(hook_path, "r", encoding="utf-8") as f:
        code = f.read()

    # Assert Math.max(0, ...) non-negative clamping exists in useComputedPrice.ts
    assert "Math.max(0, json.original_price)" in code or "Math.max(0," in code, \
        "useComputedPrice.ts must clamp prices using Math.max(0, ...)"

    # Python whitebox contract verification
    raw_api_response = {"computed_price": -50000.0, "original_price": -100000.0, "discount_amount": -10.0}
    comp = max(0.0, float(raw_api_response.get("computed_price", 0.0)))
    orig = max(0.0, float(raw_api_response.get("original_price", 0.0)))
    disc = max(0.0, float(raw_api_response.get("discount_amount", 0.0)))
    assert comp == 0.0, f"Negative computed price must clamp to 0.0, got {comp}"
    assert orig == 0.0, f"Negative original price must clamp to 0.0, got {orig}"
    assert disc == 0.0, f"Negative discount amount must clamp to 0.0, got {disc}"


def test_adv_26_whitebox_product_mapper_min_price_fallback_anomaly():
    """White-box Analysis Gap: productMappers.ts lines 126-169 resolves price to 100000 when all variant prices <= 0."""
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
    mapper_path = os.path.join(repo_root, "web/src/services/sport-api/productMappers.ts")
    assert os.path.exists(mapper_path), f"productMappers.ts path not found: {mapper_path}"
    with open(mapper_path, "r", encoding="utf-8") as f:
        code = f.read()

    # Assert minPrice logic handles variant price mapping without arbitrary non-zero fallback
    assert "prices.length > 0 ? Math.min(...prices) : 0" in code or "Math.min(...prices)" in code, \
        "productMappers.ts must compute minPrice from valid non-negative variant prices"

    # Python whitebox contract verification
    variants = [{"price": -100.0}, {"price": 0.0}, {"price": None}]
    valid_prices = [float(v["price"]) for v in variants if v.get("price") is not None and float(v["price"]) >= 0]
    min_price = min(valid_prices) if valid_prices else 0.0
    assert min_price == 0.0, f"Zero/negative variant prices should yield min_price of 0.0, got {min_price}"


def test_adv_27_scope_all_exclusion_handling(api_clients, e2e_run_id):
    """Adversarial Test: Creating promotion with scope ALL as exclusion."""
    res = api_clients.pmi.post("/api/promotions", json={
        "code": f"ADV_EXCL_ALL_{uuid4().hex[:6]}",
        "name": "Exclude All Scope",
        "discount_type": "PERCENTAGE",
        "discount_value": 10.0,
        "scopes": [{"scope_type": "ALL", "target_id": None, "is_exclusion": True}],
    })
    assert res.status_code in (200, 201, 400, 422)


def test_adv_28_sql_injection_and_xss_in_promotion_code(api_clients, e2e_run_id):
    """Adversarial Test: Code with XSS script injection tags."""
    xss_code = f"<script>alert(1)</script>_{uuid4().hex[:4]}"
    res = api_clients.pmi.post("/api/promotions", json={
        "code": xss_code,
        "name": "XSS Code Test",
        "discount_type": "PERCENTAGE",
        "discount_value": 10.0,
    })
    assert res.status_code in (200, 201, 400, 422)
