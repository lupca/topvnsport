from playwright.sync_api import Page, expect

import re

def test_oms_admin_zalo_settings(page: Page, oms_api_url: str):
    admin_base_url = oms_api_url.replace("18101", "13101")
    
    # 1. Login first
    page.goto(admin_base_url)
    page.wait_for_url(re.compile(r"^http://localhost:13110/login\?redirect="))
    page.fill("input[name='username']", "admin")
    page.fill("input[name='password']", "Admin@123")
    page.click("button[type='submit']")
    page.wait_for_url(re.compile(r"^http://localhost:13101/(\?.*)?$"))
    
    # 2. Navigate to Zalo OTP Settings
    page.goto(f"{admin_base_url}/settings/sms")

    # Verify all Zalo config inputs are present
    config_values = {
        "zalo_app_id": "zalo_app_id_123",
        "zalo_secret_key": "zalo_secret_key_123",
        "zalo_access_token": "zalo_access_token_123",
        "zalo_refresh_token": "zalo_refresh_token_123",
        "zalo_template_id": "zalo_template_id_123",
    }
    config_inputs = {
        name: page.locator(f"input[name='{name}']")
        for name in config_values
    }
    page.on("pageerror", lambda err: print(f"Page Error: {err}"))
    page.on("console", lambda msg: print(f"Console: {msg.text}"))

    try:
        for config_input in config_inputs.values():
            expect(config_input).to_be_visible(timeout=120000)
    except Exception as e:
        print("Page HTML at timeout:")
        print(page.content())
        raise e

    # Existing values are masked or empty, then replaced with new values.
    for name, config_input in config_inputs.items():
        current_value = config_input.input_value()
        assert "*" in current_value or len(current_value) == 0
        config_input.fill(config_values[name])
    
    # Click "Lưu cấu hình" button
    save_button = page.get_by_role("button", name="Lưu cấu hình")
    expect(save_button).to_be_enabled()
    save_button.click()

    # Verify notification success message
    expect(page.get_by_text("Cấu hình Zalo OTP đã được lưu thành công.")).to_be_visible(timeout=10000)
    expect(page.get_by_text("Token hợp lệ")).to_be_visible(timeout=10000)
