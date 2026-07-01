## 2026-06-29T19:57:00Z
We need to implement an endpoint GET /api/products/by-sku/{sku_code} in the existing PMI backend.
The backend is located at /home/lupca/projects/PMI/backend/.
Read main.py, models.py, and schemas.py to understand how products and variants are structured.
The new API should:
1. Lookup the product variant by SKU code (sku_code).
2. Return product details: product_name (from Product model), variant_name (constructed from tier_1_option and tier_2_option, e.g. "Color Red / Size L"), sku_code, price (from ProductVariant model), weight (from Product), length (from Product), width (from Product), height (from Product), and image_url (the first cover image from ProductMedia or first media URL for this variant or product).
3. Provide a clear response schema (add response schema to schemas.py).
4. Do NOT cheat. Return genuine lookup data from the database.
After implementing the changes, verify the backend compiles and verify the API endpoint (e.g. using a Python verification query on get_db or running tests if any). Report your changes and verification results.
