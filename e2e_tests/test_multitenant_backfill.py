"""Four-database contract test using production migration functions."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import subprocess
import sys

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy.exc import IntegrityError


ROOT = Path(__file__).resolve().parents[1]
TENANT = "eadb17a4-1b2d-5ffd-8d99-6091f167aeef"
SELLER_A = "f02a9c68-f656-5597-9f9b-7c8e28e3705d"
SELLER_B = "2c6100b7-2d10-5d58-b8cd-3d90f9103e23"
TENANT_B = "76c6b510-1b2a-5c10-b4b6-2c48078d168e"
SELLER_C = "c98b5f0b-d7b2-58ae-b168-5e721c2de29f"

MIGRATIONS = {
    "identity": ROOT / "identity-service/backend/alembic/versions/20260730_000002_backfill_default_tenant.py",
    "pmi": ROOT / "PMI/backend/alembic/versions/20260730_000003_backfill_default_tenant.py",
    "oms": ROOT / "OMS/backend/alembic/versions/0009_backfill_default_tenant.py",
    "wms": ROOT / "WMS/backend/alembic/versions/c14d5e6f7081_backfill_default_tenant.py",
}


def _load(name):
    spec = spec_from_file_location(f"backfill_{name}", MIGRATIONS[name])
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _run(name, engine, monkeypatch):
    if name == "identity":
        monkeypatch.setenv("DEFAULT_SELLER_TAX_CODE", "0101234567")
    module = _load(name)
    with engine.begin() as connection:
        context = MigrationContext.configure(connection)
        with Operations.context(context):
            module.upgrade()


def _execute_all(connection, statements):
    for statement in statements:
        connection.exec_driver_sql(statement)


def _identity_fixture(engine):
    with engine.begin() as c:
        _execute_all(c, (
            "CREATE TABLE tenants (id VARCHAR(36) PRIMARY KEY, code VARCHAR(50) NOT NULL UNIQUE, name VARCHAR(255) NOT NULL, is_active BOOLEAN NOT NULL)",
            "CREATE TABLE sellers (id VARCHAR(36) PRIMARY KEY, tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id), tax_code VARCHAR(100) NOT NULL, name VARCHAR(255) NOT NULL, is_active BOOLEAN NOT NULL, CONSTRAINT uq_sellers_tenant_tax_code UNIQUE (tenant_id, tax_code))",
            "CREATE TABLE staff_accounts (id INTEGER PRIMARY KEY, username VARCHAR(100) NOT NULL, tenant_id VARCHAR(36) NULL REFERENCES tenants(id))",
            "INSERT INTO staff_accounts VALUES (1, 'one', NULL)",
            "INSERT INTO staff_accounts VALUES (2, 'two', NULL)",
        ))


def _pmi_fixture(engine):
    with engine.begin() as c:
        _execute_all(c, (
            "CREATE TABLE categories (id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES categories(id), code VARCHAR(100) NOT NULL, tenant_id VARCHAR(36), seller_id VARCHAR(36))",
            "CREATE UNIQUE INDEX ix_categories_code ON categories(code)",
            "CREATE TABLE products (id INTEGER PRIMARY KEY, category_id INTEGER REFERENCES categories(id), product_code VARCHAR(100) NOT NULL, slug VARCHAR(255), tenant_id VARCHAR(36), seller_id VARCHAR(36))",
            "CREATE UNIQUE INDEX ix_products_product_code ON products(product_code)",
            "CREATE UNIQUE INDEX ix_products_slug ON products(slug)",
            "CREATE TABLE product_variants (id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id), sku_code VARCHAR(100) NOT NULL, tenant_id VARCHAR(36), seller_id VARCHAR(36))",
            "CREATE UNIQUE INDEX ix_product_variants_sku_code ON product_variants(sku_code)",
            "CREATE TABLE channels (id INTEGER PRIMARY KEY, code VARCHAR(100) NOT NULL, tenant_id VARCHAR(36), seller_id VARCHAR(36))",
            "CREATE UNIQUE INDEX ix_channels_code ON channels(code)",
            "CREATE TABLE promotions (id VARCHAR(36) PRIMARY KEY, code VARCHAR(100) NOT NULL, tenant_id VARCHAR(36), seller_id VARCHAR(36))",
            "CREATE UNIQUE INDEX ix_promotions_code ON promotions(code)",
            "CREATE TABLE promotion_scope (id VARCHAR(36) PRIMARY KEY, promotion_id VARCHAR(36) NOT NULL REFERENCES promotions(id), tenant_id VARCHAR(36), seller_id VARCHAR(36))",
            "CREATE TABLE promotion_computed_prices (id VARCHAR(36) PRIMARY KEY, promotion_id VARCHAR(36) REFERENCES promotions(id), variant_id VARCHAR(100) NOT NULL, tenant_id VARCHAR(36), seller_id VARCHAR(36))",
            "CREATE TABLE promotion_usage_log (id VARCHAR(36) PRIMARY KEY, promotion_id VARCHAR(36) NOT NULL REFERENCES promotions(id), tenant_id VARCHAR(36), seller_id VARCHAR(36))",
            "INSERT INTO categories VALUES (1, NULL, 'CAT-1', NULL, NULL), (2, 1, 'CAT-2', NULL, NULL)",
            "INSERT INTO products VALUES (1, 1, 'PROD-1', 'prod-1', NULL, NULL), (2, 2, 'PROD-2', 'prod-2', NULL, NULL)",
            "INSERT INTO product_variants VALUES (1, 1, 'SKU-1', NULL, NULL), (2, 2, 'SKU-2', NULL, NULL)",
            "INSERT INTO channels VALUES (1, 'WEB', NULL, NULL), (2, 'POS', NULL, NULL)",
            "INSERT INTO promotions VALUES ('p1', 'PROMO-1', NULL, NULL), ('p2', 'PROMO-2', NULL, NULL)",
            "INSERT INTO promotion_scope VALUES ('s1', 'p1', NULL, NULL), ('s2', 'p2', NULL, NULL)",
            "INSERT INTO promotion_computed_prices VALUES ('c1', 'p1', '1', NULL, NULL), ('c2', NULL, '2', NULL, NULL)",
            "INSERT INTO promotion_usage_log VALUES ('u1', 'p1', NULL, NULL), ('u2', 'p2', NULL, NULL)",
        ))


def _oms_fixture(engine):
    with engine.begin() as c:
        _execute_all(c, (
            "CREATE TABLE customers (id INTEGER PRIMARY KEY, phone VARCHAR(30) NOT NULL, tenant_id VARCHAR(36), seller_id VARCHAR(36))",
            "CREATE UNIQUE INDEX ix_customers_phone ON customers(phone)",
            "CREATE TABLE channels (id INTEGER PRIMARY KEY, code VARCHAR(30) NOT NULL, tenant_id VARCHAR(36), seller_id VARCHAR(36))",
            "CREATE UNIQUE INDEX ix_channels_code ON channels(code)",
            "CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id), channel_id INTEGER NOT NULL REFERENCES channels(id), order_number VARCHAR(30) NOT NULL, tenant_id VARCHAR(36), seller_id VARCHAR(36))",
            "CREATE UNIQUE INDEX ix_orders_order_number ON orders(order_number)",
            "CREATE TABLE fulfillment_orders (id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id), fulfillment_number VARCHAR(30) NOT NULL, tenant_id VARCHAR(36), seller_id VARCHAR(36))",
            "CREATE UNIQUE INDEX ix_fulfillment_orders_fulfillment_number ON fulfillment_orders(fulfillment_number)",
            "CREATE TABLE order_events (id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id), tenant_id VARCHAR(36), seller_id VARCHAR(36))",
            "CREATE TABLE payments (id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id), tenant_id VARCHAR(36), seller_id VARCHAR(36))",
            "INSERT INTO customers VALUES (1, '0901', NULL, NULL), (2, '0902', NULL, NULL)",
            "INSERT INTO channels VALUES (1, 'WEB', NULL, NULL), (2, 'POS', NULL, NULL)",
            "INSERT INTO orders VALUES (1, 1, 1, 'ORD-1', NULL, NULL), (2, 2, 2, 'ORD-2', NULL, NULL)",
            "INSERT INTO fulfillment_orders VALUES (1, 1, 'FUL-1', NULL, NULL), (2, 2, 'FUL-2', NULL, NULL)",
            "INSERT INTO order_events VALUES (1, 1, NULL, NULL), (2, 2, NULL, NULL)",
            "INSERT INTO payments VALUES (1, 1, NULL, NULL), (2, 2, NULL, NULL)",
        ))


def _wms_fixture(engine):
    with engine.begin() as c:
        _execute_all(c, (
            "CREATE TABLE warehouses (id INTEGER PRIMARY KEY, code VARCHAR(30) NOT NULL, tenant_id VARCHAR(36), seller_id VARCHAR(36), CONSTRAINT uq_warehouse_owner_code UNIQUE (tenant_id, seller_id, code))",
            "CREATE TABLE locations (id INTEGER PRIMARY KEY, warehouse_id INTEGER NOT NULL REFERENCES warehouses(id), location_code VARCHAR(30) NOT NULL, tenant_id VARCHAR(36), seller_id VARCHAR(36), CONSTRAINT uq_location_owner_code UNIQUE (tenant_id, seller_id, location_code))",
            "CREATE TABLE inventories (id INTEGER PRIMARY KEY, location_id INTEGER NOT NULL REFERENCES locations(id), sku_code VARCHAR(30) NOT NULL, tenant_id VARCHAR(36), seller_id VARCHAR(36), CONSTRAINT uq_inventory_sku_location UNIQUE (sku_code, location_id), CONSTRAINT uq_inventory_owner_sku_location UNIQUE (tenant_id, seller_id, sku_code, location_id))",
            "CREATE TABLE barcode_mappings (id INTEGER PRIMARY KEY, barcode VARCHAR(30) NOT NULL, sku_code VARCHAR(30) NOT NULL, tenant_id VARCHAR(36), seller_id VARCHAR(36), CONSTRAINT uq_barcode_mappings_sku_code UNIQUE (sku_code), CONSTRAINT uq_barcode_owner_barcode UNIQUE (tenant_id, seller_id, barcode), CONSTRAINT uq_barcode_owner_sku UNIQUE (tenant_id, seller_id, sku_code))",
            "CREATE TABLE inbound_shipments (id INTEGER PRIMARY KEY, warehouse_id INTEGER NOT NULL REFERENCES warehouses(id), inbound_number VARCHAR(30) NOT NULL, tenant_id VARCHAR(36), seller_id VARCHAR(36), CONSTRAINT uq_inbound_owner_number UNIQUE (tenant_id, seller_id, inbound_number))",
            "CREATE TABLE inbound_items (id INTEGER PRIMARY KEY, inbound_shipment_id INTEGER NOT NULL REFERENCES inbound_shipments(id), location_id INTEGER REFERENCES locations(id), tenant_id VARCHAR(36), seller_id VARCHAR(36))",
            "CREATE TABLE fulfillment_orders_wms (id INTEGER PRIMARY KEY, fulfillment_number VARCHAR(30) NOT NULL, tenant_id VARCHAR(36), seller_id VARCHAR(36), CONSTRAINT uq_fulfillment_owner_number UNIQUE (tenant_id, seller_id, fulfillment_number))",
            "CREATE TABLE pick_list_items (id INTEGER PRIMARY KEY, fulfillment_order_id INTEGER NOT NULL REFERENCES fulfillment_orders_wms(id), location_id INTEGER REFERENCES locations(id), tenant_id VARCHAR(36), seller_id VARCHAR(36))",
            "CREATE TABLE packing_sessions (id INTEGER PRIMARY KEY, fulfillment_order_id INTEGER NOT NULL REFERENCES fulfillment_orders_wms(id), tenant_id VARCHAR(36), seller_id VARCHAR(36))",
            "CREATE TABLE stock_transactions (id INTEGER PRIMARY KEY, location_id INTEGER NOT NULL REFERENCES locations(id), tenant_id VARCHAR(36), seller_id VARCHAR(36))",
            "INSERT INTO warehouses VALUES (1, 'WH-1', NULL, NULL), (2, 'WH-2', NULL, NULL)",
            "INSERT INTO locations VALUES (1, 1, 'LOC-1', NULL, NULL), (2, 2, 'LOC-2', NULL, NULL)",
            "INSERT INTO inventories VALUES (1, 1, 'SKU-1', NULL, NULL), (2, 2, 'SKU-2', NULL, NULL)",
            "INSERT INTO barcode_mappings VALUES (1, 'BC-1', 'SKU-1', NULL, NULL), (2, 'BC-2', 'SKU-2', NULL, NULL)",
            "INSERT INTO inbound_shipments VALUES (1, 1, 'IN-1', NULL, NULL), (2, 2, 'IN-2', NULL, NULL)",
            "INSERT INTO inbound_items VALUES (1, 1, 1, NULL, NULL), (2, 2, 2, NULL, NULL)",
            "INSERT INTO fulfillment_orders_wms VALUES (1, 'FUL-1', NULL, NULL), (2, 'FUL-2', NULL, NULL)",
            "INSERT INTO pick_list_items VALUES (1, 1, 1, NULL, NULL), (2, 2, 2, NULL, NULL)",
            "INSERT INTO packing_sessions VALUES (1, 1, NULL, NULL), (2, 2, NULL, NULL)",
            "INSERT INTO stock_transactions VALUES (1, 1, NULL, NULL), (2, 2, NULL, NULL)",
        ))


FIXTURES = {
    "identity": _identity_fixture,
    "pmi": _pmi_fixture,
    "oms": _oms_fixture,
    "wms": _wms_fixture,
}


@pytest.fixture
def databases(tmp_path):
    engines = {
        name: sa.create_engine(f"sqlite:///{tmp_path / f'{name}.db'}")
        for name in MIGRATIONS
    }
    for name, engine in engines.items():
        FIXTURES[name](engine)
    yield engines
    for engine in engines.values():
        engine.dispose()


def _counts(engine):
    with engine.connect() as c:
        return {
            table: c.execute(sa.text(f'SELECT count(*) FROM "{table}"')).scalar()
            for table in sa.inspect(c).get_table_names()
        }


def test_four_database_backfill_is_idempotent_and_isolated(databases, monkeypatch):
    before = {name: _counts(engine) for name, engine in databases.items()}
    for name, engine in databases.items():
        _run(name, engine, monkeypatch)
    after_first = {name: _counts(engine) for name, engine in databases.items()}
    for name, engine in databases.items():
        _run(name, engine, monkeypatch)
    after_second = {name: _counts(engine) for name, engine in databases.items()}

    for name in ("pmi", "oms", "wms"):
        assert before[name] == after_first[name] == after_second[name]
    assert after_first["identity"] == after_second["identity"]
    assert after_first["identity"]["tenants"] == before["identity"]["tenants"] + 1
    assert after_first["identity"]["sellers"] == before["identity"]["sellers"] + 1
    with databases["identity"].begin() as c:
        c.execute(
            sa.text(
                "INSERT INTO tenants VALUES (:id, 'other', 'Other Tenant', 1)"
            ),
            {"id": TENANT_B},
        )
        c.execute(
            sa.text(
                "INSERT INTO sellers VALUES "
                "(:seller_b, :tenant_a, '0101234568', 'Seller B', 1), "
                "(:seller_c, :tenant_b, '0101234567', 'Seller C', 1)"
            ),
            {
                "seller_b": SELLER_B,
                "tenant_a": TENANT,
                "seller_c": SELLER_C,
                "tenant_b": TENANT_B,
            },
        )

    owned = {
        "pmi": _load("pmi").OWNED_TABLES,
        "oms": _load("oms").OWNED_TABLES,
        "wms": _load("wms").OWNED_TABLES,
    }
    for service, tables in owned.items():
        with databases[service].connect() as c:
            for table in tables:
                assert c.execute(
                    sa.text(
                        f'SELECT count(*) FROM "{table}" WHERE '
                        "tenant_id<>:tenant OR seller_id<>:seller"
                    ),
                    {"tenant": TENANT, "seller": SELLER_A},
                ).scalar() == 0
                columns = {column["name"]: column for column in sa.inspect(c).get_columns(table)}
                assert columns["tenant_id"]["nullable"] is False
                assert columns["seller_id"]["nullable"] is False

    expected_revisions = {
        "identity": "20260730_000002",
        "pmi": "20260730_000003",
        "oms": "0009_backfill_default_tenant",
        "wms": "c14d5e6f7081",
    }
    for service, engine in databases.items():
        with engine.begin() as c:
            c.exec_driver_sql("CREATE TABLE alembic_version (version_num VARCHAR(64) NOT NULL)")
            c.execute(
                sa.text("INSERT INTO alembic_version VALUES (:revision)"),
                {"revision": expected_revisions[service]},
            )
    verification = subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts/verify_multitenant_backfill.py"),
            "--check-only",
            "--tenant-id",
            TENANT,
            "--seller-id",
            SELLER_A,
            *[
                argument
                for service, engine in databases.items()
                for argument in (f"--{service}-url", str(engine.url))
            ],
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    assert verification.returncode == 0, verification.stdout + verification.stderr
    assert "SUMMARY failures=0" in verification.stdout

    cases = (
        ("pmi", "categories", "code", "CAT-1"),
        ("oms", "customers", "phone", "0901"),
        ("wms", "warehouses", "code", "WH-1"),
    )
    for service, table, key, value in cases:
        engine = databases[service]
        with engine.begin() as c:
            c.execute(
                sa.text(
                    f'INSERT INTO "{table}" (id, "{key}", tenant_id, seller_id) '
                    "VALUES (100, :value, :tenant, :seller)"
                ),
                {"value": value, "tenant": TENANT, "seller": SELLER_B},
            )
        with pytest.raises(IntegrityError):
            with engine.begin() as c:
                c.execute(
                    sa.text(
                        f'INSERT INTO "{table}" (id, "{key}", tenant_id, seller_id) '
                        "VALUES (101, :value, :tenant, :seller)"
                    ),
                    {"value": value, "tenant": TENANT, "seller": SELLER_A},
                )
        with engine.connect() as c:
            rows_a = c.execute(
                sa.text(f'SELECT id FROM "{table}" WHERE seller_id=:seller'),
                {"seller": SELLER_A},
            ).scalars().all()
            rows_b = c.execute(
                sa.text(f'SELECT id FROM "{table}" WHERE seller_id=:seller'),
                {"seller": SELLER_B},
            ).scalars().all()
            assert 100 not in rows_a
            assert rows_b == [100]


@pytest.mark.parametrize(
    ("service", "orphan_sql", "probe_table"),
    (
        (
            "pmi",
            "INSERT INTO product_variants VALUES (99, 999, 'ORPHAN', NULL, NULL)",
            "categories",
        ),
        (
            "oms",
            "INSERT INTO order_events VALUES (99, 999, NULL, NULL)",
            "customers",
        ),
        (
            "wms",
            "INSERT INTO inventories VALUES (99, 999, 'ORPHAN', NULL, NULL)",
            "warehouses",
        ),
    ),
)
def test_preflight_aborts_before_mutating_roots(
    databases, monkeypatch, service, orphan_sql, probe_table
):
    with databases[service].begin() as c:
        c.exec_driver_sql(orphan_sql)
    with pytest.raises(RuntimeError, match="preflight failed"):
        _run(service, databases[service], monkeypatch)
    with databases[service].connect() as c:
        assert c.execute(
            sa.text(
                f'SELECT count(*) FROM "{probe_table}" WHERE tenant_id IS NOT NULL '
                "OR seller_id IS NOT NULL"
            )
        ).scalar() == 0


def test_identity_requires_tax_code_before_writes(databases, monkeypatch):
    monkeypatch.delenv("DEFAULT_SELLER_TAX_CODE", raising=False)
    module = _load("identity")
    with pytest.raises(RuntimeError, match="default_seller_tax_code is required"):
        with databases["identity"].begin() as connection:
            context = MigrationContext.configure(connection)
            with Operations.context(context):
                module.upgrade()
    assert _counts(databases["identity"])["tenants"] == 0
