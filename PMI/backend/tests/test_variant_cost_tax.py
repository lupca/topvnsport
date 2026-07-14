import pytest
from decimal import Decimal
from schemas.tier_variation import ProductVariantBase

class TestProductVariantSchema:
    """Test new cost_price and tax_rate fields in variant schema"""
    
    def test_variant_with_cost_and_tax(self):
        """Variant với đầy đủ cost và tax"""
        data = {
            "price": Decimal("100000"),
            "stock": 10,
            "default_cost_price": Decimal("50000"),
            "default_tax_rate": Decimal("10.00")
        }
        variant = ProductVariantBase(**data)
        assert variant.default_cost_price == Decimal("50000")
        assert variant.default_tax_rate == Decimal("10.00")
    
    def test_variant_without_cost_tax_optional(self):
        """Cost và tax là optional"""
        data = {"price": Decimal("100000"), "stock": 10}
        variant = ProductVariantBase(**data)
        assert variant.default_cost_price is None
        assert variant.default_tax_rate is None
    
    def test_cost_price_must_be_non_negative(self):
        """Cost price không được âm"""
        # Note: default_cost_price field has ge=0. Pydantic raises ValidationError.
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            ProductVariantBase(
                price=Decimal("100000"),
                stock=10,
                default_cost_price=Decimal("-1000")
            )
    
    def test_tax_rate_must_be_0_to_100(self):
        """Tax rate phải từ 0-100%"""
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            ProductVariantBase(
                price=Decimal("100000"),
                stock=10,
                default_tax_rate=Decimal("150")  # Invalid
            )
        with pytest.raises(ValidationError):
            ProductVariantBase(
                price=Decimal("100000"),
                stock=10,
                default_tax_rate=Decimal("-5")  # Invalid
            )
