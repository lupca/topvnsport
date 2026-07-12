from pydantic import BaseModel

# SystemConfig Schemas
class SmsConfigUpdate(BaseModel):
    config_value: str

class SmsConfigOut(BaseModel):
    config_key: str
    config_value: str


# SMS OTP Request/Response Schemas
class SendOtpRequest(BaseModel):
    phone_number: str

class VerifyOtpRequest(BaseModel):
    phone_number: str
    otp_code: str

class VerifyOtpResponse(BaseModel):
    success: bool
    verification_token: str
