import os
import models
from services.config_service import get_config, get_sepay_config


def test_get_config_from_db(db):
    """Config trong DB được ưu tiên hơn env var"""
    os.environ["SEPAY_MERCHANT_ID"] = "ENV_MERCHANT_ID"
    try:
        # Create config in DB
        db_config = models.SystemConfig(
            config_key="sepay_merchant_id",
            config_value="DB_MERCHANT_ID",
            description="SePay Merchant ID",
        )
        db.add(db_config)
        db.commit()

        res = get_config(db, "sepay_merchant_id")
        assert res == "DB_MERCHANT_ID"
    finally:
        os.environ.pop("SEPAY_MERCHANT_ID", None)


def test_get_config_fallback_env(db):
    """Fallback về env var khi DB không có config"""
    os.environ["SEPAY_MERCHANT_ID"] = "ENV_MERCHANT_ID"
    try:
        res = get_config(db, "non_existent_key_xyz")
        assert res == ""

        res_env = get_config(db, "sepay_merchant_id")
        assert res_env == "ENV_MERCHANT_ID"
    finally:
        os.environ.pop("SEPAY_MERCHANT_ID", None)


def test_get_sepay_config_returns_all_fields(db):
    """Trả về đủ 4 fields sepay config"""
    config = get_sepay_config(db)
    assert isinstance(config, dict)
    assert "merchant_id" in config
    assert "secret_key" in config
    assert "checkout_url" in config
    assert "web_base_url" in config
    assert config["checkout_url"] == "https://pay.sepay.vn/v1/checkout/init"
    assert config["web_base_url"] == "https://topvnsport.vn"
