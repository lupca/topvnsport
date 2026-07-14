import logging
import os
import urllib.request
import json
from sqlalchemy.orm import Session
import models

logger = logging.getLogger("wms_backend.helpers")

def log_stock_transaction(db: Session, sku_code: str, location_id: int, transaction_type: str, quantity: int, note: str = None):
    tx = models.StockTransaction(
        sku_code=sku_code,
        location_id=location_id,
        transaction_type=transaction_type,
        quantity=quantity,
        note=note
    )
    db.add(tx)
    db.flush()

def notify_oms_status(oms_order_id: int, fulfillment_number: str, new_status: str):
    if not oms_order_id or not fulfillment_number:
        logger.info("notify_oms_status skipped: oms_order_id or fulfillment_number is null")
        return
    oms_url = os.getenv("OMS_API_URL", "http://oms_backend:8001")
    target_url = f"{oms_url}/orders/{oms_order_id}/fulfillments/{fulfillment_number}/status"
    logger.info(f"Notifying OMS of status {new_status} for fulfillment {fulfillment_number} at URL: {target_url}")
    try:
        req = urllib.request.Request(
            target_url,
            data=json.dumps({"status": new_status}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="PATCH"
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status >= 400:
                raise RuntimeError(f"OMS returned status {resp.status}")
            resp_data = resp.read()
            logger.info(f"Successfully notified OMS of status {new_status}: {resp_data}")
    except Exception as e:
        logger.error(f"Failed to notify OMS of status {new_status} for fulfillment {fulfillment_number}: {e}")
        raise RuntimeError(f"OMS sync failed: {e}")
