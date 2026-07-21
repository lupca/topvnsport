from uuid import uuid4
import os
import re
from playwright.sync_api import expect
from e2e_tests.utils.api_helpers import PMIApi, WMSApi, wait_until

def test_cost_tax_sync_flow(api_clients, page):
    """
    E2E Test: 
    1. Tạo product với cost & tax bên PMI
    2. Đăng nhập vào WMS Frontend và đi tới /barcode-mappings
    3. Click nút "Đồng bộ từ PMI" và xác nhận trên confirm popup
    4. Xác nhận record hiển thị đúng giá trị cost & tax
    """
    run_id = uuid4().hex[:8]
    product_code = f"PROD-SYNC-{run_id}"
    sku_code = f"SKU-SYNC-{run_id}"
    product_name = f"Sản Phẩm E2E Sync {run_id}"
    barcode = f"BAR-SYNC-{run_id}"
    
    pmi = PMIApi(api_clients.pmi)
    
    # 1. Tạo category & family
    cat = pmi.create_category(name="Sync Test E2E", code=f"CAT-SYNC-{run_id}")
    fam = pmi.create_attribute_family(name="Sync Fam E2E", code=f"FAM-SYNC-{run_id}")
    
    # 2. Tạo product với cost & tax bên PMI
    product = pmi.create_product_with_variants(
        product_code=product_code,
        name=product_name,
        category_id=cat.id,
        family_id=fam.id,
        sku_code=sku_code,
        price=100000,
        stock=10,
        image_url=None,
        default_cost_price=55000.0,
        default_tax_rate=8.0,
        barcode=barcode
    )
    
    # 3. Vào WMS Frontend
    wms_web_url = os.getenv("E2E_WMS_WEB_URL", "http://localhost:13102")
    
    # 3a. Đăng nhập thông qua Identity Service
    page.goto(wms_web_url)
    page.wait_for_url(re.compile(r"^http://localhost:13110/login\?redirect="))
    page.fill("input[name='username']", "admin")
    page.fill("input[name='password']", "Admin@123")
    page.click("button[type='submit']")
    page.wait_for_url(re.compile(r"^http://localhost:13102/(\?.*)?$"))
    
    # 3b. Đi đến trang barcode-mappings
    page.goto(f"{wms_web_url}/barcode-mappings")
    
    # 4. Click nút "Đồng bộ từ PMI"
    sync_btn = page.get_by_role("button", name="Đồng bộ từ PMI")
    expect(sync_btn).to_be_visible(timeout=10000)
    sync_btn.click()
    
    # 4b. Chấp nhận confirm popup tùy chỉnh (click nút "Đồng ý")
    confirm_btn = page.get_by_role("button", name="Đồng ý")
    expect(confirm_btn).to_be_visible(timeout=5000)
    confirm_btn.click()
    
    # 5. Xác nhận dữ liệu hiển thị trên bảng
    search_input = page.get_by_placeholder("Tìm kiếm...")
    expect(search_input).to_be_visible(timeout=10000)
    search_input.fill(sku_code)
    
    # Đợi SKU xuất hiện trên UI
    row = page.get_by_role("row").filter(has_text=sku_code)
    expect(row).to_be_visible(timeout=20000)
    
    # Check cost_price và tax_rate hiển thị đúng
    expect(row.get_by_text("55.000 đ")).to_be_visible()
    expect(row.get_by_text("8%")).to_be_visible()
