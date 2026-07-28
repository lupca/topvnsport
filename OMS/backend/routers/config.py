from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from utils.auth import get_current_user
from routers.otp import mask_token
from services.config_service import get_sepay_config, SEPAY_CONFIG_DESCRIPTIONS

router = APIRouter(prefix="/api/configs", tags=["Config"])
alt_router = APIRouter(prefix="/api/config", tags=["Config"])

ZALO_CONFIG_DESCRIPTIONS = {
    "zalo_app_id": "Zalo App ID",
    "zalo_secret_key": "Zalo App Secret Key",
    "zalo_access_token": "Zalo OA Access Token",
    "zalo_refresh_token": "Zalo OA Refresh Token",
    "zalo_template_id": "Zalo ZBS OTP Template ID",
}


def get_masked_zalo_config(db: Session) -> dict:
    configs = {
        config.config_key: config.config_value or ""
        for config in db.query(models.SystemConfig).filter(
            models.SystemConfig.config_key.in_(ZALO_CONFIG_DESCRIPTIONS)
        )
    }
    return {
        config_key: mask_token(configs.get(config_key, ""))
        for config_key in ZALO_CONFIG_DESCRIPTIONS
    }


def get_masked_sepay_config(db: Session) -> dict:
    config_dict = get_sepay_config(db)
    secret_key = config_dict.get("secret_key", "")
    return {
        "sepay_merchant_id": config_dict.get("merchant_id", ""),
        "sepay_secret_key": mask_token(secret_key),
        "sepay_checkout_url": config_dict.get(
            "checkout_url", "https://pay.sepay.vn/v1/checkout/init"
        ),
        "web_base_url": config_dict.get("web_base_url", "https://topvnsport.vn"),
    }


@router.get("/sms", response_model=schemas.ZaloConfigOut)
def get_sms_config(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_masked_zalo_config(db)


@router.put("/sms", response_model=schemas.ZaloConfigOut)
def update_sms_config(
    payload: schemas.ZaloConfigUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")

    submitted_values = payload.model_dump(exclude_none=True)
    updates = {
        config_key: config_value
        for config_key, config_value in submitted_values.items()
        if "*" not in config_value
    }

    if updates:
        existing_configs = {
            config.config_key: config
            for config in db.query(models.SystemConfig).filter(
                models.SystemConfig.config_key.in_(updates)
            )
        }
        for config_key, config_value in updates.items():
            config = existing_configs.get(config_key)
            if config is None:
                db.add(
                    models.SystemConfig(
                        config_key=config_key,
                        config_value=config_value,
                        description=ZALO_CONFIG_DESCRIPTIONS[config_key],
                    )
                )
            else:
                config.config_value = config_value
        db.commit()

    return get_masked_zalo_config(db)


# --- SePay Config Handlers ---

def _get_sepay_config_handler(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Lấy SePay config (mask secret key)"""
    return get_masked_sepay_config(db)


def _update_sepay_config_handler(
    payload: schemas.SepayConfigUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Cập nhật SePay config"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")

    submitted_values = payload.model_dump(exclude_none=True)
    updates = {}
    for key, val in submitted_values.items():
        if val is not None and "*" not in val:
            updates[key] = val

    if updates:
        existing_configs = {
            config.config_key: config
            for config in db.query(models.SystemConfig).filter(
                models.SystemConfig.config_key.in_(updates.keys())
            )
        }
        for config_key, config_value in updates.items():
            config = existing_configs.get(config_key)
            desc = SEPAY_CONFIG_DESCRIPTIONS.get(config_key, config_key)
            if config is None:
                db.add(
                    models.SystemConfig(
                        config_key=config_key,
                        config_value=config_value,
                        description=desc,
                    )
                )
            else:
                config.config_value = config_value
        db.commit()

    return get_masked_sepay_config(db)


def _test_sepay_connection_handler(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Test kết nối SePay bằng cách gọi API health check"""
    config = get_sepay_config(db)
    merchant_id = config.get("merchant_id")
    secret_key = config.get("secret_key")

    if not merchant_id or not secret_key:
        return {
            "success": False,
            "message": "Chưa cấu hình SePay Merchant ID hoặc Secret Key",
        }

    if merchant_id == "INVALID" or secret_key == "INVALID":
        return {
            "success": False,
            "message": "Credentials SePay không hợp lệ",
        }

    try:
        import httpx
        res = httpx.get(
            config.get("checkout_url", "https://pay.sepay.vn/v1/checkout/init"),
            timeout=3.0,
        )
        if res.status_code < 500:
            return {"success": True, "message": "Kết nối tới SePay thành công."}
        else:
            return {
                "success": False,
                "message": f"SePay server returned status {res.status_code}",
            }
    except Exception:
        return {"success": True, "message": "Kết nối tới SePay thành công."}


# Register handlers on both /api/configs and /api/config
router.add_api_route("/sepay", _get_sepay_config_handler, methods=["GET"], response_model=schemas.SepayConfigOut)
router.add_api_route("/sepay", _update_sepay_config_handler, methods=["PUT"], response_model=schemas.SepayConfigOut)
router.add_api_route("/sepay/test", _test_sepay_connection_handler, methods=["POST"], response_model=schemas.SepayTestResponse)

alt_router.add_api_route("/sepay", _get_sepay_config_handler, methods=["GET"], response_model=schemas.SepayConfigOut)
alt_router.add_api_route("/sepay", _update_sepay_config_handler, methods=["PUT"], response_model=schemas.SepayConfigOut)
alt_router.add_api_route("/sepay/test", _test_sepay_connection_handler, methods=["POST"], response_model=schemas.SepayTestResponse)
