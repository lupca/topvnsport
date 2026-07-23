import os
import hmac
import json
import hashlib
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

import models
from database import get_db

logger = logging.getLogger("oms_backend")

router = APIRouter(prefix="/api/sms", tags=["Webhooks"])


def _extract_zalo_message_id(payload: dict) -> Optional[str]:
    for key in ("message_id", "msg_id"):
        value = payload.get(key)
        if value is not None:
            return str(value)

    for key in ("data", "message", "recipient", "sender"):
        nested = payload.get(key)
        if isinstance(nested, dict):
            message_id = _extract_zalo_message_id(nested)
            if message_id:
                return message_id
    return None


@router.post("/zalo-webhook")
async def zalo_webhook(request: Request, db: Session = Depends(get_db)):
    raw_body = await request.body()
    secret_config = db.query(models.SystemConfig).filter(
        models.SystemConfig.config_key == "zalo_secret_key"
    ).first()
    oa_secret_key = (
        secret_config.config_value
        if secret_config and secret_config.config_value
        else os.getenv("OA_SECRET_KEY")
    )
    if not oa_secret_key:
        logger.error("Zalo webhook secret is not configured; rejecting webhook.")
        raise HTTPException(
            status_code=503,
            detail="Webhook Zalo chưa được cấu hình.",
        )

    supplied_signature = (
        request.headers.get("X-Zalo-Signature")
        or request.headers.get("X-ZEvent-Signature")
        or request.headers.get("X-Zalo-Webhook-Signature")
        or ""
    )
    if supplied_signature.lower().startswith("sha256="):
        supplied_signature = supplied_signature[7:]

    expected_signature = hmac.new(
        oa_secret_key.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected_signature, supplied_signature.lower()):
        raise HTTPException(
            status_code=401,
            detail="Chữ ký webhook Zalo không hợp lệ.",
        )

    try:
        payload = json.loads(raw_body)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="Dữ liệu webhook Zalo không hợp lệ.",
        )
    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=400,
            detail="Dữ liệu webhook Zalo không hợp lệ.",
        )

    event_name = payload.get("event_name") or payload.get("event")
    if event_name != "user_received_message":
        return {"success": True, "updated": False}

    message_id = _extract_zalo_message_id(payload)
    if not message_id:
        raise HTTPException(
            status_code=400,
            detail="Webhook Zalo thiếu mã tin nhắn.",
        )

    otp_ver = db.query(models.OtpVerification).filter(
        models.OtpVerification.zalo_message_id == message_id
    ).order_by(models.OtpVerification.created_at.desc()).first()
    if not otp_ver:
        return {"success": True, "updated": False}

    otp_ver.provider_status = "DELIVERED"
    db.commit()
    return {"success": True, "updated": True}
