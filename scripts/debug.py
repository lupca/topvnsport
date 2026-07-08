import os
import sys
sys.path.append(os.path.join(os.getcwd(), 'scripts/shopee_import'))
import import_shopee_data

data_dir = '/home/lupca/Downloads/data topvnsport'
valid_labels = [attr['name'] for attr in import_shopee_data.ATTRIBUTES_SEED]

for filename in sorted(os.listdir(data_dir))[:5]:
    if not filename.endswith('.html'): continue
    filepath = os.path.join(data_dir, filename)
    data = import_shopee_data.parse_shopee_html(filepath, valid_labels)
    
    # Let's see what labels it encounters
    from bs4 import BeautifulSoup
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        html = f.read()
    soup = BeautifulSoup(html, 'html.parser')
    detail_rows = soup.select('.q3oRts')
    for row in detail_rows:
        label_el = row.select_one('label')
        if label_el:
            print(f"Found label: '{label_el.text.strip()}' (valid: {label_el.text.strip() in valid_labels})")

    if not data:
        print(f"{filename} -> None")
    else:
        print(f"{filename} -> Category: {data.get('category_str')} | Name: {data.get('name')[:20] if data.get('name') else 'N/A'}...")
        print("   Attributes:", data.get('attributes'))
