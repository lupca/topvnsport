import os
import sys
import re
from bs4 import BeautifulSoup
import uuid
import itertools

# Setup database connection
sys.path.append(os.path.join(os.path.dirname(__file__), '../../PMI/backend'))

# Force local port if running outside docker
os.environ["DATABASE_URL"] = "postgresql://postgres:postgres@localhost:15433/pim_db"

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import models

DATABASE_URL = os.environ["DATABASE_URL"]
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

CATEGORIES_SEED = [
    {"code": "badminton", "name": "Cầu lông", "parent_code": None},
    {"code": "rackets", "name": "Vợt cầu lông", "parent_code": "badminton"},
    {"code": "strings", "name": "Cước / Dây", "parent_code": "badminton"},
    {"code": "shuttlecocks", "name": "Quả cầu", "parent_code": "badminton"},
    {"code": "badminton_accessories", "name": "Phụ kiện cầu lông", "parent_code": "badminton"},
    
    {"code": "tennis", "name": "Tennis", "parent_code": None},
    {"code": "tennis_balls", "name": "Bóng tennis", "parent_code": "tennis"},
    
    {"code": "sportswear", "name": "Thời trang thể thao", "parent_code": None},
    {"code": "sport_shirts", "name": "Áo thể thao", "parent_code": "sportswear"},
    {"code": "sport_pants", "name": "Quần thể thao", "parent_code": "sportswear"},
    {"code": "socks", "name": "Tất / Vớ", "parent_code": "sportswear"},
]

ATTRIBUTES_SEED = [
    {"code": "brand", "name": "Thương hiệu"},
    {"code": "origin", "name": "Xuất xứ"},
    {"code": "weight_class", "name": "Trọng lượng"},
    {"code": "material", "name": "Chất liệu"},
    {"code": "racket_material", "name": "Chất liệu vợt"},
    {"code": "size", "name": "Kích cỡ"},
    {"code": "length_spec", "name": "Chiều dài"},
    {"code": "tension", "name": "Độ căng"},
    {"code": "string_status", "name": "Dây vợt"},
    {"code": "stiffness", "name": "Độ cứng"},
    {"code": "balance", "name": "Điểm cân bằng"},
    {"code": "max_tension", "name": "Sức căng"},
    {"code": "thickness", "name": "Đường kính cước"},
    {"code": "warranty_type", "name": "Loại bảo hành"},
    {"code": "warranty_period", "name": "Hạn bảo hành"},
    {"code": "age_group", "name": "Nhóm tuổi"},
    {"code": "gender", "name": "Giới tính"},
    {"code": "season", "name": "Mùa"},
    {"code": "features", "name": "Tính năng"},
    {"code": "collar_type", "name": "Cổ áo"},
    {"code": "pattern", "name": "Mẫu"},
    {"code": "sleeve_length", "name": "Chiều dài tay áo"},
    {"code": "sock_length", "name": "Chiều dài vớ"},
    {"code": "sock_type", "name": "Loại tất/vớ"},
    {"code": "pants_length", "name": "Chiều dài quần"},
    {"code": "pants_style", "name": "Kiểu dáng quần"},
    {"code": "manufacture_date", "name": "Ngày sản xuất"},
]

FAMILIES_SEED = [
    {
        "code": "family_racket", 
        "name": "Bộ Vợt",
        "attributes": ["brand", "origin", "weight_class", "racket_material", "length_spec", "tension", "string_status", "stiffness", "balance", "max_tension", "warranty_type", "warranty_period", "age_group"]
    },
    {
        "code": "family_string", 
        "name": "Bộ Cước",
        "attributes": ["brand", "origin", "thickness", "length_spec", "warranty_period", "manufacture_date"]
    },
    {
        "code": "family_shoes", 
        "name": "Bộ Giày",
        "attributes": ["brand", "origin", "size", "material"]
    },
    {
        "code": "family_sportswear", 
        "name": "Bộ Quần Áo",
        "attributes": ["brand", "origin", "gender", "season", "features", "collar_type", "pattern", "sleeve_length", "size", "material"]
    },
    {
        "code": "family_socks", 
        "name": "Bộ Tất/Vớ",
        "attributes": ["brand", "origin", "sock_length", "sock_type", "material"]
    },
    {
        "code": "family_accessories", 
        "name": "Bộ Phụ Kiện",
        "attributes": ["brand", "origin", "material"]
    },
    {
        "code": "family_shuttlecock", 
        "name": "Bộ Quả Cầu",
        "attributes": ["brand", "origin"]
    },
]

# Mapping Shopee Category String to PIM Category Code and Family
SHOPEE_CATEGORY_MAP = {
    "Thể Thao & Dã Ngoại > Dụng Cụ Thể Thao & Dã Ngoại > Cầu Lông > Vợt Cầu Lông": ("rackets", "family_racket"),
    "Thể Thao & Dã Ngoại > Dụng Cụ Thể Thao & Dã Ngoại > Cầu Lông > Khác": ("badminton_accessories", "family_accessories"),
    "Thể Thao & Dã Ngoại > Dụng Cụ Thể Thao & Dã Ngoại > Cầu Lông > Lưới Cầu Lông": ("strings", "family_string"),
    "Thể Thao & Dã Ngoại > Dụng Cụ Thể Thao & Dã Ngoại > Cầu Lông > Quả Cầu": ("shuttlecocks", "family_shuttlecock"),
    "Thể Thao & Dã Ngoại > Dụng Cụ Thể Thao & Dã Ngoại > Tennis > Banh Tennis": ("tennis_balls", "family_accessories"),
    "Thể Thao & Dã Ngoại > Thời Trang Thể Thao & Dã Ngoại > Áo Thể Thao": ("sport_shirts", "family_sportswear"),
    "Thể Thao & Dã Ngoại > Thời Trang Thể Thao & Dã Ngoại > Quần Thể Thao": ("sport_pants", "family_sportswear"),
    "Thời Trang Nam > Vớ/ Tất": ("socks", "family_socks"),
    "Thời Trang Nữ > Vớ/ Tất > Tất": ("socks", "family_socks"),
}

GROUPS_SEED = [
    {"code": "general", "name": "General"},
    {"code": "logistics", "name": "Logistics"},
    {"code": "technical", "name": "Technical Specs"},
]

def seed_database(db):
    print("Seeding database...")
    
    # 1. Channels
    if not db.query(models.Channel).filter_by(code="shopee_vn").first():
        db.add(models.Channel(code="shopee_vn", name="Shopee Vietnam"))
    if not db.query(models.Channel).filter_by(code="tiktok_shop").first():
        db.add(models.Channel(code="tiktok_shop", name="TikTok Shop"))
    db.commit()

    # 2. Categories
    cat_map = {}
    for cat in CATEGORIES_SEED:
        db_cat = db.query(models.Category).filter_by(code=cat["code"]).first()
        if not db_cat:
            parent_id = cat_map[cat["parent_code"]].id if cat["parent_code"] else None
            db_cat = models.Category(code=cat["code"], name=cat["name"], parent_id=parent_id)
            db.add(db_cat)
            db.commit()
            db.refresh(db_cat)
        cat_map[cat["code"]] = db_cat

    # 3. Attributes
    attr_map = {}
    for attr in ATTRIBUTES_SEED:
        db_attr = db.query(models.Attribute).filter_by(code=attr["code"]).first()
        if not db_attr:
            db_attr = models.Attribute(code=attr["code"], name=attr["name"], type="text")
            db.add(db_attr)
            db.commit()
            db.refresh(db_attr)
        attr_map[attr["name"]] = db_attr
        attr_map[attr["code"]] = db_attr

    # 4. Families
    fam_map = {}
    for fam in FAMILIES_SEED:
        db_fam = db.query(models.AttributeFamily).filter_by(code=fam["code"]).first()
        if not db_fam:
            db_fam = models.AttributeFamily(code=fam["code"], name=fam["name"])
            db.add(db_fam)
            db.commit()
            db.refresh(db_fam)
            
            # Link attributes
            for i, attr_code in enumerate(fam["attributes"]):
                db_attr = attr_map[attr_code]
                db.add(models.AttributeFamilyAttribute(
                    family_id=db_fam.id,
                    attribute_id=db_attr.id,
                    display_order=i+1
                ))
            db.commit()
        fam_map[fam["code"]] = db_fam
        
    # 5. Groups
    grp_map = {}
    for grp in GROUPS_SEED:
        db_grp = db.query(models.AttributeGroup).filter_by(code=grp["code"]).first()
        if not db_grp:
            db_grp = models.AttributeGroup(code=grp["code"], name=grp["name"])
            db.add(db_grp)
            db.commit()
            db.refresh(db_grp)
        grp_map[grp["code"]] = db_grp
        
    # Link all attributes to Technical group for now
    tech_grp = grp_map["technical"]
    for attr in db.query(models.Attribute).all():
        if not db.query(models.AttributeGroupAttribute).filter_by(group_id=tech_grp.id, attribute_id=attr.id).first():
            db.add(models.AttributeGroupAttribute(group_id=tech_grp.id, attribute_id=attr.id))
    db.commit()

    return cat_map, attr_map, fam_map


def parse_shopee_html(filepath, valid_labels):
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        html = f.read()

    soup = BeautifulSoup(html, 'html.parser')
    
    # 1. Product Name
    title_el = soup.select_one('.Gz4UjV')
    if title_el:
        product_name = title_el.text.strip()
    else:
        product_name = os.path.basename(filepath).replace('.html', '')
        
    # 2. Category
    category_str = ""
    cat_el = soup.select_one('.product-category-text')
    if cat_el:
        category_str = " > ".join([span.text.strip() for span in cat_el.find_all('span')])
        
    # 3. Attributes
    parsed_attrs = {}
    
    lines = [line.strip() for line in re.sub(r'<[^>]+>', '\n', html).split('\n') if line.strip()]
    
    i = 0
    while i < len(lines):
        line = lines[i]
        if line in valid_labels:
            if i + 1 < len(lines):
                next_line = lines[i+1]
                
                # Check for N/M pattern
                match = re.match(r'^(\d+)/(\d+)$', next_line)
                if match:
                    n = int(match.group(1))
                    features = []
                    # Read the next N valid strings
                    offset = 2
                    while len(features) < n and i + offset < len(lines):
                        if lines[i+offset] not in valid_labels:
                            features.append(lines[i+offset])
                        offset += 1
                    parsed_attrs[line] = ", ".join(features)
                    i += offset - 1
                elif line == "Ngày sản xuất":
                    # Skip date picker junk
                    pass
                elif next_line != "Vui lòng chọn" and next_line not in valid_labels:
                    parsed_attrs[line] = next_line
                    i += 1
        i += 1
    # 4. Description
    description = "Imported from Shopee"
    desc_el = soup.find(string=re.compile('Mô tả sản phẩm'))
    if desc_el:
        parent = desc_el.parent
        while parent and parent.name != 'div':
            parent = parent.parent
        if parent and parent.next_sibling:
            description = parent.next_sibling.get_text('\n', strip=True)
            
    # 5. Images
    valid_hashes = []
    for img in soup.find_all('img'):
        classes = img.get('class', [])
        if 'shopee-image-manager__image' in classes or 'product-image-thumbnail' in classes:
            src = img.get('src', '')
            m = re.search(r'(vn-111[a-zA-Z0-9\-]+)', src)
            if m:
                h = m.group(1)
                if h not in valid_hashes:
                    valid_hashes.append(h)
    
    # Limit to first 9 to be safe
    images = ['https://down-vn.img.susercontent.com/file/' + h for h in valid_hashes[:9]]
                
    # 6. Base Price
    prices = []
    for wrapper in soup.find_all('div', class_='price-input'):
        inp = wrapper.find('input')
        if inp and 'modelvalue' in inp.attrs:
            val = inp.get('modelvalue')
            if val and val.isdigit():
                prices.append(int(val))
    
    base_price = 100000
    if prices:
        valid_prices = [p for p in prices if p > 5000]
        if valid_prices:
            base_price = min(valid_prices)
                
    # 5.5. Extract Tier Variations
    v1_name = None
    v1_options = []
    v2_name = None
    v2_options = []
    
    rows = soup.find_all(class_='varaition-edit-row')
    current_tier = None
    for r in rows:
        label = r.find(class_='variation-edit-label')
        if label and ('Phân loại1' in label.text or 'Phân loại2' in label.text):
            label_text = label.text.strip()
            if 'Phân loại1' in label_text:
                current_tier = 1
                inp = r.find('input')
                if inp:
                    v1_name = inp.get('modelvalue', '').strip()
            elif 'Phân loại2' in label_text:
                current_tier = 2
                inp = r.find('input')
                if inp:
                    v2_name = inp.get('modelvalue', '').strip()
        else:
            inputs = r.find_all('input')
            options = []
            for inp in inputs:
                ph = inp.get('placeholder', '')
                val = inp.get('modelvalue', '').strip()
                if ph != 'Thêm mô tả' and val:
                    options.append(val)
            if current_tier == 1:
                v1_options = options
            elif current_tier == 2:
                v2_options = options
                
    tier_variations = []
    if v1_name:
        tier_variations.append({"tier_index": 1, "name": v1_name, "options": v1_options})
    if v2_name:
        tier_variations.append({"tier_index": 2, "name": v2_name, "options": v2_options})

    return {
        "name": product_name,
        "category_str": category_str,
        "description": description,
        "images": images,
        "attributes": parsed_attrs,
        "price": base_price,
        "tier_variations": tier_variations
    }

def main():
    db = SessionLocal()
    cat_map, attr_map, fam_map = seed_database(db)
    
    data_dir = "/home/lupca/Downloads/data topvnsport"
    valid_labels = [attr["name"] for attr in ATTRIBUTES_SEED]
    
    print("Parsing and importing products...")
    for filename in sorted(os.listdir(data_dir)):
        if not filename.endswith('.html'):
            continue
            
        filepath = os.path.join(data_dir, filename)
        data = parse_shopee_html(filepath, valid_labels)
        if not data:
            continue
            
        # Determine category and family
        cat_code = "badminton_accessories"
        fam_code = "family_accessories"
        if data["category_str"] in SHOPEE_CATEGORY_MAP:
            cat_code, fam_code = SHOPEE_CATEGORY_MAP[data["category_str"]]
            
        category_id = cat_map[cat_code].id
        family_id = fam_map[fam_code].id
        
        product_code = "SP-" + str(uuid.uuid4())[:8].upper()
        
        # Check if already imported
        existing = db.query(models.Product).filter_by(name=data["name"]).first()
        if existing:
            continue
            
        print(f"Importing: {data['name'][:50]}... [{cat_code}]")
        product = models.Product(
            product_code=product_code,
            name=data["name"],
            description=data["description"],
            category_id=category_id,
            family_id=family_id,
            weight=500.0,
            status="Published"
        )
        db.add(product)
        db.commit()
        db.refresh(product)
        
        # Save Tier Variations and prepare options lists
        t1_options = [None]
        t2_options = [None]
        
        if "tier_variations" in data and data["tier_variations"]:
            for tv in data["tier_variations"]:
                db_tv = models.TierVariation(
                    product_id=product.id,
                    tier_index=tv["tier_index"],
                    name=tv["name"],
                    options=tv["options"]
                )
                db.add(db_tv)
                if tv["tier_index"] == 1:
                    t1_options = tv["options"]
                elif tv["tier_index"] == 2:
                    t2_options = tv["options"]
            db.commit()
            
        # Generate variants using cartesian product
        for t1, t2 in itertools.product(t1_options, t2_options):
            variant = models.ProductVariant(
                product_id=product.id,
                tier_1_option=t1,
                tier_2_option=t2,
                sku_code=None,  # Backend event listener will auto-generate SKU
                price=data["price"],
                stock=100
            )
            db.add(variant)
        db.commit()
        
        # Media
        for idx, img_url in enumerate(data["images"]):
            media = models.ProductMedia(
                product_id=product.id,
                image_url=img_url,
                is_cover=(idx == 0),
                display_order=idx + 1
            )
            db.add(media)
        db.commit()
        
        # Attributes
        for label, value in data["attributes"].items():
            if label in attr_map:
                attr = attr_map[label]
                db.add(models.ProductAttributeValue(
                    product_id=product.id,
                    attribute_id=attr.id,
                    value_string=value
                ))
        db.commit()
        
    print("Import completed.")
    db.close()

if __name__ == "__main__":
    main()
