"""Widen encrypted system configuration values to TEXT.

Revision ID: 0003_config_value_text
Revises: 0002_zalo_message_id
Create Date: 2026-07-25

The type check makes this safe for databases that already use TEXT and fixes
the legacy VARCHAR(500) schema drift without touching stored values.
"""

from alembic import op
import sqlalchemy as sa


revision = "0003_config_value_text"
down_revision = "0002_zalo_message_id"
branch_labels = None
depends_on = None


def _config_value_type():
    bind = op.get_bind()
    for column in sa.inspect(bind).get_columns("system_configs"):
        if column["name"] == "config_value":
            return column["type"]
    raise RuntimeError("system_configs.config_value does not exist")


def upgrade() -> None:
    current_type = _config_value_type()
    if not isinstance(current_type, sa.Text):
        if op.get_bind().dialect.name == "sqlite":
            with op.batch_alter_table("system_configs") as batch_op:
                batch_op.alter_column(
                    "config_value",
                    type_=sa.Text(),
                    existing_type=current_type,
                    existing_nullable=True,
                )
        else:
            op.alter_column(
                "system_configs",
                "config_value",
                type_=sa.Text(),
                existing_type=current_type,
                existing_nullable=True,
            )


def downgrade() -> None:
    bind = op.get_bind()
    too_long = bind.execute(
        sa.text("SELECT 1 FROM system_configs WHERE length(config_value) > 500 LIMIT 1")
    ).first()
    if too_long:
        raise RuntimeError(
            "Cannot downgrade system_configs.config_value to VARCHAR(500): "
            "at least one encrypted value is longer than 500 characters"
        )

    current_type = _config_value_type()
    if isinstance(current_type, sa.Text):
        if bind.dialect.name == "sqlite":
            with op.batch_alter_table("system_configs") as batch_op:
                batch_op.alter_column(
                    "config_value",
                    type_=sa.String(length=500),
                    existing_type=current_type,
                    existing_nullable=True,
                )
        else:
            op.alter_column(
                "system_configs",
                "config_value",
                type_=sa.String(length=500),
                existing_type=current_type,
                existing_nullable=True,
            )
