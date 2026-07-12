from playwright.sync_api import Page, expect

def test_oms_admin_sms_settings(page: Page, oms_api_url: str):
    # Navigate to OMS Admin SMS Settings (e.g. localhost:13101 in layout)
    # Since OMS frontend runs on port 13101:
    admin_base_url = oms_api_url.replace("18101", "13101")
    page.goto(f"{admin_base_url}/settings/sms")

    # Verify key inputs are present
    token_input = page.locator("input[name='speed_sms_token']")
    expect(token_input).to_be_visible(timeout=10000)
    
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
