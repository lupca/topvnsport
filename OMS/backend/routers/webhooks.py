import os
import hmac
import json
import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

import models
from database import get_db

logger = logging.getLogger("oms_backend")

router = APIRouter(prefix="/api/sms", tags=["Webhooks"])
sepay_router = APIRouter(prefix="/webhooks", tags=["SePay"])


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


@sepay_router.post("/sepay")
async def sepay_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Nhận IPN từ SePay Payment Gateway.
    Docs: https://docs.sepay.vn/vi/sepay-payment-gateway

    Payload format:
    {
        "notification_type": "PAYMENT_SUCCESS" | "ORDER_PAID",
        "order": { "order_invoice_number": "...", "order_amount": ... },
        "transaction": { "transaction_status": "APPROVED", ... }
    }
    """
    raw_body = await request.body()

    try:
        payload = json.loads(raw_body)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Dữ liệu webhook SePay không hợp lệ.")

    logger.info(f"SePay Payment Gateway IPN received: {payload}")

    notification_type = payload.get("notification_type")
    order_data = payload.get("order", {})
    transaction_data = payload.get("transaction", {})

    # Chỉ xử lý khi thanh toán thành công
    if notification_type not in ("PAYMENT_SUCCESS", "ORDER_PAID"):
        logger.info(f"Ignoring notification_type: {notification_type}")
        return {"success": True, "message": f"Ignored: {notification_type}"}

    if transaction_data.get("transaction_status") != "APPROVED":
        logger.info(f"Transaction not approved: {transaction_data.get('transaction_status')}")
        return {"success": True, "message": "Transaction not approved"}

    order_invoice_number = order_data.get("order_invoice_number")
    sepay_order_id = order_data.get("order_id") or order_data.get("id") or transaction_data.get("transaction_id")
    order_amount = order_data.get("order_amount")
    payment_method = transaction_data.get("payment_method") or "SEPAY_QR"

    logger.info(
        f"Payment confirmed: invoice={order_invoice_number}, "
        f"amount={order_amount}, sepay_order_id={sepay_order_id}, method={payment_method}"
    )

    if not order_invoice_number:
        logger.warning("Missing order_invoice_number in SePay IPN")
        return {"success": True, "message": "Missing order_invoice_number"}

    order = db.query(models.Order).filter(
        models.Order.order_number == order_invoice_number
    ).first()

    if not order:
        logger.warning(f"Order not found for invoice number: {order_invoice_number}")
        return {"success": True, "message": "Order not found"}

    if order.payment_status == "PAID":
        logger.info(f"Order {order_invoice_number} is already marked as PAID")
        return {"success": True, "message": "Already paid"}

    order.payment_status = "PAID"
    order.payment_method = str(payment_method)
    if sepay_order_id:
        order.sepay_order_id = str(sepay_order_id)
    order.paid_at = datetime.now(timezone.utc).replace(tzinfo=None)

    db.commit()
    logger.info(f"Order {order_invoice_number} payment status updated to PAID")

    return {
        "success": True,
        "order_number": order_invoice_number,
        "payment_status": "PAID"
    }
