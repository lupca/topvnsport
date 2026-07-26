"""Add is_deleted and deleted_at columns to channels table.

Revision ID: 0005_add_channel_soft_delete
Revises: 0004_add_customer_soft_delete
Create Date: 2026-07-26
"""

from alembic import op
import sqlalchemy as sa


revision = "0005_add_channel_soft_delete"
down_revision = "0004_add_customer_soft_delete"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    columns = [c["name"] for c in sa.inspect(bind).get_columns("channels")]
    if "is_deleted" not in columns:
        op.add_column("channels", sa.Column("is_deleted", sa.Boolean(), server_default=sa.false(), nullable=False))
    if "deleted_at" not in columns:
        op.add_column("channels", sa.Column("deleted_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    columns = [c["name"] for c in sa.inspect(bind).get_columns("channels")]
    if "deleted_at" in columns:
        op.drop_column("channels", "deleted_at")
    if "is_deleted" in columns:
        op.drop_column("channels", "is_deleted")
