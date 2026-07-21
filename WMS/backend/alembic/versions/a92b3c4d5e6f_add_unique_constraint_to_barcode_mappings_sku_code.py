"""Add unique constraint to barcode_mappings sku_code

Revision ID: a92b3c4d5e6f
Revises: 8181edc00fb5
Create Date: 2026-07-21 17:44:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a92b3c4d5e6f'
down_revision: Union[str, Sequence[str], None] = '8181edc00fb5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Xóa duplicates trước (giữ record mới nhất)
    op.execute("""
        DELETE FROM barcode_mappings 
        WHERE id NOT IN (
            SELECT MAX(id) FROM barcode_mappings GROUP BY sku_code
        )
    """)
    # Thêm unique constraint
    op.create_unique_constraint('uq_barcode_mappings_sku_code', 'barcode_mappings', ['sku_code'])


def downgrade() -> None:
    op.drop_constraint('uq_barcode_mappings_sku_code', 'barcode_mappings', type_='unique')
