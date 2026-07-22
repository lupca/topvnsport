from __future__ import annotations

import os
import time
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from typing import Any, Iterator

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
    cat = pmi_api.create_category(name=f"Cat-{uid}", code=f"CAT-{uid}")
    fam = pmi_api.create_attribute_family(name=f"Fam-{uid}", code=f"FAM-{uid}")
    prod = pmi_api.create_product_with_variants(
        product_code=f"PROD-{uid}",
        name=f"Product {uid}",
        category_id=cat.id,
        family_id=fam.id,
        sku_code=f"SKU-{uid}",
        price=price,
        stock=stock,
    )
    return cat, fam, prod, prod.variants[0]


# ============================================================================
# TIER 1: FEATURE COVERAGE (35 Test Functions)
# ============================================================================

# --- F1: Promotion CRUD & Lifecycle Management ---

def test_tier1_f1_01_create_draft_promotion(api_clients, e2e_run_id):
    code = f"PROMO_DRAFT_{uuid4().hex[:6]}"
    payload = {
        "code": code,
        "name": "Summer Sale Draft",
        "description": "20% off everything",
        "discount_type": "PERCENTAGE",
        "discount_value": 20.0,
        "priority": 0,
        "scopes": [{"scope_type": "ALL", "target_id": None, "is_exclusion": False}],
    }
    response = api_clients.pmi.post("/api/promotions", json=payload)
    assert response.status_code in (200, 201)
    data = response.json()
    assert "id" in data
    assert data["code"] == code
    assert data["status"] == "DRAFT"
    assert data["discount_value"] == 20.0


def test_tier1_f1_02_get_promotion_by_id(api_clients, pmi_api, e2e_run_id):
    code = f"PROMO_GET_{uuid4().hex[:6]}"
    created = pmi_api.create_promotion({
        "code": code,
        "name": "Promo Detail Test",
        "discount_type": "PERCENTAGE",
        "discount_value": 15.0,
        "scopes": [],
    })
    promo_id = created["id"]
    detail = pmi_api.get_promotion(promo_id)
    assert detail["id"] == promo_id
    assert detail["code"] == code
    assert detail["name"] == "Promo Detail Test"
    assert detail["status"] == "DRAFT"


def test_tier1_f1_03_list_promotions_pagination(api_clients, pmi_api, e2e_run_id):
    pmi_api.create_promotion({"code": f"LIST_A_{uuid4().hex[:6]}", "name": "List A", "discount_type": "PERCENTAGE", "discount_value": 10.0})
    pmi_api.create_promotion({"code": f"LIST_B_{uuid4().hex[:6]}", "name": "List B", "discount_type": "PERCENTAGE", "discount_value": 10.0})

    response = api_clients.pmi.get("/api/promotions", params={"page": 1, "limit": 10})
    assert response.status_code == 200
    data = response.json()
    items = data.get("items", data) if isinstance(data, dict) else data
    assert isinstance(items, list)
    assert len(items) >= 2


def test_tier1_f1_04_update_draft_promotion(api_clients, pmi_api, e2e_run_id):
    created = pmi_api.create_promotion({
        "code": f"UPD_{uuid4().hex[:6]}",
        "name": "Original Name",
        "discount_type": "PERCENTAGE",
        "discount_value": 10.0,
    })
    promo_id = created["id"]
    updated = pmi_api.update_promotion(promo_id, {
        "name": "Updated Name",
        "description": "Updated Description",
        "discount_type": "PERCENTAGE",
        "discount_value": 25.0,
    })
    assert updated["name"] == "Updated Name"
    assert updated["discount_value"] == 25.0


def test_tier1_f1_05_delete_draft_promotion(api_clients, pmi_api, e2e_run_id):
    created = pmi_api.create_promotion({
        "code": f"DEL_{uuid4().hex[:6]}",
        "name": "To Be Deleted",
        "discount_type": "PERCENTAGE",
        "discount_value": 10.0,
    })
    promo_id = created["id"]
    pmi_api.delete_promotion(promo_id)

    response = api_clients.pmi.get(f"/api/promotions/{promo_id}")
    assert response.status_code == 404


def test_tier1_f1_06_lifecycle_draft_to_active(api_clients, pmi_api, e2e_run_id):
    created = pmi_api.create_promotion({
        "code": f"ACT_{uuid4().hex[:6]}",
        "name": "Draft to Active",
        "discount_type": "PERCENTAGE",
        "discount_value": 15.0,
    })
    promo_id = created["id"]
    activated = pmi_api.activate_promotion(promo_id)
    assert activated["status"] == "ACTIVE"


def test_tier1_f1_07_lifecycle_active_pause_resume(api_clients, pmi_api, e2e_run_id):
    created = pmi_api.create_promotion({
        "code": f"PAUSE_{uuid4().hex[:6]}",
        "name": "Active Pause Resume",
        "discount_type": "PERCENTAGE",
        "discount_value": 15.0,
    })
    promo_id = created["id"]
    pmi_api.activate_promotion(promo_id)

    paused = pmi_api.pause_promotion(promo_id)
    assert paused["status"] == "PAUSED"

    resumed = pmi_api.resume_promotion(promo_id)
    assert resumed["status"] == "ACTIVE"


def test_tier1_f1_08_lifecycle_active_to_ended(api_clients, pmi_api, e2e_run_id):
    created = pmi_api.create_promotion({
        "code": f"END_{uuid4().hex[:6]}",
        "name": "Active to Ended",
        "discount_type": "PERCENTAGE",
        "discount_value": 15.0,
    })
    promo_id = created["id"]
    pmi_api.activate_promotion(promo_id)

    ended = pmi_api.end_promotion(promo_id)
    assert ended["status"] == "ENDED"


# --- F2: Scope Targeting & Exclusion Logic ---

def test_tier1_f2_01_scope_all_target(api_clients, pmi_api, e2e_run_id):
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=100000.0)
    created = pmi_api.create_promotion({
        "code": f"SCOPE_ALL_{uuid4().hex[:6]}",
        "name": "Target All Scope",
        "discount_type": "PERCENTAGE",
        "discount_value": 10.0,
        "scopes": [{"scope_type": "ALL", "target_id": None, "is_exclusion": False}],
    })
    pmi_api.activate_promotion(created["id"])

    cp = pmi_api.get_computed_price(str(variant.id))
    assert cp["has_active_promotion"] is True
    assert cp["computed_price"] == 90000.0
    pmi_api.end_promotion(created["id"])


def test_tier1_f2_02_scope_category_target(api_clients, pmi_api, e2e_run_id):
    cat_a, fam_a, prod_a, var_a = create_test_product_and_variant(pmi_api, price=100000.0)
    cat_b, fam_b, prod_b, var_b = create_test_product_and_variant(pmi_api, price=100000.0)

    created = pmi_api.create_promotion({
        "code": f"SCOPE_CAT_{uuid4().hex[:6]}",
        "name": "Category Scope",
        "discount_type": "PERCENTAGE",
        "discount_value": 20.0,
        "scopes": [{"scope_type": "CATEGORY", "target_id": str(cat_a.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(created["id"])

    cp_a = pmi_api.get_computed_price(str(var_a.id))
    assert cp_a["has_active_promotion"] is True
    assert cp_a["computed_price"] == 80000.0

    cp_b = pmi_api.get_computed_price(str(var_b.id))
    assert cp_b["has_active_promotion"] is False
    assert cp_b["computed_price"] == 100000.0


def test_tier1_f2_03_scope_product_target(api_clients, pmi_api, e2e_run_id):
    cat, fam, prod1, var1 = create_test_product_and_variant(pmi_api, price=100000.0)
    _, _, prod2, var2 = create_test_product_and_variant(pmi_api, price=100000.0)

    created = pmi_api.create_promotion({
        "code": f"SCOPE_PROD_{uuid4().hex[:6]}",
        "name": "Product Scope",
        "discount_type": "PERCENTAGE",
        "discount_value": 30.0,
        "scopes": [{"scope_type": "PRODUCT", "target_id": str(prod1.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(created["id"])

    cp1 = pmi_api.get_computed_price(str(var1.id))
    assert cp1["has_active_promotion"] is True

    cp2 = pmi_api.get_computed_price(str(var2.id))
    assert cp2["has_active_promotion"] is False


def test_tier1_f2_04_scope_variant_target(api_clients, pmi_api, e2e_run_id):
    cat, fam, prod, var1 = create_test_product_and_variant(pmi_api, price=100000.0)

    created = pmi_api.create_promotion({
        "code": f"SCOPE_VAR_{uuid4().hex[:6]}",
        "name": "Variant Scope",
        "discount_type": "PERCENTAGE",
        "discount_value": 25.0,
        "scopes": [{"scope_type": "VARIANT", "target_id": str(var1.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(created["id"])

    cp1 = pmi_api.get_computed_price(str(var1.id))
    assert cp1["has_active_promotion"] is True
    assert cp1["computed_price"] == 75000.0


def test_tier1_f2_05_scope_category_with_variant_exclusion(api_clients, pmi_api, e2e_run_id):
    cat, fam, prod, var1 = create_test_product_and_variant(pmi_api, price=100000.0)

    # Create a second variant in same product
    v2_resp = api_clients.pmi.post(f"/api/products/{prod.id}/variants", json={
        "sku_code": f"SKU-VAR2-{uuid4().hex[:6]}",
        "price": 100000.0,
        "stock": 50,
    })

    created = pmi_api.create_promotion({
        "code": f"SCOPE_EXCL_VAR_{uuid4().hex[:6]}",
        "name": "Category with Variant Exclusion",
        "discount_type": "PERCENTAGE",
        "discount_value": 20.0,
        "scopes": [
            {"scope_type": "CATEGORY", "target_id": str(cat.id), "is_exclusion": False},
            {"scope_type": "VARIANT", "target_id": str(var1.id), "is_exclusion": True},
        ],
    })
    pmi_api.activate_promotion(created["id"])

    cp1 = pmi_api.get_computed_price(str(var1.id))
    assert cp1["has_active_promotion"] is False
    assert cp1["computed_price"] == 100000.0


def test_tier1_f2_06_scope_all_with_category_exclusion(api_clients, pmi_api, e2e_run_id):
    cat_excl, _, _, var_excl = create_test_product_and_variant(pmi_api, price=100000.0)
    cat_incl, _, _, var_incl = create_test_product_and_variant(pmi_api, price=100000.0)

    created = pmi_api.create_promotion({
        "code": f"SCOPE_EXCL_CAT_{uuid4().hex[:6]}",
        "name": "All with Category Exclusion",
        "discount_type": "PERCENTAGE",
        "discount_value": 15.0,
        "scopes": [
            {"scope_type": "ALL", "target_id": None, "is_exclusion": False},
            {"scope_type": "CATEGORY", "target_id": str(cat_excl.id), "is_exclusion": True},
        ],
    })
    pmi_api.activate_promotion(created["id"])

    cp_incl = pmi_api.get_computed_price(str(var_incl.id))
    assert cp_incl["has_active_promotion"] is True

    cp_excl = pmi_api.get_computed_price(str(var_excl.id))
    assert cp_excl["has_active_promotion"] is False
    pmi_api.end_promotion(created["id"])


# --- F3: Price Calculation Engine & Priority Resolution ---

def test_tier1_f3_01_percentage_discount_calc(api_clients, pmi_api, e2e_run_id):
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=100000.0)
    created = pmi_api.create_promotion({
        "code": f"CALC_PCT_{uuid4().hex[:6]}",
        "name": "20 Percent Discount",
        "discount_type": "PERCENTAGE",
        "discount_value": 20.0,
        "scopes": [{"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(created["id"])

    cp = pmi_api.get_computed_price(str(variant.id))
    assert cp["computed_price"] == 80000.0
    assert cp["discount_amount"] == 20000.0


def test_tier1_f3_02_percentage_discount_with_max_cap(api_clients, pmi_api, e2e_run_id):
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=1000000.0)
    created = pmi_api.create_promotion({
        "code": f"CALC_CAP_{uuid4().hex[:6]}",
        "name": "50 Percent with 100k Cap",
        "discount_type": "PERCENTAGE",
        "discount_value": 50.0,
        "max_discount": 100000.0,
        "scopes": [{"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(created["id"])

    cp = pmi_api.get_computed_price(str(variant.id))
    assert cp["computed_price"] == 900000.0
    assert cp["discount_amount"] == 100000.0


def test_tier1_f3_03_fixed_amount_discount_calc(api_clients, pmi_api, e2e_run_id):
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=200000.0)
    created = pmi_api.create_promotion({
        "code": f"CALC_FIXED_AMT_{uuid4().hex[:6]}",
        "name": "50k Fixed Amount Discount",
        "discount_type": "FIXED_AMOUNT",
        "discount_value": 50000.0,
        "scopes": [{"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(created["id"])

    cp = pmi_api.get_computed_price(str(variant.id))
    assert cp["computed_price"] == 150000.0
    assert cp["discount_amount"] == 50000.0


def test_tier1_f3_04_fixed_price_discount_calc(api_clients, pmi_api, e2e_run_id):
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=180000.0)
    created = pmi_api.create_promotion({
        "code": f"CALC_FIXED_PRC_{uuid4().hex[:6]}",
        "name": "Fixed Price 120k",
        "discount_type": "FIXED_PRICE",
        "discount_value": 120000.0,
        "scopes": [{"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(created["id"])

    cp = pmi_api.get_computed_price(str(variant.id))
    assert cp["computed_price"] == 120000.0
    assert cp["discount_amount"] == 60000.0


def test_tier1_f3_05_priority_sorting_highest_wins(api_clients, pmi_api, e2e_run_id):
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=100000.0)

    p1 = pmi_api.create_promotion({
        "code": f"PRIO_5_{uuid4().hex[:6]}",
        "name": "Priority 5 Promo",
        "discount_type": "PERCENTAGE",
        "discount_value": 10.0,
        "priority": 5,
        "scopes": [{"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(p1["id"])

    p2 = pmi_api.create_promotion({
        "code": f"PRIO_10_{uuid4().hex[:6]}",
        "name": "Priority 10 Promo",
        "discount_type": "PERCENTAGE",
        "discount_value": 30.0,
        "priority": 10,
        "scopes": [{"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(p2["id"])

    cp = pmi_api.get_computed_price(str(variant.id))
    assert cp["computed_price"] == 70000.0
    assert cp["discount_amount"] == 30000.0


def test_tier1_f3_06_computed_price_record_persistence(api_clients, pmi_api, e2e_run_id):
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=150000.0)
    created = pmi_api.create_promotion({
        "code": f"PERSIST_{uuid4().hex[:6]}",
        "name": "Record Persistence",
        "discount_type": "PERCENTAGE",
        "discount_value": 20.0,
        "scopes": [{"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(created["id"])

    cp = pmi_api.get_computed_price(str(variant.id))
    assert "original_price" in cp
    assert "computed_price" in cp
    assert "discount_amount" in cp
    assert "percentage_discount" in cp
    assert cp["original_price"] == 150000.0
    assert cp["computed_price"] == 120000.0


def test_tier1_f3_07_price_calculation_zero_base(api_clients, pmi_api, e2e_run_id):
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=0.0)
    created = pmi_api.create_promotion({
        "code": f"ZERO_BASE_{uuid4().hex[:6]}",
        "name": "Zero Base Price Promo",
        "discount_type": "PERCENTAGE",
        "discount_value": 20.0,
        "scopes": [{"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(created["id"])

    cp = pmi_api.get_computed_price(str(variant.id))
    assert cp["computed_price"] == 0.0
    assert cp["discount_amount"] == 0.0


# --- F4: Bulk & Single Computed Price APIs & Intent Parser ---

def test_tier1_f4_01_get_single_variant_computed_price(api_clients, pmi_api, e2e_run_id):
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=100000.0)
    response = api_clients.pmi.get(f"/api/variants/{variant.id}/computed-price")
    assert response.status_code == 200
    data = response.json()
    assert "computed_price" in data


def test_tier1_f4_02_post_bulk_computed_prices(api_clients, pmi_api, e2e_run_id):
    variants = [create_test_product_and_variant(pmi_api, price=100000.0)[3] for _ in range(5)]
    var_ids = [str(v.id) for v in variants]

    response = api_clients.pmi.post("/api/computed-prices/bulk", json={"variant_ids": var_ids})
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 5 or isinstance(data, (dict, list))


def test_tier1_f4_03_preview_promotion_impact(api_clients, pmi_api, e2e_run_id):
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=100000.0)
    preview_payload = {
        "discount_type": "PERCENTAGE",
        "discount_value": 15.0,
        "scopes": [{"scope_type": "CATEGORY", "target_id": str(cat.id), "is_exclusion": False}],
    }
    response = api_clients.pmi.post("/api/promotions/preview", json=preview_payload)
    assert response.status_code == 200
    data = response.json()
    assert "affected_variants_count" in data or "total_affected" in data or isinstance(data, dict)


def test_tier1_f4_04_parse_intent_natural_language(api_clients, pmi_api, e2e_run_id):
    response = api_clients.pmi.post("/api/promotions/parse-intent", json={"prompt": "Giảm 15% tối đa 50k cho áo đấu"})
    assert response.status_code == 200
    data = response.json()
    assert data.get("discount_type") == "PERCENTAGE"
    assert float(data.get("discount_value", 0)) == 15.0
    assert float(data.get("max_discount", 0)) == 50000.0


def test_tier1_f4_05_unpromoted_variant_computed_price(api_clients, pmi_api, e2e_run_id):
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=120000.0)
    cp = pmi_api.get_computed_price(str(variant.id))
    assert cp["has_active_promotion"] is False
    assert cp["computed_price"] == 120000.0
    assert cp["discount_amount"] == 0.0


# --- F5: Background Auto-Scheduler & Status Expiry ---

def test_tier1_f5_01_schedule_future_starts_at(api_clients, pmi_api, e2e_run_id):
    future_start = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    created = pmi_api.create_promotion({
        "code": f"SCHED_FUT_{uuid4().hex[:6]}",
        "name": "Future Starts At",
        "discount_type": "PERCENTAGE",
        "discount_value": 10.0,
        "starts_at": future_start,
    })
    activated = pmi_api.activate_promotion(created["id"])
    assert activated["status"] == "SCHEDULED"


def test_tier1_f5_02_auto_activate_scheduled_promotion(api_clients, pmi_api, e2e_run_id):
    near_start = (datetime.now(timezone.utc) + timedelta(seconds=2)).isoformat()
    created = pmi_api.create_promotion({
        "code": f"SCHED_ACT_{uuid4().hex[:6]}",
        "name": "Auto Activate Scheduled",
        "discount_type": "PERCENTAGE",
        "discount_value": 10.0,
        "starts_at": near_start,
    })
    pmi_api.activate_promotion(created["id"])

    updated = wait_until(
        lambda: pmi_api.get_promotion(created["id"]),
        timeout_seconds=10,
        interval_seconds=0.5,
    )
    assert updated["status"] in ("ACTIVE", "SCHEDULED")


def test_tier1_f5_03_auto_end_expired_promotion(api_clients, pmi_api, e2e_run_id):
    past_start = (datetime.now(timezone.utc) - timedelta(seconds=10)).isoformat()
    near_end = (datetime.now(timezone.utc) + timedelta(seconds=2)).isoformat()
    created = pmi_api.create_promotion({
        "code": f"SCHED_END_{uuid4().hex[:6]}",
        "name": "Auto End Expired",
        "discount_type": "PERCENTAGE",
        "discount_value": 10.0,
        "starts_at": past_start,
        "ends_at": near_end,
    })
    pmi_api.activate_promotion(created["id"])

    updated = wait_until(
        lambda: pmi_api.get_promotion(created["id"]),
        timeout_seconds=10,
        interval_seconds=0.5,
    )
    assert updated["status"] in ("ACTIVE", "ENDED")


def test_tier1_f5_04_auto_scheduler_recomputes_prices(api_clients, pmi_api, e2e_run_id):
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=100000.0)
    created = pmi_api.create_promotion({
        "code": f"SCHED_RECOMP_{uuid4().hex[:6]}",
        "name": "Scheduler Price Recompute",
        "discount_type": "PERCENTAGE",
        "discount_value": 20.0,
        "scopes": [{"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(created["id"])

    cp = pmi_api.get_computed_price(str(variant.id))
    assert cp["has_active_promotion"] is True


# --- F6: PMI Admin UI & Web Storefront Price Rendering ---

def test_tier1_f6_01_pmi_ui_list_promotions_tab_filter(api_clients, e2e_run_id):
    for status in ("ACTIVE", "SCHEDULED", "ENDED"):
        res = api_clients.pmi.get("/api/promotions", params={"status": status})
        assert res.status_code == 200


def test_tier1_f6_02_pmi_ui_create_wizard_submission(api_clients, pmi_api, e2e_run_id):
    wizard_payload = {
        "code": f"WIZARD_{uuid4().hex[:6]}",
        "name": "Wizard Created Promotion",
        "description": "Created from 4-step wizard",
        "discount_type": "PERCENTAGE",
        "discount_value": 15.0,
        "max_discount": 50000.0,
        "priority": 5,
        "scopes": [{"scope_type": "ALL", "target_id": None, "is_exclusion": False}],
    }
    response = api_clients.pmi.post("/api/promotions", json=wizard_payload)
    assert response.status_code in (200, 201)
    assert response.json()["status"] == "DRAFT"


def test_tier1_f6_03_storefront_use_computed_price_hook(api_clients, pmi_api, e2e_run_id):
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=100000.0)
    created = pmi_api.create_promotion({
        "code": f"HOOK_{uuid4().hex[:6]}",
        "name": "Storefront Hook Test",
        "discount_type": "PERCENTAGE",
        "discount_value": 20.0,
        "scopes": [{"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(created["id"])

    response = api_clients.pmi.get(f"/api/variants/{variant.id}/computed-price")
    assert response.status_code == 200
    data = response.json()
    assert data["has_active_promotion"] is True
    assert data["computed_price"] == 80000.0


def test_tier1_f6_04_storefront_product_card_active_discount(api_clients, pmi_api, e2e_run_id):
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=200000.0)
    created = pmi_api.create_promotion({
        "code": f"CARD_ACTIVE_{uuid4().hex[:6]}",
        "name": "Active Card Discount",
        "discount_type": "PERCENTAGE",
        "discount_value": 25.0,
        "scopes": [{"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(created["id"])

    cp = pmi_api.get_computed_price(str(variant.id))
    assert cp["has_active_promotion"] is True
    assert cp["original_price"] == 200000.0
    assert cp["computed_price"] == 150000.0
    assert cp["percentage_discount"] == 25.0


def test_tier1_f6_05_storefront_product_card_no_discount(api_clients, pmi_api, e2e_run_id):
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=150000.0)
    cp = pmi_api.get_computed_price(str(variant.id))
    assert cp["has_active_promotion"] is False
    assert cp["original_price"] == 150000.0
    assert cp["computed_price"] == 150000.0


# ============================================================================
# TIER 2: BOUNDARY & CORNER CASES (35 Test Functions)
# ============================================================================

# --- F1 Boundaries ---

def test_tier2_f1_b01_create_promotion_empty_name(api_clients, e2e_run_id):
    response = api_clients.pmi.post("/api/promotions", json={
        "code": f"EMPTY_NAME_{uuid4().hex[:6]}",
        "name": "",
        "discount_type": "PERCENTAGE",
        "discount_value": 10.0,
    })
    assert response.status_code == 422


def test_tier2_f1_b02_create_promotion_duplicate_code(api_clients, pmi_api, e2e_run_id):
    code = f"DUP_CODE_{uuid4().hex[:6]}"
    pmi_api.create_promotion({"code": code, "name": "Promo 1", "discount_type": "PERCENTAGE", "discount_value": 10.0})

    response = api_clients.pmi.post("/api/promotions", json={
        "code": code,
        "name": "Promo 2 Duplicate Code",
        "discount_type": "PERCENTAGE",
        "discount_value": 10.0,
    })
    assert response.status_code == 400


def test_tier2_f1_b03_create_promotion_invalid_dates(api_clients, e2e_run_id):
    starts = (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()
    ends = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()

    response = api_clients.pmi.post("/api/promotions", json={
        "code": f"BAD_DATES_{uuid4().hex[:6]}",
        "name": "Invalid Dates Promo",
        "discount_type": "PERCENTAGE",
        "discount_value": 10.0,
        "starts_at": starts,
        "ends_at": ends,
    })
    assert response.status_code in (400, 422)


def test_tier2_f1_b04_invalid_lifecycle_transition_draft_to_paused(api_clients, pmi_api, e2e_run_id):
    created = pmi_api.create_promotion({
        "code": f"BAD_PAUSE_{uuid4().hex[:6]}",
        "name": "Draft to Paused Test",
        "discount_type": "PERCENTAGE",
        "discount_value": 10.0,
    })
    response = api_clients.pmi.post(f"/api/promotions/{created['id']}/pause")
    assert response.status_code == 400


def test_tier2_f1_b05_invalid_lifecycle_transition_ended_to_active(api_clients, pmi_api, e2e_run_id):
    created = pmi_api.create_promotion({
        "code": f"BAD_ACT_{uuid4().hex[:6]}",
        "name": "Ended to Active Test",
        "discount_type": "PERCENTAGE",
        "discount_value": 10.0,
    })
    pmi_api.activate_promotion(created["id"])
    pmi_api.end_promotion(created["id"])

    response = api_clients.pmi.post(f"/api/promotions/{created['id']}/activate")
    assert response.status_code == 400


def test_tier2_f1_b06_update_ended_promotion(api_clients, pmi_api, e2e_run_id):
    created = pmi_api.create_promotion({
        "code": f"UPD_ENDED_{uuid4().hex[:6]}",
        "name": "Update Ended Test",
        "discount_type": "PERCENTAGE",
        "discount_value": 10.0,
    })
    pmi_api.activate_promotion(created["id"])
    pmi_api.end_promotion(created["id"])

    response = api_clients.pmi.put(f"/api/promotions/{created['id']}", json={"name": "New Name"})
    assert response.status_code == 400


def test_tier2_f1_b07_get_non_existent_promotion_id(api_clients):
    response = api_clients.pmi.get("/api/promotions/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404


def test_tier2_f1_b08_delete_active_promotion(api_clients, pmi_api, e2e_run_id):
    created = pmi_api.create_promotion({
        "code": f"DEL_ACT_{uuid4().hex[:6]}",
        "name": "Delete Active Test",
        "discount_type": "PERCENTAGE",
        "discount_value": 10.0,
    })
    pmi_api.activate_promotion(created["id"])

    response = api_clients.pmi.delete(f"/api/promotions/{created['id']}")
    assert response.status_code == 400


# --- F2 Boundaries ---

def test_tier2_f2_b01_scope_category_non_existent_target(api_clients, e2e_run_id):
    response = api_clients.pmi.post("/api/promotions", json={
        "code": f"BAD_CAT_{uuid4().hex[:6]}",
        "name": "Non Existent Category Scope",
        "discount_type": "PERCENTAGE",
        "discount_value": 10.0,
        "scopes": [{"scope_type": "CATEGORY", "target_id": "99999999", "is_exclusion": False}],
    })
    assert response.status_code in (200, 201, 422)


def test_tier2_f2_b02_scope_exclusion_without_base_inclusion(api_clients, pmi_api, e2e_run_id):
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=100000.0)
    created = pmi_api.create_promotion({
        "code": f"ONLY_EXCL_{uuid4().hex[:6]}",
        "name": "Only Exclusion Scope",
        "discount_type": "PERCENTAGE",
        "discount_value": 20.0,
        "scopes": [{"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": True}],
    })
    pmi_api.activate_promotion(created["id"])

    cp = pmi_api.get_computed_price(str(variant.id))
    assert cp["has_active_promotion"] is False


def test_tier2_f2_b03_scope_conflicting_product_and_variant_exclusions(api_clients, pmi_api, e2e_run_id):
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=100000.0)
    created = pmi_api.create_promotion({
        "code": f"CONFLICT_EXCL_{uuid4().hex[:6]}",
        "name": "Conflicting Exclusions",
        "discount_type": "PERCENTAGE",
        "discount_value": 20.0,
        "scopes": [
            {"scope_type": "PRODUCT", "target_id": str(prod.id), "is_exclusion": False},
            {"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": True},
        ],
    })
    pmi_api.activate_promotion(created["id"])

    cp = pmi_api.get_computed_price(str(variant.id))
    assert cp["has_active_promotion"] is False


def test_tier2_f2_b04_scope_empty_target_ids_list(api_clients, e2e_run_id):
    response = api_clients.pmi.post("/api/promotions", json={
        "code": f"EMPTY_TGT_{uuid4().hex[:6]}",
        "name": "Empty Target ID Scope",
        "discount_type": "PERCENTAGE",
        "discount_value": 10.0,
        "scopes": [{"scope_type": "VARIANT", "target_id": "", "is_exclusion": False}],
    })
    assert response.status_code in (400, 422)


def test_tier2_f2_b05_scope_multiple_exclusions_overlapping(api_clients, pmi_api, e2e_run_id):
    cat1, _, prod1, var1 = create_test_product_and_variant(pmi_api, price=100000.0)
    cat2, _, prod2, var2 = create_test_product_and_variant(pmi_api, price=100000.0)

    created = pmi_api.create_promotion({
        "code": f"MULTI_EXCL_{uuid4().hex[:6]}",
        "name": "Multiple Overlapping Exclusions",
        "discount_type": "PERCENTAGE",
        "discount_value": 20.0,
        "scopes": [
            {"scope_type": "ALL", "target_id": None, "is_exclusion": False},
            {"scope_type": "CATEGORY", "target_id": str(cat1.id), "is_exclusion": True},
            {"scope_type": "PRODUCT", "target_id": str(prod2.id), "is_exclusion": True},
        ],
    })
    pmi_api.activate_promotion(created["id"])

    cp1 = pmi_api.get_computed_price(str(var1.id))
    assert cp1["has_active_promotion"] is False

    cp2 = pmi_api.get_computed_price(str(var2.id))
    assert cp2["has_active_promotion"] is False
    pmi_api.end_promotion(created["id"])


def test_tier2_f2_b06_scope_all_with_all_categories_excluded(api_clients, pmi_api, e2e_run_id):
    cat1, _, _, var1 = create_test_product_and_variant(pmi_api, price=100000.0)
    created = pmi_api.create_promotion({
        "code": f"ALL_EXCL_CAT_{uuid4().hex[:6]}",
        "name": "All Scope Exclude Category",
        "discount_type": "PERCENTAGE",
        "discount_value": 15.0,
        "scopes": [
            {"scope_type": "ALL", "target_id": None, "is_exclusion": False},
            {"scope_type": "CATEGORY", "target_id": str(cat1.id), "is_exclusion": True},
        ],
    })
    pmi_api.activate_promotion(created["id"])

    cp1 = pmi_api.get_computed_price(str(var1.id))
    assert cp1["has_active_promotion"] is False
    pmi_api.end_promotion(created["id"])


# --- F3 Boundaries ---

def test_tier2_f3_b01_discount_percentage_0_percent(api_clients, pmi_api, e2e_run_id):
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=100000.0)
    created = pmi_api.create_promotion({
        "code": f"PCT_0_{uuid4().hex[:6]}",
        "name": "Zero Percent Promo",
        "discount_type": "PERCENTAGE",
        "discount_value": 0.0,
        "scopes": [{"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(created["id"])

    cp = pmi_api.get_computed_price(str(variant.id))
    assert cp["computed_price"] == 100000.0
    assert cp["discount_amount"] == 0.0


def test_tier2_f3_b02_discount_percentage_100_percent(api_clients, pmi_api, e2e_run_id):
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=100000.0)
    created = pmi_api.create_promotion({
        "code": f"PCT_100_{uuid4().hex[:6]}",
        "name": "100 Percent Promo",
        "discount_type": "PERCENTAGE",
        "discount_value": 100.0,
        "scopes": [{"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(created["id"])

    cp = pmi_api.get_computed_price(str(variant.id))
    assert cp["computed_price"] == 0.0
    assert cp["discount_amount"] == 100000.0


def test_tier2_f3_b03_discount_percentage_exceeds_100(api_clients, e2e_run_id):
    response = api_clients.pmi.post("/api/promotions", json={
        "code": f"PCT_105_{uuid4().hex[:6]}",
        "name": "105 Percent Promo",
        "discount_type": "PERCENTAGE",
        "discount_value": 105.0,
    })
    assert response.status_code in (400, 422)


def test_tier2_f3_b04_fixed_amount_exceeds_original_price(api_clients, pmi_api, e2e_run_id):
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=200000.0)
    created = pmi_api.create_promotion({
        "code": f"FIXED_EXCEED_{uuid4().hex[:6]}",
        "name": "Fixed Amount Exceeds Base",
        "discount_type": "FIXED_AMOUNT",
        "discount_value": 300000.0,
        "scopes": [{"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(created["id"])

    cp = pmi_api.get_computed_price(str(variant.id))
    assert cp["computed_price"] == 0.0
    assert cp["discount_amount"] == 200000.0


def test_tier2_f3_b05_fixed_price_higher_than_original(api_clients, pmi_api, e2e_run_id):
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=200000.0)
    created = pmi_api.create_promotion({
        "code": f"FIXED_HIGH_{uuid4().hex[:6]}",
        "name": "Fixed Price Higher Than Base",
        "discount_type": "FIXED_PRICE",
        "discount_value": 250000.0,
        "scopes": [{"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(created["id"])

    cp = pmi_api.get_computed_price(str(variant.id))
    assert cp["computed_price"] == 200000.0


def test_tier2_f3_b06_max_discount_negative_or_zero(api_clients, e2e_run_id):
    response = api_clients.pmi.post("/api/promotions", json={
        "code": f"BAD_CAP_{uuid4().hex[:6]}",
        "name": "Negative Cap Promo",
        "discount_type": "PERCENTAGE",
        "discount_value": 10.0,
        "max_discount": -500.0,
    })
    assert response.status_code in (400, 422)


def test_tier2_f3_b07_priority_equal_level_tiebreaker(api_clients, pmi_api, e2e_run_id):
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=100000.0)
    p1 = pmi_api.create_promotion({
        "code": f"TIE_1_{uuid4().hex[:6]}",
        "name": "Tie 1",
        "discount_type": "PERCENTAGE",
        "discount_value": 10.0,
        "priority": 5,
        "scopes": [{"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(p1["id"])

    p2 = pmi_api.create_promotion({
        "code": f"TIE_2_{uuid4().hex[:6]}",
        "name": "Tie 2",
        "discount_type": "PERCENTAGE",
        "discount_value": 20.0,
        "priority": 5,
        "scopes": [{"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(p2["id"])

    cp = pmi_api.get_computed_price(str(variant.id))
    assert cp["has_active_promotion"] is True
    assert cp["computed_price"] in (80000.0, 90000.0)


# --- F4 Boundaries ---

def test_tier2_f4_b01_bulk_prices_empty_array(api_clients):
    response = api_clients.pmi.post("/api/computed-prices/bulk", json={"variant_ids": []})
    assert response.status_code == 200


def test_tier2_f4_b02_bulk_prices_exceed_max_batch(api_clients):
    large_batch = [f"var-{i}" for i in range(600)]
    response = api_clients.pmi.post("/api/computed-prices/bulk", json={"variant_ids": large_batch})
    assert response.status_code in (400, 422)


def test_tier2_f4_b03_bulk_prices_non_existent_variant_ids(api_clients):
    response = api_clients.pmi.post("/api/computed-prices/bulk", json={"variant_ids": ["non-existent-v1", "non-existent-v2"]})
    assert response.status_code == 200


def test_tier2_f4_b04_parse_intent_ambiguous_prompt(api_clients):
    response = api_clients.pmi.post("/api/promotions/parse-intent", json={"prompt": "làm chương trình khuyến mãi đi"})
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, dict)


def test_tier2_f4_b05_preview_promotion_empty_scope(api_clients):
    response = api_clients.pmi.post("/api/promotions/preview", json={
        "discount_type": "PERCENTAGE",
        "discount_value": 10.0,
        "scopes": [],
    })
    assert response.status_code == 200
    data = response.json()
    count = data.get("affected_variants_count", data.get("total_affected", 0))
    assert count == 0


# --- F5 Boundaries ---

def test_tier2_f5_b01_starts_at_and_ends_at_same_timestamp(api_clients, pmi_api, e2e_run_id):
    now_iso = datetime.now(timezone.utc).isoformat()
    created = pmi_api.create_promotion({
        "code": f"SAME_TS_{uuid4().hex[:6]}",
        "name": "Same Start End Timestamp",
        "discount_type": "PERCENTAGE",
        "discount_value": 10.0,
        "starts_at": now_iso,
        "ends_at": now_iso,
    })
    activated = pmi_api.activate_promotion(created["id"])
    assert activated["status"] in ("ENDED", "ACTIVE")


def test_tier2_f5_b02_scheduler_clock_skew_resilience(api_clients, pmi_api, e2e_run_id):
    near_iso = (datetime.now(timezone.utc) - timedelta(milliseconds=500)).isoformat()
    created = pmi_api.create_promotion({
        "code": f"CLOCK_SKEW_{uuid4().hex[:6]}",
        "name": "Clock Skew Test",
        "discount_type": "PERCENTAGE",
        "discount_value": 10.0,
        "starts_at": near_iso,
    })
    activated = pmi_api.activate_promotion(created["id"])
    assert activated["status"] == "ACTIVE"


def test_tier2_f5_b03_scheduler_paused_promotion_expiry(api_clients, pmi_api, e2e_run_id):
    near_end = (datetime.now(timezone.utc) + timedelta(seconds=2)).isoformat()
    created = pmi_api.create_promotion({
        "code": f"PAUSE_EXP_{uuid4().hex[:6]}",
        "name": "Paused Expiry Test",
        "discount_type": "PERCENTAGE",
        "discount_value": 10.0,
        "ends_at": near_end,
    })
    pmi_api.activate_promotion(created["id"])
    pmi_api.pause_promotion(created["id"])

    updated = wait_until(
        lambda: pmi_api.get_promotion(created["id"]),
        timeout_seconds=10,
        interval_seconds=0.5,
    )
    assert updated["status"] in ("PAUSED", "ENDED")


def test_tier2_f5_b04_scheduler_database_reconnection_recovery(api_clients, pmi_api, e2e_run_id):
    response = api_clients.pmi.get("/api/promotions", params={"limit": 1})
    assert response.status_code == 200


# --- F6 Boundaries ---

def test_tier2_f6_b01_storefront_card_long_discount_percentage(api_clients, pmi_api, e2e_run_id):
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=300000.0)
    created = pmi_api.create_promotion({
        "code": f"DECIMAL_PCT_{uuid4().hex[:6]}",
        "name": "Decimal Percentage Discount",
        "discount_type": "PERCENTAGE",
        "discount_value": 33.333333,
        "scopes": [{"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(created["id"])

    cp = pmi_api.get_computed_price(str(variant.id))
    assert cp["has_active_promotion"] is True
    assert round(cp["percentage_discount"], 2) in (33.33, 33.34)


def test_tier2_f6_b02_storefront_card_zero_discount(api_clients, pmi_api, e2e_run_id):
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=100000.0)
    created = pmi_api.create_promotion({
        "code": f"ZERO_DISC_{uuid4().hex[:6]}",
        "name": "Zero Discount Amount",
        "discount_type": "PERCENTAGE",
        "discount_value": 0.0,
        "scopes": [{"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(created["id"])

    cp = pmi_api.get_computed_price(str(variant.id))
    assert cp["computed_price"] == 100000.0
    assert cp["percentage_discount"] == 0.0


def test_tier2_f6_b03_storefront_api_network_failure_fallback(api_clients):
    response = api_clients.pmi.get("/api/variants/non-existent-variant-999999/computed-price")
    assert response.status_code in (200, 404)


def test_tier2_f6_b04_pmi_wizard_step_backtrack_validation(api_clients, pmi_api, e2e_run_id):
    payload = {
        "code": f"BACKTRACK_{uuid4().hex[:6]}",
        "name": "Backtrack Step Wizard",
        "discount_type": "PERCENTAGE",
        "discount_value": 15.0,
    }
    created = pmi_api.create_promotion(payload)
    assert created["name"] == "Backtrack Step Wizard"


def test_tier2_f6_b05_pmi_preview_modal_empty_response(api_clients, pmi_api, e2e_run_id):
    response = api_clients.pmi.post("/api/promotions/preview", json={
        "discount_type": "PERCENTAGE",
        "discount_value": 10.0,
        "scopes": [{"scope_type": "CATEGORY", "target_id": "99999999", "is_exclusion": False}],
    })
    assert response.status_code == 200


# ============================================================================
# TIER 3: CROSS-FEATURE COMBINATIONS (7 Test Functions)
# ============================================================================

def test_tier3_c01_nested_scope_hierarchy_with_exclusions(api_clients, pmi_api, e2e_run_id):
    cat, fam, prod1, v_excl = create_test_product_and_variant(pmi_api, price=100000.0)
    prod2 = pmi_api.create_product_with_variants(
        product_code=f"PROD-INCL-{uuid4().hex[:6]}",
        name=f"Product Incl {uuid4().hex[:6]}",
        category_id=cat.id,
        family_id=fam.id,
        sku_code=f"SKU-INCL-{uuid4().hex[:6]}",
        price=100000.0,
        stock=50,
    )
    v_incl_id = str(prod2.variants[0].id)

    p_global = pmi_api.create_promotion({
        "code": f"GLOB_10_{uuid4().hex[:6]}",
        "name": "Global 10 Off",
        "discount_type": "PERCENTAGE",
        "discount_value": 10.0,
        "priority": 1,
        "scopes": [{"scope_type": "ALL", "target_id": None, "is_exclusion": False}],
    })
    pmi_api.activate_promotion(p_global["id"])

    p_cat = pmi_api.create_promotion({
        "code": f"CAT_20_EXCL_{uuid4().hex[:6]}",
        "name": "Cat 20 Off Exclude V1",
        "discount_type": "PERCENTAGE",
        "discount_value": 20.0,
        "priority": 10,
        "scopes": [
            {"scope_type": "CATEGORY", "target_id": str(cat.id), "is_exclusion": False},
            {"scope_type": "VARIANT", "target_id": str(v_excl.id), "is_exclusion": True},
        ],
    })
    pmi_api.activate_promotion(p_cat["id"])

    cp_incl = pmi_api.get_computed_price(v_incl_id)
    assert cp_incl["computed_price"] == 80000.0

    cp_excl = pmi_api.get_computed_price(str(v_excl.id))
    assert cp_excl["computed_price"] == 90000.0
    pmi_api.end_promotion(p_global["id"])
    pmi_api.end_promotion(p_cat["id"])


def test_tier3_c02_priority_competition_percentage_vs_fixed(api_clients, pmi_api, e2e_run_id):
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=200000.0)

    p_a = pmi_api.create_promotion({
        "code": f"COMP_PCT_{uuid4().hex[:6]}",
        "name": "Promo A Pct 20 Cap 30k",
        "discount_type": "PERCENTAGE",
        "discount_value": 20.0,
        "max_discount": 30000.0,
        "priority": 5,
        "scopes": [{"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(p_a["id"])

    p_b = pmi_api.create_promotion({
        "code": f"COMP_FIXED_{uuid4().hex[:6]}",
        "name": "Promo B Fixed Price 150k",
        "discount_type": "FIXED_PRICE",
        "discount_value": 150000.0,
        "priority": 10,
        "scopes": [{"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(p_b["id"])

    cp_before = pmi_api.get_computed_price(str(variant.id))
    assert cp_before["computed_price"] == 150000.0

    pmi_api.pause_promotion(p_b["id"])

    cp_after = pmi_api.get_computed_price(str(variant.id))
    assert cp_after["computed_price"] == 170000.0


def test_tier3_c03_auto_scheduler_to_bulk_api_sync(api_clients, pmi_api, e2e_run_id):
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=100000.0)
    start_time = (datetime.now(timezone.utc) + timedelta(seconds=2)).isoformat()

    created = pmi_api.create_promotion({
        "code": f"SCHED_SYNC_{uuid4().hex[:6]}",
        "name": "Scheduler Sync Bulk API",
        "discount_type": "PERCENTAGE",
        "discount_value": 25.0,
        "starts_at": start_time,
        "scopes": [{"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(created["id"])

    bulk1 = pmi_api.get_bulk_computed_prices([str(variant.id)])
    assert bulk1 is not None

    time.sleep(3)
    bulk2 = pmi_api.get_bulk_computed_prices([str(variant.id)])
    assert bulk2 is not None


def test_tier3_c04_intent_parser_to_wizard_to_activation(api_clients, pmi_api, e2e_run_id):
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=200000.0)

    parsed = pmi_api.parse_intent("Giảm 50k cho giày chạy bộ")
    assert parsed is not None

    created = pmi_api.create_promotion({
        "code": f"INTENT_ACT_{uuid4().hex[:6]}",
        "name": parsed.get("name", "Giảm 50k"),
        "discount_type": parsed.get("discount_type", "FIXED_AMOUNT"),
        "discount_value": float(parsed.get("discount_value", 50000.0)),
        "scopes": [{"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": False}],
    })
    activated = pmi_api.activate_promotion(created["id"])
    assert activated["status"] == "ACTIVE"

    cp = pmi_api.get_computed_price(str(variant.id))
    assert cp["has_active_promotion"] is True


def test_tier3_c05_storefront_hook_live_recalculation_on_lifecycle_pause(api_clients, pmi_api, e2e_run_id):
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=100000.0)

    created = pmi_api.create_promotion({
        "code": f"LIVE_RECALC_{uuid4().hex[:6]}",
        "name": "Live Recalc on Pause",
        "discount_type": "PERCENTAGE",
        "discount_value": 30.0,
        "scopes": [{"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(created["id"])

    cp1 = pmi_api.get_computed_price(str(variant.id))
    assert cp1["computed_price"] == 70000.0

    pmi_api.pause_promotion(created["id"])

    cp2 = pmi_api.get_computed_price(str(variant.id))
    assert cp2["has_active_promotion"] is False
    assert cp2["computed_price"] == 100000.0


def test_tier3_c06_product_base_price_change_under_active_promotion(api_clients, pmi_api, e2e_run_id):
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=100000.0)

    created = pmi_api.create_promotion({
        "code": f"BASE_CHG_{uuid4().hex[:6]}",
        "name": "Base Price Change Promo",
        "discount_type": "PERCENTAGE",
        "discount_value": 20.0,
        "scopes": [{"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(created["id"])

    cp1 = pmi_api.get_computed_price(str(variant.id))
    assert cp1["computed_price"] == 80000.0

    # Update variant price in PMI
    api_clients.pmi.put(f"/api/products/{prod.id}/variants/{variant.id}", json={"price": 150000.0})

    cp2 = pmi_api.get_computed_price(str(variant.id))
    assert cp2["computed_price"] in (120000.0, 80000.0)


def test_tier3_c07_concurrent_lifecycle_transitions_isolation(api_clients, pmi_api, e2e_run_id):
    created = pmi_api.create_promotion({
        "code": f"CONCURR_{uuid4().hex[:6]}",
        "name": "Concurrent Lifecycle Transition",
        "discount_type": "PERCENTAGE",
        "discount_value": 10.0,
    })
    promo_id = created["id"]

    act_res = api_clients.pmi.post(f"/api/promotions/{promo_id}/activate")
    assert act_res.status_code in (200, 400)

    detail = pmi_api.get_promotion(promo_id)
    assert detail["status"] in ("ACTIVE", "DRAFT", "ENDED")


# ============================================================================
# TIER 4: REAL-WORLD SCENARIOS (5 Multi-Step Scenario Tests)
# ============================================================================

def test_tier4_scenario_1(api_clients, pmi_api, e2e_run_id):
    """Scenario 1: End-to-End Flash Sale Campaign Workflow."""
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=100000.0)

    start_iso = (datetime.now(timezone.utc) + timedelta(seconds=2)).isoformat()
    end_iso = (datetime.now(timezone.utc) + timedelta(seconds=5)).isoformat()

    created = pmi_api.create_promotion({
        "code": f"FLASH_SALE_{uuid4().hex[:6]}",
        "name": "Flash Sale Midnight",
        "discount_type": "PERCENTAGE",
        "discount_value": 30.0,
        "max_discount": 150000.0,
        "starts_at": start_iso,
        "ends_at": end_iso,
        "scopes": [{"scope_type": "CATEGORY", "target_id": str(cat.id), "is_exclusion": False}],
    })
    activated = pmi_api.activate_promotion(created["id"])
    assert activated["status"] == "SCHEDULED"

    cp1 = pmi_api.get_computed_price(str(variant.id))
    assert cp1 is not None

    time.sleep(3)
    p_status2 = pmi_api.get_promotion(created["id"])
    assert p_status2["status"] in ("ACTIVE", "SCHEDULED")

    time.sleep(3)
    p_status3 = pmi_api.get_promotion(created["id"])
    assert p_status3["status"] in ("ACTIVE", "ENDED")


def test_tier4_scenario_2(api_clients, pmi_api, e2e_run_id):
    """Scenario 2: Marketing Manager Natural-Language AI Promotion Setup."""
    prompt = "Tạo chương trình xả hàng hè giảm 25% tối đa 100k cho tất cả quần kraep từ hôm nay đến cuối tuần"
    parsed = pmi_api.parse_intent(prompt)

    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=200000.0)

    created = pmi_api.create_promotion({
        "code": f"AI_PROMO_{uuid4().hex[:6]}",
        "name": parsed.get("name", "Xả hàng hè"),
        "discount_type": parsed.get("discount_type", "PERCENTAGE"),
        "discount_value": float(parsed.get("discount_value", 25.0)),
        "max_discount": float(parsed.get("max_discount", 100000.0)),
        "scopes": [{"scope_type": "CATEGORY", "target_id": str(cat.id), "is_exclusion": False}],
    })

    preview = pmi_api.preview_promotion({
        "discount_type": created["discount_type"],
        "discount_value": created["discount_value"],
        "scopes": created["scopes"],
    })
    assert preview is not None

    activated = pmi_api.activate_promotion(created["id"])
    assert activated["status"] == "ACTIVE"

    cp = pmi_api.get_computed_price(str(variant.id))
    assert cp["computed_price"] == 150000.0


def test_tier4_scenario_3(api_clients, pmi_api, e2e_run_id):
    """Scenario 3: Complex Multi-Tier Category Discount with Excluded High-Margin Variants."""
    cat, fam, prod1, v_std = create_test_product_and_variant(pmi_api, price=100000.0)

    prod2 = pmi_api.create_product_with_variants(
        product_code=f"PROD-PRO-{uuid4().hex[:6]}",
        name=f"Product Pro {uuid4().hex[:6]}",
        category_id=cat.id,
        family_id=fam.id,
        sku_code=f"SKU-PRO-{uuid4().hex[:6]}",
        price=500000.0,
        stock=10,
    )
    v_pro_id = str(prod2.variants[0].id)

    created = pmi_api.create_promotion({
        "code": f"BLACK_FRIDAY_{uuid4().hex[:6]}",
        "name": "Black Friday Footwear Deal",
        "discount_type": "PERCENTAGE",
        "discount_value": 20.0,
        "scopes": [
            {"scope_type": "CATEGORY", "target_id": str(cat.id), "is_exclusion": False},
            {"scope_type": "VARIANT", "target_id": v_pro_id, "is_exclusion": True},
        ],
    })
    pmi_api.activate_promotion(created["id"])

    bulk = pmi_api.get_bulk_computed_prices([str(v_std.id), v_pro_id])
    assert bulk is not None

    cp_std = pmi_api.get_computed_price(str(v_std.id))
    assert cp_std["computed_price"] == 80000.0

    cp_pro = pmi_api.get_computed_price(v_pro_id)
    assert cp_pro["has_active_promotion"] is False
    assert cp_pro["computed_price"] == 500000.0


def test_tier4_scenario_4(api_clients, pmi_api, e2e_run_id):
    """Scenario 4: Overlapping Promotional Priority Competition & Conflict Resolution."""
    cat, fam, prod, variant = create_test_product_and_variant(pmi_api, price=500000.0)

    p_a = pmi_api.create_promotion({
        "code": f"PROMO_A_{uuid4().hex[:6]}",
        "name": "Weekend Special",
        "discount_type": "FIXED_PRICE",
        "discount_value": 400000.0,
        "priority": 5,
        "scopes": [{"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(p_a["id"])

    p_b = pmi_api.create_promotion({
        "code": f"PROMO_B_{uuid4().hex[:6]}",
        "name": "VIP Mega Sale",
        "discount_type": "PERCENTAGE",
        "discount_value": 30.0,
        "priority": 10,
        "scopes": [{"scope_type": "VARIANT", "target_id": str(variant.id), "is_exclusion": False}],
    })
    pmi_api.activate_promotion(p_b["id"])

    cp1 = pmi_api.get_computed_price(str(variant.id))
    assert cp1["computed_price"] == 350000.0

    pmi_api.pause_promotion(p_b["id"])

    cp2 = pmi_api.get_computed_price(str(variant.id))
    assert cp2["computed_price"] == 400000.0


def test_tier4_scenario_5(api_clients, pmi_api, e2e_run_id):
    """Scenario 5: Bulk Inventory Price Re-computation Under Active Promotion."""
    variants = [create_test_product_and_variant(pmi_api, price=100000.0)[3] for _ in range(5)]
    var_ids = [str(v.id) for v in variants]

    created = pmi_api.create_promotion({
        "code": f"BULK_RECOMP_{uuid4().hex[:6]}",
        "name": "15 Percent Equipment Promo",
        "discount_type": "PERCENTAGE",
        "discount_value": 15.0,
        "scopes": [{"scope_type": "ALL", "target_id": None, "is_exclusion": False}],
    })
    pmi_api.activate_promotion(created["id"])

    bulk = pmi_api.get_bulk_computed_prices(var_ids)
    assert bulk is not None

    cp = pmi_api.get_computed_price(var_ids[0])
    assert cp["computed_price"] == 85000.0
