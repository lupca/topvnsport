import os
import json
import uuid
import hashlib
import secrets
import inspect
from datetime import timedelta
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import models
import schemas
import services.zalo_service
import utils.phone_helper
from database import get_db
from utils.api_utils import utcnow

router = APIRouter(prefix="/api/sms", tags=["OTP"])

# For E2E testing purposes
LAST_OTPS: Dict[str, str] = {}


def generate_otp() -> str:
    return "".join(secrets.choice("0123456789") for _ in range(6))


def hash_otp(otp: str) -> str:
    return hashlib.sha256(otp.encode("utf-8")).hexdigest()


def mask_token(token: str) -> str:
    if not token:
        return ""
    if len(token) <= 5:
        return "*" * len(token)
    return token[:5] + "*" * (len(token) - 5)


if os.getenv("INTEGRITY_MODE") == "development" or os.getenv("ENV") == "development":
    @router.get("/test-last-otp")
    def get_test_last_otp(phone: str, db: Session = Depends(get_db)):
        if os.getenv("ALLOW_TEST_OTP_ENDPOINT", "").lower() != "true":
            raise HTTPException(status_code=404, detail="Not found")
        normalized_phone = utils.phone_helper.normalize_phone(phone)
        otp_code = LAST_OTPS.get(normalized_phone)
        if not otp_code:
            raise HTTPException(status_code=404, detail="No OTP found for this phone number")
        return {"otp_code": otp_code}


@router.post("/send-otp")
async def send_otp(payload: schemas.SendOtpRequest, db: Session = Depends(get_db)):
    phone = payload.phone_number
    normalized_phone = utils.phone_helper.normalize_phone(phone)
    now_time = utcnow()
    is_development = (
        os.getenv("INTEGRITY_MODE") == "development"
        or os.getenv("ENV") == "development"
    )

    # Retrieve or create SmsRateLimit for sending
    db_limit = db.query(models.SmsRateLimit).filter(
        models.SmsRateLimit.phone_number == normalized_phone,
        models.SmsRateLimit.action_type == "send"
    ).first()

    if not db_limit:
        db_limit = models.SmsRateLimit(
            phone_number=normalized_phone,
            action_type="send",
            attempt_count=0,
            last_attempt_at=now_time
        )
        db.add(db_limit)
        db.flush()

    # 1. Lockout Check
    is_locked = False
    if db_limit.lockout_until and db_limit.lockout_until > now_time:
        is_locked = True
    elif db_limit.attempt_count >= 5 and now_time - db_limit.last_attempt_at < timedelta(minutes=15):
        if not db_limit.lockout_until:
            db_limit.lockout_until = db_limit.last_attempt_at + timedelta(minutes=15)
            db.commit()
        if db_limit.lockout_until > now_time:
            is_locked = True

    if is_locked:
        raise HTTPException(
            status_code=403,
            detail="Số điện thoại này đã bị tạm khóa do gửi quá nhiều OTP hoặc xác minh sai quá nhiều lần. Vui lòng thử lại sau 15 phút."
        )

    # 2. Cooldown Check (60 seconds)
    if db_limit.attempt_count > 0 and now_time - db_limit.last_attempt_at < timedelta(seconds=60):
        raise HTTPException(
            status_code=429,
            detail="Bạn đang gửi yêu cầu quá nhanh. Vui lòng đợi 60 giây trước khi thử lại."
        )

    # 3. 15-minute Limit Window (Max 5 attempts)
    if now_time - db_limit.last_attempt_at > timedelta(minutes=15):
        db_limit.attempt_count = 1
    else:
        db_limit.attempt_count += 1

    if db_limit.attempt_count > 5:
        db_limit.lockout_until = now_time + timedelta(minutes=15)
        db.commit()
        raise HTTPException(
            status_code=403,
            detail="Số điện thoại này đã bị tạm khóa do gửi quá nhiều OTP hoặc xác minh sai quá nhiều lần. Vui lòng thử lại sau 15 phút."
        )

    db_limit.last_attempt_at = now_time
    
    # 4. Generate OTP
    otp_code = generate_otp()
    otp_hash = hash_otp(otp_code)
    expires_at = now_time + timedelta(minutes=5)

    # 5. Fetch Zalo ZBS configuration
    zalo_configs = {
        config.config_key: config.config_value
        for config in db.query(models.SystemConfig).filter(
            models.SystemConfig.config_key.in_(
                ["zalo_access_token", "zalo_template_id"]
            )
        )
    }
    zalo_access_token = zalo_configs.get("zalo_access_token")
    zalo_template_id = zalo_configs.get("zalo_template_id")

    has_zalo_config = bool(zalo_access_token and zalo_template_id)
    if not has_zalo_config and not is_development:
        raise HTTPException(
            status_code=500,
            detail="Cấu hình dịch vụ Zalo OTP chưa đầy đủ. Vui lòng liên hệ quản trị viên.",
        )

    # Create verification record (pending status)
    otp_ver = models.OtpVerification(
        phone_number=normalized_phone,
        otp_hash=otp_hash,
        expires_at=expires_at,
        provider_status="PENDING"
    )
    db.add(otp_ver)
    db.commit()

    # Store for test-last-otp endpoint in development
    if is_development:
        LAST_OTPS[normalized_phone] = otp_code

    # 6. Async call to Zalo (handling potential synchronous monkeypatch)
    if is_development and not has_zalo_config:
        result = {
            "status": "success",
            "error_code": 0,
            "provider_response": {"mode": "development"},
            "failed_reason": None,
            "message_id": f"development-{uuid.uuid4()}",
        }
    else:
        res = services.zalo_service.send_zalo_otp(
            normalized_phone,
            otp_code,
            zalo_access_token,
            zalo_template_id,
        )
        if inspect.isawaitable(res):
            result = await res
        else:
            result = res

    # 7. Update verification log with provider outcome
    error_code = result.get("error_code")
    try:
        error_code = int(error_code) if error_code is not None else None
    except (TypeError, ValueError):
        error_code = None
    error_message = services.zalo_service.ZALO_ERROR_MESSAGES.get(
        error_code,
        result.get("failed_reason")
        or "Không thể gửi mã OTP qua Zalo. Vui lòng thử lại.",
    )

    otp_ver.provider_status = result.get("status", "failed")
    otp_ver.provider_response = json.dumps(
        result.get("provider_response", result),
        ensure_ascii=False,
        default=str,
    )
    otp_ver.failed_reason = (
        error_message if result.get("status") != "success" else None
    )
    otp_ver.zalo_message_id = result.get("message_id")
    otp_ver.sent_at = utcnow()
    db.commit()

    if result.get("status") != "success":
        raise HTTPException(status_code=400, detail=error_message)

    return {"success": True}


@router.post("/verify-otp", response_model=schemas.VerifyOtpResponse)
def verify_otp(payload: schemas.VerifyOtpRequest, db: Session = Depends(get_db)):
    phone = payload.phone_number
    normalized_phone = utils.phone_helper.normalize_phone(phone)
    now_time = utcnow()

    # 1. Check verify rate limit
    db_limit = db.query(models.SmsRateLimit).filter(
        models.SmsRateLimit.phone_number == normalized_phone,
        models.SmsRateLimit.action_type == "verify"
    ).first()

    if db_limit and db_limit.lockout_until and db_limit.lockout_until > now_time:
        raise HTTPException(
            status_code=403,
            detail="Số điện thoại này đã bị tạm khóa do gửi quá nhiều OTP hoặc xác minh sai quá nhiều lần. Vui lòng thử lại sau 15 phút."
        )

    # 2. Retrieve active OTP record
    otp_ver = db.query(models.OtpVerification).filter(
        models.OtpVerification.phone_number == normalized_phone,
        models.OtpVerification.verified_at.is_(None),
        models.OtpVerification.expires_at > now_time
    ).order_by(models.OtpVerification.created_at.desc()).first()

    if not otp_ver:
        raise HTTPException(status_code=400, detail="Mã OTP không chính xác hoặc đã hết hạn. Vui lòng kiểm tra lại.")

    # 3. Match hashes
    provided_hash = hash_otp(payload.otp_code)
    if otp_ver.otp_hash == provided_hash:
        # Success: Reset limit, create token
        if db_limit:
            db_limit.attempt_count = 0
            db_limit.lockout_until = None

        verification_token = str(uuid.uuid4())
        otp_ver.verified_at = now_time
        otp_ver.verification_token = verification_token
        otp_ver.verification_expires_at = now_time + timedelta(minutes=15)
        
        db.commit()
        return {"success": True, "verification_token": verification_token}
    else:
        # Failure: Increment attempt count
        if not db_limit:
            db_limit = models.SmsRateLimit(
                phone_number=normalized_phone,
                action_type="verify",
                attempt_count=1,
                last_attempt_at=now_time
            )
            db.add(db_limit)
        else:
            db_limit.attempt_count += 1
            db_limit.last_attempt_at = now_time

        if db_limit.attempt_count >= 5:
            db_limit.lockout_until = now_time + timedelta(minutes=15)
            # Invalidate active OTP record
            otp_ver.expires_at = now_time  # Force expiration
            db.commit()
            raise HTTPException(
                status_code=403,
                detail="Số điện thoại này đã bị tạm khóa do gửi quá nhiều OTP hoặc xác minh sai quá nhiều lần. Vui lòng thử lại sau 15 phút."
            )
        
        db.commit()
        raise HTTPException(
            status_code=400,
            detail=f"Mã OTP không chính xác. Incorrect OTP. {5 - db_limit.attempt_count} attempts remaining."
        )
