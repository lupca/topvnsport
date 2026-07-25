import os
import logging
from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)


def get_fernet() -> Fernet:
    key = os.getenv("FERNET_KEY")
    if not key:
        raise RuntimeError("FERNET_KEY environment variable is required")
    try:
        return Fernet(key.encode() if isinstance(key, str) else key)
    except (TypeError, ValueError) as exc:
        raise RuntimeError("FERNET_KEY must be a valid Fernet key") from exc

def encrypt_value(value: str) -> str:
    if not value:
        return value
    return get_fernet().encrypt(value.encode()).decode()

def decrypt_value(encrypted_value: str) -> str:
    if not encrypted_value:
        return encrypted_value
    try:
        return get_fernet().decrypt(encrypted_value.encode()).decode()
    except Exception as exc:
        logger.exception("Failed to decrypt an encrypted value")
        raise ValueError("Fernet decryption failed") from exc
