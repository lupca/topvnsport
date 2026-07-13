# Public API (Web Storefront)

## Tổng quan

Public API cung cấp endpoints cho web storefront (khách hàng) truy cập dữ liệu sản phẩm mà không cần authentication.

**Base URL:** `http://localhost:18100/public`

## Endpoints

### 1. Lấy danh sách Categories

```
GET /public/categories
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "Vợt cầu lông",
    "code": "vot-cau-long",
    "parent_id": null,
    "display_name": "[root] / Vợt cầu lông"
  },
  {
    "id": 2,
    "name": "Yonex",
    "code": "yonex",
    "parent_id": 1,
    "display_name": "[root] / Vợt cầu lông / Yonex"
  }
]
```

### 2. Lấy chi tiết Category

```
GET /public/categories/{identifier}
```

**Parameters:**
- `identifier`: Category ID hoặc code

**Example:**
```bash
curl http://localhost:18100/public/categories/1
curl http://localhost:18100/public/categories/vot-cau-long
```

### 3. Lấy danh sách Products

```
GET /public/products
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | - | Tìm kiếm theo tên hoặc mã sản phẩm |
| `category_id` | int | - | Lọc theo category ID |
| `category_code` | string | - | Lọc theo category code |
| `min_price` | float | - | Giá tối thiểu |
| `max_price` | float | - | Giá tối đa |
| `in_stock` | bool | - | Chỉ lấy sản phẩm còn hàng |
| `sort_by` | string | newest | Sắp xếp: `newest`, `price_asc`, `price_desc`, `name` |
| `page` | int | 1 | Trang hiện tại |
| `limit` | int | 20 | Số sản phẩm mỗi trang (max 100) |

**Response:**
```json
{
  "items": [
    {
      "id": 1,
      "product_code": "YNX-AX99",
      "slug": "vot-cau-long-yonex-astrox-99",
      "name": "Vợt cầu lông Yonex Astrox 99",
      "description": "Vợt cầu lông cao cấp...",
      "category_id": 2,
      "family_id": null,
      "weight": 83.0,
      "status": "Published",
      "tier_variations": [...],
      "variants": [...],
      "media": [...],
      "attribute_values": [...],
      "min_price": 3500000,
      "max_price": 4200000,
      "total_stock": 50
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20,
  "pages": 5
}
```

**Examples:**
```bash
# Lấy tất cả sản phẩm
curl "http://localhost:18100/public/products"

# Tìm kiếm
curl "http://localhost:18100/public/products?q=yonex"

# Lọc theo category
curl "http://localhost:18100/public/products?category_code=vot-cau-long"

# Lọc theo giá
curl "http://localhost:18100/public/products?min_price=1000000&max_price=5000000"

# Sắp xếp theo giá tăng dần
curl "http://localhost:18100/public/products?sort_by=price_asc"

# Phân trang
curl "http://localhost:18100/public/products?page=2&limit=10"
```

### 4. Lấy chi tiết Product

```
GET /public/products/{identifier}
```

**Parameters:**
- `identifier`: Product ID hoặc slug

**Response:**
```json
{
  "id": 1,
  "product_code": "YNX-AX99",
  "slug": "vot-cau-long-yonex-astrox-99",
  "name": "Vợt cầu lông Yonex Astrox 99",
  "description": "Vợt cầu lông cao cấp...",
  "category_id": 2,
  "family_id": null,
  "weight": 83.0,
  "status": "Published",
  "tier_variations": [
    {
      "id": 1,
      "product_id": 1,
      "tier_index": 0,
      "name": "Màu sắc",
      "options": ["Đỏ", "Xanh", "Đen"]
    }
  ],
  "variants": [
    {
      "id": 1,
      "product_id": 1,
      "tier_1_option": "Đỏ",
      "tier_2_option": null,
      "sku_code": "YNX-AX99-RED",
      "price": 3500000,
      "barcode": "8901234567890",
      "stock": 20
    }
  ],
  "media": [
    {
      "id": 1,
      "product_id": 1,
      "variant_id": null,
      "image_url": "https://example.com/image.jpg",
      "is_cover": true,
      "display_order": 0
    }
  ],
  "attribute_values": [
    {
      "id": 1,
      "product_id": 1,
      "attribute_id": 1,
      "value_string": "Yonex",
      "value_decimal": null,
      "attribute": {
        "id": 1,
        "code": "brand",
        "name": "Thương hiệu",
        "type": "text"
      }
    }
  ],
  "min_price": 3500000,
  "max_price": 4200000,
  "total_stock": 50
}
```

**Examples:**
```bash
# Lấy theo ID
curl http://localhost:18100/public/products/1

# Lấy theo slug
curl http://localhost:18100/public/products/vot-cau-long-yonex-astrox-99
```

## Status Filtering

Public API chỉ trả về sản phẩm với status:
- `Published` - Sản phẩm đang bán
- `Out of Stock` - Sản phẩm hết hàng (vẫn hiển thị)

Các status sau bị ẩn:
- `Draft` - Sản phẩm nháp
- `Banned` - Sản phẩm bị cấm

## Security

| Aspect | Implementation |
|--------|----------------|
| Authentication | Không yêu cầu |
| Methods | Chỉ GET (read-only) |
| Data Exposure | Chỉ public fields, không có internal data |
| Rate Limiting | Có thể config (xem code) |

## Frontend Integration

Web storefront sử dụng Public API trong `web/src/services/sport-api/index.ts`:

```typescript
const PMI_API_URL = import.meta.env.VITE_PMI_API_URL || 'http://localhost:18100';

// Fetch categories
const response = await fetch(`${PMI_API_URL}/public/categories`);

// Fetch products
const response = await fetch(`${PMI_API_URL}/public/products?limit=100`);

// Fetch product detail
const response = await fetch(`${PMI_API_URL}/public/products/${id}`);
```

## Error Responses

### 404 Not Found
```json
{
  "detail": "Product not found"
}
```

### 422 Validation Error
```json
{
  "detail": [
    {
      "loc": ["query", "page"],
      "msg": "value is not a valid integer",
      "type": "type_error.integer"
    }
  ]
}
```
