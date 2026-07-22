import datetime
import concurrent.futures
import importlib
import random
import uuid
import pytest
from fastapi.testclient import TestClient
from models import Promotion, PromotionScope, PromotionComputedPrice, ProductVariant, Product, Category, DiscountType, PromotionStatus, ScopeType
from utils.context import actor_username_var, actor_type_var


@pytest.fixture
def multi_session_client(app_module):
    """
    Client fixture that uses real independent SessionLocal() instances for each request,
    enabling multi-threaded concurrency testing against Postgres without shared session conflicts.
    """
    db_module = importlib.import_module("database")

    def override_get_db():
        db = db_module.SessionLocal()
        try:
            yield db
        finally:
            db.close()

    def override_get_identity():
        actor_username_var.set("stress_test_admin")
        actor_type_var.set("USER")
        return {
            "actor_type": "USER",
            "actor_username": "stress_test_admin",
            "user": type("MockUser", (), {"role": "admin", "username": "stress_test_admin"})()
        }

    dep_module = importlib.import_module("utils.dependency")
    app_module.app.dependency_overrides[db_module.get_db] = override_get_db
    app_module.app.dependency_overrides[dep_module.get_current_identity] = override_get_identity

    client = TestClient(app_module.app)
    yield client

    app_module.app.dependency_overrides.clear()


def test_concurrent_promotion_mutations_single_promo(multi_session_client, app_module):
    """
    Test N concurrent threads performing rapid mutations (update, activate, pause, resume, end, get)
    on a single promotion record to verify zero ObjectDeletedError or DB deadlock failures.
    """
    db_module = importlib.import_module("database")

    # 1. Create base promotion and catalog items using isolated session
    db = db_module.SessionLocal()
    try:
        cat = Category(code=f"CAT_STRESS_{uuid.uuid4().hex[:6]}", name="Stress Category")
        db.add(cat)
        db.flush()
        cat_id = cat.id

        prod = Product(product_code=f"PROD_STRESS_{uuid.uuid4().hex[:6]}", name="Stress Product", category_id=cat_id, weight=10)
        db.add(prod)
        db.flush()
        prod_id = prod.id

        v1 = ProductVariant(product_id=prod_id, sku_code=f"SKU_STRESS_1_{uuid.uuid4().hex[:6]}", price=500000.0)
        v2 = ProductVariant(product_id=prod_id, sku_code=f"SKU_STRESS_2_{uuid.uuid4().hex[:6]}", price=1000000.0)
        db.add_all([v1, v2])
        db.flush()

        v1_id = str(v1.id)
        v2_id = str(v2.id)

        promo_code = f"PROMO_CONC_{uuid.uuid4().hex[:6].upper()}"
        promo_id = str(uuid.uuid4())
        promo = Promotion(
            id=promo_id,
            code=promo_code,
            name="Concurrent Target Promo",
            discount_type=DiscountType.PERCENTAGE,
            discount_value=10.0,
            priority=5,
            status=PromotionStatus.DRAFT,
            created_at=datetime.datetime.now(datetime.timezone.utc),
            scopes=[
                PromotionScope(id=str(uuid.uuid4()), scope_type=ScopeType.CATEGORY, target_id=str(cat_id), is_exclusion=False)
            ]
        )
        db.add(promo)
        db.commit()
    finally:
        db.close()

    errors = []
    status_codes = []

    def worker_action(worker_id):
        action_type = worker_id % 6
        try:
            if action_type == 0:
                # Update promotion
                res = multi_session_client.put(
                    f"/api/promotions/{promo_id}",
                    json={
                        "name": f"Updated by worker {worker_id}",
                        "priority": random.randint(1, 50),
                        "discount_value": float(random.randint(5, 30)),
                        "scopes": [
                            {"scope_type": "CATEGORY", "target_id": str(cat_id), "is_exclusion": False}
                        ]
                    }
                )
                status_codes.append(("update", res.status_code))
                if res.status_code == 200:
                    data = res.json()
                    # Verify schema validation and presence of scopes without ObjectDeletedError
                    assert data["id"] == promo_id
                    assert "scopes" in data
            elif action_type == 1:
                # Activate
                res = multi_session_client.post(f"/api/promotions/{promo_id}/activate")
                status_codes.append(("activate", res.status_code))
                if res.status_code == 200:
                    assert res.json()["status"] in ["ACTIVE", "SCHEDULED", "PAUSED", "ENDED", "DRAFT"]
            elif action_type == 2:
                # Pause
                res = multi_session_client.post(f"/api/promotions/{promo_id}/pause")
                status_codes.append(("pause", res.status_code))
            elif action_type == 3:
                # Resume
                res = multi_session_client.post(f"/api/promotions/{promo_id}/resume")
                status_codes.append(("resume", res.status_code))
            elif action_type == 4:
                # End
                res = multi_session_client.post(f"/api/promotions/{promo_id}/end")
                status_codes.append(("end", res.status_code))
            else:
                # Get Detail or computed price
                if worker_id % 2 == 0:
                    res = multi_session_client.get(f"/api/promotions/{promo_id}")
                    status_codes.append(("get_detail", res.status_code))
                    if res.status_code == 200:
                        assert "scopes" in res.json()
                else:
                    res = multi_session_client.get(f"/api/variants/{v1_id}/computed-price")
                    status_codes.append(("get_price", res.status_code))
                    if res.status_code == 200:
                        assert res.json()["computed_price"] >= 0.0

        except Exception as exc:
            errors.append(f"Worker {worker_id} exception: {type(exc).__name__}: {str(exc)}")

    try:
        num_workers = 30
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(worker_action, i) for i in range(num_workers)]
            concurrent.futures.wait(futures)

        # Assert zero unexpected errors
        assert len(errors) == 0, f"Encountered exceptions during concurrent execution: {errors}"
        
        # Assert zero 500 internal server errors (only 200 OK or 400 Bad Request for invalid lifecycle transitions)
        five_hundreds = [s for s in status_codes if s[1] >= 500]
        assert len(five_hundreds) == 0, f"Encountered HTTP 500 errors: {five_hundreds}"

        # Verify final state in DB
        db = db_module.SessionLocal()
        try:
            final_promo = db.query(Promotion).filter(Promotion.id == promo_id).first()
            assert final_promo is not None
            # Verify scopes relationship can be loaded without ObjectDeletedError
            scopes_count = len(final_promo.scopes)
            assert scopes_count >= 0
        finally:
            db.close()
    finally:
        # Tear-down cleanup so DB is left clean for other unit tests
        cleanup_db = db_module.SessionLocal()
        try:
            cleanup_db.query(PromotionComputedPrice).filter(PromotionComputedPrice.promotion_id == promo_id).delete()
            cleanup_db.query(PromotionScope).filter(PromotionScope.promotion_id == promo_id).delete()
            cleanup_db.query(Promotion).filter(Promotion.id == promo_id).delete()
            cleanup_db.query(ProductVariant).filter(ProductVariant.id.in_([int(v1_id), int(v2_id)])).delete()
            cleanup_db.query(Product).filter(Product.id == prod_id).delete()
            cleanup_db.query(Category).filter(Category.id == cat_id).delete()
            cleanup_db.commit()
        except Exception:
            cleanup_db.rollback()
        finally:
            cleanup_db.close()


def test_concurrent_multi_promotion_lifecycle_and_price_recomputation(multi_session_client, app_module):
    """
    Stress test with 40 concurrent workers manipulating multiple promotions and bulk computed prices simultaneously.
    Verifies price calculations, priority tie-breaking, scope updates, and zero ObjectDeletedError.
    """
    db_module = importlib.import_module("database")

    db = db_module.SessionLocal()
    try:
        cat1 = Category(code=f"C1_{uuid.uuid4().hex[:6]}", name="Cat 1")
        cat2 = Category(code=f"C2_{uuid.uuid4().hex[:6]}", name="Cat 2", parent_id=cat1.id)
        db.add_all([cat1, cat2])
        db.flush()

        cat1_id = cat1.id
        cat2_id = cat2.id

        prod1 = Product(product_code=f"P1_{uuid.uuid4().hex[:6]}", name="Prod 1", category_id=cat1_id, weight=10)
        prod2 = Product(product_code=f"P2_{uuid.uuid4().hex[:6]}", name="Prod 2", category_id=cat2_id, weight=20)
        db.add_all([prod1, prod2])
        db.flush()

        prod1_id = prod1.id
        prod2_id = prod2.id

        var_list = []
        for i in range(10):
            p_id = prod1_id if i < 5 else prod2_id
            v = ProductVariant(product_id=p_id, sku_code=f"SKU_MULTI_{i}_{uuid.uuid4().hex[:4]}", price=100000.0 * (i + 1))
            var_list.append(v)
        db.add_all(var_list)
        db.commit()

        variant_int_ids = [v.id for v in var_list]
        variant_ids = [str(v.id) for v in var_list]
    finally:
        db.close()

    created_promo_ids = []
    # Seed 5 promotions
    for i in range(5):
        payload = {
            "code": f"PROMO_SEED_{i}_{uuid.uuid4().hex[:6].upper()}",
            "name": f"Seed Promotion {i}",
            "discount_type": random.choice(["PERCENTAGE", "FIXED_AMOUNT", "FIXED_PRICE"]),
            "discount_value": 10.0 * (i + 1),
            "max_discount": 50000.0 * (i + 1),
            "priority": i * 5,
            "status": "DRAFT",
            "scopes": [
                {"scope_type": "ALL", "target_id": None, "is_exclusion": False}
            ]
        }
        res = multi_session_client.post("/api/promotions", json=payload)
        assert res.status_code == 201
        pid = res.json()["id"]
        created_promo_ids.append(pid)

    errors = []
    results = []

    def worker_task(worker_id):
        try:
            target_pid = random.choice(created_promo_ids)
            op = worker_id % 7

            if op == 0:
                # Activate promo
                res = multi_session_client.post(f"/api/promotions/{target_pid}/activate")
                results.append(("activate", res.status_code))
            elif op == 1:
                # Update promo priority and scope
                res = multi_session_client.put(
                    f"/api/promotions/{target_pid}",
                    json={
                        "priority": random.randint(10, 100),
                        "discount_value": 15.0,
                        "scopes": [
                            {"scope_type": "CATEGORY", "target_id": str(cat1_id), "is_exclusion": False}
                        ]
                    }
                )
                results.append(("update", res.status_code))
            elif op == 2:
                # Pause promo
                res = multi_session_client.post(f"/api/promotions/{target_pid}/pause")
                results.append(("pause", res.status_code))
            elif op == 3:
                # Resume promo
                res = multi_session_client.post(f"/api/promotions/{target_pid}/resume")
                results.append(("resume", res.status_code))
            elif op == 4:
                # Bulk prices query
                res = multi_session_client.post(
                    "/api/computed-prices/bulk",
                    json={"variant_ids": variant_ids[:5]}
                )
                results.append(("bulk_prices", res.status_code))
                if res.status_code == 200:
                    data = res.json()
                    for vid, item in data.items():
                        assert item["computed_price"] >= 0.0
                        assert item["original_price"] >= item["computed_price"] or item["has_active_promotion"] is False
            elif op == 5:
                # Preview endpoint
                res = multi_session_client.post(
                    "/api/promotions/preview",
                    json={
                        "code": f"PREV_W_{worker_id}",
                        "name": "Preview Worker",
                        "discount_type": "PERCENTAGE",
                        "discount_value": 20.0,
                        "scopes": [{"scope_type": "ALL", "target_id": None, "is_exclusion": False}]
                    }
                )
                results.append(("preview", res.status_code))
                if res.status_code == 200:
                    assert res.json()["affected_variants_count"] >= 0
            else:
                # Create a new promo dynamically
                res = multi_session_client.post(
                    "/api/promotions",
                    json={
                        "code": f"PROMO_DYN_{worker_id}_{uuid.uuid4().hex[:4].upper()}",
                        "name": f"Dynamic Promo {worker_id}",
                        "discount_type": "PERCENTAGE",
                        "discount_value": 5.0,
                        "status": "ACTIVE",
                        "scopes": [{"scope_type": "ALL", "target_id": None, "is_exclusion": False}]
                    }
                )
                results.append(("create", res.status_code))
                if res.status_code == 201:
                    new_id = res.json()["id"]
                    created_promo_ids.append(new_id)

        except Exception as exc:
            errors.append(f"Worker {worker_id} exception: {type(exc).__name__}: {str(exc)}")

    try:
        num_threads = 40
        with concurrent.futures.ThreadPoolExecutor(max_workers=12) as executor:
            futures = [executor.submit(worker_task, i) for i in range(num_threads)]
            concurrent.futures.wait(futures)

        # Assert no exceptions
        assert len(errors) == 0, f"Encountered worker errors: {errors}"

        # Assert no 500 errors
        fives = [r for r in results if r[1] >= 500]
        assert len(fives) == 0, f"Encountered HTTP 500 status codes: {fives}"

        # Final verification of computed price table and models
        db = db_module.SessionLocal()
        try:
            cps = db.query(PromotionComputedPrice).all()
            for cp in cps:
                assert cp.computed_price >= 0.0
                assert cp.discount_amount >= 0.0
                assert cp.original_price >= cp.computed_price
                assert round(cp.computed_price + cp.discount_amount, 2) == round(cp.original_price, 2)
        finally:
            db.close()

    finally:
        # Tear-down cleanup so DB is left clean for other unit tests
        cleanup_db = db_module.SessionLocal()
        try:
            if created_promo_ids:
                cleanup_db.query(PromotionComputedPrice).filter(PromotionComputedPrice.promotion_id.in_(created_promo_ids)).delete(synchronize_session=False)
                cleanup_db.query(PromotionScope).filter(PromotionScope.promotion_id.in_(created_promo_ids)).delete(synchronize_session=False)
                cleanup_db.query(Promotion).filter(Promotion.id.in_(created_promo_ids)).delete(synchronize_session=False)

            cleanup_db.query(PromotionComputedPrice).filter(PromotionComputedPrice.variant_id.in_(variant_ids)).delete(synchronize_session=False)
            cleanup_db.query(ProductVariant).filter(ProductVariant.id.in_(variant_int_ids)).delete(synchronize_session=False)
            cleanup_db.query(Product).filter(Product.id.in_([prod1_id, prod2_id])).delete(synchronize_session=False)
            cleanup_db.query(Category).filter(Category.id.in_([cat1_id, cat2_id])).delete(synchronize_session=False)
            cleanup_db.commit()
        except Exception:
            cleanup_db.rollback()
        finally:
            cleanup_db.close()
