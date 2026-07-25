"""Ensure the Zalo message mapping column and index exist.

Revision ID: 0002_zalo_message_id
Revises: 0001_baseline
Create Date: 2026-07-25

The baseline includes this column because it is present in the current model.
This revision remains idempotent so databases stamped at the baseline that
predate the column can receive the same schema change safely.
"""

from alembic import op
import sqlalchemy as sa


revision = "0002_zalo_message_id"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("otp_verifications")}
    if "zalo_message_id" not in columns:
        op.add_column(
            "otp_verifications",
            sa.Column("zalo_message_id", sa.String(length=100), nullable=True),
        )

    inspector = sa.inspect(bind)
    indexes = inspector.get_indexes("otp_verifications")
    has_zalo_index = any(
        index["name"] == "ix_otp_verifications_zalo_message_id"
        or index.get("column_names") == ["zalo_message_id"]
        for index in indexes
    )
    if not has_zalo_index:
        op.create_index(
            "ix_otp_verifications_zalo_message_id",
            "otp_verifications",
            ["zalo_message_id"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if any(index["name"] == "ix_otp_verifications_zalo_message_id" for index in inspector.get_indexes("otp_verifications")):
        op.drop_index("ix_otp_verifications_zalo_message_id", table_name="otp_verifications")
    if any(column["name"] == "zalo_message_id" for column in inspector.get_columns("otp_verifications")):
        op.drop_column("otp_verifications", "zalo_message_id")
