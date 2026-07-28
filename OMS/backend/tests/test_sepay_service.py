import os
import unittest
from services.sepay_service import SepayService, CheckoutData


class TestSepayService(unittest.TestCase):
    def test_generate_checkout_form(self):
        os.environ["SEPAY_MERCHANT_ID"] = "SP-LIVE-TEST"
        os.environ["SEPAY_SECRET_KEY"] = "test_secret_key"
        os.environ["SEPAY_CHECKOUT_URL"] = "https://pay.sepay.vn/v1/checkout/init"

        service = SepayService()
        data = CheckoutData(
            order_number="ORD-1001",
            amount=1500000,
            description="Thanh toan don hang ORD-1001",
            success_url="https://topvnsport.vn/checkout/success?order=ORD-1001",
            error_url="https://topvnsport.vn/checkout/error?order=ORD-1001",
            cancel_url="https://topvnsport.vn/checkout/cancel?order=ORD-1001",
        )

        form = service.generate_checkout_form(data)

        self.assertEqual(form["action"], "https://pay.sepay.vn/v1/checkout/init")
        fields = form["fields"]
        self.assertEqual(fields["merchant"], "SP-LIVE-TEST")
        self.assertEqual(fields["order_amount"], "1500000")
        self.assertEqual(fields["currency"], "VND")
        self.assertEqual(fields["operation"], "PURCHASE")
        self.assertEqual(fields["order_invoice_number"], "ORD-1001")
        self.assertIn("signature", fields)
        self.assertTrue(len(fields["signature"]) > 0)


if __name__ == "__main__":
    unittest.main()
