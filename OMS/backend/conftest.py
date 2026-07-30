"""OMS-wide pytest fixtures.

These live above both ``test_main.py`` and ``tests/`` so the documented test
command can move between those paths without pytest unloading the fixtures.
"""

import os

os.environ.setdefault("INTEGRITY_MODE", "development")
os.environ.setdefault("ENV", "development")
os.environ.setdefault("DATABASE_URL", "sqlite:////tmp/oms_backend_tests.db")
os.environ.setdefault(
    "FERNET_KEY",
    "2Jf7oG7N4zFv2j3GmY5V0rLq9xW8pC1aB6dE3hK7nQw=",
)
os.environ.setdefault("ALLOW_TEST_OTP_ENDPOINT", "true")
os.environ["TESTING"] = "1"

TEST_TENANT_ID = "eadb17a4-1b2d-5ffd-8d99-6091f167aeef"
TEST_SELLER_ID = "f02a9c68-f656-5597-9f9b-7c8e28e3705d"
os.environ.setdefault("OMS_PUBLIC_TENANT_ID", TEST_TENANT_ID)
os.environ.setdefault("OMS_PUBLIC_SELLER_ID", TEST_SELLER_ID)

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import models
from database import Base, get_db
from main import app
from utils.auth import get_current_user
from utils.tenant_context import reset_tenant_context, set_tenant_context


DB_FILE = "/tmp/oms_backend_tests.db"
engine = create_engine(
    f"sqlite:///{DB_FILE}",
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


@pytest.fixture(scope="function", autouse=True)
def oms_default_tenant_scope():
    token = set_tenant_context(TEST_TENANT_ID, TEST_SELLER_ID)
    try:
        yield
    finally:
        reset_tenant_context(token)


@pytest.fixture(scope="function")
def db(oms_default_tenant_scope):
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    for code, name in (
        ("MANUAL", "Manual"),
        ("STOREFRONT", "Storefront"),
        ("SHOPEE", "Shopee"),
        ("TIKTOK_SHOP", "TikTok Shop"),
        ("LAZADA", "Lazada"),
    ):
        if not session.query(models.Channel).filter(
            models.Channel.code == code
        ).first():
            session.add(models.Channel(code=code, name=name, is_active=True))
    session.commit()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()
        try:
            os.remove(DB_FILE)
        except FileNotFoundError:
            pass


@pytest.fixture(scope="function")
def client(db):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: {
        "user_id": "1",
        "username": "admin",
        "role": "admin",
    }
    with TestClient(app) as test_client:
        test_client.headers.update(
            {
                "X-User-Id": "1",
                "X-User-Username": "admin",
                "X-Tenant-Id": TEST_TENANT_ID,
                "X-Seller-Id": TEST_SELLER_ID,
            }
        )
        yield test_client
    app.dependency_overrides.clear()
