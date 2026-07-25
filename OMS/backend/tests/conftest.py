import os
os.environ.setdefault("INTEGRITY_MODE", "development")
os.environ.setdefault("ENV", "development")
os.environ.setdefault("DATABASE_URL", "sqlite:////tmp/oms_router_tests.db")
os.environ.setdefault("FERNET_KEY", "2Jf7oG7N4zFv2j3GmY5V0rLq9xW8pC1aB6dE3hK7nQw=")
os.environ.setdefault("ALLOW_TEST_OTP_ENDPOINT", "true")
os.environ["TESTING"] = "1"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, get_db
from main import app
import models
from utils.auth import get_current_user

DB_FILE = "/tmp/oms_router_tests.db"
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_FILE}"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    Base.metadata.create_all(bind=engine)
    db_session = TestingSessionLocal()

    # Seed test channels
    channels_to_seed = [
        ("MANUAL", "Manual"),
        ("STOREFRONT", "Storefront"),
        ("SHOPEE", "Shopee"),
        ("TIKTOK_SHOP", "TikTok Shop"),
        ("LAZADA", "Lazada"),
    ]
    for code, name in channels_to_seed:
        existing = db_session.query(models.Channel).filter(models.Channel.code == code).first()
        if not existing:
            db_session.add(models.Channel(code=code, name=name, is_active=True))
    db_session.commit()

    try:
        yield db_session
    finally:
        db_session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()
        if os.path.exists(DB_FILE):
            try:
                os.remove(DB_FILE)
            except OSError:
                pass


@pytest.fixture(scope="function")
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: {
        "user_id": "1",
        "username": "admin",
        "role": "admin",
    }
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
