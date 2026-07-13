import importlib
import os
import sys
from typing import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from sqlalchemy import event
from testcontainers.postgres import PostgresContainer
from tests.factories.product import ProductFactory

@pytest.fixture(autouse=True)
def setup_factories(db_session):
    ProductFactory._meta.sqlalchemy_session = db_session


@pytest.fixture(scope="session")
def postgres_container() -> Generator[PostgresContainer, None, None]:
    if os.environ.get("BYPASS_TESTCONTAINERS") == "true":
        from sqlalchemy import create_engine, text
        url = os.environ.get("TEST_DATABASE_URL", "postgresql://postgres:postgres@db:5432/pim_test_db")
        sys_url = url.rsplit("/", 1)[0] + "/postgres"
        engine = create_engine(sys_url)
        with engine.connect() as conn:
            conn.execute(text("commit"))
            try:
                conn.execute(text("CREATE DATABASE pim_test_db"))
            except Exception:
                pass
        engine.dispose()

        class DummyContainer:
            def get_connection_url(self):
                return url
        yield DummyContainer()
    elif os.environ.get("USE_E2E_COMPOSE") == "true":
        import subprocess
        import time
        compose_file = os.path.join(os.path.dirname(__file__), "../../docker-compose.e2e.yml")
        subprocess.run(["docker", "compose", "-f", compose_file, "up", "-d", "db", "minio"], check=True)
        time.sleep(3) # Wait for containers to be ready
        url = "postgresql://postgres:postgres@localhost:15434/pim_e2e_db"
        class E2EContainer:
            def get_connection_url(self):
                return url
        yield E2EContainer()
        subprocess.run(["docker", "compose", "-f", compose_file, "down", "-v"])
    else:
        with PostgresContainer(
            "postgres:16-alpine",
            username="postgres",
            password="postgres",
            dbname="pim_test_db",
        ) as container:
            yield container


@pytest.fixture(scope="session")
def app_module(postgres_container):
    os.environ["DATABASE_URL"] = postgres_container.get_connection_url()
    os.environ["TESTING"] = "true"

    for mod_name in list(sys.modules.keys()):
        if (
            mod_name.startswith("routers")
            or mod_name.startswith("services")
            or mod_name.startswith("utils")
            or mod_name in ["main", "database", "models", "schemas", "minio_client"]
        ):
            sys.modules.pop(mod_name, None)

    module = importlib.import_module("main")
    return module


@pytest.fixture(scope="session", autouse=True)
def setup_database(app_module):
    """Create tables once per test session."""
    importlib.import_module("models")
    database_module = importlib.import_module("database")
    database_module.Base.metadata.drop_all(bind=database_module.engine)
    database_module.Base.metadata.create_all(bind=database_module.engine)


@pytest.fixture()
def mock_minio(mocker):
    minio_client = importlib.import_module("minio_client")
    mocker.patch.object(minio_client, "init_bucket", return_value=None)
    return mocker.patch.object(
        minio_client,
        "upload_file",
        return_value="http://localhost:19005/pim-media/test-image.jpg",
    )


@pytest.fixture()
def db_session(app_module):
    """
    Provide a transactional database session.
    Rolls back any changes after the test finishes, avoiding expensive drop/create.
    """
    database_module = importlib.import_module("database")
    connection = database_module.engine.connect()
    transaction = connection.begin()
    
    testing_session_local = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=connection,
    )
    session = testing_session_local()
    
    # We use a nested transaction so that application code can commit
    # without actually committing to the database.
    nested = connection.begin_nested()
    
    @event.listens_for(session, "after_transaction_end")
    def end_savepoint(session, transaction):
        nonlocal nested
        if not nested.is_active:
            nested = connection.begin_nested()

    yield session
    
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture()
def client(app_module, mock_minio, db_session) -> Generator[TestClient, None, None]:
    def override_get_db():
        yield db_session
        
    def override_get_identity():
        from utils.context import actor_username_var, actor_type_var
        actor_username_var.set("test_admin")
        actor_type_var.set("USER")
        # Return a dummy identity dictionary
        return {"actor_type": "USER", "actor_username": "test_admin", "user": type("MockUser", (), {"role": "admin", "username": "test_admin"})()}

    database_module = importlib.import_module("database")
    dependency_module = importlib.import_module("utils.dependency")
    
    app_module.app.dependency_overrides[database_module.get_db] = override_get_db
    # Override identity check so normal integration tests pass without a real JWT
    app_module.app.dependency_overrides[dependency_module.get_current_identity] = override_get_identity

    with TestClient(app_module.app) as test_client:
        yield test_client

    app_module.app.dependency_overrides.clear()


@pytest.fixture()
def client_no_auth_override(app_module, mock_minio, db_session) -> Generator[TestClient, None, None]:
    def override_get_db():
        yield db_session

    database_module = importlib.import_module("database")
    
    app_module.app.dependency_overrides[database_module.get_db] = override_get_db

    with TestClient(app_module.app) as test_client:
        yield test_client

    app_module.app.dependency_overrides.clear()
