import os
from typing import Optional
from sqlalchemy.orm import Session

import models


SEPAY_CONFIG_DESCRIPTIONS = {
    "sepay_merchant_id": "SePay Merchant ID",
    "sepay_secret_key": "SePay Secret Key",
    "sepay_checkout_url": "SePay Checkout URL",
    "web_base_url": "Web Base URL",
}


def get_config(db: Optional[Session], key: str, default: str = "") -> str:
    """Lấy config từ DB, fallback về env var"""
    if db is not None:
        config = (
            db.query(models.SystemConfig)
            .filter(models.SystemConfig.config_key == key)
            .first()
        )
        if config and config.config_value:
            return config.config_value
    return os.getenv(key.upper(), default)


def get_sepay_config(db: Optional[Session] = None) -> dict:
    """Trả về dictionary chứa đủ 4 SePay config fields với fallback env var"""
    return {
        "merchant_id": get_config(db, "sepay_merchant_id"),
        "secret_key": get_config(db, "sepay_secret_key"),
        "checkout_url": get_config(
            db,
            "sepay_checkout_url",
            "https://pay.sepay.vn/v1/checkout/init",
        ),
        "web_base_url": get_config(
            db,
            "web_base_url",
            "https://topvnsport.vn",
        ),
    }
