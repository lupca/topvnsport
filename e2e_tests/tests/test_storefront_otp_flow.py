from __future__ import annotations

from uuid import uuid4

from playwright.sync_api import expect

from e2e_tests.utils.api_helpers import OMSApi, PMIApi, WMSApi, wait_until


E2E_IMAGE_URL = "https://placehold.co/600x600/png?text=E2E+Racket"


def test_storefront_otp_checkout_flow(api_clients, page, web_base_url):
    run_id = uuid4().hex[:8]
    product_name = f"Vợt Lining E2E OTP Test {run_id}"
    product_code = f"PROD-E2E-OTP-{run_id}"
    sku_code = f"SKU-E2E-OTP-LINING-{run_id}"
    barcode = f"EAN-E2E-OTP-{run_id}"
    category_code = f"CAT-E2E-OTP-{run_id}"
    family_code = f"FAM-E2E-OTP-{run_id}"
    warehouse_code = f"WH-E2E-OTP-{run_id}"
    storage_location_code = f"LOC-E2E-OTP-STORAGE-{run_id}"
    pick_location_code = f"LOC-E2E-OTP-PICK-{run_id}"
    inbound_number = f"INB-E2E-OTP-{run_id}"
    customer_phone = f"09{int(run_id, 16) % 10**8:08d}"
    customer_name = f"OTP Buyer {run_id}"
    customer_address = f"E2E OTP Street {run_id}"

    pmi = PMIApi(api_clients.pmi)
    oms = OMSApi(api_clients.oms)
    wms = WMSApi(api_clients.wms)

    # Arrange: create fresh PMI + WMS master data.
    category = pmi.create_category(name="Vợt Test E2E OTP", code=category_code)
    family = pmi.create_attribute_family(name="Family Test E2E OTP", code=family_code)
    product = pmi.create_product_with_variants(
        product_code=product_code,
        name=product_name,
        category_id=category.id,
        family_id=family.id,
        sku_code=sku_code,
        price=1250000,
        stock=100,
        image_url=E2E_IMAGE_URL,
    )

    warehouse = wms.create_warehouse(code=warehouse_code, name="WH E2E OTP 01")
    storage_location = wms.create_location(warehouse_id=warehouse.id, location_code=storage_location_code, location_type="STORAGE")
    wms.create_location(warehouse_id=warehouse.id, location_code=pick_location_code, location_type="PICKING")
    wms.create_barcode_mapping(barcode=barcode, sku_code=sku_code, product_name=product_name, variant_name="Standard")

    inbound = wms.create_inbound_shipment(
        inbound_number=inbound_number,
        warehouse_id=warehouse.id,
        sku_code=sku_code,
        product_name=product_name,
        expected_qty=100,
    )
    wms.receive_inbound_shipment(inbound.id, sku_code=sku_code, received_qty=100, location_id=storage_location.id)
    wms.put_away_inbound_item(inbound.id, sku_code=sku_code, location_id=storage_location.id)
    wms.complete_inbound_shipment(inbound.id)

    inventory_after_inbound = wait_until(
        lambda: wms.get_inventory_record(sku_code=sku_code, location_id=storage_location.id),
        timeout_seconds=45,
    )
    assert inventory_after_inbound is not None
    assert inventory_after_inbound.qty_on_hand == 100

    # Act: place the order through the live web frontend.
    page.goto(web_base_url, wait_until="domcontentloaded")
    search_box = page.get_by_placeholder("Tìm vợt Yonex, Lining, cước đan, giày cầu lông...")
    search_box.fill(product_name)

    dropdown_result = page.locator("#topvnsport-header").get_by_text(product_name, exact=True)
    expect(dropdown_result).to_be_visible(timeout=15_000)
    dropdown_result.click()

    expect(page.get_by_role("heading", name=product_name)).to_be_visible(timeout=15_000)
    page.get_by_role("button", name="Thêm vào giỏ hàng").click()
    expect(page.get_by_text("Giỏ Hàng Của Bạn")).to_be_visible(timeout=15_000)
    page.locator("button").filter(has_text="Tiến hành thanh toán").click()

    page.get_by_placeholder("Ví dụ: Nguyễn Văn A").fill(customer_name)
    page.get_by_placeholder("Ví dụ: 0912345678").fill(customer_phone)
    page.get_by_placeholder("Ví dụ: Số 12 Chùa Hà").fill(customer_address)
    page.locator("button").filter(has_text="Xác nhận đặt hàng ✓").click()

    # Verify OtpModal is open
    otp_modal = page.locator("#otp-verification-modal")
    expect(otp_modal).to_be_visible(timeout=10000)

    # Verify 60s cooldown state on resend button
    resend_button = page.locator("button:has-text('Gửi lại sau')")
    expect(resend_button).to_be_disabled(timeout=5000)
    expect(resend_button).to_contain_text("Gửi lại sau")

    # Click bypass button
    page.get_by_role("button", name="Bỏ qua xác nhận (Chỉ dùng cho Test)").click()

    # Verify successful checkout transition
    expect(page.get_by_text("ĐẶT HÀNG THÀNH CÔNG!")).to_be_visible(timeout=20_000)
    order_number_label = page.locator("div.bg-gray-50 p").filter(has_text="Mã đơn hàng")
    expect(order_number_label).to_be_visible(timeout=20_000)
    created_order_number = order_number_label.first.inner_text().split(":", maxsplit=1)[-1].strip()

    # Verify that the order is correctly created in the OMS database
    draft_order = wait_until(
        lambda: _find_latest_order_by_phone(oms, customer_phone),
        timeout_seconds=30,
    )
    assert draft_order is not None
    assert draft_order.status == "DRAFT"
    assert draft_order.order_number in created_order_number


def _find_latest_order_by_phone(oms: OMSApi, phone: str):
    orders = oms.get_orders(search=phone)
    if not orders.items:
        return None
    return orders.items[0]
