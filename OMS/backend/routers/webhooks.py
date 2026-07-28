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
from adapters.payments.sepay import SePayAdapter
from adapters.payments.vnpay import VNPayAdapter
from adapters.channels.shopee import ShopeeAdapter
from adapters.channels.tiktok import TikTokAdapter
from adapters.channels.lazada import LazadaAdapter
from services.payment_service import PaymentService
from services.order_service import OrderService

logger = logging.getLogger("oms_backend")

router = APIRouter(prefix="/api/sms", tags=["Webhooks"])
sepay_router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


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
    """Nhận IPN từ SePay Payment Gateway / Bank transfer"""
    raw_body = await request.body()

    try:
        payload = json.loads(raw_body)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Dữ liệu webhook SePay không hợp lệ.")

    logger.info(f"SePay IPN received: {payload}")

    notification_type = payload.get("notification_type")
    order_data = payload.get("order", {})
    transaction_data = payload.get("transaction", {})
    order_invoice_number = order_data.get("order_invoice_number") or payload.get("content")

    if notification_type and notification_type not in ("PAYMENT_SUCCESS", "ORDER_PAID"):
        logger.info(f"Ignoring notification_type: {notification_type}")
        return {"success": True, "message": f"Ignored: {notification_type}"}

    if transaction_data and transaction_data.get("transaction_status") not in (None, "APPROVED"):
        logger.info(f"Transaction not approved: {transaction_data.get('transaction_status')}")
        return {"success": True, "message": "Transaction not approved"}

    adapter = SePayAdapter()
    txn = await adapter.handle_webhook(payload)
    if not txn:
        return {"success": True, "message": "Ignored or non-matching notification"}

    matched_order = PaymentService.match_order_for_transaction(db, txn)
    if matched_order and matched_order.payment_status == "PAID":
        logger.info(f"Order {matched_order.order_number} is already marked as PAID")
        return {"success": True, "message": "Already paid", "order_number": matched_order.order_number, "payment_status": "PAID"}

    payment = await PaymentService.process_payment_transaction(db, txn, created_by="sepay_webhook")
    if payment:
        order = db.query(models.Order).filter(models.Order.id == payment.order_id).first()
        order_num = order.order_number if order else order_invoice_number
        return {"success": True, "order_number": order_num, "payment_id": payment.id, "payment_status": "PAID"}

    if order_invoice_number:
        order = db.query(models.Order).filter(models.Order.order_number == order_invoice_number).first()
        if order:
            if order.payment_status == "PAID":
                return {"success": True, "message": "Already paid", "order_number": order_invoice_number, "payment_status": "PAID"}
            order.payment_status = "PAID"
            order.paid_at = datetime.now(timezone.utc).replace(tzinfo=None)
            db.commit()
            return {"success": True, "order_number": order_invoice_number, "payment_status": "PAID"}

    return {"success": True, "message": "Received"}


@sepay_router.post("/vnpay")
async def vnpay_webhook(request: Request, db: Session = Depends(get_db)):
    raw_body = await request.body()
    try:
        payload = json.loads(raw_body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid VNPay payload")

    adapter = VNPayAdapter()
    txn = await adapter.handle_webhook(payload)
    if not txn:
        return {"RspCode": "01", "Message": "Order Not Found or Failed"}

    payment = await PaymentService.process_payment_transaction(db, txn, created_by="vnpay_webhook")
    if payment:
        return {"RspCode": "00", "Message": "Confirm Success"}

    return {"RspCode": "01", "Message": "Order Not Found"}


@sepay_router.post("/shopee")
async def shopee_webhook(request: Request, db: Session = Depends(get_db)):
    raw_body = await request.body()
    try:
        payload = json.loads(raw_body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Shopee payload")

    adapter = ShopeeAdapter()
    normalized = await adapter.handle_webhook(payload)
    if normalized:
        order = await OrderService.create_or_ingest_order(db, normalized, created_by="shopee_webhook")
        return {"success": True, "order_id": order.id, "order_number": order.order_number}

    return {"success": True, "message": "Ignored"}


@sepay_router.post("/tiktok")
async def tiktok_webhook(request: Request, db: Session = Depends(get_db)):
    raw_body = await request.body()
    try:
        payload = json.loads(raw_body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid TikTok payload")

    adapter = TikTokAdapter()
    normalized = await adapter.handle_webhook(payload)
    if normalized:
        order = await OrderService.create_or_ingest_order(db, normalized, created_by="tiktok_webhook")
        return {"success": True, "order_id": order.id, "order_number": order.order_number}

    return {"success": True, "message": "Ignored"}


@sepay_router.post("/lazada")
async def lazada_webhook(request: Request, db: Session = Depends(get_db)):
    raw_body = await request.body()
    try:
        payload = json.loads(raw_body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Lazada payload")

    adapter = LazadaAdapter()
    normalized = await adapter.handle_webhook(payload)
    if normalized:
        order = await OrderService.create_or_ingest_order(db, normalized, created_by="lazada_webhook")
        return {"success": True, "order_id": order.id, "order_number": order.order_number}

    return {"success": True, "message": "Ignored"}
