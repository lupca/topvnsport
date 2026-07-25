import pytest
from routers.otp import generate_otp, hash_otp, mask_token


def test_otp_helpers():
    otp = generate_otp()
    assert len(otp) == 6
    assert otp.isdigit()

    h = hash_otp("123456")
    assert isinstance(h, str)
    assert len(h) == 64

    masked = mask_token("secret_token_123")
    assert masked.startswith("secre")
    assert "*" in masked
    assert mask_token("") == ""
    assert mask_token("123") == "***"


def test_test_last_otp_requires_explicit_flag(client, monkeypatch):
    monkeypatch.setenv("ALLOW_TEST_OTP_ENDPOINT", "false")

    response = client.get("/api/sms/test-last-otp?phone=0987654321")

    assert response.status_code == 404


def test_send_and_verify_otp_flow(client, db):
    phone = "0987654321"

    # Send OTP
    resp = client.post("/api/sms/send-otp", json={"phone_number": phone})
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    # Get test last OTP
    resp_last = client.get(f"/api/sms/test-last-otp?phone={phone}")
    assert resp_last.status_code == 200
    otp_code = resp_last.json()["otp_code"]
    assert len(otp_code) == 6

    # Verify OTP with wrong code
    resp_bad = client.post("/api/sms/verify-otp", json={"phone_number": phone, "otp_code": "000000"})
    assert resp_bad.status_code == 400

    # Verify OTP with correct code
    resp_verify = client.post("/api/sms/verify-otp", json={"phone_number": phone, "otp_code": otp_code})
    assert resp_verify.status_code == 200
    assert resp_verify.json()["success"] is True
    assert "verification_token" in resp_verify.json()
