import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request

from utils.api_utils import PIM_API_URL
from utils.auth import get_current_user

logger = logging.getLogger("oms_backend")

router = APIRouter(prefix="/products", tags=["Products"])


@router.get("/search")
def search_products(request: Request, current_user: dict = Depends(get_current_user)):
    params = dict(request.query_params)
    if "search" in params:
        params["q"] = params.pop("search")
    url = f"{PIM_API_URL}/products"
    logger.info(f"Proxying product search to PMI: {url} with params {params}")
    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(url, params=params)
            if resp.is_error:
                raise HTTPException(status_code=resp.status_code, detail=resp.text)
            resp_json = resp.json()
            if isinstance(resp_json, dict) and "items" in resp_json:
                return resp_json["items"]
            return resp_json
    except httpx.HTTPError as e:
        logger.error(f"HTTP error during product search proxy: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to search products: {str(e)}")
