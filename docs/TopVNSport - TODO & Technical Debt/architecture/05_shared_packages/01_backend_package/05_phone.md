# Backend Package: Phone Module

## Task ID: BE-05
## Prerequisites: BE-00 (Setup)
## Estimated: 1 hour

---

## Mục Tiêu

Tạo phone number utilities với:
- Normalization (remove formatting)
- Validation (Vietnam phone numbers)
- Formatting for display

---

## Implementation

### File: `packages/backend-common/topvnsport_common/phone.py`

```python
"""Phone number utilities for Vietnam phone numbers."""

import re
from typing import Optional

import phonenumbers
from phonenumbers import NumberParseException


# Vietnam country code
VIETNAM_COUNTRY_CODE = "VN"
VIETNAM_DIAL_CODE = "84"

# Valid Vietnam mobile prefixes (after removing 0 or +84)
VIETNAM_MOBILE_PREFIXES = [
    # Viettel
    "32", "33", "34", "35", "36", "37", "38", "39", "86", "96", "97", "98",
    # Vinaphone
    "81", "82", "83", "84", "85", "88", "91", "94",
    # Mobifone
    "70", "76", "77", "78", "79", "89", "90", "93",
    # Vietnamobile
    "52", "56", "58", "92",
    # Gmobile
    "59", "99",
    # Itelecom
    "87",
]


def normalize_phone(
    phone: str,
    country_code: str = VIETNAM_DIAL_CODE,
    keep_country_code: bool = True,
) -> Optional[str]:
    """
    Normalize phone number to standard format.
    
    Removes spaces, dashes, parentheses and normalizes country code.
    
    Args:
        phone: Phone number in any format
        country_code: Default country code if not present
        keep_country_code: Whether to include country code in output
    
    Returns:
        Normalized phone number or None if invalid
    
    Examples:
        normalize_phone("+84 912 345 678") -> "84912345678"
        normalize_phone("0912345678") -> "84912345678"
        normalize_phone("0912345678", keep_country_code=False) -> "912345678"
    """
    if not phone:
        return None
    
    # Remove all non-digit characters except leading +
    cleaned = re.sub(r"[^\d+]", "", phone)
    
    # Handle empty after cleaning
    if not cleaned:
        return None
    
    # Remove leading + if present
    if cleaned.startswith("+"):
        cleaned = cleaned[1:]
    
    # Handle leading 0 (local format)
    if cleaned.startswith("0"):
        cleaned = country_code + cleaned[1:]
    
    # Handle if country code is missing
    if not cleaned.startswith(country_code):
        cleaned = country_code + cleaned
    
    # Validate length (Vietnam: 84 + 9-10 digits)
    if len(cleaned) < 11 or len(cleaned) > 12:
        return None
    
    if keep_country_code:
        return cleaned
    else:
        return cleaned[len(country_code):]


def validate_phone(phone: str) -> bool:
    """
    Validate if phone number is a valid Vietnam phone number.
    
    Args:
        phone: Phone number (any format)
    
    Returns:
        True if valid Vietnam phone number, False otherwise
    """
    try:
        # Try to parse with phonenumbers library
        parsed = phonenumbers.parse(phone, VIETNAM_COUNTRY_CODE)
        
        # Check if valid and is Vietnam number
        if not phonenumbers.is_valid_number(parsed):
            return False
        
        if phonenumbers.region_code_for_number(parsed) != VIETNAM_COUNTRY_CODE:
            return False
        
        return True
    except NumberParseException:
        return False


def validate_mobile(phone: str) -> bool:
    """
    Validate if phone number is a valid Vietnam mobile number.
    
    Args:
        phone: Phone number (any format)
    
    Returns:
        True if valid Vietnam mobile number, False otherwise
    """
    # First check basic validity
    if not validate_phone(phone):
        return False
    
    # Normalize to check prefix
    normalized = normalize_phone(phone, keep_country_code=False)
    if not normalized:
        return False
    
    # Check mobile prefix
    prefix = normalized[:2]
    return prefix in VIETNAM_MOBILE_PREFIXES


def format_phone(
    phone: str,
    format_type: str = "international",
) -> Optional[str]:
    """
    Format phone number for display.
    
    Args:
        phone: Phone number (any format)
        format_type: One of "international", "national", "e164"
    
    Returns:
        Formatted phone number or None if invalid
    
    Examples:
        format_phone("84912345678", "international") -> "+84 91 234 5678"
        format_phone("84912345678", "national") -> "091 234 5678"
        format_phone("84912345678", "e164") -> "+84912345678"
    """
    try:
        parsed = phonenumbers.parse(phone, VIETNAM_COUNTRY_CODE)
        
        if not phonenumbers.is_valid_number(parsed):
            return None
        
        if format_type == "international":
            return phonenumbers.format_number(
                parsed, phonenumbers.PhoneNumberFormat.INTERNATIONAL
            )
        elif format_type == "national":
            return phonenumbers.format_number(
                parsed, phonenumbers.PhoneNumberFormat.NATIONAL
            )
        elif format_type == "e164":
            return phonenumbers.format_number(
                parsed, phonenumbers.PhoneNumberFormat.E164
            )
        else:
            return None
    except NumberParseException:
        return None


def get_carrier(phone: str) -> Optional[str]:
    """
    Get carrier name for Vietnam mobile number.
    
    Args:
        phone: Phone number (any format)
    
    Returns:
        Carrier name or None if unknown
    """
    normalized = normalize_phone(phone, keep_country_code=False)
    if not normalized:
        return None
    
    prefix = normalized[:2]
    
    carriers = {
        "Viettel": ["32", "33", "34", "35", "36", "37", "38", "39", "86", "96", "97", "98"],
        "Vinaphone": ["81", "82", "83", "84", "85", "88", "91", "94"],
        "Mobifone": ["70", "76", "77", "78", "79", "89", "90", "93"],
        "Vietnamobile": ["52", "56", "58", "92"],
        "Gmobile": ["59", "99"],
        "Itelecom": ["87"],
    }
    
    for carrier, prefixes in carriers.items():
        if prefix in prefixes:
            return carrier
    
    return None
```

---

## Test Cases

### File: `packages/backend-common/tests/unit/test_phone.py`

```python
"""Tests for phone module."""

import pytest

from topvnsport_common.phone import (
    normalize_phone,
    validate_phone,
    validate_mobile,
    format_phone,
    get_carrier,
)


class TestNormalizePhone:
    """Tests for normalize_phone()."""

    def test_normalize_with_country_code(self):
        """Should normalize +84 format."""
        # Given
        phone = "+84 912 345 678"
        
        # When
        result = normalize_phone(phone)
        
        # Then
        assert result == "84912345678"

    def test_normalize_with_leading_zero(self):
        """Should normalize 0xxx format."""
        # Given
        phone = "0912345678"
        
        # When
        result = normalize_phone(phone)
        
        # Then
        assert result == "84912345678"

    def test_removes_spaces_and_dashes(self):
        """Should remove formatting characters."""
        # Given
        phone = "091-234-5678"
        
        # When
        result = normalize_phone(phone)
        
        # Then
        assert result == "84912345678"

    def test_handles_parentheses(self):
        """Should handle (xxx) format."""
        # Given
        phone = "(091) 234-5678"
        
        # When
        result = normalize_phone(phone)
        
        # Then
        assert result == "84912345678"

    def test_without_country_code(self):
        """Should return without country code when requested."""
        # Given
        phone = "0912345678"
        
        # When
        result = normalize_phone(phone, keep_country_code=False)
        
        # Then
        assert result == "912345678"

    def test_empty_string_returns_none(self):
        """Should return None for empty string."""
        assert normalize_phone("") is None
        assert normalize_phone("   ") is None

    def test_invalid_length_returns_none(self):
        """Should return None for invalid length."""
        assert normalize_phone("123") is None
        assert normalize_phone("0912345678901234567") is None

    def test_handles_dots(self):
        """Should handle dot separators."""
        # Given
        phone = "091.234.5678"
        
        # When
        result = normalize_phone(phone)
        
        # Then
        assert result == "84912345678"


class TestValidatePhone:
    """Tests for validate_phone()."""

    def test_valid_vietnam_mobile(self):
        """Should validate Vietnam mobile numbers."""
        # Valid Viettel
        assert validate_phone("0912345678") is True
        assert validate_phone("+84912345678") is True
        assert validate_phone("84912345678") is True

    def test_valid_vietnam_landline(self):
        """Should validate Vietnam landline."""
        # Hanoi landline
        assert validate_phone("+84 24 1234 5678") is True

    def test_invalid_too_short(self):
        """Should reject numbers too short."""
        assert validate_phone("84123") is False

    def test_invalid_too_long(self):
        """Should reject numbers too long."""
        assert validate_phone("84912345678901") is False

    def test_invalid_country_code(self):
        """Should reject non-Vietnam numbers."""
        # US number
        assert validate_phone("+1 555 123 4567") is False

    def test_invalid_format(self):
        """Should reject invalid format."""
        assert validate_phone("not-a-number") is False
        assert validate_phone("abc123") is False

    def test_empty_string(self):
        """Should reject empty string."""
        assert validate_phone("") is False


class TestValidateMobile:
    """Tests for validate_mobile()."""

    def test_valid_viettel(self):
        """Should validate Viettel mobile."""
        assert validate_mobile("0961234567") is True
        assert validate_mobile("0321234567") is True

    def test_valid_vinaphone(self):
        """Should validate Vinaphone mobile."""
        assert validate_mobile("0911234567") is True
        assert validate_mobile("0811234567") is True

    def test_valid_mobifone(self):
        """Should validate Mobifone mobile."""
        assert validate_mobile("0901234567") is True
        assert validate_mobile("0701234567") is True

    def test_valid_vietnamobile(self):
        """Should validate Vietnamobile."""
        assert validate_mobile("0521234567") is True
        assert validate_mobile("0921234567") is True

    def test_landline_rejected(self):
        """Should reject landline numbers."""
        # Hanoi landline
        assert validate_mobile("+84 24 1234 5678") is False

    def test_invalid_prefix(self):
        """Should reject invalid mobile prefix."""
        assert validate_mobile("0001234567") is False


class TestFormatPhone:
    """Tests for format_phone()."""

    def test_format_international(self):
        """Should format as international."""
        # Given
        phone = "84912345678"
        
        # When
        result = format_phone(phone, "international")
        
        # Then
        assert result == "+84 91 234 56 78"

    def test_format_national(self):
        """Should format as national."""
        # Given
        phone = "84912345678"
        
        # When
        result = format_phone(phone, "national")
        
        # Then
        assert result == "091 234 56 78"

    def test_format_e164(self):
        """Should format as E.164."""
        # Given
        phone = "0912345678"
        
        # When
        result = format_phone(phone, "e164")
        
        # Then
        assert result == "+84912345678"

    def test_invalid_phone_returns_none(self):
        """Should return None for invalid phone."""
        assert format_phone("invalid") is None

    def test_invalid_format_type_returns_none(self):
        """Should return None for invalid format type."""
        assert format_phone("0912345678", "unknown") is None


class TestGetCarrier:
    """Tests for get_carrier()."""

    def test_viettel(self):
        """Should identify Viettel numbers."""
        assert get_carrier("0961234567") == "Viettel"
        assert get_carrier("0321234567") == "Viettel"
        assert get_carrier("0971234567") == "Viettel"

    def test_vinaphone(self):
        """Should identify Vinaphone numbers."""
        assert get_carrier("0911234567") == "Vinaphone"
        assert get_carrier("0811234567") == "Vinaphone"

    def test_mobifone(self):
        """Should identify Mobifone numbers."""
        assert get_carrier("0901234567") == "Mobifone"
        assert get_carrier("0891234567") == "Mobifone"

    def test_vietnamobile(self):
        """Should identify Vietnamobile numbers."""
        assert get_carrier("0521234567") == "Vietnamobile"
        assert get_carrier("0921234567") == "Vietnamobile"

    def test_gmobile(self):
        """Should identify Gmobile numbers."""
        assert get_carrier("0591234567") == "Gmobile"
        assert get_carrier("0991234567") == "Gmobile"

    def test_itelecom(self):
        """Should identify Itelecom numbers."""
        assert get_carrier("0871234567") == "Itelecom"

    def test_unknown_prefix(self):
        """Should return None for unknown prefix."""
        assert get_carrier("0001234567") is None

    def test_invalid_phone(self):
        """Should return None for invalid phone."""
        assert get_carrier("invalid") is None
```

---

## Verification

```bash
cd packages/backend-common

# Run phone tests
pytest tests/unit/test_phone.py -v

# Run with coverage
pytest tests/unit/test_phone.py --cov=topvnsport_common.phone --cov-report=term-missing

# Expected coverage: 100%
```

---

## Checklist

- [ ] phone.py implemented
- [ ] normalize_phone() with formatting removal
- [ ] validate_phone() with phonenumbers library
- [ ] validate_mobile() for Vietnam mobile only
- [ ] format_phone() with international/national/e164
- [ ] get_carrier() for carrier identification
- [ ] All 32 test cases pass
- [ ] 100% code coverage
- [ ] Handles all Vietnam carrier prefixes
