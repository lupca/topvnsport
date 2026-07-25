from main import app
from utils.auth import get_current_user


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


def test_sms_config_endpoints_support_long_tokens(client):
    long_access_token = "access-" + "a" * 493
    long_refresh_token = "refresh-" + "b" * 492

    response = client.put(
        "/api/configs/sms",
        json={
            "zalo_access_token": long_access_token,
            "zalo_refresh_token": long_refresh_token,
            "zalo_template_id": "tpl_long_token_test",
        },
    )

    assert response.status_code == 200
    assert response.json()["zalo_access_token"] == long_access_token[:5] + "*" * (len(long_access_token) - 5)
    assert response.json()["zalo_refresh_token"] == long_refresh_token[:5] + "*" * (len(long_refresh_token) - 5)

    get_response = client.get("/api/configs/sms")
    assert get_response.status_code == 200
    assert get_response.json()["zalo_access_token"] == response.json()["zalo_access_token"]
    assert get_response.json()["zalo_refresh_token"] == response.json()["zalo_refresh_token"]


def test_sms_config_mutation_requires_admin(client):
    app.dependency_overrides[get_current_user] = lambda: {
        "user_id": "2",
        "username": "operator",
        "role": "operator",
    }

    try:
        response = client.put(
            "/api/configs/sms",
            json={"zalo_template_id": "tpl_non_admin"},
        )
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 403
