import os
import re
import sys
import time
from datetime import datetime, timezone
from sqlalchemy import create_engine, text, Column, Integer, String, Boolean, DateTime, ForeignKey, Numeric
from sqlalchemy.orm import declarative_base, sessionmaker

PIM_DATABASE_URL = os.environ.get("PIM_DATABASE_URL", "postgresql://postgres:postgres@localhost:15433/pim_db")
WMS_DATABASE_URL = os.environ.get("WMS_DATABASE_URL", "postgresql://postgres:postgres@localhost:15435/wms_db")
DATA_DIR = "/home/lupca/Downloads/data topvnsport"

Base = declarative_base()

class Warehouse(Base):
    __tablename__ = "warehouses"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Location(Base):
    __tablename__ = "locations"
    id = Column(Integer, primary_key=True, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    location_code = Column(String, unique=True, nullable=False)
    is_active = Column(Boolean, default=True)

class Inventory(Base):
    __tablename__ = "inventories"
    id = Column(Integer, primary_key=True, index=True)
    sku_code = Column(String, nullable=False, index=True)
    product_name = Column(String, nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    qty_on_hand = Column(Integer, default=0, nullable=False)
    qty_reserved = Column(Integer, default=0, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class InboundShipment(Base):
    __tablename__ = "inbound_shipments"
    id = Column(Integer, primary_key=True, index=True)
    inbound_number = Column(String, unique=True, nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    supplier_name = Column(String)
    status = Column(String, default="pending")
    note = Column(String)
    created_by = Column(String)
    received_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    total_amount = Column(Numeric(12, 2))

class InboundItem(Base):
    __tablename__ = "inbound_items"
    id = Column(Integer, primary_key=True, index=True)
    inbound_shipment_id = Column(Integer, ForeignKey("inbound_shipments.id"), nullable=False)
    sku_code = Column(String, nullable=False)
    product_name = Column(String, nullable=False)
    expected_qty = Column(Integer, nullable=False)
    received_qty = Column(Integer, default=0)
    location_id = Column(Integer, ForeignKey("locations.id"))
    status = Column(String, default="pending")

class StockTransaction(Base):
    __tablename__ = "stock_transactions"
    id = Column(Integer, primary_key=True, index=True)
    sku_code = Column(String, nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    transaction_type = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False)
    note = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

detail_files = [
    {"filename": "Vợt cầu lông Yonex Astrox 77 Play - Chính Hãng - Quà Tặng.html", "sku_prefix": "YONEX-ASTROX-77-PLAY"},
    {"filename": "Cầu Thành Công 76 và 77. Cam kết chính hãng. Chuẩn thi đấu giải. Hộp 12 quả cầu lông..html", "sku_prefix": "CAU-THANH-CONG"},
    {"filename": "Cuốn Cán Vợt Cầu Lông VS Chính Hãng - Siêu Bám Tay, Thấm Hút Mồ Hôi, Đa Dạng Màu Sắc.html", "sku_prefix": "VS-GRIP"},
    {"filename": "Túi vải mền đựng vợt yonex chính hãng.html", "sku_prefix": "BAG-YONEX-SOFT"}
]

def parse_detail_file_stock(file_info):
    filepath = os.path.join(DATA_DIR, file_info["filename"])
    if not os.path.exists(filepath):
        return {}
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    model_inputs = []
    for m in re.finditer(r'<input\b[^>]*placeholder="([^"]*)"[^>]*modelvalue="([^"]*)"', content):
        model_inputs.append({"placeholder": m.group(1), "modelvalue": m.group(2)})

    options = [mi["modelvalue"].strip() for mi in model_inputs if mi["placeholder"] == "Nhập" and mi["modelvalue"].strip()]
    input_values = [mi["modelvalue"] for mi in model_inputs if mi["placeholder"] == "Input"]
    
    stock_map = {}
    if options:
        idx = 0
        for opt in options:
            if idx + 1 < len(input_values):
                try:
                    stock = int(input_values[idx+1])
                    suffix = opt.replace(" ", "-").replace("/", "-").upper()
                    sku_code = f"{file_info['sku_prefix']}-{suffix}"
                    stock_map[sku_code] = stock
                except ValueError:
                    pass
            idx += 3
    else:
        if len(input_values) >= 4:
            try:
                stock = int(input_values[2])
                stock_map[file_info["sku_prefix"]] = stock
            except ValueError:
                pass
    return stock_map

def parse_list_files_stock():
    stock_map = {}
    for filename in ["Shopee - Kênh Người bán.html", "Shopee - Kênh Người bán2.html"]:
        filepath = os.path.join(DATA_DIR, filename)
        if not os.path.exists(filepath):
            continue
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()

        rows = content.split('<tr ')
        for row in rows:
            url_match = re.search(r'/product/(\d+)', row)
            if not url_match:
                continue
            target_id = url_match.group(1)

            var_blocks = row.split('class="model-list-item"')
            if len(var_blocks) > 1:
                for vb in var_blocks[1:]:
                    model_id_match = re.search(r'Model ID:\s*(\d+)', vb) or re.search(r'modelid="(\d+)"', vb)
                    if not model_id_match:
                        continue
                    model_id = model_id_match.group(1).strip()
                    
                    stock_match = re.search(r'class="stock-text"[^>]*>(.*?)</span>', vb, re.DOTALL)
                    stock_str = stock_match.group(1).strip() if stock_match else "0"
                    if "Hết hàng" in stock_str:
                        stock = 0
                    else:
                        stock_str = re.sub(r'<[^>]+>', '', stock_str).strip()
                        if 'k' in stock_str:
                            stock = int(float(stock_str.replace('k', '')) * 1000)
                        else:
                            try:
                                stock = int(stock_str.replace(".", ""))
                            except ValueError:
                                stock = 0
                    stock_map[f"SP-{model_id}"] = stock
            else:
                stock_match = re.search(r'class="stock-text"[^>]*>(.*?)</span>', row, re.DOTALL)
                stock_str = stock_match.group(1).strip() if stock_match else "0"
                if "Hết hàng" in stock_str:
                    stock = 0
                else:
                    stock_str = re.sub(r'<[^>]+>', '', stock_str).strip()
                    if 'k' in stock_str:
                        stock = int(float(stock_str.replace('k', '')) * 1000)
                    else:
                        try:
                            stock = int(stock_str.replace(".", ""))
                        except ValueError:
                            stock = 0
                stock_map[f"SP-{target_id}"] = stock
    return stock_map

def main():
    print("--- 1. Parsing stock quantities from Shopee HTML ---")
    shopee_stock = {}
    for fi in detail_files:
        st = parse_detail_file_stock(fi)
        shopee_stock.update(st)
    
    list_st = parse_list_files_stock()
    shopee_stock.update(list_st)
    print(f"Parsed {len(shopee_stock)} SKUs from Shopee HTML files.")

    print("\n--- 2. Fetching PIM Variants from Local DB ---")
    pim_engine = create_engine(PIM_DATABASE_URL)
    with pim_engine.connect() as conn:
        result = conn.execute(text("""
            SELECT pv.sku_code, p.name as product_name
            FROM product_variants pv
            JOIN products p ON pv.product_id = p.id
            WHERE pv.sku_code IS NOT NULL
        """))
        pim_variants = {row.sku_code: row.product_name for row in result}

    print(f"Found {len(pim_variants)} SKUs in local PIM database.")

    print("\n--- 3. Connecting to WMS DB & Ensuring Warehouse/Location ---")
    wms_engine = create_engine(WMS_DATABASE_URL)
    SessionWMS = sessionmaker(bind=wms_engine)
    db = SessionWMS()

    wh = db.query(Warehouse).first()
    if not wh:
        wh = Warehouse(code="KHO1", name="Kho Chính")
        db.add(wh)
        db.commit()
        db.refresh(wh)

    loc = db.query(Location).filter(Location.warehouse_id == wh.id).first()
    if not loc:
        loc = Location(warehouse_id=wh.id, location_code="KHO1-A01-K02-T01")
        db.add(loc)
        db.commit()
        db.refresh(loc)

    print(f"Using Warehouse ID: {wh.id} ({wh.name}), Location ID: {loc.id} ({loc.location_code})")

    print("\n--- 4. Creating & Processing Inbound Shipment ---")
    inbound_number = f"INB-SHOPEE-{int(time.time())}"
    shipment = InboundShipment(
        inbound_number=inbound_number,
        warehouse_id=wh.id,
        supplier_name="Shopee Import Supplier",
        status="COMPLETED",
        note="Imported stock from Shopee HTML data",
        created_by="system_import",
        received_date=datetime.now(timezone.utc)
    )
    db.add(shipment)
    db.flush()

    total_items = 0
    total_qty = 0

    for sku, product_name in pim_variants.items():
        qty = shopee_stock.get(sku, 100)
        if qty <= 0:
            continue

        item = InboundItem(
            inbound_shipment_id=shipment.id,
            sku_code=sku,
            product_name=product_name,
            expected_qty=qty,
            received_qty=qty,
            location_id=loc.id,
            status="put_away"
        )
        db.add(item)

        inv = db.query(Inventory).filter(Inventory.sku_code == sku, Inventory.location_id == loc.id).first()
        if not inv:
            inv = Inventory(
                sku_code=sku,
                product_name=product_name,
                location_id=loc.id,
                qty_on_hand=0,
                qty_reserved=0
            )
            db.add(inv)
            db.flush()

        inv.qty_on_hand = qty  # Set absolute quantity matching inbound

        st = StockTransaction(
            sku_code=sku,
            location_id=loc.id,
            transaction_type="INBOUND",
            quantity=qty,
            note=f"Inbound {inbound_number}"
        )
        db.add(st)

        total_items += 1
        total_qty += qty

    db.commit()
    print(f"Inbound Shipment {inbound_number} completed successfully!")
    print(f"Processed {total_items} SKUs with total quantity of {total_qty}.")

    print("\n--- Verification ---")
    inv_count = db.query(Inventory).count()
    sum_qty = db.execute(text("SELECT COALESCE(SUM(qty_on_hand), 0) FROM inventories")).scalar()
    print(f"Total inventory records in WMS: {inv_count}")
    print(f"Total stock on hand in WMS: {sum_qty}")

    db.close()

if __name__ == "__main__":
    main()
