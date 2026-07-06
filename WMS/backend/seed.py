from database import SessionLocal, Base, engine
import models

import os

def seed_data():
    if os.environ.get("ENV") == "production":
        print("Skipping seed data in production environment.")
        return

    db = SessionLocal()
    # Ensure tables are created
    Base.metadata.create_all(bind=engine)
    
    # 1. Seed Warehouses
    wh = db.query(models.Warehouse).filter(models.Warehouse.code == "WH-001").first()
    if not wh:
        wh = models.Warehouse(
            code="WH-001",
            name="Main Warehouse 1",
            address="123 Logistics Blvd, Industrial Zone",
            is_active=True
        )
        db.add(wh)
        db.commit()
        db.refresh(wh)
        print(f"Seeded warehouse: {wh.code}")
    else:
        print("Warehouse WH-001 already exists")

    # 2. Seed Locations
    loc = db.query(models.Location).filter(models.Location.location_code == "KHO1-A01-K02-T01").first()
    if not loc:
        loc = models.Location(
            warehouse_id=wh.id,
            location_code="KHO1-A01-K02-T01",
            zone="KHO1",
            aisle="A01",
            rack="K02",
            shelf="T01",
            type="pick",
            is_active=True
        )
        db.add(loc)
        db.commit()
        db.refresh(loc)
        print(f"Seeded location: {loc.location_code}")
    else:
        print("Location KHO1-A01-K02-T01 already exists")

    # Seed standard locations matching types: STORAGE, RECEIVING, PACKING, SHIPPING
    standard_locs = [
        {"code": "KHO1-STORAGE-01", "type": "STORAGE", "zone": "KHO1", "aisle": "A01", "rack": "K01", "shelf": "T01"},
        {"code": "KHO1-RECEIVING-01", "type": "RECEIVING", "zone": "KHO1", "aisle": "A01", "rack": "K01", "shelf": "T02"},
        {"code": "KHO1-PACKING-01", "type": "PACKING", "zone": "KHO1", "aisle": "A01", "rack": "K01", "shelf": "T03"},
        {"code": "KHO1-SHIPPING-01", "type": "SHIPPING", "zone": "KHO1", "aisle": "A01", "rack": "K01", "shelf": "T04"},
        {"code": "KHO1-STORAGE-02", "type": "STORAGE", "zone": "KHO1", "aisle": "A02", "rack": "K02", "shelf": "T01"},
    ]
    for sl in standard_locs:
        db_loc = db.query(models.Location).filter(models.Location.location_code == sl["code"]).first()
        if not db_loc:
            db_loc = models.Location(
                warehouse_id=wh.id,
                location_code=sl["code"],
                zone=sl["zone"],
                aisle=sl["aisle"],
                rack=sl["rack"],
                shelf=sl["shelf"],
                type=sl["type"],
                is_active=True
            )
            db.add(db_loc)
            db.commit()
            print(f"Seeded standard location: {sl['code']} of type {sl['type']}")

    # 3. Seed Barcode Mappings
    barcode1 = "8930001234567"
    bm = db.query(models.BarcodeMapping).filter(models.BarcodeMapping.barcode == barcode1).first()
    if not bm:
        bm = models.BarcodeMapping(
            barcode=barcode1,
            barcode_type="EAN-13",
            sku_code="SKU-PROD-A",
            product_name="Product A",
            variant_name="Standard",
            image_url="http://example.com/images/proda.png"
        )
        db.add(bm)
        db.commit()
        print(f"Seeded barcode mapping: {barcode1}")
    else:
        print(f"Barcode mapping {barcode1} already exists")

    # 4. Seed Inventory
    inv = db.query(models.Inventory).filter(
        models.Inventory.sku_code == "SKU-PROD-A",
        models.Inventory.location_id == loc.id
    ).first()
    if not inv:
        inv = models.Inventory(
            sku_code="SKU-PROD-A",
            product_name="Product A",
            location_id=loc.id,
            qty_on_hand=100,
            qty_reserved=0
        )
        db.add(inv)
        db.commit()
        print(f"Seeded inventory for SKU-PROD-A at {loc.location_code}")
    else:
        print("Inventory for SKU-PROD-A already exists")

    # Seed TSHIRT-RED-M and PROD-BASE-1
    for sku, name in [("TSHIRT-RED-M", "Áo thun phong cách Unisex"), ("PROD-BASE-1", "Sản phẩm cơ bản")]:
        inv_item = db.query(models.Inventory).filter(
            models.Inventory.sku_code == sku,
            models.Inventory.location_id == loc.id
        ).first()
        if not inv_item:
            inv_item = models.Inventory(
                sku_code=sku,
                product_name=name,
                location_id=loc.id,
                qty_on_hand=100,
                qty_reserved=0
            )
            db.add(inv_item)
            db.commit()
            print(f"Seeded inventory for {sku} at {loc.location_code}")

    db.close()


if __name__ == "__main__":
    # If run directly as a script (need correct relative import setup or run as module)
    # e.g., python -m backend.seed
    seed_data()
