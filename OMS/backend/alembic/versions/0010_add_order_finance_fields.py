"""Add order finance fields and RETURNED support for profit/loss reporting.

Revision ID: 0010_add_order_finance_fields
Revises: 0009_backfill_default_tenant
Create Date: 2026-11-09

Adds ``discount_amount``, ``seller_shipping_cost``, ``platform_fee`` and
``returned_at`` to ``orders``, indexes ``updated_at`` for incremental sync
(``GET /orders?updated_since=``), and backfills NULL ``updated_at`` values so
legacy rows are visible to incremental consumers.
"""

from alembic import op
import sqlalchemy as sa


revision = "0010_add_order_finance_fields"
down_revision = "0009_backfill_default_tenant"
branch_labels = None
depends_on = None


def _columns(bind):
    return {column["name"] for column in sa.inspect(bind).get_columns("orders")}


def _indexes(bind):
    return {index["name"] for index in sa.inspect(bind).get_indexes("orders")}


def upgrade() -> None:
    bind = op.get_bind()
    columns = _columns(bind)

    if "discount_amount" not in columns:
        op.add_column(
            "orders",
            sa.Column(
                "discount_amount",
                sa.Numeric(12, 2),
                nullable=False,
                server_default="0",
            ),
        )
    if "seller_shipping_cost" not in columns:
        op.add_column(
            "orders",
            sa.Column(
                "seller_shipping_cost",
                sa.Numeric(12, 2),
                nullable=False,
                server_default="0",
            ),
        )
    if "platform_fee" not in columns:
        op.add_column(
            "orders",
            sa.Column("platform_fee", sa.Numeric(12, 2), nullable=True),
        )
    if "returned_at" not in columns:
        op.add_column(
            "orders",
            sa.Column("returned_at", sa.DateTime(), nullable=True),
        )

    op.execute(
        "UPDATE orders SET updated_at = COALESCE(created_at, CURRENT_TIMESTAMP) "
        "WHERE updated_at IS NULL"
    )

    if "ix_orders_updated_at" not in _indexes(bind):
        op.create_index("ix_orders_updated_at", "orders", ["updated_at"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    if "ix_orders_updated_at" in _indexes(bind):
        op.drop_index("ix_orders_updated_at", table_name="orders")

    columns = _columns(bind)
    for name in ("returned_at", "platform_fee", "seller_shipping_cost", "discount_amount"):
        if name in columns:
            op.drop_column("orders", name)
