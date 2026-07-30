"""Add nullable tenant and seller ownership scope.

Revision ID: b03c4d5e6f70
Revises: a92b3c4d5e6f
Create Date: 2026-07-30 18:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b03c4d5e6f70"
down_revision: Union[str, Sequence[str], None] = "a92b3c4d5e6f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


OWNED_TABLES = (
    "warehouses",
    "locations",
    "inventories",
    "barcode_mappings",
    "inbound_shipments",
    "inbound_items",
    "fulfillment_orders_wms",
    "pick_list_items",
    "packing_sessions",
    "stock_transactions",
)


def upgrade() -> None:
    # Expand only. Backfill, NOT NULL, and uniqueness contraction belong to PMI-030.
    for table_name in OWNED_TABLES:
        op.add_column(table_name, sa.Column("tenant_id", sa.Uuid(), nullable=True))
        op.add_column(table_name, sa.Column("seller_id", sa.Uuid(), nullable=True))
        op.create_index(
            f"ix_{table_name}_tenant_id", table_name, ["tenant_id"], unique=False
        )
        op.create_index(
            f"ix_{table_name}_seller_id", table_name, ["seller_id"], unique=False
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
        op.drop_index(f"ix_{table_name}_seller_id", table_name=table_name)
        op.drop_index(f"ix_{table_name}_tenant_id", table_name=table_name)
        op.drop_column(table_name, "seller_id")
        op.drop_column(table_name, "tenant_id")
