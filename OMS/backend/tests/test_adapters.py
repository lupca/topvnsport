import pytest
from decimal import Decimal

from adapters.channels.shopee import ShopeeAdapter
from adapters.channels.tiktok import TikTokAdapter
from adapters.channels.lazada import LazadaAdapter
from adapters.channels.web import WebAdapter

from adapters.payments.sepay import SePayAdapter
from adapters.payments.vnpay import VNPayAdapter
from adapters.payments.momo import MoMoAdapter
from adapters.payments.cod import CODAdapter

from adapters.invoices.base import InvoiceRequest
from adapters.invoices.vnpt import VNPTInvoiceProvider
from adapters.invoices.viettel import ViettelInvoiceProvider
from adapters.invoices.meinvoice import MeInvoiceProvider


@pytest.mark.asyncio
async def test_channel_adapters():
    shopee = ShopeeAdapter()
    assert shopee.channel_code == "SHOPEE"
    norm_shopee = await shopee.handle_webhook({
        "ordersn": "SP123456",
        "total_amount": 500000,
        "recipient_address": {"name": "Shopee Buyer", "phone": "0988888888", "full_address": "Hanoi"},
        "item_list": [{"item_sku": "SKU-1", "item_name": "Shopee Item", "model_quantity_purchased": 2, "model_discounted_price": 250000}]
    })
    assert norm_shopee is not None
    assert norm_shopee.channel_order_id == "SP123456"
    assert norm_shopee.total_amount == Decimal("500000")

    tiktok = TikTokAdapter()
    assert tiktok.channel_code == "TIKTOK"
    norm_tiktok = await tiktok.handle_webhook({
        "order_id": "TT999",
        "recipient_address": {"full_name": "TikTok Buyer", "phone_number": "0977777777", "full_address": "HCM"},
        "payment_info": {"total_amount": 300000},
        "item_list": [{"seller_sku": "SKU-TT", "product_name": "TikTok Shirt", "quantity": 1, "sku_original_price": 300000}]
    })
    assert norm_tiktok is not None
    assert norm_tiktok.channel_order_id == "TT999"

    lazada = LazadaAdapter()
    assert lazada.channel_code == "LAZADA"
    norm_lazada = await lazada.handle_webhook({
        "order_id": "LZ888",
        "price": 150000,
        "address_billing": {"first_name": "Lazada Buyer", "phone": "0966666666", "address1": "Danang"},
        "items": [{"sku": "SKU-LZ", "name": "Lazada Hat", "item_price": 150000}]
    })
    assert norm_lazada is not None
    assert norm_lazada.channel_order_id == "LZ888"

    web = WebAdapter()
    assert web.channel_code == "WEB"
    norm_web = await web.handle_webhook({
        "order_number": "ORD-WEB-001",
        "customer_name": "Web User",
        "customer_phone": "0955555555",
        "shipping_address": "Can Tho",
        "total_amount": 200000,
        "items": [{"sku_code": "SKU-W", "product_name": "Web Shoe", "quantity": 1, "unit_price": 200000, "subtotal": 200000}]
    })
    assert norm_web is not None
    assert norm_web.channel_order_id == "ORD-WEB-001"


@pytest.mark.asyncio
async def test_payment_adapters():
    sepay = SePayAdapter()
    assert sepay.provider_code == "SEPAY"
    assert sepay.match_order_number("Thanh toan don ORD-20260728-0001 thanh cong") == "ORD-20260728-0001"
    
    sepay_txn = await sepay.handle_webhook({
        "notification_type": "PAYMENT_SUCCESS",
        "order": {"order_invoice_number": "ORD-20260728-0001", "order_amount": 500000, "order_id": "SEP-101"},
        "transaction": {"transaction_status": "APPROVED", "payment_method": "SEPAY_QR"}
    })
    assert sepay_txn is not None
    assert sepay_txn.amount == Decimal("500000")
    assert sepay_txn.content == "ORD-20260728-0001"

    vnpay = VNPayAdapter()
    assert vnpay.provider_code == "VNPAY"
    vnp_txn = await vnpay.handle_webhook({
        "vnp_ResponseCode": "00",
        "vnp_TransactionNo": "VNP123",
        "vnp_Amount": 10000000,
        "vnp_OrderInfo": "ORD-VNP-001"
    })
    assert vnp_txn is not None
    assert vnp_txn.amount == Decimal("100000.00")

    momo = MoMoAdapter()
    assert momo.provider_code == "MOMO"
    momo_txn = await momo.handle_webhook({
        "resultCode": 0,
        "transId": "MM555",
        "amount": 250000,
        "orderId": "ORD-MM-001"
    })
    assert momo_txn is not None
    assert momo_txn.amount == Decimal("250000")

    cod = CODAdapter()
    assert cod.provider_code == "COD"
    cod_txn = await cod.handle_webhook({"order_number": "ORD-COD-001", "amount": 180000})
    assert cod_txn is not None
    assert cod_txn.amount == Decimal("180000")


@pytest.mark.asyncio
async def test_invoice_adapters():
    req = InvoiceRequest(
        order_id=1,
        customer_name="Test Customer",
        customer_tax_code="0101234567",
        customer_address="Hanoi",
        items=[{"sku_code": "SKU-1", "product_name": "Prod 1", "quantity": 1, "unit_price": 100000}],
        total_amount=Decimal("100000"),
    )

    vnpt = VNPTInvoiceProvider()
    res_vnpt = await vnpt.issue_invoice(req)
    assert res_vnpt.provider == "VNPT"
    assert res_vnpt.status == "ISSUED"
    assert res_vnpt.pdf_url.startswith("https://")

    viettel = ViettelInvoiceProvider()
    res_vtl = await viettel.issue_invoice(req)
    assert res_vtl.provider == "VIETTEL"
    assert res_vtl.status == "ISSUED"

    meinvoice = MeInvoiceProvider()
    res_misa = await meinvoice.issue_invoice(req)
    assert res_misa.provider == "MEINVOICE"
    assert res_misa.status == "ISSUED"
