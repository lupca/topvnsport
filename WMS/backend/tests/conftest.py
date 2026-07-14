import os
import sys
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add WMS/backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database import Base, get_db
from main import app
import models

DB_FILE = "/tmp/test_wms_subdir.db"
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_FILE}"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db_session = TestingSessionLocal()
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
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
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
