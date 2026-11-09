"""Internal service-to-service token handling for the Identity service.

Identity only *receives* the shared ``INTERNAL_SERVICE_TOKEN`` (e.g. PMI's
seller-membership check). It is optional here: when it is not configured, the
internal endpoints answer 503 instead of falling back to any built-in value.
The ``vk_`` prefix is reserved for external API keys, so a token using it is
rejected at startup to keep the two credential types impossible to confuse.
"""
import os
import secrets
from typing import Optional

from fastapi import Header, HTTPException, status

from utils.api_keys import API_KEY_NAMESPACE


def _load_internal_service_token() -> Optional[str]:
    token = os.getenv("INTERNAL_SERVICE_TOKEN", "").strip()
    if not token:
        return None
    if token.startswith(API_KEY_NAMESPACE):
        raise RuntimeError(
            "INTERNAL_SERVICE_TOKEN must not start with 'vk_' "
            "(prefix reserved for external seller API keys)"
        )
    return token


INTERNAL_SERVICE_TOKEN = _load_internal_service_token()


def require_internal_service(x_api_key: Optional[str] = Header(None)) -> None:
    if INTERNAL_SERVICE_TOKEN is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="INTERNAL_SERVICE_TOKEN is not configured on Identity",
        )
    if not x_api_key or x_api_key.startswith(API_KEY_NAMESPACE) or not secrets.compare_digest(
        x_api_key.encode("utf-8"), INTERNAL_SERVICE_TOKEN.encode("utf-8")
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal service credentials",
        )
