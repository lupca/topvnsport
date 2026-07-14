import sys
import os
import pytest
import datetime
from datetime import timedelta
import uuid
import math
from fastapi import status, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

# Adjust path to import backend modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import models
import schemas
from utils.auth import JWT_SECRET_KEY, JWT_ALGORITHM, create_access_token, INTERNAL_SERVICE_TOKEN
from utils.context import actor_username_var, actor_type_var, correlation_id_var
from utils.audit import audit_action
from services.product_service import _parse_attribute_storage_value, _upsert_product_attribute_values, _save_product_channel_listings, update_product_aggregate
from services.audit_worker import process_outbox_batch

def test_coerced_uuid_string_edges():
    """Verify conversion boundaries for CoercedUUIDString type decorator."""
    from models import CoercedUUIDString
    decorator = CoercedUUIDString()
    
    # 1. Bind param edges
    assert decorator.process_bind_param(None, None) is None
    uid = uuid.uuid4()
    assert decorator.process_bind_param(uid, None) == str(uid)
    assert decorator.process_bind_param("invalid-uuid-string", None) == "invalid-uuid-string"
    assert decorator.process_bind_param(12345, None) == 12345

    # 2. Result value edges
    assert decorator.process_result_value(None, None) is None
    assert decorator.process_result_value(str(uid), None) == uid
    assert decorator.process_result_value("not-a-valid-uuid", None) == "not-a-valid-uuid"
    
    # Passing an int returns the raw value safely
    assert decorator.process_result_value(12345, None) == 12345


def test_product_variant_before_insert_generator(db_session: Session):
    """Verify before_insert event listener behaves correctly with empty/None/missing codes."""
    # 1. Product variant with no target product or product_id
    variant = models.ProductVariant(
        tier_1_option="Đỏ",
        tier_2_option="Size XL",
        price=100000.0,
        stock=5
    )
    from models import receive_before_insert
    receive_before_insert(None, db_session.connection(), variant)
    assert variant.sku_code == "UNKNOWN-DO-SIZE-XL"

    # 2. Product variant with option cleaning returning empty strings
    variant2 = models.ProductVariant(
        tier_1_option="!!!",
        tier_2_option="???",
        price=50000.0,
        stock=10
    )
    receive_before_insert(None, db_session.connection(), variant2)
    assert variant2.sku_code == "UNKNOWN-DEFAULT"


def test_sync_stock_non_existent_product_flaw(client, db_session: Session):
    """Verify that sync-stock raises 404 when product_id does not exist."""
    # Clean products database first to set up deterministic state
    db_session.query(models.ProductVariant).delete()
    db_session.query(models.Product).delete()
    db_session.commit()

    headers = {"X-API-Key": INTERNAL_SERVICE_TOKEN}

    # Case A: DB is empty. Querying a non-existent product should return 404.
    response = client.post("/api/service/sync-stock", json={"product_id": 9999, "stock": 42}, headers=headers)
    assert response.status_code == 404

    # Verify no mock product was created
    mock_prod = db_session.query(models.Product).first()
    assert mock_prod is None

    # Case B: A product exists in DB, but we query with a different non-existent product_id.
    # The API should return 404 instead of updating the existing product.
    existing_product = models.Product(
        product_code="EXISTING-123",
        name="Existing Product",
        weight=10.0,
        status="Published"
    )
    db_session.add(existing_product)
    db_session.flush()
    existing_variant = models.ProductVariant(
        product_id=existing_product.id,
        sku_code="SKU-123",
        price=1000.0,
        stock=10
    )
    db_session.add(existing_variant)
    db_session.commit()

    response2 = client.post("/api/service/sync-stock", json={"product_id": 8888, "stock": 99}, headers=headers)
    assert response2.status_code == 404

    # Verify the existing product's stock was NOT updated
    db_session.commit()
    db_session.refresh(existing_variant)
    assert existing_variant.stock == 10


def test_audit_logs_pagination_boundaries(client, db_session: Session):
    """Test boundary parameter validation in the audit-logs endpoint."""
    token = create_access_token({"sub": "admin_pagination_tester", "role": "admin"})
    headers = {"Authorization": f"Bearer {token}"}

    # Instantiate a new TestClient with raise_server_exceptions=False
    client_no_raise = TestClient(client.app, raise_server_exceptions=False)

    # 1. Keyword wildcard/injection sanitization (run first when transaction is healthy)
    response_wildcard = client_no_raise.get("/api/audit-logs?keyword=%_'_\"_or_1=1", headers=headers)
    assert response_wildcard.status_code == status.HTTP_200_OK

    # 2. page = 0 (Calculates negative offset, leading to DB DataError)
    response = client_no_raise.get("/api/audit-logs?page=0&limit=50", headers=headers)
    assert response.status_code in {status.HTTP_400_BAD_REQUEST, status.HTTP_422_UNPROCESSABLE_ENTITY}
    db_session.rollback()

    # 3. page = -5
    response2 = client_no_raise.get("/api/audit-logs?page=-5&limit=10", headers=headers)
    assert response2.status_code in {status.HTTP_400_BAD_REQUEST, status.HTTP_422_UNPROCESSABLE_ENTITY}
    db_session.rollback()

    # 4. limit = -10
    response3 = client_no_raise.get("/api/audit-logs?page=1&limit=-10", headers=headers)
    assert response3.status_code in {status.HTTP_400_BAD_REQUEST, status.HTTP_422_UNPROCESSABLE_ENTITY}
    db_session.rollback()


def test_parse_attribute_storage_value_adversarial():
    """Verify _parse_attribute_storage_value with extreme/NaN/Inf numeric inputs."""
    # 1. NaN and Inf inputs
    text_val, float_val = _parse_attribute_storage_value("nan", "decimal")
    assert text_val is None
    assert math.isnan(float_val)

    text_val2, float_val2 = _parse_attribute_storage_value("inf", "float")
    assert text_val2 is None
    assert math.isinf(float_val2)

    # 2. Mixed numeric string suffix
    text_val3, float_val3 = _parse_attribute_storage_value("10.5mm", "integer")
    assert text_val3 == "10.5mm"
    assert float_val3 is None

    # 3. None and empty value handling
    text_val4, float_val4 = _parse_attribute_storage_value(None, "decimal")
    assert text_val4 is None and float_val4 is None

    text_val5, float_val5 = _parse_attribute_storage_value("   ", "integer")
    assert text_val5 is None and float_val5 is None


def test_save_product_channel_listings_exceptions(db_session: Session):
    """Test channel listing mapper exceptions with invalid codes/SKUs."""
    # Create a dummy product to satisfy the foreign key constraint
    prod = models.Product(product_code="TEMP-PRODUCT-FOR-LISTING-TEST", name="Temp Prod", weight=10.0)
    db_session.add(prod)
    db_session.commit()
    product_id = prod.id

    # 1. Non-existent channel code
    with pytest.raises(HTTPException) as exc_info:
        _save_product_channel_listings(
            db=db_session,
            product_id=product_id,
            channel_listings=[
                schemas.ProductChannelListingCreate(
                    channel_code="NON-EXISTENT-CHANNEL-XYZ",
                    status="Draft",
                    title_override=None,
                    description_override=None,
                    shipping_config=None,
                    channel_product_id=None,
                    attribute_values=[],
                    variant_overrides=[]
                )
            ],
            db_variants=[]
        )
    assert exc_info.value.status_code == 400
    assert "not found" in exc_info.value.detail

    # 2. Variant override with non-existent SKU code
    channel = db_session.query(models.Channel).first()
    if not channel:
        channel = models.Channel(code="SHOPEE", name="Shopee Viet Nam")
        db_session.add(channel)
        db_session.commit()

    with pytest.raises(HTTPException) as exc_info2:
        _save_product_channel_listings(
            db=db_session,
            product_id=product_id,
            channel_listings=[
                schemas.ProductChannelListingCreate(
                    channel_code=channel.code,
                    status="Draft",
                    title_override=None,
                    description_override=None,
                    shipping_config=None,
                    channel_product_id=None,
                    attribute_values=[],
                    variant_overrides=[
                        schemas.VariantChannelListingCreate(
                            sku_code="MISSING-SKU-123",
                            price_override=100.0,
                            channel_variant_id=None
                        )
                    ]
                )
            ],
            db_variants=[]
        )
    assert exc_info2.value.status_code == 400
    assert "not found in variants list" in exc_info2.value.detail


def test_product_attributes_duplicate_integrity(client, db_session: Session):
    """Test duplicate attribute value inputs violating unique DB constraints."""
    attr = db_session.query(models.Attribute).first()
    if not attr:
        attr = models.Attribute(code="color", name="Color", type="text")
        db_session.add(attr)
        db_session.commit()

    fam = db_session.query(models.AttributeFamily).first()
    if not fam:
        fam = models.AttributeFamily(code="general", name="General Family")
        db_session.add(fam)
        db_session.commit()

    # Create product payload with duplicate attribute values for the same attribute id
    payload = {
        "product_code": "PROD-DUP-ATTR-TEST",
        "name": "Duplicate Attribute Product",
        "weight": 100.0,
        "status": "Draft",
        "family_id": fam.id,
        "variants": [
            {"sku_code": "PROD-DUP-ATTR-VAR", "price": 1000.0, "stock": 5}
        ],
        "attributes": [
            {"id": attr.id, "value": "Red"},
            {"id": attr.id, "value": "Blue"}
        ]
    }
    
    response = client.post("/products", json=payload)
    assert response.status_code in {status.HTTP_400_BAD_REQUEST, status.HTTP_500_INTERNAL_SERVER_ERROR}
    assert "unique constraint" in response.json()["detail"].lower() or "duplicate" in response.json()["detail"].lower() or "failed" in response.json()["detail"].lower()


def test_product_import_failures(client):
    """Verify import failure paths (binary decoding and invalid values)."""
    # 1. Non-UTF8 file decoding failure
    binary_content = b"\x80\x81\x82\x83\xff"
    from io import BytesIO
    files = {"file": ("products.csv", BytesIO(binary_content), "text/csv")}
    response = client.post("/products/import", files=files)
    assert response.status_code == 500
    assert "utf-8" in response.json()["detail"].lower()

    # 2. Non-float price value parsing failure
    csv_content = "sku,name,price\nIMPORT-VAR-1,Imported Name,invalid_price_abc\n"
    files2 = {"file": ("products.csv", BytesIO(csv_content.encode("utf-8")), "text/csv")}
    response2 = client.post("/products/import", files=files2)
    assert response2.status_code == 500
    assert "float" in response2.json()["detail"].lower()


def test_audit_action_decorator_exceptions(db_session: Session):
    """Verify audit_action handles exceptions and performs clean session close."""
    @audit_action(module="Product", action_type="UPDATE")
    def dummy_sync_function(db: Session = None):
        raise ValueError("Simulated failure in function")

    with pytest.raises(ValueError, match="Simulated failure in function"):
        dummy_sync_function(db=db_session)
    
    from sqlalchemy.orm import Session as SqlalchemySession
    original_session_close = SqlalchemySession.close
    close_called = False
    def mock_close(self):
        nonlocal close_called
        close_called = True
        original_session_close(self)
    
    import unittest.mock
    with unittest.mock.patch("sqlalchemy.orm.Session.close", mock_close):
        with pytest.raises(ValueError):
            dummy_sync_function(db=None)
            
    assert close_called is True


def test_process_outbox_batch_db_failure_propagation(db_session: Session):
    """Verify worker error propagation when DB connection fails during status update."""
    from models import AuditOutbox, ActorType, OutboxStatus
    entry = AuditOutbox(
        correlation_id=uuid.uuid4(),
        actor_username="test_actor",
        actor_type=ActorType.USER,
        module="Product",
        action_type="UPDATE",
        status=OutboxStatus.PENDING
    )
    db_session.add(entry)
    db_session.commit()

    original_add = db_session.add
    original_commit = db_session.commit
    
    commit_count = 0
    def mock_commit():
        nonlocal commit_count
        commit_count += 1
        if commit_count > 1: # Failure on the retry status update commit
            raise Exception("Complete database connection loss")
        original_commit()

    def mock_add(instance):
        raise Exception("Original processing failure")

    db_session.add = mock_add
    db_session.commit = mock_commit

    # The exception propagated is the original processing failure because the worker
    # catches status update exceptions and raises the original exception.
    try:
        with pytest.raises(Exception, match="Original processing failure"):
            process_outbox_batch(db_session, worker_id="worker-fail-test")
    finally:
        db_session.add = original_add
        db_session.commit = original_commit
