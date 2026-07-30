#!/usr/bin/env python3
"""Read-only verification for the four-database ownership contract."""

from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass

import sqlalchemy as sa


EXPECTED_REVISIONS = {
    "identity": "20260730_000002",
    "pmi": "20260730_000003",
    "oms": "0009_backfill_default_tenant",
    "wms": "c14d5e6f7081",
}
OWNED = {
    "pmi": (
        "categories", "products", "product_variants", "channels", "promotions",
        "promotion_scope", "promotion_computed_prices", "promotion_usage_log",
    ),
    "oms": (
        "customers", "channels", "orders", "fulfillment_orders",
        "order_events", "payments",
    ),
    "wms": (
        "warehouses", "locations", "inventories", "barcode_mappings",
        "inbound_shipments", "inbound_items", "fulfillment_orders_wms",
        "pick_list_items", "packing_sessions", "stock_transactions",
    ),
}
PARENTS = {
    "pmi": (
        ("product_variants", "product_id", "products"),
        ("promotion_scope", "promotion_id", "promotions"),
        ("promotion_usage_log", "promotion_id", "promotions"),
    ),
    "oms": (
        ("fulfillment_orders", "order_id", "orders"),
        ("order_events", "order_id", "orders"),
        ("payments", "order_id", "orders"),
    ),
    "wms": (
        ("locations", "warehouse_id", "warehouses"),
        ("inventories", "location_id", "locations"),
        ("inbound_shipments", "warehouse_id", "warehouses"),
        ("inbound_items", "inbound_shipment_id", "inbound_shipments"),
        ("pick_list_items", "fulfillment_order_id", "fulfillment_orders_wms"),
        ("packing_sessions", "fulfillment_order_id", "fulfillment_orders_wms"),
        ("stock_transactions", "location_id", "locations"),
    ),
}
TARGET_KEYS = {
    "pmi": (
        ("categories", ("seller_id", "code")),
        ("products", ("seller_id", "product_code")),
        ("products", ("seller_id", "slug")),
        ("product_variants", ("seller_id", "sku_code")),
        ("channels", ("seller_id", "code")),
        ("promotions", ("seller_id", "code")),
    ),
    "oms": (
        ("customers", ("seller_id", "phone")),
        ("channels", ("seller_id", "code")),
        ("orders", ("seller_id", "order_number")),
        ("fulfillment_orders", ("seller_id", "fulfillment_number")),
    ),
    "wms": (
        ("warehouses", ("seller_id", "code")),
        ("locations", ("seller_id", "location_code")),
        ("inventories", ("seller_id", "sku_code", "location_id")),
        ("barcode_mappings", ("seller_id", "barcode")),
        ("barcode_mappings", ("seller_id", "sku_code")),
        ("inbound_shipments", ("seller_id", "inbound_number")),
        ("fulfillment_orders_wms", ("seller_id", "fulfillment_number")),
    ),
}


@dataclass
class Finding:
    service: str
    check: str
    count: int


def _scalar(connection, sql, **params) -> int:
    return int(connection.execute(sa.text(sql), params).scalar() or 0)


def _unique_column_sets(inspector, table):
    values = {
        tuple(item["column_names"])
        for item in inspector.get_unique_constraints(table)
    }
    values.update(
        tuple(item["column_names"])
        for item in inspector.get_indexes(table)
        if item.get("unique")
    )
    return values


def verify_identity(connection, tenant_id, seller_id):
    findings = []
    inspector = sa.inspect(connection)
    findings.append(
        Finding(
            "identity",
            "default_tenant",
            _scalar(
                connection,
                "SELECT count(*) FROM tenants WHERE id=:id AND code='topvnsport'",
                id=tenant_id,
            )
            != 1,
        )
    )
    findings.append(
        Finding(
            "identity",
            "default_seller",
            _scalar(
                connection,
                "SELECT count(*) FROM sellers WHERE id=:seller_id "
                "AND tenant_id=:tenant_id",
                seller_id=seller_id,
                tenant_id=tenant_id,
            )
            != 1,
        )
    )
    findings.append(
        Finding(
            "identity",
            "staff_null_or_unknown",
            _scalar(
                connection,
                "SELECT count(*) FROM staff_accounts s LEFT JOIN tenants t "
                "ON s.tenant_id=t.id WHERE s.tenant_id IS NULL OR t.id IS NULL",
            ),
        )
    )
    staff_columns = {
        column["name"]: column
        for column in inspector.get_columns("staff_accounts")
    }
    findings.append(
        Finding(
            "identity",
            "staff_tenant_nullable",
            int(staff_columns["tenant_id"]["nullable"]),
        )
    )
    staff_foreign_keys = {
        tuple(foreign_key["constrained_columns"])
        for foreign_key in inspector.get_foreign_keys("staff_accounts")
    }
    seller_foreign_keys = {
        tuple(foreign_key["constrained_columns"])
        for foreign_key in inspector.get_foreign_keys("sellers")
    }
    findings.append(
        Finding(
            "identity",
            "staff_tenant_fk_missing",
            int(("tenant_id",) not in staff_foreign_keys),
        )
    )
    findings.append(
        Finding(
            "identity",
            "seller_tenant_fk_missing",
            int(("tenant_id",) not in seller_foreign_keys),
        )
    )
    return findings


def verify_business(service, connection, tenant_id, seller_id):
    findings = []
    inspector = sa.inspect(connection)
    for table in OWNED[service]:
        count = _scalar(
            connection,
            f'SELECT count(*) FROM "{table}" WHERE tenant_id IS NULL OR '
            "seller_id IS NULL OR tenant_id<>:tenant_id OR seller_id<>:seller_id",
            tenant_id=tenant_id,
            seller_id=seller_id,
        )
        findings.append(Finding(service, f"{table}.null_or_unknown", count))
        nullable = sum(
            1
            for column in inspector.get_columns(table)
            if column["name"] in ("tenant_id", "seller_id") and column["nullable"]
        )
        findings.append(Finding(service, f"{table}.nullable_columns", nullable))
        ownership_foreign_keys = sum(
            1
            for foreign_key in inspector.get_foreign_keys(table)
            if set(foreign_key["constrained_columns"])
            & {"tenant_id", "seller_id"}
        )
        findings.append(
            Finding(
                service,
                f"{table}.cross_database_owner_fk",
                ownership_foreign_keys,
            )
        )
    for child, fk, parent in PARENTS[service]:
        count = _scalar(
            connection,
            f'SELECT count(*) FROM "{child}" c LEFT JOIN "{parent}" p '
            f'ON c."{fk}"=p.id WHERE p.id IS NULL OR '
            "c.tenant_id<>p.tenant_id OR c.seller_id<>p.seller_id",
        )
        findings.append(Finding(service, f"{child}.orphan_or_mismatch", count))
    for table, target in TARGET_KEYS[service]:
        uniques = _unique_column_sets(inspector, table)
        findings.append(
            Finding(service, f"{table}.{'+'.join(target)}.missing_unique", int(target not in uniques))
        )
        global_key = target[1:]
        findings.append(
            Finding(service, f"{table}.{'+'.join(global_key)}.global_unique", int(global_key in uniques))
        )
        group = ", ".join(f'"{column}"' for column in target)
        duplicate = _scalar(
            connection,
            f'SELECT count(*) FROM (SELECT 1 FROM "{table}" GROUP BY {group} '
            "HAVING count(*)>1) duplicate_groups",
        )
        findings.append(Finding(service, f"{table}.target_duplicate", duplicate))
    if service == "pmi":
        findings.extend(
            (
                Finding(
                    service,
                    "categories.parent_mismatch",
                    _scalar(
                        connection,
                        "SELECT count(*) FROM categories c JOIN categories p "
                        "ON c.parent_id=p.id WHERE c.tenant_id<>p.tenant_id OR "
                        "c.seller_id<>p.seller_id",
                    ),
                ),
                Finding(
                    service,
                    "products.category_mismatch",
                    _scalar(
                        connection,
                        "SELECT count(*) FROM products p JOIN categories c "
                        "ON p.category_id=c.id WHERE p.tenant_id<>c.tenant_id OR "
                        "p.seller_id<>c.seller_id",
                    ),
                ),
                Finding(
                    service,
                    "promotion_computed_prices.orphan_or_mismatch",
                    _scalar(
                        connection,
                        "SELECT count(*) FROM promotion_computed_prices c "
                        "LEFT JOIN promotions p ON c.promotion_id=p.id "
                        "LEFT JOIN product_variants v ON "
                        "c.variant_id=CAST(v.id AS VARCHAR) WHERE "
                        "(p.id IS NULL AND v.id IS NULL) OR "
                        "(p.id IS NOT NULL AND (c.tenant_id<>p.tenant_id OR "
                        "c.seller_id<>p.seller_id)) OR (p.id IS NULL AND "
                        "(c.tenant_id<>v.tenant_id OR c.seller_id<>v.seller_id))",
                    ),
                ),
            )
        )
    elif service == "oms":
        findings.append(
            Finding(
                service,
                "orders.parent_mismatch",
                _scalar(
                    connection,
                    "SELECT count(*) FROM orders o LEFT JOIN customers c "
                    "ON o.customer_id=c.id LEFT JOIN channels ch ON "
                    "o.channel_id=ch.id WHERE c.id IS NULL OR ch.id IS NULL OR "
                    "o.tenant_id<>c.tenant_id OR o.seller_id<>c.seller_id OR "
                    "o.tenant_id<>ch.tenant_id OR o.seller_id<>ch.seller_id",
                ),
            )
        )
    elif service == "wms":
        for table in ("inbound_items", "pick_list_items"):
            findings.append(
                Finding(
                    service,
                    f"{table}.location_or_mismatch",
                    _scalar(
                        connection,
                        f'SELECT count(*) FROM "{table}" c LEFT JOIN locations l '
                        "ON c.location_id=l.id WHERE c.location_id IS NOT NULL "
                        "AND (l.id IS NULL OR c.tenant_id<>l.tenant_id OR "
                        "c.seller_id<>l.seller_id)",
                    ),
                )
            )
    return findings


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check-only", action="store_true", help="accepted for explicit read-only operation")
    parser.add_argument("--tenant-id", required=True)
    parser.add_argument("--seller-id", required=True)
    for service in EXPECTED_REVISIONS:
        parser.add_argument(
            f"--{service}-url",
            default=os.getenv(f"{service.upper()}_DATABASE_URL"),
        )
    return parser.parse_args()


def main():
    args = parse_args()
    print(
        "RUNBOOK: backup_restore_point=REQUIRED_OPERATOR_CONFIRMATION; "
        "maintenance_window=PAUSE_WRITES_BEFORE_MIGRATION; "
        "deploy_order=Identity->PMI->OMS->WMS; "
        "rollback_boundary=APPLICATION_ONLY_AFTER_CONTRACT; "
        "automatic_downgrade=FORBIDDEN_AFTER_CROSS_SELLER_DUPLICATES."
    )
    findings = []
    for service, expected_revision in EXPECTED_REVISIONS.items():
        url = getattr(args, f"{service}_url")
        if not url:
            print(
                f"ERROR: {service.upper()}_DATABASE_URL or --{service}-url is required",
                file=sys.stderr,
            )
            return 2
        engine = sa.create_engine(url)
        try:
            with engine.connect() as connection:
                revision = connection.execute(
                    sa.text("SELECT version_num FROM alembic_version")
                ).scalar()
                findings.append(
                    Finding(service, "contract_revision", int(revision != expected_revision))
                )
                if service == "identity":
                    findings.extend(
                        verify_identity(connection, args.tenant_id, args.seller_id)
                    )
                else:
                    findings.extend(
                        verify_business(
                            service, connection, args.tenant_id, args.seller_id
                        )
                    )
        finally:
            engine.dispose()
    for finding in findings:
        print(f"{finding.service}.{finding.check}={finding.count}")
    failures = [finding for finding in findings if finding.count]
    print(f"SUMMARY failures={len(failures)} checks={len(findings)}")
    return int(bool(failures))


if __name__ == "__main__":
    raise SystemExit(main())
