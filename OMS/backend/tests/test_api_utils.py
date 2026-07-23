from datetime import datetime
from utils.api_utils import utcnow, PIM_API_KEY


def test_utcnow():
    now = utcnow()
    assert isinstance(now, datetime)
    assert now.tzinfo is None


def test_api_constants():
    assert PIM_API_KEY is not None
