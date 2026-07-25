import os

from alembic import command
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.autogenerate import compare_metadata
from sqlalchemy import Text, create_engine, inspect

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
