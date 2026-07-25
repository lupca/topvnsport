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

For an existing database whose schema is already at the baseline, stamp it
without recreating tables, then apply later revisions:

```bash
alembic stamp 0001_baseline
alembic upgrade head
```

Use `alembic upgrade head` directly only for an empty database. Alembic imports
the models, so `FERNET_KEY` is required even when generating or applying a
migration.
