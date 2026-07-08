import os
import sys
from sqlalchemy import text

sys.path.append(os.path.join(os.path.dirname(__file__), '../PMI/backend'))

from database import engine
from utils.startup import run_migrations

def cleanup():
    print("Running migrations first to ensure all tables exist...")
    run_migrations()

    print("Cleaning up old catalog data...")
    with engine.begin() as conn:
        tables_to_truncate = [
            "product_media",
            "product_attribute_values",
            "product_channel_attribute_values",
            "variant_channel_listings",
            "product_channel_listings",
            "product_variants",
            "tier_variations",
            "products",
            "attribute_family_attributes",
            "attribute_families",
            "channel_category_mappings",
            "channel_attribute_mappings",
            "attribute_group_attributes",
            "attribute_groups",
            "attributes",
            "categories"
        ]
        
        for table in tables_to_truncate:
            print(f"Truncating {table}...")
            # Use TRUNCATE CASCADE to ensure all dependent rows are deleted
            conn.execute(text(f"TRUNCATE TABLE {table} CASCADE"))

    print("Cleanup completed successfully!")

if __name__ == "__main__":
    cleanup()
