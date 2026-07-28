import ast
import os
import glob
import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from exceptions import (
    DomainException,
    ProductNotFoundException,
    ChannelNotFoundException,
    VariantSkuNotFoundException,
)
from services.product_service import (
    update_product_aggregate,
)
import models
import schemas


def test_service_layer_has_no_http_exceptions():
    """Verify that services/ directory contains ZERO references to HTTPException."""
    services_dir = os.path.join(os.path.dirname(__file__), "..", "services")
    python_files = glob.glob(os.path.join(services_dir, "**", "*.py"), recursive=True)

    violations = []
    for filepath in python_files:
        with open(filepath, "r", encoding="utf-8") as f:
            source = f.read()

        tree = ast.parse(source, filename=filepath)
        for node in ast.walk(tree):
            # Check imports
            if isinstance(node, ast.ImportFrom):
                if node.module in ("fastapi", "starlette.exceptions"):
                    for alias in node.names:
                        if alias.name == "HTTPException":
                            violations.append(f"{filepath}:{node.lineno} imports HTTPException from {node.module}")
            # Check raise statements
            elif isinstance(node, ast.Raise):
                if isinstance(node.exc, ast.Call):
                    if isinstance(node.exc.func, ast.Name) and node.exc.func.id == "HTTPException":
                        violations.append(f"{filepath}:{node.lineno} raises HTTPException")

    assert not violations, f"Found HTTPException in service layer: {violations}"


def test_domain_exception_attributes_and_contract():
    """Verify DomainException structure and message/detail mapping."""
    exc1 = DomainException("Base domain error", status_code=400)
    assert exc1.message == "Base domain error"
    assert exc1.status_code == 400
    assert exc1.detail == "Base domain error"
    assert str(exc1) == "Base domain error"

    exc_pnf = ProductNotFoundException()
    assert exc_pnf.status_code == 404
    assert exc_pnf.message == "Product not found"
    assert exc_pnf.detail == "Product not found"
    assert isinstance(exc_pnf, DomainException)

    exc_cnf = ChannelNotFoundException("Custom channel error")
    assert exc_cnf.status_code == 400
    assert exc_cnf.message == "Custom channel error"
    assert exc_cnf.detail == "Custom channel error"
    assert isinstance(exc_cnf, DomainException)

    exc_vnf = VariantSkuNotFoundException("Custom SKU error")
    assert exc_vnf.status_code == 400
    assert exc_vnf.message == "Custom SKU error"
    assert exc_vnf.detail == "Custom SKU error"
    assert isinstance(exc_vnf, DomainException)


def test_product_service_raises_product_not_found(db_session: Session):
    """Verify update_product_aggregate raises ProductNotFoundException (404) for missing product."""
    dummy_update = schemas.ProductUpdate(
        product_code="NON_EXISTENT_PROD",
        name="Non Existent",
        category_id=1,
        family_id=1,
        weight=1.0,
        length=1.0,
        width=1.0,
        height=1.0,
        status="Draft",
        tier_variations=[],
        variants=[schemas.ProductVariantCreate(sku_code="SKU-NONEXISTENT", price=100.0)],
        media=[],
        attributes=[],
        channel_listings=[],
    )

    with pytest.raises(ProductNotFoundException) as exc_info:
        update_product_aggregate(db_session, product_id=9999999, product_in=dummy_update)

    assert exc_info.value.status_code == 404
    assert exc_info.value.message == "Product not found"
    assert exc_info.value.detail == "Product not found"


from tests.factories.product import ProductFactory

def test_product_service_raises_channel_not_found(db_session: Session):
    """Verify update_product_aggregate raises ChannelNotFoundException (400) when channel code invalid."""
    category = db_session.query(models.Category).first()
    if not category:
        category = models.Category(code="DEFAULT_CAT_1", name="Default Category 1")
        db_session.add(category)
        db_session.commit()

    family = db_session.query(models.AttributeFamily).first()
    if not family:
        family = models.AttributeFamily(code="DEFAULT_FAM_1", name="Default Family 1")
        db_session.add(family)
        db_session.commit()

    product = ProductFactory(product_code="TEST-DECOUPLE-PROD-1", category_id=category.id, family_id=family.id)
    db_session.add(product)
    db_session.commit()

    update_in = schemas.ProductUpdate(
        product_code="TEST-DECOUPLE-PROD-1",
        name="Test Decouple Prod 1 Updated",
        category_id=category.id,
        family_id=family.id,
        weight=1.0,
        length=1.0,
        width=1.0,
        height=1.0,
        status="Draft",
        tier_variations=[],
        variants=[schemas.ProductVariantCreate(sku_code="SKU-DEC-1", price=50.0)],
        media=[],
        attributes=[],
        channel_listings=[
            schemas.ProductChannelListingCreate(
                channel_code="NON_EXISTENT_CHANNEL_CODE_999",
                status="Draft"
            )
        ],
    )

    with pytest.raises(ChannelNotFoundException) as exc_info:
        update_product_aggregate(db_session, product_id=product.id, product_in=update_in)

    assert exc_info.value.status_code == 400
    assert "Channel with code 'NON_EXISTENT_CHANNEL_CODE_999' not found" in exc_info.value.message


def test_product_service_raises_variant_sku_not_found(db_session: Session):
    """Verify update_product_aggregate raises VariantSkuNotFoundException (400) when channel override SKU is invalid."""
    category = db_session.query(models.Category).first()
    if not category:
        category = models.Category(code="DEFAULT_CAT_2", name="Default Category 2")
        db_session.add(category)
        db_session.commit()

    family = db_session.query(models.AttributeFamily).first()
    if not family:
        family = models.AttributeFamily(code="DEFAULT_FAM_2", name="Default Family 2")
        db_session.add(family)
        db_session.commit()

    product = ProductFactory(product_code="TEST-DECOUPLE-PROD-2", category_id=category.id, family_id=family.id)
    db_session.add(product)
    db_session.commit()

    # Ensure a valid channel exists (code 'SHOPEE' or create mock)
    channel = db_session.query(models.Channel).first()
    if not channel:
        channel = models.Channel(code="SHOPEE", name="Shopee")
        db_session.add(channel)
        db_session.commit()
    channel_code = channel.code

    update_in = schemas.ProductUpdate(
        product_code="TEST-DECOUPLE-PROD-2",
        name="Test Decouple Prod 2 Updated",
        category_id=category.id,
        family_id=family.id,
        weight=1.0,
        length=1.0,
        width=1.0,
        height=1.0,
        status="Draft",
        tier_variations=[],
        variants=[schemas.ProductVariantCreate(sku_code="SKU-DEC-2", price=50.0)],
        media=[],
        attributes=[],
        channel_listings=[
            schemas.ProductChannelListingCreate(
                channel_code=channel_code,
                status="Draft",
                variant_overrides=[
                    schemas.VariantChannelListingCreate(
                        sku_code="INVALID_VARIANT_SKU_CODE_888",
                        price_override=70.0
                    )
                ]
            )
        ],
    )

    with pytest.raises(VariantSkuNotFoundException) as exc_info:
        update_product_aggregate(db_session, product_id=product.id, product_in=update_in)

    assert exc_info.value.status_code == 400
    assert "Variant SKU 'INVALID_VARIANT_SKU_CODE_888' not found" in exc_info.value.message


def test_router_integration_response_body_format(client: TestClient):
    """Verify HTTP response body structure strictly matches {"detail": ...} and status code is correct."""
    payload = {
        "product_code": "NON_EXISTENT_PROD",
        "name": "Non Existent",
        "category_id": 1,
        "family_id": 1,
        "weight": 1.0,
        "length": 1.0,
        "width": 1.0,
        "height": 1.0,
        "status": "Draft",
        "tier_variations": [],
        "variants": [{"sku_code": "SKU-TEST", "price": 10.0}],
        "media": [],
        "attributes": [],
        "channel_listings": [],
    }
    res = client.put("/products/9999999", json=payload)
    assert res.status_code == status.HTTP_404_NOT_FOUND
    body = res.json()
    assert "detail" in body
    assert body["detail"] == "Product not found"


def test_router_handles_invalid_inputs_without_500(client: TestClient):
    """Verify router endpoints respond with 4xx and do not throw unhandled 500 internal server errors."""
    endpoints_to_test = [
        ("GET", "/products/9999999"),
        ("GET", "/categories/9999999"),
        ("GET", "/channels/9999999"),
        ("GET", "/attributes/9999999"),
        ("DELETE", "/products/9999999"),
        ("DELETE", "/categories/9999999"),
        ("DELETE", "/channels/9999999"),
        ("DELETE", "/attributes/9999999"),
    ]

    for method, path in endpoints_to_test:
        if method == "GET":
            res = client.get(path)
        elif method == "DELETE":
            res = client.delete(path)
        
        assert res.status_code in (400, 404, 422), (
            f"Endpoint {method} {path} returned status {res.status_code}, expected 4xx non-500 response"
        )
        assert "detail" in res.json(), f"Response for {method} {path} missing 'detail' key: {res.text}"
