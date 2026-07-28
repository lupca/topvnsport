"""Add multi-channel tables and fields.

Revision ID: 0007_add_multichannel_tables
Revises: 0006_add_payment_fields
Create Date: 2026-07-28
"""

from alembic import op
import sqlalchemy as sa

revision = "0007_add_multichannel_tables"
down_revision = "0006_add_payment_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c["name"] for c in inspector.get_columns("orders")}

    if "channel_code" not in columns:
        op.add_column(
            "orders",
            sa.Column("channel_code", sa.String(length=20), server_default="WEB", nullable=True),
        )
    if "channel_order_id" not in columns:
        op.add_column(
            "orders",
            sa.Column("channel_order_id", sa.String(length=100), nullable=True),
        )
    if "channel_metadata" not in columns:
        op.add_column(
            "orders",
            sa.Column("channel_metadata", sa.JSON(), server_default="{}", nullable=True),
        )

    indexes = inspector.get_indexes("orders")
    index_names = {idx["name"] for idx in indexes}
    if "ix_orders_channel_code" not in index_names:
        op.create_index("ix_orders_channel_code", "orders", ["channel_code"], unique=False)

    tables = inspector.get_table_names()

    if "payments" not in tables:
        op.create_table(
            "payments",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
            sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id"), nullable=False),
            sa.Column("provider", sa.String(length=20), nullable=False),
            sa.Column("provider_txn_id", sa.String(length=100), nullable=True),
            sa.Column("amount", sa.Numeric(precision=15, scale=2), nullable=False),
            sa.Column("status", sa.String(length=20), server_default="PENDING", nullable=False),
            sa.Column("reconciled_at", sa.DateTime(), nullable=True),
            sa.Column("raw_data", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.UniqueConstraint("provider", "provider_txn_id", name="uq_payments_provider_txn"),
        )
        op.create_index("ix_payments_id", "payments", ["id"], unique=False)
        op.create_index("ix_payments_order_id", "payments", ["order_id"], unique=False)
        op.create_index("ix_payments_provider", "payments", ["provider"], unique=False)
        op.create_index("ix_payments_status", "payments", ["status"], unique=False)

    if "payment_ledger" not in tables:
        op.create_table(
            "payment_ledger",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
            sa.Column("payment_id", sa.Integer(), sa.ForeignKey("payments.id"), nullable=False),
            sa.Column("entry_type", sa.String(length=20), nullable=False),
            sa.Column("amount", sa.Numeric(precision=15, scale=2), nullable=False),
            sa.Column("running_balance", sa.Numeric(precision=15, scale=2), nullable=True),
            sa.Column("metadata_json", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        )
        op.create_index("ix_payment_ledger_id", "payment_ledger", ["id"], unique=False)
        op.create_index("ix_payment_ledger_payment_id", "payment_ledger", ["payment_id"], unique=False)

    if "invoices" not in tables:
        op.create_table(
            "invoices",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
            sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id"), nullable=False),
            sa.Column("provider", sa.String(length=20), nullable=False),
            sa.Column("invoice_number", sa.String(length=50), nullable=True),
            sa.Column("invoice_date", sa.DateTime(), nullable=True),
            sa.Column("status", sa.String(length=20), server_default="PENDING", nullable=False),
            sa.Column("pdf_url", sa.String(length=500), nullable=True),
            sa.Column("raw_response", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.UniqueConstraint("provider", "invoice_number", name="uq_invoices_provider_num"),
        )
        op.create_index("ix_invoices_id", "invoices", ["id"], unique=False)
        op.create_index("ix_invoices_order_id", "invoices", ["order_id"], unique=False)
        op.create_index("ix_invoices_provider", "invoices", ["provider"], unique=False)
        op.create_index("ix_invoices_status", "invoices", ["status"], unique=False)

    if "order_events" not in tables:
        op.create_table(
            "order_events",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
            sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id"), nullable=False),
            sa.Column("event_type", sa.String(length=50), nullable=False),
            sa.Column("payload", sa.JSON(), nullable=False),
            sa.Column("created_by", sa.String(length=100), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        )
        op.create_index("ix_order_events_id", "order_events", ["id"], unique=False)
        op.create_index("ix_order_events_order_id", "order_events", ["order_id"], unique=False)
        op.create_index("ix_order_events_event_type", "order_events", ["event_type"], unique=False)


def downgrade() -> None:
    op.drop_table("order_events")
    op.drop_table("invoices")
    op.drop_table("payment_ledger")
    op.drop_table("payments")
    op.drop_index("ix_orders_channel_code", table_name="orders")
    op.drop_column("orders", "channel_metadata")
    op.drop_column("orders", "channel_order_id")
    op.drop_column("orders", "channel_code")
