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

## 3. Bảng `product_channel_listings`
Quản lý trạng thái niêm yết (Publishing) và các tùy chỉnh cấp độ Sản phẩm Cha cho từng Kênh.

| Column | Type | Constraints / Description |
| :--- | :--- | :--- |
| `id` | Integer | Primary Key |
| `product_id` | Integer | FK -> `products.id` |
| `channel_id` | Integer | FK -> `channels.id` |
| `status` | String(50) | Trạng thái hiển thị trên kênh (`Published`, `Draft`, `Hidden`) |
| `title_override` | String(255) | (Nullable). Tiêu đề ghi đè. Nguồn gốc: Người dùng muốn tên SP trên Shopee có chứa keyword giật tít, trong khi web giữ tên chuẩn. |
| `channel_product_id` | String(255) | (Nullable). ID do sàn trả về sau khi đăng tải thành công (chuẩn bị cho tích hợp API sau này). |

## 4. Bảng `variant_channel_listings`
Quản lý Giá bán và định danh cho từng Biến thể (SKU) trên từng Kênh.

| Column | Type | Constraints / Description |
| :--- | :--- | :--- |
| `id` | Integer | Primary Key |
| `variant_id` | Integer | FK -> `product_variants.id` |
| `channel_id` | Integer | FK -> `channels.id` |
| `price_override` | Float | (Nullable). Giá bán ưu tiên trên kênh này. Nếu NULL, hệ thống fallback về lấy `price` ở bảng `product_variants` gốc. |
| `channel_variant_id` | String(255) | (Nullable). ID biến thể do sàn quản lý. |

> **Lưu ý về Nguồn Dữ Liệu Gốc (Data Source Reference):** 
> - Khác biệt về Cột thuộc tính động trên file CSV của Shopee (các cột có màu đỏ và xanh lam trong sheet Đăng tải bản mẫu) được giải quyết bởi bảng `channel_attribute_mappings`.
> - Việc chênh lệch giá bán giữa các sàn được giải quyết bằng `price_override`.
