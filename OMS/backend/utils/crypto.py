import os
from cryptography.fernet import Fernet

def get_fernet() -> Fernet:
    key = os.getenv("FERNET_KEY")
    if not key:
        key = "lz_K8Z8d1d-0iO-4yN2Vb11234567890abcdefghijk="
    return Fernet(key.encode() if isinstance(key, str) else key)

def encrypt_value(value: str) -> str:
    if not value:
        return value
    return get_fernet().encrypt(value.encode()).decode()

def decrypt_value(encrypted_value: str) -> str:
    if not encrypted_value:
        return encrypted_value
    try:
        return get_fernet().decrypt(encrypted_value.encode()).decode()
    except Exception as e:
        raise ValueError(f"Decryption failed: {e}")
