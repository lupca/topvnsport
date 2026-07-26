"""Add is_deleted and deleted_at columns to customers table.

Revision ID: 0004_add_customer_soft_delete
Revises: 0003_config_value_text
Create Date: 2026-07-26
"""

from alembic import op
import sqlalchemy as sa


revision = "0004_add_customer_soft_delete"
down_revision = "0003_config_value_text"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    columns = [c["name"] for c in sa.inspect(bind).get_columns("customers")]
    if "is_deleted" not in columns:
        op.add_column("customers", sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("0"), nullable=False))
    if "deleted_at" not in columns:
        op.add_column("customers", sa.Column("deleted_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    columns = [c["name"] for c in sa.inspect(bind).get_columns("customers")]
    if "deleted_at" in columns:
        op.drop_column("customers", "deleted_at")
    if "is_deleted" in columns:
        op.drop_column("customers", "is_deleted")
