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


# OTP Request/Response Schemas
class SendOtpRequest(BaseModel):
    phone_number: str

class VerifyOtpRequest(BaseModel):
    phone_number: str
    otp_code: str

class VerifyOtpResponse(BaseModel):
    success: bool
    verification_token: str
