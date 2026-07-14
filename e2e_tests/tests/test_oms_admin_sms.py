from playwright.sync_api import Page, expect

import re

def test_oms_admin_sms_settings(page: Page, oms_api_url: str):
    admin_base_url = oms_api_url.replace("18101", "13101")
    
    # 1. Login first
    page.goto(admin_base_url)
    page.wait_for_url(re.compile(r"^http://localhost:13110/login\?redirect="))
    page.fill("input[name='username']", "admin")
    page.fill("input[name='password']", "Admin@123")
    page.click("button[type='submit']")
    page.wait_for_url(re.compile(r"^http://localhost:13101/(\?.*)?$"))
    
    # 2. Navigate to SMS Settings
    page.goto(f"{admin_base_url}/settings/sms")

    # Verify key inputs are present
    token_input = page.locator("input[name='speed_sms_token']")
    page.on("pageerror", lambda err: print(f"Page Error: {err}"))
    page.on("console", lambda msg: print(f"Console: {msg.text}"))

    try:
        expect(token_input).to_be_visible(timeout=120000)
    except Exception as e:
        print("Page HTML at timeout:")
        print(page.content())
        raise e
    
    # Assert token masking (represented by asterisks) or empty
    current_value = token_input.input_value()
    assert "*" in current_value or len(current_value) == 0

    # Fill in a new token and click save
    token_input.fill("speed_sms_token_new_key_123")
    
    # Click "Lưu cấu hình" button
    save_button = page.get_by_role("button", name="Lưu cấu hình")
    expect(save_button).to_be_enabled()
    save_button.click()

    # Verify notification success message
    expect(page.get_by_text("Cấu hình SMS đã được lưu thành công.")).to_be_visible(timeout=10000)
