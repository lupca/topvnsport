"""add_promotions_tables

Revision ID: 20260722_000001
Revises: c9a2d4b80123
Create Date: 2026-07-22 03:40:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260722_000001'
down_revision = 'c9a2d4b80123'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Define enum types with check constraint fallback for cross-database compatibility
    discount_type_enum = sa.Enum('PERCENTAGE', 'FIXED_AMOUNT', 'FIXED_PRICE', name='discount_type_enum')
    promotion_status_enum = sa.Enum('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'ENDED', name='promotion_status_enum')
    scope_type_enum = sa.Enum('ALL', 'CATEGORY', 'PRODUCT', 'VARIANT', name='scope_type_enum')

    # 1. Create table 'promotions'
    op.create_table(
        'promotions',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('code', sa.String(length=100), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('discount_type', discount_type_enum, nullable=False),
        sa.Column('discount_value', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('max_discount', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('priority', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('status', promotion_status_enum, nullable=False, server_default='DRAFT'),
        sa.Column('starts_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ends_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('intent', sa.Text(), nullable=True),
        sa.Column('ai_reasoning', sa.Text(), nullable=True),
        sa.Column('created_by', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_promotions_code', 'promotions', ['code'], unique=True)
    op.create_index('ix_promotions_status', 'promotions', ['status'], unique=False)

    # 2. Create table 'promotion_scope'
    op.create_table(
        'promotion_scope',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('promotion_id', sa.String(length=36), nullable=False),
        sa.Column('scope_type', scope_type_enum, nullable=False),
        sa.Column('target_id', sa.String(length=255), nullable=True),
        sa.Column('is_exclusion', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.ForeignKeyConstraint(['promotion_id'], ['promotions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_promotion_scope_promotion_id', 'promotion_scope', ['promotion_id'], unique=False)

    # 3. Create table 'promotion_computed_prices'
    op.create_table(
        'promotion_computed_prices',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('variant_id', sa.String(length=255), nullable=False),
        sa.Column('promotion_id', sa.String(length=36), nullable=True),
        sa.Column('original_price', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('computed_price', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('discount_amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('percentage_discount', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['promotion_id'], ['promotions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_promotion_computed_prices_variant_id', 'promotion_computed_prices', ['variant_id'], unique=False)
    op.create_index('ix_promotion_computed_prices_promotion_id', 'promotion_computed_prices', ['promotion_id'], unique=False)

    # 4. Create table 'promotion_usage_log'
    op.create_table(
        'promotion_usage_log',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('promotion_id', sa.String(length=36), nullable=False),
        sa.Column('variant_id', sa.String(length=255), nullable=False),
        sa.Column('applied_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['promotion_id'], ['promotions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_promotion_usage_log_promotion_id', 'promotion_usage_log', ['promotion_id'], unique=False)
    op.create_index('ix_promotion_usage_log_variant_id', 'promotion_usage_log', ['variant_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_promotion_usage_log_variant_id', table_name='promotion_usage_log')
    op.drop_index('ix_promotion_usage_log_promotion_id', table_name='promotion_usage_log')
    op.drop_table('promotion_usage_log')

    op.drop_index('ix_promotion_computed_prices_promotion_id', table_name='promotion_computed_prices')
    op.drop_index('ix_promotion_computed_prices_variant_id', table_name='promotion_computed_prices')
    op.drop_table('promotion_computed_prices')

    op.drop_index('ix_promotion_scope_promotion_id', table_name='promotion_scope')
    op.drop_table('promotion_scope')

    op.drop_index('ix_promotions_status', table_name='promotions')
    op.drop_index('ix_promotions_code', table_name='promotions')
    op.drop_table('promotions')

    # Drop Enum Types
    sa.Enum(name='scope_type_enum').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='promotion_status_enum').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='discount_type_enum').drop(op.get_bind(), checkfirst=True)
