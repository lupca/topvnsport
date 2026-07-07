"""hybrid pim schema and seed

Revision ID: 20260706_000001
Revises:
Create Date: 2026-07-06
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260706_000001"
down_revision = None
branch_labels = None
depends_on = None


attribute_families_table = sa.table(
    "attribute_families",
    sa.column("id", sa.Integer),
    sa.column("code", sa.String),
    sa.column("name", sa.String),
    sa.column("created_at", sa.DateTime),
)

attributes_table = sa.table(
    "attributes",
    sa.column("id", sa.Integer),
    sa.column("code", sa.String),
    sa.column("name", sa.String),
    sa.column("type", sa.String),
    sa.column("is_required", sa.Boolean),
    sa.column("is_unique", sa.Boolean),
    sa.column("is_locale_based", sa.Boolean),
    sa.column("is_channel_based", sa.Boolean),
    sa.column("created_at", sa.DateTime),
)


def upgrade() -> None:
    op.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS family_id INTEGER")
    op.execute("CREATE INDEX IF NOT EXISTS ix_products_family_id ON products (family_id)")
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'fk_products_family_id'
            ) THEN
                ALTER TABLE products
                ADD CONSTRAINT fk_products_family_id
                FOREIGN KEY (family_id) REFERENCES attribute_families(id) ON DELETE SET NULL;
            END IF;
        END $$;
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS attribute_family_attributes (
            id SERIAL PRIMARY KEY,
            family_id INTEGER NOT NULL REFERENCES attribute_families(id) ON DELETE CASCADE,
            attribute_id INTEGER NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
            display_order INTEGER NOT NULL DEFAULT 1,
            CONSTRAINT uq_family_attribute UNIQUE (family_id, attribute_id)
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_attribute_family_attributes_family_id ON attribute_family_attributes (family_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_attribute_family_attributes_attribute_id ON attribute_family_attributes (attribute_id)")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS product_attribute_values (
            id SERIAL PRIMARY KEY,
            product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            attribute_id INTEGER NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
            value_string VARCHAR(255),
            value_decimal FLOAT,
            CONSTRAINT uq_product_attribute_value UNIQUE (product_id, attribute_id)
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_product_attribute_values_product_id ON product_attribute_values (product_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_product_attribute_values_attribute_id ON product_attribute_values (attribute_id)")

    op.execute(
        "DELETE FROM attribute_families WHERE code IN ('family_racket', 'family_shoes', 'family_string')"
    )
    op.execute(
        "DELETE FROM attributes WHERE code IN ('brand', 'balance', 'stiffness', 'maxTension', 'thickness', 'material', 'size')"
    )

    import datetime
    now = datetime.datetime.utcnow()

    op.bulk_insert(
        attribute_families_table,
        [
            {"code": "family_racket", "name": "Bộ Vợt", "created_at": now},
            {"code": "family_shoes", "name": "Bộ Giày", "created_at": now},
            {"code": "family_string", "name": "Bộ Cước", "created_at": now},
        ],
    )

    op.bulk_insert(
        attributes_table,
        [
            {
                "code": "brand",
                "name": "Thương hiệu",
                "type": "text",
                "is_required": True,
                "is_unique": False,
                "is_locale_based": False,
                "is_channel_based": False,
                "created_at": now,
            },
            {
                "code": "balance",
                "name": "Điểm cân bằng",
                "type": "decimal",
                "is_required": False,
                "is_unique": False,
                "is_locale_based": False,
                "is_channel_based": False,
                "created_at": now,
            },
            {
                "code": "stiffness",
                "name": "Độ cứng",
                "type": "text",
                "is_required": False,
                "is_unique": False,
                "is_locale_based": False,
                "is_channel_based": False,
                "created_at": now,
            },
            {
                "code": "maxTension",
                "name": "Sức căng",
                "type": "decimal",
                "is_required": False,
                "is_unique": False,
                "is_locale_based": False,
                "is_channel_based": False,
                "created_at": now,
            },
            {
                "code": "thickness",
                "name": "Đường kính cước",
                "type": "text",
                "is_required": False,
                "is_unique": False,
                "is_locale_based": False,
                "is_channel_based": False,
                "created_at": now,
            },
            {
                "code": "material",
                "name": "Chất liệu",
                "type": "text",
                "is_required": False,
                "is_unique": False,
                "is_locale_based": False,
                "is_channel_based": False,
                "created_at": now,
            },
            {
                "code": "size",
                "name": "Kích cỡ",
                "type": "text",
                "is_required": False,
                "is_unique": False,
                "is_locale_based": False,
                "is_channel_based": False,
                "created_at": now,
            },
        ],
    )

    op.execute(
        """
        INSERT INTO attribute_family_attributes (family_id, attribute_id, display_order)
        SELECT f.id, a.id, x.display_order
        FROM (
            VALUES
                ('family_racket', 'brand', 1),
                ('family_racket', 'balance', 2),
                ('family_racket', 'stiffness', 3),
                ('family_racket', 'maxTension', 4),
                ('family_shoes', 'brand', 1),
                ('family_shoes', 'size', 2),
                ('family_shoes', 'material', 3),
                ('family_string', 'brand', 1),
                ('family_string', 'thickness', 2)
        ) AS x(family_code, attr_code, display_order)
        JOIN attribute_families f ON f.code = x.family_code
        JOIN attributes a ON a.code = x.attr_code
        """
    )


def downgrade() -> None:
    op.drop_index("ix_product_attribute_values_attribute_id", table_name="product_attribute_values")
    op.drop_index("ix_product_attribute_values_product_id", table_name="product_attribute_values")
    op.drop_table("product_attribute_values")

    op.drop_index("ix_attribute_family_attributes_attribute_id", table_name="attribute_family_attributes")
    op.drop_index("ix_attribute_family_attributes_family_id", table_name="attribute_family_attributes")
    op.drop_table("attribute_family_attributes")

    op.drop_constraint("fk_products_family_id", "products", type_="foreignkey")
    op.drop_index("ix_products_family_id", table_name="products")
    op.drop_column("products", "family_id")
