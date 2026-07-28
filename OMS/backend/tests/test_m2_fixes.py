from datetime import datetime
from decimal import Decimal
from schemas.auth import ZaloConfigOut
from schemas.order import OrderOut

def test_zalo_config_out_masks_secrets():
    config = ZaloConfigOut(
        zalo_app_id="123456789",
        zalo_secret_key="my_super_secret_key_123",
        zalo_access_token="access_token_val_9999",
        zalo_refresh_token="refresh_token_val_8888",
        zalo_template_id="template_100"
    )
    assert config.zalo_app_id == "123456789"
    assert config.zalo_secret_key == "my_s***"
    assert config.zalo_access_token == "acce***"
    assert config.zalo_refresh_token == "refr***"
    assert config.zalo_template_id == "template_100"

def test_order_out_default_factory_independence():
    order1 = OrderOut(
        id=1,
        order_number="ORD-001",
        customer_id=10,
        channel_id=2,
        status="PENDING",
        total_amount=Decimal("100.00"),
        shipping_fee=Decimal("10.00"),
        shipping_address="123 Main St",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    order2 = OrderOut(
        id=2,
        order_number="ORD-002",
        customer_id=11,
        channel_id=2,
        status="PENDING",
        total_amount=Decimal("200.00"),
        shipping_fee=Decimal("15.00"),
        shipping_address="456 Side St",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    assert order1.items is not order2.items
    assert order1.fulfillment_orders is not order2.fulfillment_orders
