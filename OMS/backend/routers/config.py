from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from utils.auth import get_current_user
from routers.otp import mask_token

router = APIRouter(prefix="/api/configs", tags=["Config"])

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
