import factory
from factory import Faker
from models import Product
from .base import BaseFactory

class ProductFactory(BaseFactory):
    class Meta:
        model = Product

    product_code = factory.Sequence(lambda n: f"SKU-{n:04d}")
    name = Faker('catch_phrase')
    description = Faker('text')
    weight = Faker('pyfloat', positive=True, min_value=10, max_value=5000)
    length = Faker('pyfloat', positive=True, min_value=1, max_value=100)
    width = Faker('pyfloat', positive=True, min_value=1, max_value=100)
    height = Faker('pyfloat', positive=True, min_value=1, max_value=100)
