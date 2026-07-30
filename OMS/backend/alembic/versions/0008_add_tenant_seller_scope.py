"""Add nullable OMS tenant and seller ownership columns.

Revision ID: 0008_add_tenant_seller_scope
Revises: 0007_add_multichannel_tables
Create Date: 2026-07-30

This is the expand phase only. The default-owner backfill, global unique
constraint replacement, and NOT NULL contract belong to PMI-030.
"""

from alembic import op
import sqlalchemy as sa


revision = "0008_add_tenant_seller_scope"
down_revision = "0007_add_multichannel_tables"
branch_labels = None
depends_on = None


OWNED_TABLES = (
    "customers",
    "channels",
    "orders",
    "fulfillment_orders",
    "order_events",
    "payments",
)


def _column_names(inspector, table_name):
    return {column["name"] for column in inspector.get_columns(table_name)}


def _index_names(inspector, table_name):
    return {index["name"] for index in inspector.get_indexes(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    for table_name in OWNED_TABLES:
        if table_name not in existing_tables:
            continue
        columns = _column_names(inspector, table_name)
        if "tenant_id" not in columns:
            op.add_column(
                table_name,
                sa.Column("tenant_id", sa.Uuid(), nullable=True),
            )
        if "seller_id" not in columns:
            op.add_column(
                table_name,
                sa.Column("seller_id", sa.Uuid(), nullable=True),
            )

        # Refresh inspection after DDL so this revision remains safely rerunnable
        # on databases where an earlier attempt completed only part of a table.
        inspector = sa.inspect(bind)
        indexes = _index_names(inspector, table_name)
        for index_name, columns in (
            (f"ix_{table_name}_tenant_id", ["tenant_id"]),
            (f"ix_{table_name}_seller_id", ["seller_id"]),
            (f"ix_{table_name}_tenant_seller", ["tenant_id", "seller_id"]),
        ):
            if index_name not in indexes:
                op.create_index(index_name, table_name, columns, unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    for table_name in reversed(OWNED_TABLES):
        if table_name not in existing_tables:
            continue
        indexes = _index_names(inspector, table_name)
        for index_name in (
            f"ix_{table_name}_tenant_seller",
            f"ix_{table_name}_seller_id",
            f"ix_{table_name}_tenant_id",
        ):
            if index_name in indexes:
                op.drop_index(index_name, table_name=table_name)

        inspector = sa.inspect(bind)
        columns = _column_names(inspector, table_name)
        if "seller_id" in columns:
            op.drop_column(table_name, "seller_id")
        if "tenant_id" in columns:
            op.drop_column(table_name, "tenant_id")
