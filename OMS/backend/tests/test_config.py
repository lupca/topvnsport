def test_sms_config_endpoints(client, db):
    # Get config (initially empty masked values)
    resp = client.get("/api/configs/sms")
    assert resp.status_code == 200
    data = resp.json()
    assert "zalo_app_id" in data
    assert "zalo_template_id" in data

    # Update config
    update_payload = {
        "zalo_app_id": "123456789",
        "zalo_secret_key": "my_secret_key_abc",
        "zalo_template_id": "tpl_9999"
    }
    resp_up = client.put("/api/configs/sms", json=update_payload)
    assert resp_up.status_code == 200
    updated_data = resp_up.json()
    assert updated_data["zalo_app_id"].startswith("12345")
    assert "*" in updated_data["zalo_app_id"]
