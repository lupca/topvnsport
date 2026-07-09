import pytest
from tests.factories.product import ProductFactory
from models import Product

def test_product_factory_creates_product(db_session):
    # Use the factory to build and save a product to DB
    product = ProductFactory()
    db_session.commit()
    
    # Assert it was saved
    saved = db_session.query(Product).filter_by(id=product.id).first()
    assert saved is not None
    assert saved.product_code.startswith("SKU-")
    assert saved.weight > 0

@pytest.mark.vcr()
def test_external_api_call_with_vcr():
    import requests
    # This will be recorded in tests/integration/cassettes/test_external_api_call_with_vcr.yaml
    response = requests.get("https://api.github.com/events")
    assert response.status_code == 200
