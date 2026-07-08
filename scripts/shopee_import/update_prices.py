import os
import sys

# Setup database connection
sys.path.append(os.path.join(os.path.dirname(__file__), '../../PMI/backend'))

os.environ["DATABASE_URL"] = "postgresql://postgres:postgres@localhost:15433/pim_db"

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import models
from import_shopee_data import parse_shopee_html, ATTRIBUTES_SEED

DATABASE_URL = os.environ["DATABASE_URL"]
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def main():
    db = SessionLocal()
    data_dir = "/home/lupca/Downloads/data topvnsport"
    valid_labels = [attr["name"] for attr in ATTRIBUTES_SEED]
    
    print("Updating prices...")
    for filename in sorted(os.listdir(data_dir)):
        if not filename.endswith('.html'):
            continue
            
        filepath = os.path.join(data_dir, filename)
        data = parse_shopee_html(filepath, valid_labels)
        if not data:
            continue
            
        product = db.query(models.Product).filter_by(name=data["name"]).first()
        if product:
            variant = db.query(models.ProductVariant).filter_by(product_id=product.id).first()
            if variant:
                old_price = variant.price
                variant.price = data["price"]
                print(f"Updated '{data['name'][:30]}...': {old_price} -> {data['price']}")
                db.commit()
        else:
            print(f"Product not found: {data['name'][:30]}...")
            
    print("Price update completed.")
    db.close()

if __name__ == "__main__":
    main()
