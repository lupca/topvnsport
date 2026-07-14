"""drop_users_table

Revision ID: 389100db4264
Revises: d394d33af157
Create Date: 2026-07-15 03:41:34.424900
"""

from alembic import op
import sqlalchemy as sa



# revision identifiers, used by Alembic.
revision = '389100db4264'
down_revision = 'd394d33af157'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table('users')


def downgrade() -> None:
    pass
