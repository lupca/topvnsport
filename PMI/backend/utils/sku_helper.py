import re
import unicodedata
import random
import string
from typing import Optional


def generate_random_suffix(length: int = 4) -> str:
    """Generate random alphanumeric suffix (uppercase only, no ambiguous chars)."""
    # Exclude ambiguous characters: 0, O, I, L
    chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
    return ''.join(random.choice(chars) for _ in range(length))


def clean_text_for_code(text: str, max_length: int = 30) -> str:
    """Clean Vietnamese text to ASCII uppercase, suitable for codes."""
    if not text:
        return ""
    text = text.replace('đ', 'd').replace('Đ', 'd')
    text = unicodedata.normalize('NFKD', text)
    text = text.encode('ascii', 'ignore').decode('ascii')
    text = text.upper()
    text = re.sub(r'[^A-Z0-9]+', '-', text)
    text = text.strip('-')
    # Truncate to max_length, but don't cut in the middle of a word
    if len(text) > max_length:
        text = text[:max_length].rsplit('-', 1)[0]
    return text


def generate_product_code(category_code: str, product_name: str, random_length: int = 4) -> str:
    """
    Generate product code from category code + product name + random suffix.

    Example:
        category_code="VCL", product_name="Vợt Yonex Astrox 77"
        -> "VCL-YONEX-ASTROX-77-A7K9"

    Total max length ~40 chars (safe for all platforms)
    """
    # Clean category code (max 5 chars)
    cat = clean_text_for_code(category_code, max_length=5) or "PRD"

    # Clean product name (max 25 chars to leave room for cat + random)
    name = clean_text_for_code(product_name, max_length=25)

    # Generate random suffix
    suffix = generate_random_suffix(random_length)

    if name:
        return f"{cat}-{name}-{suffix}"
    else:
        return f"{cat}-{suffix}"


def clean_option_for_sku(text: str) -> str:
    if not text:
        return ""
    text = text.replace('đ', 'd').replace('Đ', 'd')
    text = unicodedata.normalize('NFKD', text)
    text = text.encode('ascii', 'ignore').decode('ascii')
    text = text.upper()
    text = re.sub(r'[^A-Z0-9]+', '-', text)
    return text.strip('-')

def generate_sku_code(product_code: str, t1: Optional[str] = None, t2: Optional[str] = None) -> str:
    parts = [product_code.upper()]
    if t1:
        cleaned_t1 = clean_option_for_sku(t1)
        if cleaned_t1:
            parts.append(cleaned_t1)
    if t2:
        cleaned_t2 = clean_option_for_sku(t2)
        if cleaned_t2:
            parts.append(cleaned_t2)
    if len(parts) == 1:
        parts.append("DEFAULT")
    return "-".join(parts)
