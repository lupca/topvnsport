import base64
from dataclasses import dataclass
import hashlib
import hmac
import os
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session
from adapters.payments.sepay import SePayAdapter
from services.config_service import get_sepay_config


@dataclass
class CheckoutData:
    order_number: str
    amount: int  # VND, no decimals
    description: str
    success_url: str
    error_url: str
    cancel_url: str


class SepayService:
    def __init__(self, db: Optional[Session] = None):
        config = get_sepay_config(db)
        self.merchant_id = config["merchant_id"]
        self.secret_key = config["secret_key"]
        self.checkout_url = config["checkout_url"]
        self.web_base_url = config["web_base_url"]
        self.adapter = SePayAdapter(
            merchant_id=self.merchant_id,
            secret_key=self.secret_key,
            db=db,
        )

    def generate_checkout_form(self, data: CheckoutData) -> Dict[str, Any]:
        """
        Generates form fields to submit to SePay checkout.
        """
        fields = {
            "merchant": self.merchant_id,
            "currency": "VND",
            "order_amount": str(data.amount),
            "operation": "PURCHASE",
            "order_description": data.description,
            "order_invoice_number": data.order_number,
            "success_url": data.success_url,
            "error_url": data.error_url,
            "cancel_url": data.cancel_url,
        }

        fields["signature"] = self._sign_fields(fields)

        return {
            "action": self.checkout_url,
            "fields": fields,
        }

    def _sign_fields(self, fields: Dict[str, Any]) -> str:
        """
        Creates signature following SePay specification.
        Signature calculation concatenates comma-separated key=value pairs for specified fields in exact order.
        """
        signed_field_names = [
            "merchant",
            "operation",
            "payment_method",
            "order_amount",
            "currency",
            "order_invoice_number",
            "order_description",
            "customer_id",
            "success_url",
            "error_url",
            "cancel_url",
        ]

        parts = []
        for field in signed_field_names:
            if field in fields and fields[field] is not None:
                parts.append(f"{field}={fields[field]}")

        message = ",".join(parts)
        secret = self.secret_key or ""
        signature = hmac.new(
            secret.encode("utf-8"),
            message.encode("utf-8"),
            hashlib.sha256,
        ).digest()

        return base64.b64encode(signature).decode("utf-8")
