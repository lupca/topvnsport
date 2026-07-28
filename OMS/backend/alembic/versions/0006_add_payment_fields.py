"""Add payment fields to orders table.

Revision ID: 0006_add_payment_fields
Revises: 0005_add_channel_soft_delete
Create Date: 2026-07-28
"""

from alembic import op
import sqlalchemy as sa


revision = "0006_add_payment_fields"
down_revision = "0005_add_channel_soft_delete"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c["name"] for c in inspector.get_columns("orders")}

    if "payment_status" not in columns:
        op.add_column(
            "orders",
            sa.Column("payment_status", sa.String(length=20), server_default="PENDING", nullable=True),
        )
    if "payment_method" not in columns:
        op.add_column(
            "orders",
            sa.Column("payment_method", sa.String(length=20), nullable=True),
        )
    if "sepay_order_id" not in columns:
        op.add_column(
            "orders",
            sa.Column("sepay_order_id", sa.String(length=100), nullable=True),
        )
    if "paid_at" not in columns:
        op.add_column(
            "orders",
            sa.Column("paid_at", sa.DateTime(), nullable=True),
        )

    inspector = sa.inspect(bind)
    indexes = inspector.get_indexes("orders")
    index_names = {idx["name"] for idx in indexes}

    if "ix_orders_payment_status" not in index_names and "idx_orders_payment_status" not in index_names:
        op.create_index("ix_orders_payment_status", "orders", ["payment_status"], unique=False)

    if "ix_orders_sepay_order_id" not in index_names and "idx_orders_sepay_order_id" not in index_names:
        op.create_index("ix_orders_sepay_order_id", "orders", ["sepay_order_id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    indexes = inspector.get_indexes("orders")
    index_names = {idx["name"] for idx in indexes}

    if "ix_orders_sepay_order_id" in index_names:
        op.drop_index("ix_orders_sepay_order_id", table_name="orders")
    elif "idx_orders_sepay_order_id" in index_names:
        op.drop_index("idx_orders_sepay_order_id", table_name="orders")
    if "ix_orders_payment_status" in index_names:
        op.drop_index("ix_orders_payment_status", table_name="orders")
    elif "idx_orders_payment_status" in index_names:
        op.drop_index("idx_orders_payment_status", table_name="orders")

    columns = {c["name"] for c in inspector.get_columns("orders")}
    if "paid_at" in columns:
        op.drop_column("orders", "paid_at")
    if "sepay_order_id" in columns:
        op.drop_column("orders", "sepay_order_id")
    if "payment_method" in columns:
        op.drop_column("orders", "payment_method")
    if "payment_status" in columns:
        op.drop_column("orders", "payment_status")
