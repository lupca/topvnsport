import re
import unicodedata
from typing import Optional

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
