import pytest
import uuid
import datetime
from sqlalchemy import text
from models import AuditOutbox, AuditLog, ActorType, OutboxStatus
from utils.masking import mask_sensitive_data

def test_mask_sensitive_data():
    # Test flat dictionary masking
    payload = {
        "id": 1,
        "password": "my_password",
        "ACCESS_TOKEN": "my_token",
        "username": "john_doe"
    }
    masked = mask_sensitive_data(payload)
    assert masked is not payload
    assert masked["password"] == "***MASKED***"
    assert masked["ACCESS_TOKEN"] == "***MASKED***"
    assert masked["id"] == 1
    assert masked["username"] == "john_doe"

    # Test nested dictionary and list masking
    payload_nested = {
        "channel": "Shopee",
        "config": {
            "app_key": "shopee123",
            "app_secret": "shopee_secret",
            "tokens": [
                {"access_token": "token123", "refresh_token": "token456"},
                {"access_token": "token789", "refresh_token": "token012"}
            ]
        }
    }
    masked_nested = mask_sensitive_data(payload_nested)
    assert masked_nested["config"]["app_secret"] == "***MASKED***"
    assert masked_nested["config"]["tokens"][0]["access_token"] == "***MASKED***"
    assert masked_nested["config"]["tokens"][0]["refresh_token"] == "***MASKED***"
    assert masked_nested["config"]["tokens"][1]["access_token"] == "***MASKED***"
    assert masked_nested["config"]["tokens"][1]["refresh_token"] == "***MASKED***"
    assert masked_nested["config"]["app_key"] == "shopee123"

def test_db_schema_tables_exist(db_session):
    """Verify that migrations created the audit_outbox and audit_logs tables."""
    result = db_session.execute(text(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public'"
    )).fetchall()
    table_names = [row[0] for row in result]
    assert "audit_outbox" in table_names
    assert "audit_logs" in table_names

def test_audit_outbox_db_insertion(db_session):
    """Test inserting and retrieving AuditOutbox model."""
    corr_id = uuid.uuid4()
    entry = AuditOutbox(
        correlation_id=corr_id,
        actor_id="123",
        actor_username="test_actor",
        actor_type=ActorType.USER,
        ip_address="127.0.0.1",
        method="POST",
        path="/api/products",
        module="Product",
        action_type="CREATE",
        entity_type="Product",
        entity_id="456",
        changes={"name": ["Old Name", "New Name"]},
        raw_details="Created new product",
        status=OutboxStatus.PENDING
    )
    db_session.add(entry)
    db_session.commit()

    retrieved = db_session.query(AuditOutbox).filter_by(correlation_id=corr_id).first()
    assert retrieved is not None
    assert retrieved.actor_username == "test_actor"
    assert retrieved.actor_type == ActorType.USER
    assert retrieved.changes == {"name": ["Old Name", "New Name"]}
    assert retrieved.status == OutboxStatus.PENDING

def test_audit_log_db_insertion(db_session):
    """Test inserting and retrieving AuditLog model."""
    corr_id = uuid.uuid4()
    entry = AuditLog(
        correlation_id=corr_id,
        actor_id="999",
        actor_username="worker_service",
        actor_type=ActorType.SERVICE,
        ip_address="127.0.0.1",
        method="PUT",
        path="/api/products/456",
        module="Product",
        action_type="UPDATE",
        entity_type="Product",
        entity_id="456",
        changes={"price": [100, 150]},
        raw_details="Updated product price",
        processed_at=datetime.datetime.now(datetime.timezone.utc)
    )
    db_session.add(entry)
    db_session.commit()

    retrieved = db_session.query(AuditLog).filter_by(correlation_id=corr_id).first()
    assert retrieved is not None
    assert retrieved.actor_username == "worker_service"
    assert retrieved.actor_type == ActorType.SERVICE
    assert retrieved.changes == {"price": [100, 150]}

def test_mask_tuples_nested_dict():
    # Test masking of tuples containing nested dicts
    payload = {
        "data": (1, {"password": "secret_password", "nested": {"refresh_token": "token123"}})
    }
    masked = mask_sensitive_data(payload)
    assert masked["data"][1]["password"] == "***MASKED***"
    assert masked["data"][1]["nested"]["refresh_token"] == "***MASKED***"
    assert isinstance(masked["data"], tuple)

def test_mask_circular_structure():
    # Test masking of a circular dictionary structure (verify cycle is detected and returns "***CYCLE DETECTED***" without crashing)
    payload = {"name": "test"}
    payload["self"] = payload
    masked = mask_sensitive_data(payload)
    assert masked["name"] == "test"
    assert masked["self"] == "***CYCLE DETECTED***"

def test_audit_raw_sql_insert_omitting_created_at(db_session):
    # Test raw SQL insert omitting created_at and verify the column is populated via the database server default
    corr_id = uuid.uuid4()
    db_session.execute(text(
        """
        INSERT INTO audit_outbox (id, correlation_id, actor_username, actor_type, source_service, module, action_type, status, attempt_count)
        VALUES (:id, :corr_id, 'sql_actor', 'USER', 'PMI', 'Product', 'CREATE', 'PENDING', 0)
        """
    ), {
        "id": uuid.uuid4(),
        "corr_id": corr_id
    })
    db_session.commit()

    retrieved = db_session.query(AuditOutbox).filter_by(correlation_id=corr_id).first()
    assert retrieved is not None
    assert retrieved.created_at is not None
    assert retrieved.created_at.tzinfo is not None

def test_audit_retrieved_datetimes_are_timezone_aware(db_session):
    # Test that retrieved datetimes from the models have tzinfo (timezone-aware)
    corr_id = uuid.uuid4()
    entry = AuditOutbox(
        correlation_id=corr_id,
        actor_id="123",
        actor_username="test_actor_tz",
        actor_type=ActorType.USER,
        ip_address="127.0.0.1",
        method="POST",
        path="/api/products",
        module="Product",
        action_type="CREATE",
        entity_type="Product",
        entity_id="456",
        changes={"name": ["Old Name", "New Name"]},
        raw_details="Created new product",
        status=OutboxStatus.PENDING
    )
    db_session.add(entry)
    db_session.commit()

    db_session.expire_all()

    retrieved = db_session.query(AuditOutbox).filter_by(correlation_id=corr_id).first()
    assert retrieved is not None
    assert retrieved.created_at is not None
    assert retrieved.created_at.tzinfo is not None
    assert retrieved.created_at.tzinfo.utcoffset(retrieved.created_at) is not None


def test_audit_guest_db_insertion(db_session):
    """Test database insertion of an audit record with actor_type=ActorType.GUEST."""
    corr_id = uuid.uuid4()
    entry = AuditOutbox(
        correlation_id=corr_id,
        actor_id="guest_123",
        actor_username="guest_actor",
        actor_type=ActorType.GUEST,
        ip_address="127.0.0.1",
        method="GET",
        path="/api/products",
        module="Product",
        action_type="READ",
        entity_type="Product",
        entity_id="789",
        changes={},
        raw_details="Guest viewed product details",
        status=OutboxStatus.PENDING
    )
    db_session.add(entry)
    db_session.commit()

    retrieved = db_session.query(AuditOutbox).filter_by(correlation_id=corr_id).first()
    assert retrieved is not None
    assert retrieved.actor_username == "guest_actor"
    assert retrieved.actor_type == ActorType.GUEST


def test_product_update_records_audit_outbox(client, db_session):
    import models
    from models import AuditOutbox
    
    cat = db_session.query(models.Category).first()
    fam = db_session.query(models.AttributeFamily).first()
    attr = db_session.query(models.Attribute).first()
    
    payload = {
        "product_code": "PROD-AUDIT-TEST",
        "name": "Audit Test Product",
        "description": "Original description",
        "category_id": cat.id if cat else None,
        "family_id": fam.id if fam else None,
        "weight": 100.0,
        "length": 10.0,
        "width": 10.0,
        "height": 10.0,
        "is_pre_order": False,
        "dts_days": 7,
        "status": "Draft",
        "tier_variations": [],
        "variants": [
            {
                "tier_1_option": None,
                "tier_2_option": None,
                "sku_code": "PROD-AUDIT-TEST-VAR",
                "price": 50000.0,
                "barcode": "12345",
                "stock": 10
            }
        ],
        "media": [],
        "attributes": []
    }
    
    create_resp = client.post("/products", json=payload)
    assert create_resp.status_code == 201
    created_product = create_resp.json()
    product_id = created_product["id"]
    
    db_session.commit()
    
    create_log = db_session.query(AuditOutbox).filter_by(entity_id=str(product_id), action_type="CREATE").first()
    assert create_log is not None
    assert create_log.module == "Product"
    
    update_payload = payload.copy()
    update_payload["name"] = "Audit Test Product Updated"
    update_payload["weight"] = 120.0
    update_payload["variants"][0]["price"] = 60000.0
    
    update_resp = client.put(f"/products/{product_id}", json=update_payload)
    assert update_resp.status_code == 200
    
    db_session.commit()
    
    update_log = db_session.query(AuditOutbox).filter_by(entity_id=str(product_id), action_type="UPDATE").first()
    assert update_log is not None
    
    changes = update_log.changes
    assert changes is not None
    assert "before" in changes
    assert "after" in changes
    assert changes["before"]["name"] == "Audit Test Product"
    assert changes["after"]["name"] == "Audit Test Product Updated"
    assert changes["before"]["weight"] == 100.0
    assert changes["after"]["weight"] == 120.0
    
    assert "variants_modified" in changes["before"]
    assert "variants_modified" in changes["after"]
    assert "PROD-AUDIT-TEST-VAR" in changes["before"]["variants_modified"]
    assert float(changes["before"]["variants_modified"]["PROD-AUDIT-TEST-VAR"]["price"]) == 50000.0
    assert float(changes["after"]["variants_modified"]["PROD-AUDIT-TEST-VAR"]["price"]) == 60000.0


def test_read_only_action_records_and_commits_logs(client, db_session):
    from models import AuditOutbox
    
    response = client.get("/api/export/shopee?status=Published")
    assert response.status_code in (200, 404)
    
    export_log = db_session.query(AuditOutbox).filter_by(module="Channel", action_type="EXPORT").first()
    assert export_log is not None
    assert export_log.method == "GET"
    assert "/api/export/shopee" in export_log.path


def test_failed_writable_action_rolls_back_and_does_not_commit(client, db_session):
    from models import AuditOutbox
    
    initial_count = db_session.query(AuditOutbox).count()
    
    payload = {
        "product_code": "",
        "name": "",
        "weight": -10.0,
    }
    response = client.post("/products", json=payload)
    assert response.status_code == 422
    
    db_session.commit()
    final_count = db_session.query(AuditOutbox).count()
    assert final_count == initial_count


def test_production_session_lifecycle(client, db_session):
    # Prepare payload for a new category with a unique code
    payload = {
        "name": "Lifecycle Category",
        "code": "LIFECYCLE-CODE",
        "parent_id": None
    }
    
    # Call the write API (POST /categories)
    response = client.post("/categories", json=payload)
    assert response.status_code == 201
    category_id = response.json()["id"]
    
    # Get bind and immediately close the session to simulate FastAPI request teardown
    bind = db_session.get_bind()
    db_session.close()
    
    # Query the database using a fresh session to assert that the AuditOutbox record was successfully committed
    from sqlalchemy.orm import Session
    from models import AuditOutbox
    
    fresh_session = Session(bind=bind)
    try:
        audit_record = fresh_session.query(AuditOutbox).filter_by(
            entity_id=str(category_id),
            action_type="CREATE",
            module="Category"
        ).first()
        
        assert audit_record is not None
        assert audit_record.changes is not None or audit_record.entity_type == "Category"
    finally:
        fresh_session.close()


def test_get_audit_logs_endpoints(client_no_auth_override, db_session):
    import models
    from utils.auth import create_access_token
    from models import AuditLog, ActorType
    import uuid

    # Clear existing logs to avoid noise
    db_session.query(AuditLog).delete()
    db_session.commit()

    admin_token = create_access_token({"sub": "admin_user_test", "role": "admin"})
    staff_token = create_access_token({"sub": "staff_user_test", "role": "staff"})

    # 1. Non-admin access should be forbidden and log security intrusion
    headers_staff = {"Authorization": f"Bearer {staff_token}"}
    resp = client_no_auth_override.get("/api/audit-logs", headers=headers_staff)
    assert resp.status_code == 403

    # Check security intrusion log was written to audit_outbox
    db_session.commit()
    intrusion_log = db_session.query(models.AuditOutbox).filter_by(
        actor_username="staff_user_test",
        action_type="SECURITY"
    ).first()
    assert intrusion_log is not None
    assert intrusion_log.module == "Security"
    assert intrusion_log.entity_id == "/settings/audit"

    # 2. Admin access should succeed
    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    resp = client_no_auth_override.get("/api/audit-logs", headers=headers_admin)
    assert resp.status_code == 200
    data = resp.json()
    assert "data" in data
    assert data["total"] == 0

    # Add some dummy audit logs
    corr_id_1 = uuid.uuid4()
    corr_id_2 = uuid.uuid4()
    log1 = AuditLog(
        correlation_id=corr_id_1,
        actor_username="admin_user_test",
        actor_type=ActorType.USER,
        module="Product",
        action_type="CREATE",
        entity_type="Product",
        entity_id="101",
        changes={"name": [None, "Adidas Shoes"]},
        raw_details="Created product Adidas Shoes"
    )
    log2 = AuditLog(
        correlation_id=corr_id_2,
        actor_username="stock_sync_service",
        actor_type=ActorType.SERVICE,
        module="Category",
        action_type="UPDATE",
        entity_type="Category",
        entity_id="202",
        changes={"name": ["Old Cat", "New Cat"]},
        raw_details="Updated category name"
    )
    db_session.add(log1)
    db_session.add(log2)
    db_session.commit()

    # Test filtering by module
    resp = client_no_auth_override.get("/api/audit-logs?module=Product", headers=headers_admin)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert resp.json()["data"][0]["entity_id"] == "101"

    # Test filtering by actor
    resp = client_no_auth_override.get("/api/audit-logs?actor=stock_sync_service", headers=headers_admin)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert resp.json()["data"][0]["actor"] == "stock_sync_service"

    # Test filtering by correlation_id
    resp = client_no_auth_override.get(f"/api/audit-logs?correlation_id={corr_id_1}", headers=headers_admin)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1

    # Test keyword filtering
    resp = client_no_auth_override.get("/api/audit-logs?keyword=adidas", headers=headers_admin)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1

    # Test limit maxes at 100
    resp = client_no_auth_override.get("/api/audit-logs?limit=200", headers=headers_admin)
    assert resp.status_code == 200
    assert resp.json()["limit"] == 100


def test_sync_stock_endpoint(client, db_session):
    import models
    from utils.auth import INTERNAL_SERVICE_TOKEN
    from models import AuditOutbox

    # Create dummy product and variant
    product = models.Product(
        product_code="SYNC-TEST-PROD",
        name="Sync Test Product",
        weight=200.0,
        status="Published"
    )
    db_session.add(product)
    db_session.commit()

    variant = models.ProductVariant(
        product_id=product.id,
        sku_code="SYNC-TEST-VAR",
        price=120000.0,
        stock=15
    )
    db_session.add(variant)
    db_session.commit()

    # 1. Invalid API Key should return 401
    resp = client.post(
        "/api/service/sync-stock",
        json={"product_id": product.id, "stock": 50},
        headers={"X-API-Key": "invalid-key"}
    )
    assert resp.status_code == 401

    # 2. Valid API Key should succeed and update stock + log changes
    resp = client.post(
        "/api/service/sync-stock",
        json={"product_id": product.id, "stock": 50},
        headers={"X-API-Key": INTERNAL_SERVICE_TOKEN, "X-Correlation-ID": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"}
    )
    assert resp.status_code == 200
    assert resp.json()["message"] == "Stock synchronized successfully"

    # Refresh DB session and verify variant stock update
    db_session.commit()
    db_session.refresh(variant)
    assert variant.stock == 50

    # Verify audit outbox record exists
    outbox_log = db_session.query(AuditOutbox).filter_by(
        actor_username="stock_sync_service",
        action_type="UPDATE"
    ).first()
    assert outbox_log is not None
    assert outbox_log.correlation_id == uuid.UUID("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")
    assert outbox_log.changes == {"stock": [15, 50]}


def test_log_security_intrusion_endpoint(client_no_auth_override, db_session):
    from models import AuditOutbox
    from utils.auth import create_access_token

    # 1. Staff gets 403 and intrusion is NOT logged
    token = create_access_token({"sub": "hacker123", "role": "staff", "staff_id": "456"})
    headers = {"Authorization": f"Bearer {token}"}

    resp = client_no_auth_override.post(
        "/api/audit-logs/security",
        headers=headers,
        json={"path": "/settings/audit"}
    )
    assert resp.status_code == 403

    db_session.commit()
    intrusion_log = db_session.query(AuditOutbox).filter_by(
        actor_username="hacker123",
        action_type="SECURITY"
    ).first()
    assert intrusion_log is None

    # 2. Admin gets 200 and intrusion IS logged
    admin_token = create_access_token({"sub": "admin123", "role": "admin", "staff_id": "123"})
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    resp_admin = client_no_auth_override.post(
        "/api/audit-logs/security",
        headers=admin_headers,
        json={"path": "/settings/audit"}
    )
    assert resp_admin.status_code == 200

    db_session.commit()
    admin_intrusion_log = db_session.query(AuditOutbox).filter_by(
        actor_username="admin123",
        action_type="SECURITY"
    ).first()
    assert admin_intrusion_log is not None
    assert admin_intrusion_log.actor_type.name == "USER"
    assert admin_intrusion_log.module == "Security"
    assert admin_intrusion_log.entity_id == "/settings/audit"
    assert admin_intrusion_log.path == "/settings/audit"


def test_mask_deque():
    import collections
    from utils.masking import mask_sensitive_data
    payload = {"data": collections.deque([{"password": "secret"}])}
    res = mask_sensitive_data(payload)
    assert res["data"][0]["password"] == "***MASKED***"
    assert isinstance(res["data"], collections.deque)

def test_audit_logs_jwt_only_admin(client_no_auth_override, db_session):
    import models
    from utils.auth import create_access_token
    
    # Clear existing logs to avoid noise and test pollution in session-wide db tests
    db_session.query(models.AuditLog).delete()
    db_session.commit()
    
    # Admin user not present in DB, authenticated purely via JWT payload role="admin"
    token = create_access_token({"sub": "jwt_only_admin", "role": "admin"})
    headers = {"Authorization": f"Bearer {token}"}
    
    resp = client_no_auth_override.get("/api/audit-logs", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "data" in data
    assert data["total"] == 0

def test_audit_logs_jwt_only_non_admin(client_no_auth_override, db_session):
    import models
    from utils.auth import create_access_token
    
    # Clear existing intrusion logs to avoid noise
    db_session.query(models.AuditOutbox).filter_by(
        actor_username="jwt_only_staff",
        action_type="SECURITY"
    ).delete()
    db_session.commit()
    
    # Non-admin user not present in DB, authenticated purely via JWT payload role="staff"
    token = create_access_token({"sub": "jwt_only_staff", "role": "staff"})
    headers = {"Authorization": f"Bearer {token}"}
    
    resp = client_no_auth_override.get("/api/audit-logs", headers=headers)
    assert resp.status_code == 403
    
    # Check security intrusion log was written to audit_outbox
    db_session.commit()
    intrusion_log = db_session.query(models.AuditOutbox).filter_by(
        actor_username="jwt_only_staff",
        action_type="SECURITY"
    ).first()
    assert intrusion_log is not None





