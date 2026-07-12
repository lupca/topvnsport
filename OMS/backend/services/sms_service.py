import httpx
import base64
from utils.phone_helper import normalize_phone
from utils.crypto import decrypt_value

async def send_speed_sms(phone: str, otp: str, decrypted_token: str) -> dict:
    """
    Sends an OTP code via SpeedSMS API using HTTPX.
    """
    normalized_phone = normalize_phone(phone)
    url = "https://api.speedsms.vn/index.php/sms/send"
    
    # Basic Authorization encoding: {token}:x
    auth_str = f"{decrypted_token}:x"
    auth_b64 = base64.b64encode(auth_str.encode("utf-8")).decode("utf-8")
    
    headers = {
        "Authorization": f"Basic {auth_b64}",
        "Content-Type": "application/json"
    }
    
    content = f"Ma OTP cua ban la {otp}. Hieu luc trong 5 phut."
    payload = {
        "to": [normalized_phone],
        "content": content,
        "sms_type": 2  # CSKH / Transactional OTP
    }
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp_json = resp.json()
            
            if resp.status_code == 200 and resp_json.get("code") == "00":
                return {
                    "status": "success",
                    "provider_response": resp_json,
                    "failed_reason": None
                }
            else:
                return {
                    "status": "failed",
                    "provider_response": resp_json,
                    "failed_reason": resp_json.get("message", "API response error")
                }
    except Exception as e:
        return {
            "status": "failed",
            "provider_response": str(e),
            "failed_reason": f"Connection exception: {str(e)}"
        }
