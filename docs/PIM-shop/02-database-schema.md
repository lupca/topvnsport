# Thiết Kế Database (Lớp Channel)

Dựa trên nguyên tắc tách biệt Lớp Core và Lớp Channel, bên cạnh các bảng Core hiện tại (`categories`, `attributes`, `products`, `product_variants` trong file `PMI/backend/models.py`), chúng ta cần thêm các bảng sau:

## 1. Bảng `channel_category_mappings`
Lưu trữ "Từ điển dịch" danh mục của PIM sang danh mục của Sàn.

| Column | Type | Constraints / Description |
| :--- | :--- | :--- |
| `id` | Integer | Primary Key |
| `channel_id` | Integer | FK -> `channels.id` |
| `pim_category_id` | Integer | FK -> `categories.id` |
| `channel_category_code` | String(255) | Mã danh mục của sàn. **Ví dụ Shopee:** `120039` |
| `channel_category_name` | String(255) | Tên danh mục của sàn hoặc chuỗi đầy đủ. **Ví dụ TikTok:** `Thiết bị các môn thể thao bóng/Cầu lông (603065)` |

**Ràng buộc (Constraints):**
- `UNIQUE(channel_id, pim_category_id)`: Chống việc map cùng 1 category PIM sang 2 category Shopee.

## 2. Bảng `channel_attribute_mappings`
Lưu trữ "Từ điển dịch" thuộc tính PIM sang thuộc tính Sàn.

| Column | Type | Constraints / Description |
| :--- | :--- | :--- |
| `id` | Integer | Primary Key |
| `channel_id` | Integer | FK -> `channels.id` |
| `pim_attribute_id` | Integer | FK -> `attributes.id` |
| `channel_category_code`| String(255) | (Nullable). Dành cho các sàn (như Shopee) có ID thuộc tính thay đổi theo từng Danh mục. Nếu NULL, áp dụng cho mọi danh mục trên kênh. |
| `channel_attribute_code` | String(255) | Cột trên file mass upload. **Ví dụ Shopee:** `ps_brand`. **TikTok:** `product_property/100107` |
| `channel_attribute_name` | String(255) | Tên thuộc tính hiển thị (VD: Thương hiệu, Chất liệu) |

**Ràng buộc (Constraints):**
- `UNIQUE(channel_id, pim_attribute_id, channel_category_code)`: Chống duplicate map thuộc tính.

## 3. Bảng `product_channel_listings`
Quản lý trạng thái niêm yết (Publishing) và các tùy chỉnh cấp độ Sản phẩm Cha cho từng Kênh.

| Column | Type | Constraints / Description |
| :--- | :--- | :--- |
| `id` | Integer | Primary Key |
| `product_id` | Integer | FK -> `products.id` |
| `channel_id` | Integer | FK -> `channels.id` |
| `status` | String(50) | Trạng thái hiển thị trên kênh (`Published`, `Draft`, `Hidden`) |
| `title_override` | String(255) | (Nullable). Tiêu đề ghi đè cho sàn. |
| `description_override` | Text | (Nullable). Mô tả chi tiết ghi đè cho sàn (Vì Shopee/TikTok có quy tắc SEO, độ dài mô tả khác với Web chuẩn). |
| `shipping_config` | JSON | (Nullable). Lưu các cấu hình vận chuyển riêng biệt (VD Shopee yêu cầu cột `channel_id_` như J&T, GHN). |
| `channel_product_id` | String(255) | (Nullable). ID do sàn trả về sau khi đăng tải. |

**Ràng buộc (Constraints):**
- `UNIQUE(product_id, channel_id)`: Một sản phẩm chỉ có 1 bản listing duy nhất trên 1 kênh.

## 4. Bảng `variant_channel_listings`
Quản lý Giá bán và định danh cho từng Biến thể (SKU) trên từng Kênh.

| Column | Type | Constraints / Description |
| :--- | :--- | :--- |
| `id` | Integer | Primary Key |
| `variant_id` | Integer | FK -> `product_variants.id` |
| `channel_id` | Integer | FK -> `channels.id` |
| `price_override` | Numeric(12,2) | (Nullable). Giá bán ưu tiên trên kênh này. Dùng Numeric(12,2) để tránh sai số thập phân. Nếu NULL, hệ thống fallback về lấy `price` ở bảng `product_variants` gốc. |
| `channel_variant_id` | String(255) | (Nullable). ID biến thể do sàn quản lý. |

**Ràng buộc (Constraints):**
- `UNIQUE(variant_id, channel_id)`: Một biến thể chỉ có 1 bản listing duy nhất trên 1 kênh.

## 5. Bảng `product_channel_attribute_values` [CRITICAL FIX]
Đóng vai trò cực kỳ quan trọng để lưu các **giá trị thuộc tính ghi đè riêng cho sàn** hoặc các thuộc tính sàn bắt buộc mà PIM không có.

| Column | Type | Constraints / Description |
| :--- | :--- | :--- |
| `id` | Integer | Primary Key |
| `product_id` | Integer | FK -> `products.id` |
| `channel_id` | Integer | FK -> `channels.id` |
| `attribute_mapping_id`| Integer | FK -> `channel_attribute_mappings.id`. (Biết được giá trị này đang điền cho cột nào của sàn). |
| `value_string` | String(255) | Giá trị chữ. (VD: "Polyester") |
| `value_decimal` | Numeric(12,2)| Giá trị số. |

**Ràng buộc (Constraints):**
- `UNIQUE(product_id, channel_id, attribute_mapping_id)`: Mỗi thuộc tính sàn trên 1 sản phẩm chỉ được điền 1 giá trị.

---

> **Lưu ý Cập nhật Lớp Core (Models.py):**
> 1. Đổi trường `price` thành `Numeric(12,2)` thay vì `Float` để tránh lỗi tính toán tiền tệ.
> 2. Thêm trường `barcode` vào bảng `product_variants`.
> 3. Khai báo thêm `hs_code` và `tax_code` vào bảng `products` (Lớp Core). Dù đây là trường bắt buộc của Shopee, nhưng mã HS (Harmonized System) là chuẩn hải quan toàn cầu, do đó nó thuộc tính chất vật lý của sản phẩm và xứng đáng nằm ở Core thay vì Channel.
> 4. Sửa lại `remote_side` trong relationship `children` của Category để tránh bị ngược cấp.
