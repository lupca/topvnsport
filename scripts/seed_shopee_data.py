import os
import re
import json
import base64
import httpx
import time

PMI_URL = "http://localhost:18100"
WMS_URL = "http://localhost:18102"
data_dir = "/home/lupca/Downloads/data topvnsport"

# Image upload cache
uploaded_images_cache = {}

# Detailed Shopee HTML files
detail_files = [
    {
        "filename": "Vợt cầu lông Yonex Astrox 77 Play - Chính Hãng - Quà Tặng.html",
        "category_code": "rackets",
        "family_code": "family_racket",
        "sku_prefix": "YONEX-ASTROX-77-PLAY",
        "barcode_prefix": "893000000001"
    },
    {
        "filename": "Cầu Thành Công 76 và 77. Cam kết chính hãng. Chuẩn thi đấu giải. Hộp 12 quả cầu lông..html",
        "category_code": "shuttlecocks",
        "family_code": None,
        "sku_prefix": "CAU-THANH-CONG",
        "barcode_prefix": "893000000002"
    },
    {
        "filename": "Cuốn Cán Vợt Cầu Lông VS Chính Hãng - Siêu Bám Tay, Thấm Hút Mồ Hôi, Đa Dạng Màu Sắc.html",
        "category_code": "badminton_accessories",
        "family_code": None,
        "sku_prefix": "VS-GRIP",
        "barcode_prefix": "893000000003"
    },
    {
        "filename": "Túi vải mền đựng vợt yonex chính hãng.html",
        "category_code": "bags",
        "family_code": None,
        "sku_prefix": "BAG-YONEX-SOFT",
        "barcode_prefix": "893000000004"
    }
]

# Track seeded products by product code
seeded_product_codes = set()

def classify_category(name):
    name_lower = name.lower()
    
    # Remove promotional text for classification purposes
    clean_name = name_lower.split("tặng")[0].split("quà")[0].split("-đan cước")[0].strip()
    
    if "vợt" in clean_name or "racket" in clean_name:
        if "bao vợt" in clean_name or "túi" in clean_name or "balo" in clean_name:
            return "bags"
        elif "cuốn cán" in clean_name or "cán vợt" in clean_name:
            return "badminton_accessories"
        elif "cước" in clean_name or "dây cước" in clean_name:
            return "strings"
        else:
            return "rackets"
    elif "cầu" in clean_name or "shuttlecock" in clean_name:
        if "quả cầu" in clean_name or "hộp" in clean_name or "thành công" in clean_name:
            return "shuttlecocks"
        else:
            return "shuttlecocks"
    elif any(k in clean_name for k in ["cước", "dây cước", "string", "bg65", "bg66", "bg80", "kizuna"]):
        return "strings"
    elif any(k in clean_name for k in ["túi", "bag", "balo"]):
        return "bags"
    elif any(k in clean_name for k in ["giày", "shoes", "giay"]):
        return "shoes"
    elif any(k in clean_name for k in ["quần", "áo", "tất", "bóng", "phụ kiện", "cuốn cán", "cao su"]):
        return "badminton_accessories"
    
    return "badminton_equipment"

def get_fallback_price(category_code):
    if category_code == "rackets":
        return 1500000.0
    elif category_code == "bags":
        return 300000.0
    elif category_code == "strings":
        return 180000.0
    elif category_code == "shuttlecocks":
        return 250000.0
    else:
        return 100000.0

def wait_for_services():
    print("Waiting for PMI and WMS services to be ready...")
    for port, name in [(18100, "PMI"), (18102, "WMS")]:
        url = f"http://localhost:{port}/"
        while True:
            try:
                resp = httpx.get(url, timeout=2)
                print(f"{name} is up!")
                break
            except Exception:
                print(f"Waiting for {name} on port {port}...")
                time.sleep(2)

def upload_image_payload(img_src, display_order, is_cover=False):
    if not img_src:
        return None
        
    # Check cache to avoid duplicate uploads
    if img_src in uploaded_images_cache:
        img_url = uploaded_images_cache[img_src]
        return {
            "image_url": img_url,
            "is_cover": is_cover,
            "display_order": display_order,
            "variant_tier_1_option": None
        }

    try:
        if img_src.startswith("data:image/"):
            header, base64_data = img_src.split(",", 1)
            file_data = base64.b64decode(base64_data)
            ref_decoded = "image.png"
            mime_type = "image/png"
        else:
            ref_decoded = img_src.replace("./", "").replace("%28", "(").replace("%29", ")")
            img_path = os.path.join(data_dir, ref_decoded)
            if not os.path.exists(img_path):
                return None
            with open(img_path, "rb") as img_file:
                file_data = img_file.read()
            mime_type = "image/png" if ref_decoded.endswith(".png") else "image/jpeg"
            
        upload_url = f"{PMI_URL}/upload"
        files_payload = {"file": (ref_decoded, file_data, mime_type)}
        resp = httpx.post(upload_url, files=files_payload, timeout=10)
        if resp.status_code == 200:
            img_url = resp.json()["image_url"]
            uploaded_images_cache[img_src] = img_url
            return {
                "image_url": img_url,
                "is_cover": is_cover,
                "display_order": display_order,
                "variant_tier_1_option": None
            }
    except Exception as e:
        print(f"    Failed to upload image {img_src[:40]}: {e}")
    return None

def parse_product_html(file_info):
    filename = file_info["filename"]
    filepath = os.path.join(data_dir, filename)
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    # 1. Item ID
    item_id = None
    url_match = re.search(r'saved from url=\(\d+\)(https?://[^\s]+)', content)
    if url_match:
        url = url_match.group(1)
        item_id_match = re.search(r'/product/(\d+)', url)
        if item_id_match:
            item_id = item_id_match.group(1)
    
    if not item_id:
        item_id = str(int(time.time() * 1000))
        
    product_code = f"SP-{item_id}"
    print(f"\nParsing detail {filename} (Product Code: {product_code})")

    # 2. Product Name
    name = ""
    name_match = re.search(r'<input\b[^>]*placeholder="Tên sản phẩm[^"]*"[^>]*modelvalue="([^"]*)"', content)
    if name_match:
        name = name_match.group(1)
    else:
        title_match = re.search(r'<title>(.*?)</title>', content)
        name = title_match.group(1) if title_match else filename.replace(".html", "")
    print(f"  Name: {name}")

    # 3. Description
    description = ""
    desc_match = re.search(r'Mô tả sản phẩm', content)
    if desc_match:
        start = desc_match.start()
        snippet = content[start:start+5000]
        clean = re.sub(r'<[^>]+>', '\n', snippet)
        lines = [l.strip() for l in clean.split('\n') if l.strip()]
        desc_lines = []
        started = False
        for line in lines:
            if "Mô tả sản phẩm" in line or line == "Mô tả":
                started = True
                continue
            if started:
                if any(h in line for h in ["Thông tin bán hàng", "Phân loại nhóm", "Hình ảnh sản phẩm", "Bảng quy đổi kích cỡ"]):
                    break
                desc_lines.append(line)
        description = "\n".join(desc_lines)
    print(f"  Description: {len(description)} chars")

    # 4. Inputs parsing for variations and logistics
    inputs = re.findall(r'<input\b[^>]*>', content)
    model_inputs = []
    for inp in inputs:
        placeholder = re.search(r'placeholder="([^"]*)"', inp)
        modelvalue = re.search(r'modelvalue="([^"]*)"', inp)
        if modelvalue:
            model_inputs.append({
                "placeholder": placeholder.group(1) if placeholder else "",
                "modelvalue": modelvalue.group(1)
            })

    # Variation options
    var_group_name = None
    options = []
    for mi in model_inputs:
        if mi["placeholder"] == "e.g. Color, etc" and mi["modelvalue"].strip():
            var_group_name = mi["modelvalue"].strip()
        elif mi["placeholder"] == "Nhập" and mi["modelvalue"].strip():
            options.append(mi["modelvalue"].strip())
            
    print(f"  Variation Group: {var_group_name}, Options: {options}")

    # Price, Stock, SKU list
    input_values = [mi["modelvalue"] for mi in model_inputs if mi["placeholder"] == "Input"]
    
    variants = []
    weight = 0.0
    width = 0.0
    length = 0.0
    height = 0.0

    if options:
        # Each variation has 3 inputs: Price, Stock, GTIN
        idx = 0
        for opt in options:
            if idx + 1 < len(input_values):
                price = float(input_values[idx])
                stock = int(input_values[idx+1])
                suffix = opt.replace(" ", "-").replace("/", "-").upper()
                sku_code = f"{file_info['sku_prefix']}-{suffix}"
                variants.append({
                    "tier_1_option": opt,
                    "tier_2_option": None,
                    "sku_code": sku_code,
                    "price": price,
                    "stock": stock
                })
            idx += 3
            
        if idx < len(input_values):
            weight = float(input_values[idx])
    else:
        if len(input_values) >= 4:
            price = float(input_values[1])
            stock = int(input_values[2])
            weight = float(input_values[3])
            variants.append({
                "tier_1_option": None,
                "tier_2_option": None,
                "sku_code": file_info["sku_prefix"],
                "price": price,
                "stock": stock
            })

    # Read dimensions
    for mi in model_inputs:
        if mi["placeholder"] == "R":
            width = float(mi["modelvalue"])
        elif mi["placeholder"] == "D":
            length = float(mi["modelvalue"])
        elif mi["placeholder"] == "C":
            height = float(mi["modelvalue"])

    print(f"  Variants: {len(variants)}")
    print(f"  Logistics: Weight={weight}g, D={length}cm, R={width}cm, C={height}cm")

    # Extract and upload images
    files_folder = filepath.replace(".html", "_files")
    img_refs = re.findall(r'src="\./[^"]*_files/([^"]+)"', content)
    seen = set()
    dedup_refs = []
    for ref in img_refs:
        if ref not in seen:
            seen.add(ref)
            dedup_refs.append(ref)
            
    uploaded_media = []
    img_idx = 1
    for ref in dedup_refs:
        if img_idx > 9:
            break
            
        img_src = f"./{os.path.basename(files_folder)}/{ref}"
        media_item = upload_image_payload(img_src, img_idx, is_cover=(img_idx == 1))
        if media_item:
            uploaded_media.append(media_item)
            img_idx += 1

    payload = {
        "product_code": product_code,
        "name": name,
        "description": description,
        "weight": weight,
        "length": length,
        "width": width,
        "height": height,
        "is_pre_order": False,
        "dts_days": 7,
        "status": "Published",
        "tier_variations": [
            {
                "tier_index": 1,
                "name": var_group_name or "Phân loại",
                "options": options
            }
        ] if options else [],
        "variants": variants,
        "media": uploaded_media,
        "attributes": []
    }
    
    seeded_product_codes.add(product_code)
    return payload

def parse_list_product_from_row(row_html, list_filename):
    if 'eds-table__row' not in row_html:
        return None
        
    # Extract ID
    id_match = re.search(r'ID Sản phẩm:\s*(\d+)', row_html)
    if not id_match:
        id_match = re.search(r'product/(\d+)', row_html)
    if not id_match:
        return None
        
    target_id = id_match.group(1).strip()
    product_code = f"SP-{target_id}"
    
    if product_code in seeded_product_codes:
        # Already seeded
        return None

    # Extract Product Name
    name = None
    name_match = re.search(r'class="product-name-wrap"[^>]*><span[^>]*class="product-name-wrap"[^>]*>(.*?)</span>', row_html)
    if name_match:
        name = name_match.group(1).strip()
    else:
        alt_match = re.search(r'class="product-image".*?alt="(.*?)"', row_html, re.DOTALL)
        if alt_match:
            name = alt_match.group(1).strip()
    if not name:
        name = f"Sản phẩm {target_id}"

    category_code = classify_category(name)
    fallback_price = get_fallback_price(category_code)

    # Extract Cover image
    cover_img = None
    img_match = re.search(r'class="product-image".*?src="(.*?)"', row_html, re.DOTALL)
    if img_match:
        cover_img = img_match.group(1).strip()

    # Extract Variations
    var_blocks = row_html.split('class="model-list-item"')
    variants = []
    options = []
    uploaded_media = []
    
    img_idx = 1
    
    # Upload cover image
    if cover_img:
        if not cover_img.startswith("data:image/"):
            files_prefix = "./Shopee - Kênh Người bán_files/" if "2.html" not in list_filename else "./Shopee - Kênh Người bán2_files/"
            cover_img = files_prefix + os.path.basename(cover_img)
            
        media_item = upload_image_payload(cover_img, img_idx, is_cover=True)
        if media_item:
            uploaded_media.append(media_item)
            img_idx += 1

    if len(var_blocks) > 1:
        # Multi variant
        for vb in var_blocks[1:]:
            var_name_match = re.search(r'class="variation-name-info-name">(.*?)</div>', vb)
            var_name = var_name_match.group(1).strip() if var_name_match else "Standard"
            options.append(var_name)
            
            model_id_match = re.search(r'Model ID:\s*(\d+)', vb)
            if not model_id_match:
                model_id_match = re.search(r'modelid="(\d+)"', vb)
            model_id = model_id_match.group(1).strip() if model_id_match else str(int(time.time() * 1000))
            
            price_match = re.search(r'<span>₫([\d\.]+)</span>', vb)
            price = 0.0
            if price_match:
                price = float(price_match.group(1).replace(".", ""))
            if price == 0.0:
                price = fallback_price
                
            stock_match = re.search(r'class="stock-text"[^>]*>(.*?)</span>', vb, re.DOTALL)
            stock_str = stock_match.group(1).strip() if stock_match else "0"
            if "Hết hàng" in stock_str:
                stock = 0
            else:
                stock_str = re.sub(r'<[^>]+>', '', stock_str).strip()
                if 'k' in stock_str:
                    stock = int(float(stock_str.replace('k', '')) * 1000)
                else:
                    stock = int(stock_str.replace(".", ""))
                    
            # Upload variant image
            var_img_match = re.search(r'class="variation-name-image".*?src="(.*?)"', vb, re.DOTALL)
            if var_img_match and img_idx <= 9:
                var_img = var_img_match.group(1).strip()
                if not var_img.startswith("data:image/"):
                    files_prefix = "./Shopee - Kênh Người bán_files/" if "2.html" not in list_filename else "./Shopee - Kênh Người bán2_files/"
                    var_img = files_prefix + os.path.basename(var_img)
                
                media_item = upload_image_payload(var_img, img_idx, is_cover=False)
                if media_item:
                    media_item["variant_tier_1_option"] = var_name
                    uploaded_media.append(media_item)
                    img_idx += 1
                    
            variants.append({
                "tier_1_option": var_name,
                "tier_2_option": None,
                "sku_code": f"SP-{model_id}",
                "price": price,
                "stock": stock
            })
    else:
        # Single variant
        price_match = re.search(r'<span>₫([\d\.]+)</span>', row_html)
        price = 0.0
        if price_match:
            price = float(price_match.group(1).replace(".", ""))
        if price == 0.0:
            price = fallback_price
            
        stock_match = re.search(r'class="stock-text"[^>]*>(.*?)</span>', row_html, re.DOTALL)
        stock_str = stock_match.group(1).strip() if stock_match else "0"
        if "Hết hàng" in stock_str:
            stock = 0
        else:
            stock_str = re.sub(r'<[^>]+>', '', stock_str).strip()
            if 'k' in stock_str:
                stock = int(float(stock_str.replace('k', '')) * 1000)
            else:
                stock = int(stock_str.replace(".", ""))
                
        variants.append({
            "tier_1_option": None,
            "tier_2_option": None,
            "sku_code": f"SP-{target_id}",
            "price": price,
            "stock": stock
        })

    payload = {
        "product_code": product_code,
        "name": name,
        "description": f"Sản phẩm {name} nhập khẩu chính hãng từ Shopee.",
        "weight": 200.0,
        "length": 10.0,
        "width": 10.0,
        "height": 10.0,
        "is_pre_order": False,
        "dts_days": 7,
        "status": "Published",
        "tier_variations": [
            {
                "tier_index": 1,
                "name": "Phân loại",
                "options": options
            }
        ] if options else [],
        "variants": variants,
        "media": uploaded_media,
        "attributes": [],
        "category_code": category_code
    }
    
    seeded_product_codes.add(product_code)
    return payload

def seed_pmi_product(product_data, category_id, family_id):
    product_data["category_id"] = category_id
    product_data["family_id"] = family_id
        
    url = f"{PMI_URL}/products"
    resp = httpx.post(url, json=product_data, timeout=10)
    if resp.status_code == 201:
        print(f"Successfully seeded product {product_data['product_code']} to PMI!")
        return resp.json()
    else:
        print(f"Failed to seed product {product_data['product_code']}: {resp.status_code} - {resp.text}")
        return None

def seed_wms_variant(variant, product_name, default_loc_id, barcode_str, image_url):
    bm_url = f"{WMS_URL}/barcode-mappings"
    bm_payload = {
        "barcode": barcode_str,
        "barcode_type": "EAN-13",
        "sku_code": variant["sku_code"],
        "product_name": product_name,
        "variant_name": variant["tier_1_option"] or "Standard",
        "image_url": image_url
    }
    
    bm_resp = httpx.post(bm_url, json=bm_payload)
    if bm_resp.status_code == 201 or bm_resp.status_code == 200:
        pass
    else:
        print(f"    Failed to seed barcode mapping: {bm_resp.status_code} - {bm_resp.text}")

    inv_url = f"{WMS_URL}/inventory/adjust"
    inv_payload = {
        "sku_code": variant["sku_code"],
        "location_id": default_loc_id,
        "quantity": variant["stock"],
        "note": "Initial Shopee HTML Seeding"
    }
    inv_resp = httpx.post(inv_url, json=inv_payload)
    if inv_resp.status_code == 201 or inv_resp.status_code == 200:
        pass
    else:
        print(f"    Failed to seed inventory: {inv_resp.status_code} - {inv_resp.text}")

def main():
    wait_for_services()
    
    # Fetch categories and families from PMI
    categories = httpx.get(f"{PMI_URL}/categories").json()
    families = httpx.get(f"{PMI_URL}/attribute-families").json()
    
    category_map = {c["code"]: c["id"] for c in categories}
    family_map = {f["code"]: f["id"] for f in families}
    
    print("\nPMI Categories Map:", category_map)
    print("PMI Families Map:", family_map)

    # WMS default pick location
    locations = httpx.get(f"{WMS_URL}/locations").json()
    default_loc_id = None
    for loc in locations:
        if loc["location_code"] == "KHO1-A01-K02-T01":
            default_loc_id = loc["id"]
            break
    if not default_loc_id and locations:
        default_loc_id = locations[0]["id"]
        
    print(f"WMS default location ID: {default_loc_id}")

    fallback_family_id = families[0]["id"] if families else 1
    print(f"Fallback family ID: {fallback_family_id}")

    # 1. Parse and seed 4 detailed products first
    for file_info in detail_files:
        product_data = parse_product_html(file_info)
        category_id = category_map.get(file_info["category_code"])
        family_id = family_map.get(file_info["family_code"]) if file_info["family_code"] else fallback_family_id
        
        seeded_product = seed_pmi_product(product_data, category_id, family_id)
        if seeded_product:
            cover_image_url = None
            if product_data["media"]:
                cover_image_url = product_data["media"][0]["image_url"]
                
            for idx, variant in enumerate(product_data["variants"]):
                barcode_str = f"{file_info['barcode_prefix']}{idx:02d}"
                seed_wms_variant(variant, product_data["name"], default_loc_id, barcode_str, cover_image_url)

    # 2. Parse and seed ALL products from list HTML files
    print("\nParsing and seeding all products from list files...")
    for filename in ["Shopee - Kênh Người bán.html", "Shopee - Kênh Người bán2.html"]:
        filepath = os.path.join(data_dir, filename)
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
            
        # Split robustly by "<tr "
        rows = content.split('<tr ')
            
        for row in rows:
            try:
                product_data = parse_list_product_from_row(row, filename)
                if not product_data:
                    continue
                    
                category_id = category_map.get(product_data["category_code"])
                
                # Check custom family for rackets or strings
                family_code = "family_racket" if product_data["category_code"] == "rackets" else "family_string" if product_data["category_code"] == "strings" else None
                family_id = family_map.get(family_code) if family_code else fallback_family_id
                
                seeded_product = seed_pmi_product(product_data, category_id, family_id)
                if seeded_product:
                    cover_image_url = None
                    if product_data["media"]:
                        cover_image_url = product_data["media"][0]["image_url"]
                        
                    # Generate a unique barcode for each variant
                    target_id = product_data["product_code"].replace("SP-", "")
                    for idx, variant in enumerate(product_data["variants"]):
                        barcode_str = f"893{int(target_id) % 10000000:07d}{idx:03d}"
                        seed_wms_variant(variant, product_data["name"], default_loc_id, barcode_str, cover_image_url)
            except Exception as e:
                print(f"Error seeding list product row: {e}")

    print("\nSeeding finished!")

if __name__ == "__main__":
    main()
