import pytest
from datetime import datetime
from schemas import (
    InboundShipmentCreate,
    InboundShipmentResponse,
    FulfillmentOrderWMSCreate,
    FulfillmentOrderWMSResponse
)

def test_wms_schemas_default_factory_list_independence():
    shipment1 = InboundShipmentCreate(
        inbound_number="IN-001",
        warehouse_id=1
    )
    shipment2 = InboundShipmentCreate(
        inbound_number="IN-002",
        warehouse_id=1
    )
    assert shipment1.items is not shipment2.items

    fo1 = FulfillmentOrderWMSCreate(
        fulfillment_number="FO-001"
    )
    fo2 = FulfillmentOrderWMSCreate(
        fulfillment_number="FO-002"
    )
    assert fo1.pick_list_items is not fo2.pick_list_items

    fo_resp1 = FulfillmentOrderWMSResponse(
        id=1,
        fulfillment_number="FO-001",
        created_at=datetime.utcnow()
    )
    fo_resp2 = FulfillmentOrderWMSResponse(
        id=2,
        fulfillment_number="FO-002",
        created_at=datetime.utcnow()
    )
    assert fo_resp1.pick_list_items is not fo_resp2.pick_list_items
    assert fo_resp1.packing_sessions is not fo_resp2.packing_sessions
