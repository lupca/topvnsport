import pytest
from models import BarcodeMapping, InboundItem
from decimal import Decimal
from datetime import datetime

class TestBarcodeMappingModel:
    """Test BarcodeMapping với cost/tax fields mới"""
    
    def test_create_barcode_mapping_with_cost_tax(self, db_session):
        """Tạo BarcodeMapping với cost và tax"""
        bm = BarcodeMapping(
            barcode="8934567890123",
            barcode_type="EAN-13",
            sku_code="TEST-001-RED",
            product_name="Test Product",
            variant_name="Red",
            cost_price=Decimal("50000"),
            tax_rate=Decimal("10.00"),
            pmi_variant_id=123,
            last_synced_at=datetime.utcnow()
        )
        db_session.add(bm)
        db_session.commit()
        
        saved = db_session.query(BarcodeMapping).filter_by(sku_code="TEST-001-RED").first()
        assert saved.cost_price == Decimal("50000")
        assert saved.tax_rate == Decimal("10.00")
        assert saved.pmi_variant_id == 123
        assert saved.last_synced_at is not None

class TestInboundItemModel:
    """Test InboundItem với unit_cost field mới"""
    
    def test_create_inbound_item_with_unit_cost(self, db_session, sample_inbound_shipment):
        """Tạo InboundItem với unit_cost"""
        item = InboundItem(
            inbound_shipment_id=sample_inbound_shipment.id,
            sku_code="TEST-001-RED",
            product_name="Test Product",
            expected_qty=100,
            unit_cost=Decimal("48000")  # Giá nhập thực tế
        )
        db_session.add(item)
        db_session.commit()
        
        saved = db_session.query(InboundItem).filter_by(sku_code="TEST-001-RED").first()
        assert saved.unit_cost == Decimal("48000")
