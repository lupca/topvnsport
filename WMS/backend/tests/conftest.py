import os
import sys

DB_FILE = "/tmp/test_wms_subdir.db"
DEFAULT_PG_URL = "postgresql://postgres:postgres@localhost:15435/wms_db"

def get_database_url():
    url = os.getenv("TEST_DATABASE_URL") or os.getenv("DATABASE_URL")
    if url:
        return url
    try:
        from sqlalchemy import create_engine
        temp_engine = create_engine(DEFAULT_PG_URL, connect_args={"connect_timeout": 2})
        with temp_engine.connect() as conn:
            pass
        temp_engine.dispose()
        return DEFAULT_PG_URL
    except Exception:
        return f"sqlite:///{DB_FILE}"

SQLALCHEMY_DATABASE_URL = get_database_url()
os.environ["DATABASE_URL"] = SQLALCHEMY_DATABASE_URL

# Add WMS/backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, get_db
from utils.auth import get_current_user
from main import app
import models

if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db_session = TestingSessionLocal()
    try:
        yield db_session
    finally:
        db_session.close()
        engine.dispose()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()
        if SQLALCHEMY_DATABASE_URL.startswith("sqlite") and os.path.exists(DB_FILE):
            try:
                os.remove(DB_FILE)
            except OSError:
                pass

@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: {"user_id": "1", "username": "admin"}
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture(scope="function")
def sample_inbound_shipment(db_session):
    # Seed a warehouse first since warehouse is ForeignKey
    wh = models.Warehouse(code="WH-TEST", name="Test WH")
    db_session.add(wh)
    db_session.commit()
    
    shipment = models.InboundShipment(
        inbound_number="INB-12345",
        warehouse_id=wh.id,
        supplier_name="NCC Test",
        status="pending"
    )
    db_session.add(shipment)
    db_session.commit()
    db_session.refresh(shipment)
    return shipment
