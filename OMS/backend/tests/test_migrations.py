import os
from urllib.parse import quote
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.autogenerate import compare_metadata
from sqlalchemy import Text, create_engine, inspect, text

from database import Base


def _alembic_config() -> Config:
    return Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))


def test_upgrade_head_matches_models_and_is_idempotent(tmp_path, monkeypatch):
    database_url = f"sqlite:///{tmp_path / 'migration.db'}"
    monkeypatch.setenv("DATABASE_URL", database_url)

    command.upgrade(_alembic_config(), "head")
    command.upgrade(_alembic_config(), "head")

    engine = create_engine(database_url)
    with engine.connect() as connection:
        migration_context = MigrationContext.configure(connection)
        assert compare_metadata(migration_context, Base.metadata) == []

        config_value = next(
            column
            for column in inspect(connection).get_columns("system_configs")
            if column["name"] == "config_value"
        )
        assert isinstance(config_value["type"], Text)
        assert config_value["type"].length is None


def test_upgrade_head_repairs_existing_postgres_schema_without_data_loss(monkeypatch):
    """Exercise the production rollout path: existing tables, no version row."""
    postgres_url = os.getenv("OMS_TEST_POSTGRES_URL")
    if not postgres_url:
        pytest.skip("set OMS_TEST_POSTGRES_URL to run the PostgreSQL migration test")

    schema_name = f"oms_migration_{uuid4().hex}"
    admin_engine = create_engine(postgres_url)
    search_path = quote(f"-csearch_path={schema_name}")
    test_url = f"{postgres_url}{'&' if '?' in postgres_url else '?'}options={search_path}"
    test_engine = None

    try:
        with admin_engine.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema_name}"'))

        test_engine = create_engine(test_url)
        Base.metadata.create_all(bind=test_engine)
        preserved_values = {
            "zalo_app_id": "a" * 480,
            "zalo_refresh_token": "b" * 500,
        }
        with test_engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE system_configs ALTER COLUMN config_value TYPE VARCHAR(500)")
            )
            connection.execute(text("DROP INDEX ix_otp_verifications_zalo_message_id"))
            connection.execute(
                text("ALTER TABLE otp_verifications DROP COLUMN zalo_message_id")
            )
            connection.execute(
                text("ALTER TABLE customers DROP COLUMN IF EXISTS is_deleted")
            )
            connection.execute(
                text("ALTER TABLE customers DROP COLUMN IF EXISTS deleted_at")
            )
            connection.execute(
                text(
                    "INSERT INTO system_configs (config_key, config_value) "
                    "VALUES (:key, :value)"
                ),
                [
                    {"key": key, "value": value}
                    for key, value in preserved_values.items()
                ],
            )

        # Alembic's ConfigParser interpolation requires percent signs in an
        # encoded URL to be escaped while env.py copies the value into config.
        monkeypatch.setenv("DATABASE_URL", test_url.replace("%", "%%"))
        command.upgrade(_alembic_config(), "head")
        command.upgrade(_alembic_config(), "head")

        with test_engine.connect() as connection:
            columns = {
                column["name"]: column for column in inspect(connection).get_columns("system_configs")
            }
            assert isinstance(columns["config_value"]["type"], Text)
            assert columns["config_value"]["type"].length is None

            actual_values = dict(
                connection.execute(
                    text(
                        "SELECT config_key, config_value FROM system_configs "
                        "WHERE config_key IN ('zalo_app_id', 'zalo_refresh_token')"
                    )
                ).all()
            )
            assert actual_values == preserved_values

            otp_columns = {
                column["name"] for column in inspect(connection).get_columns("otp_verifications")
            }
            assert "zalo_message_id" in otp_columns
            assert any(
                index["name"] == "ix_otp_verifications_zalo_message_id"
                for index in inspect(connection).get_indexes("otp_verifications")
            )

            customer_columns = {
                column["name"] for column in inspect(connection).get_columns("customers")
            }
            assert "is_deleted" in customer_columns
            assert "deleted_at" in customer_columns
    finally:
        if test_engine is not None:
            test_engine.dispose()
        with admin_engine.begin() as connection:
            connection.execute(text(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE'))
        admin_engine.dispose()
