import os
import sys

DB_FILE = "/tmp/test_wms_subdir.db"
DEFAULT_TEST_PG_URL = "postgresql://postgres:postgres@localhost:15435/wms_test_db"

def get_database_url():
    test_url = os.getenv("TEST_DATABASE_URL")
    if test_url:
        pg_url = test_url
    else:
        env_db_url = os.getenv("DATABASE_URL")
        if env_db_url:
            pg_url = env_db_url
        else:
            pg_url = DEFAULT_TEST_PG_URL

    if "sqlite" in pg_url:
        return pg_url

    if "/wms_db" in pg_url:
        pg_url = pg_url.replace("/wms_db", "/wms_test_db")
    elif not pg_url.endswith("/wms_test_db") and "postgresql" in pg_url:
        parts = pg_url.rsplit('/', 1)
        pg_url = f"{parts[0]}/wms_test_db"

    try:
        from sqlalchemy import create_engine
        temp_engine = create_engine(pg_url, connect_args={"connect_timeout": 2})
        with temp_engine.connect() as conn:
            pass
        temp_engine.dispose()
        return pg_url
    except Exception:
        try:
            from sqlalchemy import create_engine, text
            base_pg = pg_url.rsplit('/', 1)[0] + '/postgres'
            admin_engine = create_engine(base_pg, connect_args={"connect_timeout": 2}, isolation_level="AUTOCOMMIT")
            with admin_engine.connect() as conn:
                db_name = pg_url.rsplit('/', 1)[1]
                conn.execute(text(f"CREATE DATABASE {db_name}"))
            admin_engine.dispose()
            return pg_url
        except Exception:
            pass

    return f"sqlite:///{DB_FILE}"

SQLALCHEMY_DATABASE_URL = get_database_url()
os.environ["DATABASE_URL"] = SQLALCHEMY_DATABASE_URL

if "wms_db" in SQLALCHEMY_DATABASE_URL and "wms_test_db" not in SQLALCHEMY_DATABASE_URL:
    raise RuntimeError(f"CRITICAL SAFETY ERROR: Test database URL points to live database '{SQLALCHEMY_DATABASE_URL}'!")

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
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False, "timeout": 30}
    )
else:
    engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    if "wms_db" in SQLALCHEMY_DATABASE_URL and "wms_test_db" not in SQLALCHEMY_DATABASE_URL:
        raise RuntimeError("Refusing to run tests or drop tables on live database!")
    Base.metadata.create_all(bind=engine)
    db_session = TestingSessionLocal()
    try:
        yield db_session
    finally:
        db_session.close()
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
