from __future__ import with_statement

import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from database import Base
import models  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

from core.config import DATABASE_URL

config.set_main_option(
    "sqlalchemy.url",
    os.getenv("DATABASE_URL", DATABASE_URL),
)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        lock_connection = None
        if connection.dialect.name == "postgresql":
            # Startup migrations can be invoked by both the container entrypoint
            # and deploy_prod.sh. Serialize them so the baseline's existence
            # checks cannot race on a pre-Alembic database.
            lock_connection = connectable.connect()
            lock_connection.exec_driver_sql(
                "SELECT pg_advisory_lock(hashtext('oms-alembic-migrations'))"
            )

        try:
            context.configure(
                connection=connection,
                target_metadata=target_metadata,
                compare_type=True,
            )

            with context.begin_transaction():
                context.run_migrations()
        finally:
            if lock_connection is not None:
                try:
                    lock_connection.exec_driver_sql(
                        "SELECT pg_advisory_unlock(hashtext('oms-alembic-migrations'))"
                    )
                    lock_connection.commit()
                finally:
                    lock_connection.close()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
