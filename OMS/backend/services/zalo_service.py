import re
from typing import Any

import httpx

from utils.phone_helper import normalize_phone


ZALO_TEMPLATE_URL = "https://business.openapi.zalo.me/message/template"
ZALO_OAUTH_URL = "https://oauth.zaloapp.com/v4/oa/access_token"

ZALO_ERROR_MESSAGES = {
    -118: "Số điện thoại này chưa đăng ký Zalo.",
    -115: "Hạn mức gửi tin Zalo đã hết. Vui lòng thử lại sau.",
    -108: "Thông tin gửi Zalo OTP không đúng định dạng.",
}


def _error_code(payload: dict[str, Any], fallback: int | None = None) -> int | None:
    value = payload.get("error", payload.get("error_code", fallback))
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return fallback


def _failed_response(
    provider_response: Any,
    error_code: int | None,
    fallback_reason: str,
) -> dict:
    return {
        "status": "failed",
        "error_code": error_code,
        "provider_response": provider_response,
        "failed_reason": ZALO_ERROR_MESSAGES.get(error_code, fallback_reason),
        "message_id": None,
    }


async def send_zalo_otp(
    phone: str,
    otp: str,
    access_token: str,
    template_id: str,
) -> dict:
    """Send an OTP using a Zalo ZBS template message."""
    normalized_phone = normalize_phone(phone)
    if not re.fullmatch(r"84\d{9}", normalized_phone):
        return _failed_response(
            provider_response={"phone": normalized_phone},
            error_code=-108,
            fallback_reason=ZALO_ERROR_MESSAGES[-108],
        )

    headers = {
        "access_token": access_token,
        "Content-Type": "application/json",
    }
    payload = {
        "phone": normalized_phone,
        "template_id": template_id,
        "template_data": {"otp": otp},
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                ZALO_TEMPLATE_URL,
                headers=headers,
                json=payload,
            )
            response_payload = response.json()
    except Exception as exc:
        return _failed_response(
            provider_response=str(exc),
            error_code=None,
            fallback_reason=f"Không thể kết nối dịch vụ Zalo: {exc}",
        )

    error_code = _error_code(response_payload)
    if response.status_code == 200 and error_code == 0:
        data = response_payload.get("data") or {}
        message_id = (
            data.get("message_id")
            or data.get("msg_id")
            or response_payload.get("message_id")
            or response_payload.get("msg_id")
        )
        return {
            "status": "success",
            "error_code": 0,
            "provider_response": response_payload,
            "failed_reason": None,
            "message_id": str(message_id) if message_id is not None else None,
        }

    fallback_reason = (
        response_payload.get("message")
        or response_payload.get("error_name")
        or "Zalo từ chối gửi mã OTP."
    )
    return _failed_response(response_payload, error_code, fallback_reason)


async def refresh_zalo_token(
    app_id: str,
    secret_key: str,
    refresh_token: str,
) -> dict:
    """Exchange a Zalo OA refresh token and return the rotated token pair."""
    headers = {
        "secret_key": secret_key,
        "Content-Type": "application/x-www-form-urlencoded",
    }
    form_data = {
        "app_id": app_id,
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                ZALO_OAUTH_URL,
                headers=headers,
                data=form_data,
            )
            response_payload = response.json()
    except Exception as exc:
        return {
            "status": "failed",
            "provider_response": str(exc),
            "failed_reason": f"Không thể làm mới Zalo token: {exc}",
        }

    access_token = response_payload.get("access_token")
    new_refresh_token = response_payload.get("refresh_token")
    if response.status_code == 200 and access_token and new_refresh_token:
        return {
            "status": "success",
            "access_token": access_token,
            "refresh_token": new_refresh_token,
            "expires_in": response_payload.get("expires_in"),
            "provider_response": response_payload,
            "failed_reason": None,
        }

    return {
        "status": "failed",
        "error_code": _error_code(response_payload),
        "provider_response": response_payload,
        "failed_reason": (
            response_payload.get("message")
            or response_payload.get("error_name")
            or "Zalo từ chối làm mới token."
        ),
    }
