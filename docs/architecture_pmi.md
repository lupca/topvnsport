# PMI (Product Master Index) Architecture

## 1. Tổng quan
PMI đóng vai trò như một hệ thống PIM (Product Information Management), là "Source of Truth" (Nguồn sự thật) duy nhất về thông tin sản phẩm, mô tả, biến thể, giá cả và hình ảnh của hệ thống.
- **Backend:** FastAPI (Port 18100)
- **Frontend:** Next.js/React (Port 13100)
- **Database:** PostgreSQL (`pim_db` - Port 15433)
- **Media Storage:** MinIO (Port 19005) lưu trữ Object Storage thay thế S3.

## 2. Cấu trúc Database (Models)

### Danh mục & Thuộc tính mở rộng
- `Category`: Danh mục hình cây `parent_id` vô hạn (Ví dụ: Thể thao > Cầu lông > Vợt).
- Cụm Thuộc tính: `AttributeFamily` (Tập thuộc tính cho một dòng SP), `AttributeGroup`, `Attribute` (Type: Text, Bool, Option...). Hỗ trợ quản lý dữ liệu linh hoạt mà không cần alter table.
- `ProductAttributeValue`: Value động cho từng thuộc tính của sản phẩm.

### Sản phẩm cốt lõi (Catalog)
- `Product`: Thể hiện cho một dòng sản phẩm cha.
  - Chứa: `product_code`, `name`, `description`, `weight`, `dimensions`, `is_pre_order`, `status`.
  - Liên kết tới 1 `Category` và 1 `AttributeFamily`.
- `TierVariation`: Biến thể tầng (Tối đa 2 tầng giống Shopee: Tier 1 có thể là "Màu sắc", Tier 2 là "Kích cỡ").
- `ProductVariant`: Một sản phẩm hữu hình cụ thể.
  - Chứa `sku_code` (Mã định danh duy nhất toàn hệ thống dùng làm khóa móc nối với OMS/WMS), `price`, `stock` (Đang trùng lặp chức năng với WMS).
  - Có các `tier_1_option` và `tier_2_option` để hiển thị trên UI.

### Media (Quản lý File)
- `ProductMedia`: Lưu trữ đường link ảnh (`image_url`), cờ `is_cover` để đánh dấu ảnh bìa. Liên kết với `Product` hoặc một `ProductVariant` cụ thể (Ví dụ: Ảnh riêng cho vợt màu Xanh).

## 3. Các API Endpoints Chi Tiết

### Sản phẩm (Products & Variants)
- `POST /products`: Lưu nguyên cục JSON từ frontend bao gồm (Thông tin cha, Tier Variations, Các Variants con sinh ra từ tổ hợp Tier, Ảnh...).
- `GET /products`, `GET /products/{id}`, `PUT /products/{id}`, `DELETE /products/{id}`.
- `GET /api/products/by-sku/{sku_code}`: **(Critical Endpoint)** Trả về thông tin tóm tắt (Tên cha, Tên biến thể, Giá, Ảnh bìa) dùng để OMS tính tiền và WMS hiển thị lúc quét mã.

### Phân loại & Thuộc tính (Taxonomy)
- `POST/GET/PUT/DELETE /categories`: CRUD danh mục.
- `POST/GET /attributes`, `/attribute-groups`, `/attribute-families`: Quản lý siêu dữ liệu linh động.

### Upload Media
- `POST /upload`: API nhận file multipart/form-data. Backend sẽ gọi `minio_client` đẩy file vào bucket `topvnsport` và sinh URL public trả về cho Client.
