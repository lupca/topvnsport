"""Backfill and contract WMS tenant/seller ownership.

Revision ID: c14d5e6f7081
Revises: b03c4d5e6f70
Create Date: 2026-07-30
"""

from alembic import op
import sqlalchemy as sa


revision = "c14d5e6f7081"
down_revision = "b03c4d5e6f70"
branch_labels = None
depends_on = None

TENANT_ID = "eadb17a4-1b2d-5ffd-8d99-6091f167aeef"
SELLER_ID = "f02a9c68-f656-5597-9f9b-7c8e28e3705d"
OWNED_TABLES = (
    "warehouses", "locations", "inventories", "barcode_mappings",
    "inbound_shipments", "inbound_items", "fulfillment_orders_wms",
    "pick_list_items", "packing_sessions", "stock_transactions",
)
PARENTS = {
    "locations": ("warehouses", "warehouse_id"),
    "inventories": ("locations", "location_id"),
    "inbound_shipments": ("warehouses", "warehouse_id"),
    "inbound_items": ("inbound_shipments", "inbound_shipment_id"),
    "pick_list_items": ("fulfillment_orders_wms", "fulfillment_order_id"),
    "packing_sessions": ("fulfillment_orders_wms", "fulfillment_order_id"),
    "stock_transactions": ("locations", "location_id"),
}
ROOTS = ("warehouses", "barcode_mappings", "fulfillment_orders_wms")
NATURAL_KEYS = (
    ("warehouses", ("code",), "uq_warehouse_seller_code", ()),
    ("locations", ("location_code",), "uq_location_seller_code", ()),
    ("inventories", ("sku_code", "location_id"), "uq_inventory_seller_sku_location", ("uq_inventory_sku_location",)),
    ("barcode_mappings", ("barcode",), "uq_barcode_seller_barcode", ()),
    ("barcode_mappings", ("sku_code",), "uq_barcode_seller_sku", ("uq_barcode_mappings_sku_code",)),
    ("inbound_shipments", ("inbound_number",), "uq_inbound_seller_number", ()),
    ("fulfillment_orders_wms", ("fulfillment_number",), "uq_fulfillment_wms_seller_number", ()),
)


def _count(bind, sql, **params):
    return bind.execute(sa.text(sql), params).scalar()


def _preflight(bind):
    failures = []
    for table in OWNED_TABLES:
        bad = _count(
            bind,
            f'SELECT count(*) FROM "{table}" WHERE '
            "(tenant_id IS NOT NULL OR seller_id IS NOT NULL) AND "
            "(tenant_id IS NULL OR seller_id IS NULL OR "
            "tenant_id<>:tenant_id OR seller_id<>:seller_id)",
            tenant_id=TENANT_ID,
            seller_id=SELLER_ID,
        )
        if bad:
            failures.append(f"{table}.unknown_or_partial_owner={bad}")
    for child, (parent, fk) in PARENTS.items():
        orphan = _count(
            bind,
            f'SELECT count(*) FROM "{child}" c LEFT JOIN "{parent}" p '
            f'ON c."{fk}"=p.id WHERE p.id IS NULL',
        )
        if orphan:
            failures.append(f"{child}.orphan={orphan}")
    # Optional location links are additional ownership parents.
    for table in ("inbound_items", "pick_list_items"):
        mismatch_parent = _count(
            bind,
            f'SELECT count(*) FROM "{table}" c LEFT JOIN locations l '
            "ON c.location_id=l.id WHERE c.location_id IS NOT NULL AND l.id IS NULL",
        )
        if mismatch_parent:
            failures.append(f"{table}.location_orphan={mismatch_parent}")
    for table, keys, _target, _legacy in NATURAL_KEYS:
        group = ", ".join(f'"{key}"' for key in keys)
        duplicate = _count(
            bind,
            f'SELECT count(*) FROM (SELECT 1 FROM "{table}" GROUP BY {group} '
            "HAVING count(*)>1) duplicate_groups",
        )
        if duplicate:
            failures.append(f"{table}.{'+'.join(keys)}.target_duplicate={duplicate}")
    if failures:
        raise RuntimeError("WMS ownership preflight failed: " + ", ".join(failures))


def _backfill(bind):
    params = {"tenant_id": TENANT_ID, "seller_id": SELLER_ID}
    for table in ROOTS:
        bind.execute(
            sa.text(
                f'UPDATE "{table}" SET tenant_id=:tenant_id, seller_id=:seller_id '
                "WHERE tenant_id IS NULL AND seller_id IS NULL"
            ),
            params,
        )
    # Parent order is significant: warehouse -> location -> inventory, and
    # shipment/fulfillment roots -> their children.
    for child in (
        "locations", "inventories", "inbound_shipments", "inbound_items",
        "pick_list_items", "packing_sessions", "stock_transactions",
    ):
        parent, fk = PARENTS[child]
        bind.execute(
            sa.text(
                f'UPDATE "{child}" SET tenant_id=(SELECT p.tenant_id FROM "{parent}" p '
                f'WHERE p.id="{child}"."{fk}"), seller_id=(SELECT p.seller_id '
                f'FROM "{parent}" p WHERE p.id="{child}"."{fk}")'
            )
        )


def _validate(bind):
    failures = []
    for table in OWNED_TABLES:
        invalid = _count(
            bind,
            f'SELECT count(*) FROM "{table}" WHERE tenant_id IS NULL OR '
            "seller_id IS NULL OR tenant_id<>:tenant_id OR seller_id<>:seller_id",
            tenant_id=TENANT_ID,
            seller_id=SELLER_ID,
        )
        if invalid:
            failures.append(f"{table}.invalid_owner={invalid}")
    for child, (parent, fk) in PARENTS.items():
        mismatch = _count(
            bind,
            f'SELECT count(*) FROM "{child}" c JOIN "{parent}" p '
            f'ON c."{fk}"=p.id WHERE c.tenant_id<>p.tenant_id '
            "OR c.seller_id<>p.seller_id",
        )
        if mismatch:
            failures.append(f"{child}.parent_mismatch={mismatch}")
    for table in ("inbound_items", "pick_list_items"):
        mismatch = _count(
            bind,
            f'SELECT count(*) FROM "{table}" c JOIN locations l '
            "ON c.location_id=l.id WHERE c.tenant_id<>l.tenant_id "
            "OR c.seller_id<>l.seller_id",
        )
        if mismatch:
            failures.append(f"{table}.location_mismatch={mismatch}")
    for table, keys, _target, _legacy in NATURAL_KEYS:
        group = ", ".join(("seller_id",) + keys)
        duplicate = _count(
            bind,
            f'SELECT count(*) FROM (SELECT 1 FROM "{table}" GROUP BY {group} '
            "HAVING count(*)>1) duplicate_groups",
        )
        if duplicate:
            failures.append(f"{table}.{'+'.join(keys)}.duplicate={duplicate}")
    if failures:
        raise RuntimeError("WMS contract validation failed: " + ", ".join(failures))


def _drop_unique(bind, table, name):
    inspector = sa.inspect(bind)
    indexes = {i["name"]: i for i in inspector.get_indexes(table)}
    constraints = {u["name"]: u for u in inspector.get_unique_constraints(table)}
    # Try constraint first (PostgreSQL unique constraints have backing indexes)
    if name in constraints:
        with op.batch_alter_table(table) as batch:
            batch.drop_constraint(name, type_="unique")
    elif name in indexes and indexes[name].get("unique"):
        op.drop_index(name, table_name=table)


def _contract(bind):
    for table in OWNED_TABLES:
        columns = {c["name"]: c for c in sa.inspect(bind).get_columns(table)}
        if columns["tenant_id"]["nullable"] or columns["seller_id"]["nullable"]:
            with op.batch_alter_table(table) as batch:
                batch.alter_column("tenant_id", existing_type=sa.Uuid(), nullable=False)
                batch.alter_column("seller_id", existing_type=sa.Uuid(), nullable=False)

    # Drop both known legacy constraints and expand-phase constraints whose
    # tenant_id prefix is broader than the ADR's seller-owned natural key.
    expand_names = (
        "uq_warehouse_owner_code", "uq_location_owner_code",
        "uq_inventory_owner_sku_location", "uq_barcode_owner_barcode",
        "uq_barcode_owner_sku", "uq_inbound_owner_number",
        "uq_fulfillment_owner_number",
    )
    for table, _keys, _target, legacy in NATURAL_KEYS:
        for name in legacy:
            _drop_unique(bind, table, name)
    for table, name in zip(
        ("warehouses", "locations", "inventories", "barcode_mappings",
         "barcode_mappings", "inbound_shipments", "fulfillment_orders_wms"),
        expand_names,
    ):
        _drop_unique(bind, table, name)

    for table, keys, target, _legacy in NATURAL_KEYS:
        existing = {
            u["name"] for u in sa.inspect(bind).get_unique_constraints(table)
        }
        if target not in existing:
            with op.batch_alter_table(table) as batch:
                batch.create_unique_constraint(target, ["seller_id", *keys])


def upgrade():
    bind = op.get_bind()
    _preflight(bind)
    _backfill(bind)
    _validate(bind)
    _contract(bind)


def downgrade():
    raise RuntimeError(
        "WMS ownership contract is one-way: automatic downgrade could collapse "
        "valid cross-seller natural-key duplicates"
    )
