import importlib
import os
import sys
from typing import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from testcontainers.postgres import PostgresContainer


@pytest.fixture(scope="session")
def postgres_container() -> Generator[PostgresContainer, None, None]:
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

    for mod_name in ["main", "database", "models", "schemas", "minio_client"]:
        sys.modules.pop(mod_name, None)

    module = importlib.import_module("main")
    return module


@pytest.fixture(autouse=True)
def reset_database(app_module):
    database_module = importlib.import_module("database")
    database_module.Base.metadata.drop_all(bind=database_module.engine)
    database_module.Base.metadata.create_all(bind=database_module.engine)


@pytest.fixture()
def mock_minio(app_module, mocker):
    mocker.patch.object(app_module.minio_client, "init_bucket", return_value=None)
    return mocker.patch.object(
        app_module.minio_client,
        "upload_file",
        return_value="http://localhost:19005/pim-media/test-image.jpg",
    )


@pytest.fixture()
def client(app_module, mock_minio) -> Generator[TestClient, None, None]:
    database_module = importlib.import_module("database")
    testing_session_local = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=database_module.engine,
    )

    def override_get_db():
        db = testing_session_local()
        try:
            yield db
        finally:
            db.close()

    app_module.app.dependency_overrides[app_module.get_db] = override_get_db

    with TestClient(app_module.app) as test_client:
        yield test_client

    app_module.app.dependency_overrides.clear()


@pytest.fixture()
def db_session(app_module):
    database_module = importlib.import_module("database")
    testing_session_local = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=database_module.engine,
    )
    db = testing_session_local()
    try:
        yield db
    finally:
        db.close()
