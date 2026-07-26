import re

PHONE_REGEX = r"^(0|\+84|84)[35789]\d{8}$"


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
