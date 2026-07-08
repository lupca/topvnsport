import httpx

PMI_URL = "http://localhost:18100"

def check_pmi_data():
    print("Checking imported data in PMI...")
    try:
        # Fetch all products
        resp = httpx.get(f"{PMI_URL}/products?size=1000", timeout=10)
        if resp.status_code != 200:
            print(f"Failed to fetch products: {resp.status_code}")
            return
            
        data = resp.json()
        if "items" in data:
            products = data["items"]
            print(f"Total products returned in this page: {len(products)}")
            print(f"Total products in PMI (from API total): {data.get('total', len(products))}")
        else:
            products = data
            print(f"Total products in PMI: {len(products)}")
        
        # Check details
        total_variants = 0
        total_media = 0
        products_missing_media = []
        products_missing_variants = []
        
        for p in products:
            # Re-fetch product to get variants and media
            p_code = p["product_code"]
            p_id = p["id"]
            p_resp = httpx.get(f"{PMI_URL}/products/{p_id}", timeout=5)
            if p_resp.status_code == 200:
                p_detail = p_resp.json()
                variants = p_detail.get("variants", [])
                media = p_detail.get("media", [])
                
                total_variants += len(variants)
                total_media += len(media)
                
                if len(variants) == 0:
                    products_missing_variants.append(p_code)
                if len(media) == 0:
                    products_missing_media.append(p_code)
            else:
                print(f"Failed to fetch detail for {p_code} (ID: {p_id})")

        print(f"Total variants across all products: {total_variants}")
        print(f"Total media items across all products: {total_media}")
        
        if products_missing_variants:
            print(f"Warning: {len(products_missing_variants)} products missing variants (e.g., {products_missing_variants[:5]})")
        else:
            print("All products have at least one variant.")
            
        if products_missing_media:
            print(f"Warning: {len(products_missing_media)} products missing media (e.g., {products_missing_media[:5]})")
        else:
            print("All products have at least one media item.")
            
        print("\nChecking categories distribution:")
        category_counts = {}
        for p in products:
            cat_id = p.get("category_id")
            category_counts[cat_id] = category_counts.get(cat_id, 0) + 1
            
        for cat_id, count in category_counts.items():
            print(f"  Category ID {cat_id}: {count} products")

    except Exception as e:
        print(f"Error checking data: {e}")

if __name__ == "__main__":
    check_pmi_data()
