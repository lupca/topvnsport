"""add tenants, sellers, and nullable staff tenant

Revision ID: 20260730_000001
Revises: f975036c6a88
Create Date: 2026-07-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260730_000001"
down_revision: Union[str, Sequence[str], None] = "f975036c6a88"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tenants",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tenants_code", "tenants", ["code"], unique=True)

    op.create_table(
        "sellers",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("tax_code", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(
            ["tenant_id"], ["tenants.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "tenant_id", "tax_code", name="uq_sellers_tenant_tax_code"
        ),
    )
    op.create_index("ix_sellers_tenant_id", "sellers", ["tenant_id"], unique=False)

    op.add_column(
        "staff_accounts", sa.Column("tenant_id", sa.Uuid(), nullable=True)
    )
    op.create_index(
        "ix_staff_accounts_tenant_id",
        "staff_accounts",
        ["tenant_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_staff_accounts_tenant_id_tenants",
        "staff_accounts",
        "tenants",
        ["tenant_id"],
        ["id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_staff_accounts_tenant_id_tenants",
        "staff_accounts",
        type_="foreignkey",
    )
    op.drop_index("ix_staff_accounts_tenant_id", table_name="staff_accounts")
    op.drop_column("staff_accounts", "tenant_id")

    op.drop_index("ix_sellers_tenant_id", table_name="sellers")
    op.drop_table("sellers")
    op.drop_index("ix_tenants_code", table_name="tenants")
    op.drop_table("tenants")
