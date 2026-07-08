"""add_multi_channel_tables

Revision ID: 119d08c29f15
Revises: 20260706_000001
Create Date: 2026-07-07 23:55:49.294195
"""

from alembic import op
import sqlalchemy as sa



# revision identifiers, used by Alembic.
revision = '119d08c29f15'
down_revision = '20260706_000001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create channels, locales, currencies, channel_configs
    op.create_table(
        'channels',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(length=100), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_channels_code'), 'channels', ['code'], unique=True)
    op.create_index(op.f('ix_channels_id'), 'channels', ['id'], unique=False)

    op.create_table(
        'locales',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(length=100), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_locales_code'), 'locales', ['code'], unique=True)
    op.create_index(op.f('ix_locales_id'), 'locales', ['id'], unique=False)

    op.create_table(
        'currencies',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(length=100), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_currencies_code'), 'currencies', ['code'], unique=True)
    op.create_index(op.f('ix_currencies_id'), 'currencies', ['id'], unique=False)

    op.create_table(
        'channel_configs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('channel_id', sa.Integer(), nullable=False),
        sa.Column('app_key', sa.String(length=255), nullable=True),
        sa.Column('app_secret', sa.String(length=255), nullable=True),
        sa.Column('access_token', sa.Text(), nullable=True),
        sa.Column('refresh_token', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.ForeignKeyConstraint(['channel_id'], ['channels.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('channel_id')
    )
    op.create_index(op.f('ix_channel_configs_channel_id'), 'channel_configs', ['channel_id'], unique=True)
    op.create_index(op.f('ix_channel_configs_id'), 'channel_configs', ['id'], unique=False)

    # 2. Create channel_category_mappings
    op.create_table(
        'channel_category_mappings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('channel_id', sa.Integer(), nullable=False),
        sa.Column('pim_category_id', sa.Integer(), nullable=False),
        sa.Column('channel_category_code', sa.String(length=255), nullable=False),
        sa.Column('channel_category_name', sa.String(length=255), nullable=False),
        sa.ForeignKeyConstraint(['channel_id'], ['channels.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['pim_category_id'], ['categories.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('channel_id', 'pim_category_id', name='uq_channel_pim_category')
    )
    op.create_index(op.f('ix_channel_category_mappings_channel_id'), 'channel_category_mappings', ['channel_id'], unique=False)
    op.create_index(op.f('ix_channel_category_mappings_id'), 'channel_category_mappings', ['id'], unique=False)
    op.create_index(op.f('ix_channel_category_mappings_pim_category_id'), 'channel_category_mappings', ['pim_category_id'], unique=False)

    # 3. Create channel_attribute_mappings
    op.create_table(
        'channel_attribute_mappings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('channel_id', sa.Integer(), nullable=False),
        sa.Column('pim_attribute_id', sa.Integer(), nullable=False),
        sa.Column('channel_category_code', sa.String(length=255), nullable=True),
        sa.Column('channel_attribute_code', sa.String(length=255), nullable=False),
        sa.Column('channel_attribute_name', sa.String(length=255), nullable=False),
        sa.ForeignKeyConstraint(['channel_id'], ['channels.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['pim_attribute_id'], ['attributes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('channel_id', 'pim_attribute_id', 'channel_category_code', name='uq_channel_pim_attribute_cat')
    )
    op.create_index(op.f('ix_channel_attribute_mappings_channel_id'), 'channel_attribute_mappings', ['channel_id'], unique=False)
    op.create_index(op.f('ix_channel_attribute_mappings_id'), 'channel_attribute_mappings', ['id'], unique=False)
    op.create_index(op.f('ix_channel_attribute_mappings_pim_attribute_id'), 'channel_attribute_mappings', ['pim_attribute_id'], unique=False)

    # 4. Create product_channel_listings
    op.create_table(
        'product_channel_listings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('channel_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='Draft'),
        sa.Column('title_override', sa.String(length=255), nullable=True),
        sa.Column('description_override', sa.Text(), nullable=True),
        sa.Column('shipping_config', sa.JSON(), nullable=True),
        sa.Column('channel_product_id', sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(['channel_id'], ['channels.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('product_id', 'channel_id', name='uq_product_channel_listing')
    )
    op.create_index(op.f('ix_product_channel_listings_channel_id'), 'product_channel_listings', ['channel_id'], unique=False)
    op.create_index(op.f('ix_product_channel_listings_id'), 'product_channel_listings', ['id'], unique=False)
    op.create_index(op.f('ix_product_channel_listings_product_id'), 'product_channel_listings', ['product_id'], unique=False)
    op.create_index(op.f('ix_product_channel_listings_status'), 'product_channel_listings', ['status'], unique=False)

    # 5. Create variant_channel_listings
    op.create_table(
        'variant_channel_listings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('listing_id', sa.Integer(), nullable=False),
        sa.Column('variant_id', sa.Integer(), nullable=False),
        sa.Column('channel_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=True),
        sa.Column('price_override', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('channel_variant_id', sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(['channel_id'], ['channels.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['listing_id'], ['product_channel_listings.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['variant_id'], ['product_variants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('variant_id', 'channel_id', name='uq_variant_channel_listing')
    )
    op.create_index(op.f('ix_variant_channel_listings_channel_id'), 'variant_channel_listings', ['channel_id'], unique=False)
    op.create_index(op.f('ix_variant_channel_listings_id'), 'variant_channel_listings', ['id'], unique=False)
    op.create_index(op.f('ix_variant_channel_listings_listing_id'), 'variant_channel_listings', ['listing_id'], unique=False)
    op.create_index(op.f('ix_variant_channel_listings_product_id'), 'variant_channel_listings', ['product_id'], unique=False)
    op.create_index(op.f('ix_variant_channel_listings_variant_id'), 'variant_channel_listings', ['variant_id'], unique=False)

    # 6. Create product_channel_attribute_values
    op.create_table(
        'product_channel_attribute_values',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('listing_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('channel_id', sa.Integer(), nullable=False),
        sa.Column('attribute_mapping_id', sa.Integer(), nullable=False),
        sa.Column('value_string', sa.Text(), nullable=True),
        sa.Column('value_decimal', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.ForeignKeyConstraint(['attribute_mapping_id'], ['channel_attribute_mappings.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['channel_id'], ['channels.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['listing_id'], ['product_channel_listings.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('product_id', 'channel_id', 'attribute_mapping_id', name='uq_prod_chan_attr_val')
    )
    op.create_index(op.f('ix_product_channel_attribute_values_attribute_mapping_id'), 'product_channel_attribute_values', ['attribute_mapping_id'], unique=False)
    op.create_index(op.f('ix_product_channel_attribute_values_channel_id'), 'product_channel_attribute_values', ['channel_id'], unique=False)
    op.create_index(op.f('ix_product_channel_attribute_values_id'), 'product_channel_attribute_values', ['id'], unique=False)
    op.create_index(op.f('ix_product_channel_attribute_values_listing_id'), 'product_channel_attribute_values', ['listing_id'], unique=False)
    op.create_index(op.f('ix_product_channel_attribute_values_product_id'), 'product_channel_attribute_values', ['product_id'], unique=False)

    # 7. Add columns to existing tables
    op.add_column('products', sa.Column('hs_code', sa.String(length=100), nullable=True))
    op.add_column('products', sa.Column('tax_code', sa.String(length=100), nullable=True))
    op.add_column('product_variants', sa.Column('barcode', sa.String(length=255), nullable=True))


def downgrade() -> None:
    # 1. Drop columns from existing tables
    op.drop_column('product_variants', 'barcode')
    op.drop_column('products', 'tax_code')
    op.drop_column('products', 'hs_code')

    # 2. Drop tables
    op.drop_table('product_channel_attribute_values')
    op.drop_table('variant_channel_listings')
    op.drop_table('product_channel_listings')
    op.drop_table('channel_attribute_mappings')
    op.drop_table('channel_category_mappings')
    op.drop_table('channel_configs')
    op.drop_table('currencies')
    op.drop_table('locales')
    op.drop_table('channels')
