from typing import Optional

from pydantic import BaseModel


# SystemConfig Schemas
class ZaloConfigUpdate(BaseModel):
    zalo_app_id: Optional[str] = None
    zalo_secret_key: Optional[str] = None
    zalo_access_token: Optional[str] = None
    zalo_refresh_token: Optional[str] = None
    zalo_template_id: Optional[str] = None


class ZaloConfigOut(BaseModel):
    zalo_app_id: str
    zalo_secret_key: str
    zalo_access_token: str
    zalo_refresh_token: str
    zalo_template_id: str


class SepayConfigUpdate(BaseModel):
    sepay_merchant_id: Optional[str] = None
    sepay_secret_key: Optional[str] = None
    sepay_checkout_url: Optional[str] = None
    web_base_url: Optional[str] = None


class SepayConfigOut(BaseModel):
    sepay_merchant_id: str
    sepay_secret_key: str
    sepay_checkout_url: str
    web_base_url: str


class SepayTestResponse(BaseModel):
    success: bool
    message: str


# OTP Request/Response Schemas
class SendOtpRequest(BaseModel):
    phone_number: str

class VerifyOtpRequest(BaseModel):
    phone_number: str
    otp_code: str


class VerifyOtpResponse(BaseModel):
    success: bool
    verification_token: str
