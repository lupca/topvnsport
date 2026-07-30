"""Backfill and contract PMI tenant/seller ownership.

Revision ID: 20260730_000003
Revises: 20260730_000002
Create Date: 2026-07-30
"""

from alembic import op
import sqlalchemy as sa


revision = "20260730_000003"
down_revision = "20260730_000002"
branch_labels = None
depends_on = None

TENANT_ID = "eadb17a4-1b2d-5ffd-8d99-6091f167aeef"
SELLER_ID = "f02a9c68-f656-5597-9f9b-7c8e28e3705d"
OWNED_TABLES = (
    "categories", "products", "product_variants", "channels", "promotions",
    "promotion_scope", "promotion_computed_prices", "promotion_usage_log",
)
ROOTS = ("categories", "products", "channels", "promotions")
CHILDREN = {
    "product_variants": ("products", "product_id", "id"),
    "promotion_scope": ("promotions", "promotion_id", "id"),
    "promotion_usage_log": ("promotions", "promotion_id", "id"),
}
NATURAL_KEYS = (
    ("categories", ("code",), "uq_categories_seller_code", ("ix_categories_code",)),
    ("products", ("product_code",), "uq_products_seller_product_code", ("ix_products_product_code",)),
    ("products", ("slug",), "uq_products_seller_slug", ("ix_products_slug",)),
    ("product_variants", ("sku_code",), "uq_product_variants_seller_sku_code", ("ix_product_variants_sku_code",)),
    ("channels", ("code",), "uq_channels_seller_code", ("ix_channels_code",)),
    ("promotions", ("code",), "uq_promotions_seller_code", ("ix_promotions_code",)),
)


def _count(bind, sql, **params):
    return bind.execute(sa.text(sql), params).scalar()


def _owner_preflight(bind):
    failures = []
    for table in OWNED_TABLES:
        bad = _count(
            bind,
            f'SELECT count(*) FROM "{table}" WHERE '
            "(tenant_id IS NOT NULL OR seller_id IS NOT NULL) AND "
            "(tenant_id IS NULL OR seller_id IS NULL OR "
            "tenant_id <> :tenant_id OR seller_id <> :seller_id)",
            tenant_id=TENANT_ID,
            seller_id=SELLER_ID,
        )
        if bad:
            failures.append(f"{table}.unknown_or_partial_owner={bad}")
    for child, (parent, fk, pk) in CHILDREN.items():
        orphan = _count(
            bind,
            f'SELECT count(*) FROM "{child}" c LEFT JOIN "{parent}" p '
            f'ON c."{fk}" = p."{pk}" WHERE p."{pk}" IS NULL',
        )
        if orphan:
            failures.append(f"{child}.orphan={orphan}")
    # A computed price may be linked by promotion, or by its variant string.
    orphan = _count(
        bind,
        "SELECT count(*) FROM promotion_computed_prices c "
        "LEFT JOIN promotions p ON c.promotion_id = p.id "
        "LEFT JOIN product_variants v ON c.variant_id = CAST(v.id AS VARCHAR) "
        "WHERE p.id IS NULL AND v.id IS NULL",
    )
    if orphan:
        failures.append(f"promotion_computed_prices.orphan={orphan}")
    # Every accepted legacy owner becomes SELLER_ID, so grouping by the natural
    # key predicts the target seller-scoped constraint before any UPDATE runs.
    for table, keys, _target, _legacy in NATURAL_KEYS:
        nonnull = " AND ".join(f'"{key}" IS NOT NULL' for key in keys)
        group = ", ".join(f'"{key}"' for key in keys)
        duplicate = _count(
            bind,
            f'SELECT count(*) FROM (SELECT 1 FROM "{table}" WHERE {nonnull} '
            f"GROUP BY {group} HAVING count(*)>1) duplicate_groups",
        )
        if duplicate:
            failures.append(f"{table}.{'+'.join(keys)}.target_duplicate={duplicate}")
    if failures:
        raise RuntimeError("PMI ownership preflight failed: " + ", ".join(failures))


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
    for child, (parent, fk, pk) in CHILDREN.items():
        bind.execute(
            sa.text(
                f'UPDATE "{child}" SET tenant_id=(SELECT p.tenant_id FROM "{parent}" p '
                f'WHERE p."{pk}"="{child}"."{fk}"), seller_id=('
                f'SELECT p.seller_id FROM "{parent}" p WHERE p."{pk}"="{child}"."{fk}")'
            )
        )
    bind.execute(
        sa.text(
            "UPDATE promotion_computed_prices SET "
            "tenant_id=COALESCE((SELECT p.tenant_id FROM promotions p WHERE "
            "p.id=promotion_computed_prices.promotion_id), (SELECT v.tenant_id "
            "FROM product_variants v WHERE promotion_computed_prices.variant_id="
            "CAST(v.id AS VARCHAR))), seller_id=COALESCE((SELECT p.seller_id "
            "FROM promotions p WHERE p.id=promotion_computed_prices.promotion_id), "
            "(SELECT v.seller_id FROM product_variants v WHERE "
            "promotion_computed_prices.variant_id=CAST(v.id AS VARCHAR)))"
        )
    )


def _validate(bind):
    failures = []
    for table in OWNED_TABLES:
        invalid = _count(
            bind,
            f'SELECT count(*) FROM "{table}" WHERE tenant_id IS NULL OR '
            "seller_id IS NULL OR tenant_id <> :tenant_id OR seller_id <> :seller_id",
            tenant_id=TENANT_ID,
            seller_id=SELLER_ID,
        )
        if invalid:
            failures.append(f"{table}.invalid_owner={invalid}")
    for child, (parent, fk, pk) in CHILDREN.items():
        mismatch = _count(
            bind,
            f'SELECT count(*) FROM "{child}" c JOIN "{parent}" p '
            f'ON c."{fk}"=p."{pk}" WHERE c.tenant_id<>p.tenant_id '
            "OR c.seller_id<>p.seller_id",
        )
        if mismatch:
            failures.append(f"{child}.parent_mismatch={mismatch}")
    for table, keys, _target, _legacy in NATURAL_KEYS:
        nonnull = " AND ".join(f'"{key}" IS NOT NULL' for key in keys)
        group = ", ".join(("seller_id",) + keys)
        duplicate = _count(
            bind,
            f'SELECT count(*) FROM (SELECT 1 FROM "{table}" WHERE {nonnull} '
            f"GROUP BY {group} HAVING count(*) > 1) duplicates",
        )
        if duplicate:
            failures.append(f"{table}.{'+'.join(keys)}.duplicate={duplicate}")
    if failures:
        raise RuntimeError("PMI contract validation failed: " + ", ".join(failures))


def _contract(bind):
    for table in OWNED_TABLES:
        cols = {c["name"]: c for c in sa.inspect(bind).get_columns(table)}
        if cols["tenant_id"]["nullable"] or cols["seller_id"]["nullable"]:
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
                # Keep the lookup index expected by the ORM.
                op.create_index(name, table, list(keys), unique=False)
            elif name in uniques:
                with op.batch_alter_table(table) as batch:
                    batch.drop_constraint(name, type_="unique")
        inspector = sa.inspect(bind)
        existing = {u["name"] for u in inspector.get_unique_constraints(table)}
        if target not in existing:
            with op.batch_alter_table(table) as batch:
                batch.create_unique_constraint(target, ["seller_id", *keys])


def upgrade():
    bind = op.get_bind()
    _owner_preflight(bind)
    _backfill(bind)
    _validate(bind)
    _contract(bind)


def downgrade():
    raise RuntimeError(
        "PMI ownership contract is one-way: automatic downgrade could collapse "
        "valid cross-seller natural-key duplicates"
    )
