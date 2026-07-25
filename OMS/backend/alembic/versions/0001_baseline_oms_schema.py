"""Baseline the current OMS schema.

Revision ID: 0001_baseline
Revises:
Create Date: 2026-07-25

For a database that already has the OMS schema, mark this revision as applied
without recreating tables:

    alembic stamp 0001_baseline

Use ``alembic upgrade head`` only for an empty database.  Later revisions can
then be applied to either database.
"""

from alembic import op
import sqlalchemy as sa


revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "customers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("phone", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_customers_id", "customers", ["id"], unique=False)
    op.create_index("ix_customers_phone", "customers", ["phone"], unique=True)

    op.create_table(
        "channels",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_channels_id", "channels", ["id"], unique=False)
    op.create_index("ix_channels_code", "channels", ["code"], unique=True)

    op.create_table(
        "system_configs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("config_key", sa.String(length=100), nullable=False),
        # EncryptedString is intentionally unbounded; TEXT prevents the old
        # VARCHAR(500) schema drift from truncating encrypted values.
        sa.Column("config_value", sa.Text(), nullable=True),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_system_configs_id", "system_configs", ["id"], unique=False)
    op.create_index("ix_system_configs_config_key", "system_configs", ["config_key"], unique=True)

    op.create_table(
        "orders",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("order_number", sa.String(), nullable=False),
        sa.Column("customer_id", sa.Integer(), nullable=False),
        sa.Column("channel_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("total_amount", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("shipping_fee", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("shipping_address", sa.Text(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["channel_id"], ["channels.id"]),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_orders_id", "orders", ["id"], unique=False)
    op.create_index("ix_orders_order_number", "orders", ["order_number"], unique=True)

    op.create_table(
        "fulfillment_orders",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("fulfillment_number", sa.String(), nullable=False),
        sa.Column("warehouse_code", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("tracking_number", sa.String(), nullable=True),
        sa.Column("carrier_name", sa.String(), nullable=True),
        sa.Column("shipped_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_fulfillment_orders_id", "fulfillment_orders", ["id"], unique=False)
    op.create_index(
        "ix_fulfillment_orders_fulfillment_number",
        "fulfillment_orders",
        ["fulfillment_number"],
        unique=True,
    )

    op.create_table(
        "order_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("sku_code", sa.String(), nullable=False),
        sa.Column("product_name", sa.String(), nullable=False),
        sa.Column("variant_name", sa.String(), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("subtotal", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("image_url", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_order_items_id", "order_items", ["id"], unique=False)

    op.create_table(
        "otp_verifications",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("phone_number", sa.String(length=20), nullable=False),
        sa.Column("otp_hash", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("verified_at", sa.DateTime(), nullable=True),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=True),
        sa.Column("verification_token", sa.String(length=255), nullable=True),
        sa.Column("verification_expires_at", sa.DateTime(), nullable=True),
        sa.Column("zalo_message_id", sa.String(length=100), nullable=True),
        sa.Column("provider_status", sa.String(length=50), nullable=True),
        sa.Column("provider_response", sa.Text(), nullable=True),
        sa.Column("failed_reason", sa.String(length=255), nullable=True),
        sa.Column("sent_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_otp_verifications_id", "otp_verifications", ["id"], unique=False)
    op.create_index("ix_otp_verifications_phone_number", "otp_verifications", ["phone_number"], unique=False)
    op.create_index(
        "ix_otp_verifications_verification_token",
        "otp_verifications",
        ["verification_token"],
        unique=True,
    )
    op.create_index(
        "ix_otp_verifications_zalo_message_id",
        "otp_verifications",
        ["zalo_message_id"],
        unique=False,
    )

    op.create_table(
        "sms_rate_limits",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("phone_number", sa.String(length=20), nullable=False),
        sa.Column("action_type", sa.String(length=50), nullable=False),
        sa.Column("attempt_count", sa.Integer(), nullable=True),
        sa.Column("last_attempt_at", sa.DateTime(), nullable=True),
        sa.Column("lockout_until", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sms_rate_limits_id", "sms_rate_limits", ["id"], unique=False)
    op.create_index("ix_sms_rate_limits_phone_number", "sms_rate_limits", ["phone_number"], unique=False)


def downgrade() -> None:
    op.drop_table("sms_rate_limits")
    op.drop_table("otp_verifications")
    op.drop_table("order_items")
    op.drop_table("fulfillment_orders")
    op.drop_table("orders")
    op.drop_table("system_configs")
    op.drop_table("channels")
    op.drop_table("customers")
