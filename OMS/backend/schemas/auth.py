from typing import Optional

from pydantic import BaseModel, field_validator


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

    @field_validator("zalo_secret_key", "zalo_access_token", "zalo_refresh_token", mode="after")
    @classmethod
    def mask_sensitive_fields(cls, v: str) -> str:
        if not v:
            return ""
        if v.endswith("***"):
            return v
        if len(v) <= 4:
            return v[:4] + "***"
        return f"{v[:4]}***"


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
