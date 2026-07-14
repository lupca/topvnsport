"""Add partner and finance fields

Revision ID: 8181edc00fb5
Revises: 
Create Date: 2026-07-15 06:06:23.384441

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8181edc00fb5'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    
    # 1. barcode_mappings
    bm_cols = [c['name'] for c in inspector.get_columns('barcode_mappings')]
    if 'cost_price' not in bm_cols:
        op.add_column('barcode_mappings', sa.Column('cost_price', sa.Numeric(precision=12, scale=2), nullable=True))
    if 'tax_rate' not in bm_cols:
        op.add_column('barcode_mappings', sa.Column('tax_rate', sa.Numeric(precision=5, scale=2), nullable=True))
    if 'pmi_variant_id' not in bm_cols:
        op.add_column('barcode_mappings', sa.Column('pmi_variant_id', sa.Integer(), nullable=True))
    if 'last_synced_at' not in bm_cols:
        op.add_column('barcode_mappings', sa.Column('last_synced_at', sa.DateTime(), nullable=True))
    if 'selling_price' not in bm_cols:
        op.add_column('barcode_mappings', sa.Column('selling_price', sa.Numeric(precision=12, scale=2), nullable=True))
        
    # 2. inbound_items
    ii_cols = [c['name'] for c in inspector.get_columns('inbound_items')]
    if 'unit_cost' not in ii_cols:
        op.add_column('inbound_items', sa.Column('unit_cost', sa.Numeric(precision=12, scale=2), nullable=True))
        
    # 3. inbound_shipments
    is_cols = [c['name'] for c in inspector.get_columns('inbound_shipments')]
    if 'receiver_name' not in is_cols:
        op.add_column('inbound_shipments', sa.Column('receiver_name', sa.String(), nullable=True))
    if 'original_document_number' not in is_cols:
        op.add_column('inbound_shipments', sa.Column('original_document_number', sa.String(), nullable=True))
    if 'total_amount' not in is_cols:
        op.add_column('inbound_shipments', sa.Column('total_amount', sa.Numeric(precision=12, scale=2), nullable=True))
        
    # 4. fulfillment_orders_wms
    fo_cols = [c['name'] for c in inspector.get_columns('fulfillment_orders_wms')]
    if 'original_document_number' not in fo_cols:
        op.add_column('fulfillment_orders_wms', sa.Column('original_document_number', sa.String(), nullable=True))
    if 'total_amount' not in fo_cols:
        op.add_column('fulfillment_orders_wms', sa.Column('total_amount', sa.Numeric(precision=12, scale=2), nullable=True))
        
    # 5. pick_list_items
    pl_cols = [c['name'] for c in inspector.get_columns('pick_list_items')]
    if 'selling_price' not in pl_cols:
        op.add_column('pick_list_items', sa.Column('selling_price', sa.Numeric(precision=12, scale=2), nullable=True))
        
    # 6. inventories unique constraint
    inv_constrs = inspector.get_unique_constraints('inventories')
    has_constr = any(c['name'] == 'uq_inventory_sku_location' for c in inv_constrs)
    if not has_constr:
        op.create_unique_constraint('uq_inventory_sku_location', 'inventories', ['sku_code', 'location_id'])


def downgrade() -> None:
    """Downgrade schema."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    
    # 6. inventories unique constraint
    inv_constrs = inspector.get_unique_constraints('inventories')
    has_constr = any(c['name'] == 'uq_inventory_sku_location' for c in inv_constrs)
    if has_constr:
        op.drop_constraint('uq_inventory_sku_location', 'inventories', type_='unique')
        
    # 5. pick_list_items
    pl_cols = [c['name'] for c in inspector.get_columns('pick_list_items')]
    if 'selling_price' in pl_cols:
        op.drop_column('pick_list_items', 'selling_price')
        
    # 4. fulfillment_orders_wms
    fo_cols = [c['name'] for c in inspector.get_columns('fulfillment_orders_wms')]
    if 'original_document_number' in fo_cols:
        op.drop_column('fulfillment_orders_wms', 'original_document_number')
    if 'total_amount' in fo_cols:
        op.drop_column('fulfillment_orders_wms', 'total_amount')
        
    # 3. inbound_shipments
    is_cols = [c['name'] for c in inspector.get_columns('inbound_shipments')]
    if 'receiver_name' in is_cols:
        op.drop_column('inbound_shipments', 'receiver_name')
    if 'original_document_number' in is_cols:
        op.drop_column('inbound_shipments', 'original_document_number')
    if 'total_amount' in is_cols:
        op.drop_column('inbound_shipments', 'total_amount')
        
    # 2. inbound_items
    ii_cols = [c['name'] for c in inspector.get_columns('inbound_items')]
    if 'unit_cost' in ii_cols:
        op.drop_column('inbound_items', 'unit_cost')
        
    # 1. barcode_mappings
    bm_cols = [c['name'] for c in inspector.get_columns('barcode_mappings')]
    if 'selling_price' in bm_cols:
        op.drop_column('barcode_mappings', 'selling_price')
    if 'last_synced_at' in bm_cols:
        op.drop_column('barcode_mappings', 'last_synced_at')
    if 'pmi_variant_id' in bm_cols:
        op.drop_column('barcode_mappings', 'pmi_variant_id')
    if 'tax_rate' in bm_cols:
        op.drop_column('barcode_mappings', 'tax_rate')
    if 'cost_price' in bm_cols:
        op.drop_column('barcode_mappings', 'cost_price')
