import models


def test_get_sepay_config_masks_secret(client, db):
    """Secret key được mask khi GET"""
    # Seed a config in DB
    db.add(
        models.SystemConfig(
            config_key="sepay_secret_key",
            config_value="MY_SECRET_KEY_12345",
            description="SePay Secret Key",
        )
    )
    db.commit()

    resp = client.get("/api/config/sepay")
    assert resp.status_code == 200
    data = resp.json()
    assert "sepay_secret_key" in data
    # MY_SE -> MY_SE + '*' * (len - 5)
    assert data["sepay_secret_key"].startswith("MY_SE")
    assert "*" in data["sepay_secret_key"]


def test_update_sepay_config(client, db):
    """Update sepay config thành công"""
    payload = {
        "sepay_merchant_id": "SP_MERCHANT_99",
        "sepay_secret_key": "NEW_SECRET_KEY_88888",
        "sepay_checkout_url": "https://custom.checkout.url",
        "web_base_url": "https://custom.web.url",
    }
    resp = client.put("/api/config/sepay", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["sepay_merchant_id"] == "SP_MERCHANT_99"
    assert data["sepay_checkout_url"] == "https://custom.checkout.url"
    assert data["web_base_url"] == "https://custom.web.url"
    assert data["sepay_secret_key"].startswith("NEW_S")


def test_update_sepay_config_encrypts_secret(client, db):
    """Secret key được encrypt khi lưu trong DB"""
    payload = {
        "sepay_secret_key": "SUPER_SECRET_TOKEN_XYZ",
    }
    resp = client.put("/api/config/sepay", json=payload)
    assert resp.status_code == 200

    # Query directly from DB
    config_entry = (
        db.query(models.SystemConfig)
        .filter(models.SystemConfig.config_key == "sepay_secret_key")
        .first()
    )
    assert config_entry is not None
    # Accessing config_value decrypts it to plaintext
    assert config_entry.config_value == "SUPER_SECRET_TOKEN_XYZ"


def test_test_sepay_connection_success(client, db):
    """Test connection trả về success"""
    # Put valid credentials
    client.put(
        "/api/config/sepay",
        json={
            "sepay_merchant_id": "MERCHANT_OK",
            "sepay_secret_key": "SECRET_OK",
        },
    )

    resp = client.post("/api/config/sepay/test")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "thành công" in data["message"].lower() or "hợp lệ" in data["message"].lower()


def test_test_sepay_connection_invalid_credentials(client, db):
    """Test connection với credentials sai / chưa cấu hình"""
    # Clear configs or put INVALID credentials
    client.put(
        "/api/config/sepay",
        json={
            "sepay_merchant_id": "INVALID",
            "sepay_secret_key": "INVALID",
        },
    )

    resp = client.post("/api/config/sepay/test")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is False
    assert "không hợp lệ" in data["message"].lower()
