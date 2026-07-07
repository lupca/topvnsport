# Quản Lý Cài Đặt Hệ Thống & Kênh Bán Hàng

Để hệ thống PIM có thể mở rộng tự động và linh hoạt, chúng ta không thể "hard-code" (viết cứng) thông tin của Shopee hay TikTok vào code. Thay vào đó, cần xây dựng một Module **"Cài Đặt Hệ Thống > Kênh Bán Hàng"** (Settings > Sales Channels) để người quản trị (Admin) có thể tự do thêm, sửa, xóa (CRUD) các cấu hình nền tảng.

Dưới đây là bản thiết kế cho module này.

## 1. Mở Rộng Database 

Trong bảng `channels` hiện tại của PIM (`models.py`), chúng ta nên thêm một bảng lưu trữ Cấu hình API (Credentials) để chuẩn bị cho việc tích hợp đồng bộ tự động sau này (thay vì chỉ xuất file Excel).

### Bảng `channels` (Đã có, cần thiết kế UI để CRUD)
- `id`
- `code` (Ví dụ: `shopee_vn`, `tiktok_shop`)
- `name` (Ví dụ: `Shopee Việt Nam`)

### [NEW] Bảng `channel_configs` (Cấu hình Kênh)
Lưu trữ các tham số kết nối API hoặc các cấu hình đặc thù cho từng kênh.
- `id`: PK
- `channel_id`: FK -> `channels.id`
- `app_key` / `client_id`: Dùng cho OAuth2 tích hợp API.
- `app_secret`: Mã bí mật kết nối.
- `access_token` & `refresh_token`: (Lưu mã hóa).
- `is_active`: Trạng thái Bật/Tắt kênh này trên toàn hệ thống.

## 2. Thiết Kế Giao Diện (Frontend UI/UX)

Trong phần menu **Cài Đặt (Settings)** của Admin Dashboard, tạo một trang **Kênh Bán Hàng (Sales Channels)**.

### Màn hình 1: Danh sách Kênh (Channel List)
- Hiển thị danh sách dạng Card (Thẻ) hoặc Table: 
  - [ Thẻ Shopee - Status: Đang hoạt động ]
  - [ Thẻ TikTok - Status: Đang hoạt động ]
  - [ Nút "Thêm Kênh Mới" ] (Cho phép tạo kênh Lazada, Tiki...)

### Màn hình 2: Chi Tiết Kênh (Channel Details)
Khi click vào quản lý một kênh (Ví dụ: Shopee), màn hình sẽ được chia làm 3 Tab chính:

#### Tab 1: Thông tin & Kết nối (General & Connection)
- Cho phép đổi tên kênh (VD: Shopee VN, Shopee Global).
- Cho phép nhập `App Key`, `App Secret` để liên kết với hệ thống của sàn.
- Nút `[Kiểm tra kết nối]` (Test Connection).

#### Tab 2: Ánh xạ Danh mục (Category Mappings)
- **Giao diện:** Một bảng Table có 2 cột chính.
  - Cột 1: Danh mục PIM (Dạng cây thư mục: `Thể thao > Vợt cầu lông`).
  - Cột 2: Ô Input/Dropdown để điền Mã Danh mục Shopee (`120039`).
- **UX Tính năng:** Cho phép Admin tìm kiếm nhanh danh mục PIM chưa được map để điền ID của Shopee vào. Dữ liệu này sẽ được lưu xuống bảng `channel_category_mappings`.

#### Tab 3: Ánh xạ Thuộc tính (Attribute Mappings)
- **Giao diện:** Một bảng Table có 3 cột.
  - Cột 1: Thuộc tính PIM (`Thương hiệu`, `Nơi sản xuất`).
  - Cột 2: Cột Sàn Yêu Cầu (`ps_brand`, `Country of Origin`).
  - Cột 3: Áp dụng cho Danh mục nào (Nếu chọn `Tất cả`, nó sẽ áp dụng Global. Nếu chọn `120039`, nó chỉ ánh xạ khi xuất danh mục Vợt cầu lông).
- **UX Tính năng:** Admin có thể định nghĩa thêm các cặp mapping mới khi Shopee hoặc TikTok thay đổi biểu mẫu. Lưu dữ liệu xuống bảng `channel_attribute_mappings`.
- **Lưu ý đánh đổi (Trade-off):** Frontend ở giao diện tạo Sản Phẩm sẽ **chỉ hiển thị** các thuộc tính nào đã được Admin khai báo mapping ở Tab này. Mặc dù ở giai đoạn 1 PIM chưa tự động fetch API của sàn để biết danh mục nào bắt buộc điền gì, nhưng tính năng này trao quyền cho Admin thêm/bớt field bắt lỗi tuỳ ý mà không cần Dev phải can thiệp sửa code mỗi lần sàn thay đổi luật.

## 3. Kiến Trúc Backend API

Các API cần bổ sung để Frontend có thể CRUD dữ liệu cài đặt:

**Quản lý Kênh Bán Hàng (Channel CRUD):**
- `GET /api/channels`: Lấy danh sách kênh.
- `POST /api/channels`: Thêm kênh mới (VD: Lazada).
- `GET /api/channels/{id}`: Lấy chi tiết kênh.
- `PUT /api/channels/{id}`: Sửa tên/mã kênh.
- `DELETE /api/channels/{id}`: Xóa kênh (chỉ được xóa nếu chưa có sản phẩm nào đang niêm yết).

**Quản lý Cấu hình Kết nối (Configs):**
- `GET /api/channels/{id}/config`
- `PUT /api/channels/{id}/config`

**Quản lý Mapping (Như đã đề cập ở tài liệu trước):**
- `GET /api/channels/{id}/category-mappings`
- `POST/PUT /api/channels/{id}/category-mappings` (Cập nhật đồng loạt - Bulk Update)
- `GET /api/channels/{id}/attribute-mappings`
- `POST/PUT /api/channels/{id}/attribute-mappings`

## 4. Tầm Quan Trọng Của Module Này
Việc thiết kế Module Settings giúp hệ thống PIM của công ty mang tầm vóc của một SaaS chuyên nghiệp. Thay vì mỗi lần Shopee thay đổi file Excel, hoặc mỗi lần công ty muốn mở rộng sang bán ở Lazada, Developer lại phải đi sửa code; thì giờ đây **chỉ cần Admin vào màn hình Settings, tạo kênh mới, nhập các cấu hình mapping là hệ thống sẽ tự động xuất file Excel tương thích ngay lập tức.**
