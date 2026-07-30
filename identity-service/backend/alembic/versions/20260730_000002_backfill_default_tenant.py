"""Backfill the deterministic default tenant and contract staff ownership.

Revision ID: 20260730_000002
Revises: 20260730_000001
Create Date: 2026-07-30

Pass the production tax code with ``-x default_seller_tax_code=<MST>`` (or the
``DEFAULT_SELLER_TAX_CODE`` environment variable).  There is intentionally no
committed fallback value.
"""

from os import environ

from alembic import context, op
import sqlalchemy as sa


revision = "20260730_000002"
down_revision = "20260730_000001"
branch_labels = None
depends_on = None

TENANT_ID = "eadb17a4-1b2d-5ffd-8d99-6091f167aeef"
SELLER_ID = "f02a9c68-f656-5597-9f9b-7c8e28e3705d"


def _tax_code() -> str:
    configured = ""
    try:
        configured = context.get_x_argument(as_dictionary=True).get(
            "default_seller_tax_code", ""
        )
    except (AttributeError, NameError):
        pass
    migration_config = op.get_context().config
    configured = (
        configured
        or (
            migration_config.get_main_option("default_seller_tax_code", "")
            if migration_config is not None
            else ""
        )
        or environ.get("DEFAULT_SELLER_TAX_CODE", "")
    ).strip()
    if not configured:
        raise RuntimeError(
            "default_seller_tax_code is required; pass "
            "'-x default_seller_tax_code=<production MST>'"
        )
    if len(configured) > 100:
        raise RuntimeError("default_seller_tax_code exceeds sellers.tax_code length")
    return configured


def _scalar(bind, sql: str, **params):
    return bind.execute(sa.text(sql), params).scalar()


def _preflight(bind, tax_code: str) -> None:
    conflicts = {
        "default tenant UUID": _scalar(
            bind,
            "SELECT count(*) FROM tenants "
            "WHERE id = :id AND code <> 'topvnsport'",
            id=TENANT_ID,
        ),
        "default tenant code": _scalar(
            bind,
            "SELECT count(*) FROM tenants "
            "WHERE code = 'topvnsport' AND id <> :id",
            id=TENANT_ID,
        ),
        "default seller UUID": _scalar(
            bind,
            "SELECT count(*) FROM sellers WHERE id = :id "
            "AND (tenant_id <> :tenant_id OR tax_code <> :tax_code)",
            id=SELLER_ID,
            tenant_id=TENANT_ID,
            tax_code=tax_code,
        ),
        "default seller natural key": _scalar(
            bind,
            "SELECT count(*) FROM sellers WHERE tenant_id = :tenant_id "
            "AND tax_code = :tax_code AND id <> :id",
            id=SELLER_ID,
            tenant_id=TENANT_ID,
            tax_code=tax_code,
        ),
        "staff with unknown/non-default tenant": _scalar(
            bind,
            "SELECT count(*) FROM staff_accounts s "
            "WHERE s.tenant_id IS NOT NULL AND s.tenant_id <> :tenant_id",
            tenant_id=TENANT_ID,
        ),
    }
    failures = [f"{name}={count}" for name, count in conflicts.items() if count]
    if failures:
        raise RuntimeError("identity ownership preflight failed: " + ", ".join(failures))


def upgrade() -> None:
    bind = op.get_bind()
    tax_code = _tax_code()
    _preflight(bind, tax_code)

    # UPDATE-then-INSERT is portable across PostgreSQL and the SQLite migration
    # fixture and remains deterministic when an interrupted deployment is rerun.
    tenant_result = bind.execute(
        sa.text(
            "UPDATE tenants SET name = 'TopVNSport', is_active = :active "
            "WHERE id = :id"
        ),
        {"id": TENANT_ID, "active": True},
    )
    if tenant_result.rowcount == 0:
        bind.execute(
            sa.text(
                "INSERT INTO tenants (id, code, name, is_active) "
                "VALUES (:id, 'topvnsport', 'TopVNSport', :active)"
            ),
            {"id": TENANT_ID, "active": True},
        )

    seller_result = bind.execute(
        sa.text(
            "UPDATE sellers SET tenant_id = :tenant_id, tax_code = :tax_code, "
            "name = 'TopVNSport', is_active = :active WHERE id = :id"
        ),
        {
            "id": SELLER_ID,
            "tenant_id": TENANT_ID,
            "tax_code": tax_code,
            "active": True,
        },
    )
    if seller_result.rowcount == 0:
        bind.execute(
            sa.text(
                "INSERT INTO sellers "
                "(id, tenant_id, tax_code, name, is_active) VALUES "
                "(:id, :tenant_id, :tax_code, 'TopVNSport', :active)"
            ),
            {
                "id": SELLER_ID,
                "tenant_id": TENANT_ID,
                "tax_code": tax_code,
                "active": True,
            },
        )

    bind.execute(
        sa.text(
            "UPDATE staff_accounts SET tenant_id = :tenant_id "
            "WHERE tenant_id IS NULL"
        ),
        {"tenant_id": TENANT_ID},
    )
    if _scalar(bind, "SELECT count(*) FROM staff_accounts WHERE tenant_id IS NULL"):
        raise RuntimeError("identity backfill left NULL staff ownership")

    columns = {c["name"]: c for c in sa.inspect(bind).get_columns("staff_accounts")}
    if columns["tenant_id"]["nullable"]:
        with op.batch_alter_table("staff_accounts") as batch:
            batch.alter_column(
                "tenant_id", existing_type=sa.Uuid(), nullable=False
            )


def downgrade() -> None:
    # The deterministic tenant/seller rows and staff assignment are data, not
    # expendable migration scaffolding.  Keep them and only reopen the expand
    # boundary so an application rollback is possible without deleting data.
    bind = op.get_bind()
    columns = {c["name"]: c for c in sa.inspect(bind).get_columns("staff_accounts")}
    if not columns["tenant_id"]["nullable"]:
        with op.batch_alter_table("staff_accounts") as batch:
            batch.alter_column("tenant_id", existing_type=sa.Uuid(), nullable=True)
