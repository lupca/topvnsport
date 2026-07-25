# OMS backend database migrations

The OMS schema is managed by Alembic. The application no longer calls
`Base.metadata.create_all()` at startup and must not be used to apply schema
changes.

Run commands from `OMS/backend` with `DATABASE_URL` and `FERNET_KEY` set:

```bash
alembic upgrade head
alembic current
alembic revision --autogenerate -m "describe the schema change"
```

For an existing database, `alembic upgrade head` is safe even when the schema
predates Alembic: the baseline checks for existing tables and indexes, then
applies the drift-fixing revisions. A manually verified baseline can also be
stamped before upgrading:

```bash
alembic stamp 0001_baseline
alembic upgrade head
```

The backend container runs `alembic upgrade head` before Uvicorn starts, so a
new local or CI environment is initialized automatically. Do not run
`Base.metadata.create_all()` to apply schema changes.

Alembic imports the models, so `FERNET_KEY` is required even when generating
or applying a migration. To test the production-shaped existing-schema path,
provide a disposable PostgreSQL URL via `OMS_TEST_POSTGRES_URL` when running
`tests/test_migrations.py`.
