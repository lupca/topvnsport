import pytest
from sqlalchemy.orm import Session
from fastapi import status
from fastapi.testclient import TestClient

from exceptions import (
    DomainException,
    ProductNotFoundException,
    ChannelNotFoundException,
    VariantSkuNotFoundException,
)
from services.product_service import update_product_aggregate
import schemas


def test_domain_exception_defaults_and_attributes():
    base_exc = DomainException("Custom message", status_code=403)
    assert base_exc.message == "Custom message"
    assert base_exc.status_code == 403
    assert base_exc.detail == "Custom message"

    p_exc = ProductNotFoundException()
    assert p_exc.status_code == 404
    assert p_exc.message == "Product not found"
    assert isinstance(p_exc, DomainException)

    c_exc = ChannelNotFoundException("Channel invalid")
    assert c_exc.status_code == 400
    assert c_exc.message == "Channel invalid"
    assert isinstance(c_exc, DomainException)

    v_exc = VariantSkuNotFoundException("SKU missing")
    assert v_exc.status_code == 400
    assert v_exc.message == "SKU missing"
    assert isinstance(v_exc, DomainException)


def test_service_raises_domain_exception(db_session: Session):
    dummy_update = schemas.ProductUpdate(
        product_code="NONEXISTENT",
        name="Nonexistent",
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
        update_product_aggregate(db_session, product_id=9999999, product_in=dummy_update)

    assert exc_info.value.status_code == 404
    assert exc_info.value.message == "Product not found"


def test_api_handles_domain_exception_globally(client: TestClient):
    payload = {
        "product_code": "NONEXISTENT",
        "name": "Nonexistent",
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
                "sku_code": "SKU-DUMMY",
                "price": 10.0
            }
        ],
        "media": [],
        "attributes": [],
        "channel_listings": []
    }
    response = client.put("/products/9999999", json=payload)
    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.json() == {"detail": "Product not found"}
