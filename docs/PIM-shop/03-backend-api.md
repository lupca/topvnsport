# Thiết Kế Backend API (FastAPI)

Các API quản lý trong `PMI/backend/main.py` sẽ cần được cập nhật và bổ sung để vận hành hệ thống đa kênh.

## 1. Quản lý Mappings
Các API dành cho Admin/Dev để thiết lập "từ điển" (Thường chỉ setup 1 lần lúc onboarding).

- `GET /api/channels/{channel_id}/category-mappings`
- `POST /api/channels/{channel_id}/category-mappings`
- `GET /api/channels/{channel_id}/attribute-mappings`
- `POST /api/channels/{channel_id}/attribute-mappings`

## 2. Quản lý Listing (Sản phẩm lên Kênh)
Khi tạo mới hoặc cập nhật một sản phẩm (`POST /products` hoặc `PUT /products/{id}`), Schema Pydantic `ProductCreate` sẽ được mở rộng thêm trường `channel_listings`:

```json
{
  "product_code": "SP-123",
  "name": "Áo Yonex",
  "variants": [
    { "sku_code": "SP-123-RED", "price": 100000, "stock": 10 }
  ],
  "channel_listings": [
    {
      "channel_code": "shopee_vn", // Dùng code thay vì ID cứng
      "status": "Published",
      "title_override": "Áo Yonex Giật Tít SEO Shopee",
      "description_override": "Mô tả dài chuẩn SEO Shopee...",
      "shipping_config": {
        "channel_id_32023": true // Bật J&T Express
      },
      "attribute_values": [
        { "attribute_mapping_id": 10, "value_string": "Polyester" } // Thuộc tính đặc thù sàn
      ],
      "variant_overrides": [
        { "sku_code": "SP-123-RED", "price_override": 120000 }
      ]
    }
  ]
}
```

## 3. API Xuất dữ liệu Mass Upload (Export Excel/CSV)

Thay vì tích hợp API trực tiếp lên sàn (khó bảo trì ở giai đoạn đầu), PIM sẽ hỗ trợ tính năng **Export CSV chuẩn định dạng của sàn**.

### Endpoint: `GET /api/export/shopee?status=Published`
**Logic xử lý Backend:**
1. Filter các sản phẩm có `product_channel_listings` thuộc `channel_id = Shopee` và `status = Published`.
2. Map `Product.product_code` -> Cột `et_title_variation_integration_no`.
3. Tra bảng `channel_category_mappings` để điền ID danh mục Shopee vào cột `ps_category`.
4. Với từng Product Attribute, tra bảng `channel_attribute_mappings` để map đúng tên cột (Ví dụ: map thành `ps_brand`).
5. Nếu SKU có `price_override`, dùng giá đó; nếu không dùng `base_price`.
6. Trả về file CSV.

### Endpoint: `GET /api/export/tiktok?status=Published`
**Logic xử lý Backend (Điểm khác biệt lấy từ file TikTok Template):**
1. Filter các sản phẩm Published trên TikTok.
2. Sắp xếp các biến thể của cùng một Sản phẩm liền kề nhau (Row contiguous).
3. Map Tên Sản Phẩm (`Product.name` hoặc `title_override`) vào cột `product_name` giống hệt nhau cho mọi row biến thể.
4. Tra bảng `channel_category_mappings`, lấy trường `channel_category_name` (Vì TikTok yêu cầu điền cả chuỗi, VD: `Thiết bị thể thao/Cầu lông (603065)`) thay vì chỉ lấy ID.
5. Tra bảng thuộc tính, map thành các cột có tiền tố `product_property/ID`.
6. Trả về file CSV.

## 4. Background Tasks & WMS Sync
Stock (Tồn kho) là dữ liệu toàn cục (Global). Nếu WMS update tồn kho (`PUT /api/products/by-sku/{sku_code}/stock`), PIM sẽ không phân biệt kênh. Tuy nhiên, ở giai đoạn nâng cấp sau (Tích hợp API Sàn), PIM sẽ dùng background worker (Celery/RQ) lắng nghe sự kiện thay đổi Stock để bắn API trừ/cộng tồn kho đồng loạt trên Shopee và TikTok.
