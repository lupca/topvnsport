import os
import logging
from datetime import datetime, timezone
import httpx
from fastapi import HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger("oms_backend")

PIM_API_URL = os.getenv("PIM_API_URL", os.getenv("PMI_URL", "http://pim-api:8000"))
WMS_API_URL = os.getenv("WMS_API_URL", os.getenv("WMS_URL", "http://wms-api:8002"))
DEFAULT_FULFILLMENT_WAREHOUSE_CODE = os.getenv("FULFILLMENT_WAREHOUSE_CODE", "WH-001")
PIM_API_KEY = os.getenv("PIM_API_KEY", "oms_wms_internal_api_key_secret_2026")


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def call_api(url: str, method: str = "GET", data: dict = None):
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": PIM_API_KEY
    }
    logger.info(f"Initiating inter-service API call: {method} {url}")
    try:
        with httpx.Client(timeout=5.0) as client:
            if method.upper() == "GET":
                resp = client.get(url, headers=headers)
            elif method.upper() == "POST":
                resp = client.post(url, headers=headers, json=data)
            elif method.upper() == "PUT":
                resp = client.put(url, headers=headers, json=data)
            elif method.upper() == "PATCH":
                resp = client.patch(url, headers=headers, json=data)
            elif method.upper() == "DELETE":
                resp = client.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            logger.info(f"Inter-service API call: {method} {url} returned status {resp.status_code}")
            
            if resp.status_code == 204:
                return None
                
            if resp.is_error:
                try:
                    err_detail = resp.json()
                except Exception:
                    err_detail = resp.text
                if isinstance(err_detail, dict) and "detail" in err_detail:
                    detail_msg = err_detail["detail"]
                else:
                    detail_msg = str(err_detail)
                raise HTTPException(status_code=resp.status_code, detail=f"API call failed: {detail_msg}")
                
            return resp.json()
    except httpx.HTTPError as e:
        logger.error(f"HTTP error during inter-service call to {url}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to connect to API: {str(e)}")
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error during inter-service call to {url}: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


async def validation_exception_handler(request, exc: RequestValidationError):
    translated_errors = []
    for err in exc.errors():
        err_type = err.get("type")
        ctx = err.get("ctx") or {}
        msg = err.get("msg", "")
        
        if err_type == "missing":
            translated_msg = "Trường này là bắt buộc"
        elif err_type == "greater_than_equal":
            limit = ctx.get("limit_value") or ctx.get("ge")
            translated_msg = f"Giá trị phải lớn hơn hoặc bằng {limit}"
        elif err_type == "less_than_equal":
            limit = ctx.get("limit_value") or ctx.get("le")
            translated_msg = f"Giá trị phải nhỏ hơn hoặc bằng {limit}"
        elif err_type in ("string_too_short", "too_short"):
            min_length = ctx.get("min_length")
            field_type = ctx.get("field_type", "")
            if field_type == "List" or "List" in msg or "danh sách" in msg.lower():
                translated_msg = f"Danh sách phải chứa ít nhất {min_length} phần tử"
            else:
                translated_msg = f"Độ dài tối thiểu là {min_length} ký tự"
        elif err_type == "string_pattern_mismatch":
            translated_msg = "Định dạng không hợp lệ"
        elif err_type == "value_error":
            if msg.startswith("Value error, "):
                translated_msg = msg[len("Value error, "):]
            else:
                translated_msg = msg
        else:
            translated_msg = msg
            
        translated_errors.append({
            "loc": err.get("loc"),
            "msg": translated_msg,
            "type": err_type
        })
        
    return JSONResponse(
        status_code=422,
        content={"detail": translated_errors}
    )
