"""add nullable tenant and seller ownership scope

Revision ID: 20260730_000002
Revises: 20260722_000001
Create Date: 2026-07-30

This is the expand step only. PMI-030 backfills ownership, replaces the legacy
global unique constraints, and makes these columns non-nullable.
"""

from alembic import op
import sqlalchemy as sa


revision = "20260730_000002"
down_revision = "20260722_000001"
branch_labels = None
depends_on = None


OWNED_TABLES = (
    "categories",
    "products",
    "product_variants",
    "channels",
    "promotions",
    "promotion_scope",
    "promotion_computed_prices",
    "promotion_usage_log",
)


def upgrade() -> None:
    for table_name in OWNED_TABLES:
        op.add_column(
            table_name,
            sa.Column("tenant_id", sa.Uuid(), nullable=True),
        )
        op.add_column(
            table_name,
            sa.Column("seller_id", sa.Uuid(), nullable=True),
        )
        op.create_index(
            f"ix_{table_name}_tenant_seller",
            table_name,
            ["tenant_id", "seller_id"],
            unique=False,
        )


def downgrade() -> None:
    for table_name in reversed(OWNED_TABLES):
        op.drop_index(f"ix_{table_name}_tenant_seller", table_name=table_name)
        op.drop_column(table_name, "seller_id")
        op.drop_column(table_name, "tenant_id")
