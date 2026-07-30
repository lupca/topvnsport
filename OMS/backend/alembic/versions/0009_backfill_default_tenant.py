"""Backfill and contract OMS tenant/seller ownership.

Revision ID: 0009_backfill_default_tenant
Revises: 0008_add_tenant_seller_scope
Create Date: 2026-07-30
"""

from alembic import op
import sqlalchemy as sa


revision = "0009_backfill_default_tenant"
down_revision = "0008_add_tenant_seller_scope"
branch_labels = None
depends_on = None

TENANT_ID = "eadb17a4-1b2d-5ffd-8d99-6091f167aeef"
SELLER_ID = "f02a9c68-f656-5597-9f9b-7c8e28e3705d"
OWNED_TABLES = (
    "customers", "channels", "orders", "fulfillment_orders", "order_events",
    "payments",
)
CHILDREN = {
    "fulfillment_orders": ("orders", "order_id"),
    "order_events": ("orders", "order_id"),
    "payments": ("orders", "order_id"),
}
NATURAL_KEYS = (
    ("customers", ("phone",), "uq_customers_seller_phone", ("ix_customers_phone",)),
    ("channels", ("code",), "uq_channels_seller_code", ("ix_channels_code",)),
    ("orders", ("order_number",), "uq_orders_seller_order_number", ("ix_orders_order_number",)),
    ("fulfillment_orders", ("fulfillment_number",), "uq_fulfillment_orders_seller_number", ("ix_fulfillment_orders_fulfillment_number",)),
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
    # Orders are independently queried, but their two required parents must
    # exist and agree before the default pair is assigned.
    orphan_orders = _count(
        bind,
        "SELECT count(*) FROM orders o LEFT JOIN customers c ON o.customer_id=c.id "
        "LEFT JOIN channels ch ON o.channel_id=ch.id "
        "WHERE c.id IS NULL OR ch.id IS NULL",
    )
    if orphan_orders:
        failures.append(f"orders.orphan={orphan_orders}")
    for child, (parent, fk) in CHILDREN.items():
        orphan = _count(
            bind,
            f'SELECT count(*) FROM "{child}" c LEFT JOIN "{parent}" p '
            f'ON c."{fk}"=p.id WHERE p.id IS NULL',
        )
        if orphan:
            failures.append(f"{child}.orphan={orphan}")
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
        raise RuntimeError("OMS ownership preflight failed: " + ", ".join(failures))


def _backfill(bind):
    params = {"tenant_id": TENANT_ID, "seller_id": SELLER_ID}
    for table in ("customers", "channels"):
        bind.execute(
            sa.text(
                f'UPDATE "{table}" SET tenant_id=:tenant_id, seller_id=:seller_id '
                "WHERE tenant_id IS NULL AND seller_id IS NULL"
            ),
            params,
        )
    bind.execute(
        sa.text(
            "UPDATE orders SET tenant_id=(SELECT c.tenant_id FROM customers c "
            "WHERE c.id=orders.customer_id), seller_id=(SELECT c.seller_id FROM "
            "customers c WHERE c.id=orders.customer_id)"
        )
    )
    for child, (parent, fk) in CHILDREN.items():
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
    order_mismatch = _count(
        bind,
        "SELECT count(*) FROM orders o JOIN customers c ON o.customer_id=c.id "
        "JOIN channels ch ON o.channel_id=ch.id WHERE "
        "o.tenant_id<>c.tenant_id OR o.seller_id<>c.seller_id OR "
        "o.tenant_id<>ch.tenant_id OR o.seller_id<>ch.seller_id",
    )
    if order_mismatch:
        failures.append(f"orders.parent_mismatch={order_mismatch}")
    for child, (parent, fk) in CHILDREN.items():
        mismatch = _count(
            bind,
            f'SELECT count(*) FROM "{child}" c JOIN "{parent}" p '
            f'ON c."{fk}"=p.id WHERE c.tenant_id<>p.tenant_id '
            "OR c.seller_id<>p.seller_id",
        )
        if mismatch:
            failures.append(f"{child}.parent_mismatch={mismatch}")
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
        raise RuntimeError("OMS contract validation failed: " + ", ".join(failures))


def _contract(bind):
    for table in OWNED_TABLES:
        columns = {c["name"]: c for c in sa.inspect(bind).get_columns(table)}
        if columns["tenant_id"]["nullable"] or columns["seller_id"]["nullable"]:
            with op.batch_alter_table(table) as batch:
                batch.alter_column("tenant_id", existing_type=sa.Uuid(), nullable=False)
                batch.alter_column("seller_id", existing_type=sa.Uuid(), nullable=False)
    for table, keys, target, legacy_names in NATURAL_KEYS:
        inspector = sa.inspect(bind)
        indexes = {i["name"]: i for i in inspector.get_indexes(table)}
        uniques = {u["name"]: u for u in inspector.get_unique_constraints(table)}
        for name in legacy_names:
            if name in indexes and indexes[name].get("unique"):
                op.drop_index(name, table_name=table)
                op.create_index(name, table, list(keys), unique=False)
            elif name in uniques:
                with op.batch_alter_table(table) as batch:
                    batch.drop_constraint(name, type_="unique")
        if target not in {
            u["name"] for u in sa.inspect(bind).get_unique_constraints(table)
        }:
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
        "OMS ownership contract is one-way: automatic downgrade could collapse "
        "valid cross-seller natural-key duplicates"
    )
