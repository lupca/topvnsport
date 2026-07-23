import hmac
import hashlib
import json
import models
from routers.webhooks import _extract_zalo_message_id


def test_extract_zalo_message_id():
    assert _extract_zalo_message_id({"message_id": "msg-123"}) == "msg-123"
    assert _extract_zalo_message_id({"data": {"msg_id": "msg-456"}}) == "msg-456"
    assert _extract_zalo_message_id({"other": "value"}) is None


def test_zalo_webhook_endpoint(client, db):
    secret_key = "test_webhook_secret_key"
    cfg = models.SystemConfig(config_key="zalo_secret_key", config_value=secret_key, description="Secret")
    db.add(cfg)

    from utils.api_utils import utcnow
    from datetime import timedelta
    otp_ver = models.OtpVerification(
        phone_number="0988888888",
        otp_hash="dummy_hash",
        expires_at=utcnow() + timedelta(minutes=5),
        provider_status="PENDING",
        zalo_message_id="zalo-msg-777"
    )
    db.add(otp_ver)
    db.commit()

    payload = {
        "event_name": "user_received_message",
        "message_id": "zalo-msg-777"
    }
    body = json.dumps(payload).encode("utf-8")
    sig = hmac.new(secret_key.encode("utf-8"), body, hashlib.sha256).hexdigest()

    resp = client.post(
        "/api/sms/zalo-webhook",
        content=body,
        headers={"X-Zalo-Signature": f"sha256={sig}", "Content-Type": "application/json"}
    )
    assert resp.status_code == 200
    assert resp.json() == {"success": True, "updated": True}
