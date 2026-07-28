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
import models
import schemas
from services.product_service import update_product_aggregate, _save_product_channel_listings


def test_exception_inheritance_and_defaults():
    """Verify class hierarchy and default status codes (400 vs 404)."""
    assert issubclass(ProductNotFoundException, DomainException)
    assert issubclass(ChannelNotFoundException, DomainException)
    assert issubclass(VariantSkuNotFoundException, DomainException)

    p_exc = ProductNotFoundException()
    assert p_exc.status_code == 404
    assert p_exc.message == "Product not found"
    assert p_exc.detail == "Product not found"

    c_exc = ChannelNotFoundException()
    assert c_exc.status_code == 400
    assert c_exc.message == "Channel not found"
    assert c_exc.detail == "Channel not found"

    v_exc = VariantSkuNotFoundException()
    assert v_exc.status_code == 400
    assert v_exc.message == "Variant SKU not found"
    assert v_exc.detail == "Variant SKU not found"


def test_custom_status_code_override():
    """Verify custom status code and custom message override in DomainException."""
    custom_p = ProductNotFoundException("Custom product missing", status_code=404)
    assert custom_p.status_code == 404
    assert custom_p.message == "Custom product missing"

    custom_c = ChannelNotFoundException("Custom channel missing", status_code=400)
    assert custom_c.status_code == 400
    assert custom_c.message == "Custom channel missing"

    custom_v = VariantSkuNotFoundException("Custom SKU missing", status_code=400)
    assert custom_v.status_code == 400
    assert custom_v.message == "Custom SKU missing"


def test_product_not_found_service_and_api(client: TestClient, db_session: Session):
    """Verify ProductNotFoundException maps to 404 HTTP status code in API response."""
    # Service layer assertion
    dummy_update = schemas.ProductUpdate(
        product_code="NONEXISTENT_CODE",
        name="Nonexistent Product",
        category_id=1,
        family_id=1,
        weight=1.0,
        length=1.0,
        width=1.0,
        height=1.0,
        status="Draft",
        tier_variations=[],
        variants=[
            schemas.ProductVariantCreate(
                sku_code="SKU-DUMMY",
                price=10.0
            )
        ],
        media=[],
        attributes=[],
        channel_listings=[]
    )
    with pytest.raises(ProductNotFoundException) as exc_info:
        update_product_aggregate(db_session, product_id=99999999, product_in=dummy_update)
    assert exc_info.value.status_code == 404
    assert exc_info.value.message == "Product not found"

    # API HTTP endpoint assertion
    import json
    payload = json.loads(dummy_update.model_dump_json())
    response = client.put("/products/99999999", json=payload)
    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.json() == {"detail": "Product not found"}


def test_channel_not_found_service_and_api(client: TestClient, db_session: Session):
    """Verify ChannelNotFoundException maps to 400 HTTP status code in API response."""
    # Create valid product
    prod = models.Product(product_code="TEST-PROD-M5-CH", name="Test Prod M5 CH", weight=1.0)
    db_session.add(prod)
    db_session.commit()
    db_session.refresh(prod)

    # Service layer direct assertion
    with pytest.raises(ChannelNotFoundException) as exc_info:
        _save_product_channel_listings(
            db=db_session,
            product_id=prod.id,
            channel_listings=[
                schemas.ProductChannelListingCreate(
                    channel_code="INVALID_CHANNEL_999",
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
    assert "Channel with code 'INVALID_CHANNEL_999' not found" in exc_info.value.message

    # API endpoint HTTP response assertion
    payload = {
        "product_code": prod.product_code,
        "name": prod.name,
        "category_id": 1,
        "family_id": 1,
        "weight": 1.0,
        "length": 1.0,
        "width": 1.0,
        "height": 1.0,
        "status": "Draft",
        "tier_variations": [],
        "variants": [
            {
                "sku_code": "SKU-TEST-CH",
                "price": 10.0
            }
        ],
        "media": [],
        "attributes": [],
        "channel_listings": [
            {
                "channel_code": "INVALID_CHANNEL_999",
                "status": "Draft",
                "title_override": None,
                "description_override": None,
                "shipping_config": None,
                "channel_product_id": None,
                "attribute_values": [],
                "variant_overrides": []
            }
        ]
    }
    response = client.put(f"/products/{prod.id}", json=payload)
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json() == {"detail": "Channel with code 'INVALID_CHANNEL_999' not found"}


def test_variant_sku_not_found_service_and_api(client: TestClient, db_session: Session):
    """Verify VariantSkuNotFoundException maps to 400 HTTP status code in API response."""
    # Create channel and product
    channel = db_session.query(models.Channel).first()
    if not channel:
        channel = models.Channel(code="SHOPEE", name="Shopee Viet Nam")
        db_session.add(channel)
        db_session.commit()

    prod = models.Product(product_code="TEST-PROD-M5-SKU", name="Test Prod M5 SKU", weight=1.0)
    db_session.add(prod)
    db_session.commit()
    db_session.refresh(prod)

    # Service layer direct assertion
    with pytest.raises(VariantSkuNotFoundException) as exc_info:
        _save_product_channel_listings(
            db=db_session,
            product_id=prod.id,
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
                            sku_code="NONEXISTENT-SKU-999",
                            price_override=50.0,
                            channel_variant_id=None
                        )
                    ]
                )
            ],
            db_variants=[]
        )
    assert exc_info.value.status_code == 400
    assert "Variant SKU 'NONEXISTENT-SKU-999' not found in variants list" in exc_info.value.message

    # API endpoint HTTP response assertion
    payload = {
        "product_code": prod.product_code,
        "name": prod.name,
        "category_id": 1,
        "family_id": 1,
        "weight": 1.0,
        "length": 1.0,
        "width": 1.0,
        "height": 1.0,
        "status": "Draft",
        "tier_variations": [],
        "variants": [
            {
                "sku_code": "SKU-VALID-1",
                "price": 10.0
            }
        ],
        "media": [],
        "attributes": [],
        "channel_listings": [
            {
                "channel_code": channel.code,
                "status": "Draft",
                "title_override": None,
                "description_override": None,
                "shipping_config": None,
                "channel_product_id": None,
                "attribute_values": [],
                "variant_overrides": [
                    {
                        "sku_code": "NONEXISTENT-SKU-999",
                        "price_override": 50.0,
                        "channel_variant_id": None
                    }
                ]
            }
        ]
    }
    response = client.put(f"/products/{prod.id}", json=payload)
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "Variant SKU 'NONEXISTENT-SKU-999' not found in variants list" in response.json()["detail"]
