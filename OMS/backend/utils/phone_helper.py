import re

def normalize_phone(phone: str) -> str:
    """
    Normalize phone number to format 84xxxxxxxxx.
    Strips leading 0, +, spaces, and hyphens.
    """
    if not phone:
        return ""
    digits = re.sub(r"\D", "", phone)
    if digits.startswith("84"):
        return digits
    if digits.startswith("0"):
        return "84" + digits[1:]
    return "84" + digits
