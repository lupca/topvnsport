# OMS (Order Management System) Architecture

## 1. Tổng quan
OMS là trung tâm tiếp nhận đơn hàng, quản lý khách hàng, kênh bán hàng và phân bổ hàng hóa. OMS đóng vai trò là "bộ não" điều phối thông tin từ lúc khách hàng bấm đặt hàng cho đến khi hàng được đóng gói và giao đi.
- **Backend:** FastAPI (Port 18101)
- **Frontend:** Next.js/React (Port 13101)
- **Database:** PostgreSQL (`oms_db` - Port 15434)

## 2. Cấu trúc Database (Models)

### Customer (Khách hàng)
- `id`, `name`, `phone` (Unique), `email`, `address`, `created_at`
- Liên kết 1-nhiều tới `Order`.

### Channel (Kênh bán hàng)
- `id`, `code` (Unique), `name`, `is_active`
- Quản lý đa kênh bán (Shopee, Lazada, Tiktok, Web).

### Order (Đơn hàng)
- `id`, `order_number` (Unique, tự gen theo sequence), `status` (DRAFT, PROCESSING, PACKED, SHIPPED, COMPLETED, CANCELLED).
- `total_amount`, `shipping_fee`, `shipping_address`, `note`.
- Khóa ngoại: `customer_id`, `channel_id`.
- Chứa logic trọng tâm để tính toán giá trị cuối cùng.

### OrderItem (Sản phẩm trong đơn hàng)
- `id`, `order_id`
- `sku_code`, `product_name`, `variant_name`, `image_url` (Fetch metadata từ PMI).
- `quantity`, `unit_price`, `subtotal`.

### FulfillmentOrder (Lệnh xuất kho liên kết)
- `id`, `order_id`, `fulfillment_number` (Unique).
- `warehouse_code`, `status`, `tracking_number`, `carrier_name`, `shipped_at`.
- Lưu trữ bản sao trạng thái xuất kho từ WMS để truy vấn nội bộ nhánh OMS mà không cần join database sang WMS.

## 3. Các API Endpoints Chi Tiết

### Khách hàng & Kênh bán
- `POST /customers`: Tạo khách hàng mới.
- `GET /customers`, `GET /customers/{id}`, `PUT /customers/{id}`
- `POST /channels`, `GET /channels`, `PUT /channels/{id}`

### Đơn hàng (Nghiệp vụ cốt lõi)
- `POST /orders`: Tạo một order nháp.
- `GET /orders`, `GET /orders/{id}`
- `POST /orders/{id}/confirm`: Xác nhận đơn hàng. 
  - **Logic:** Gọi PMI kiểm tra giá gốc và sự tồn tại của SKU -> Gọi WMS yêu cầu reserve hàng hóa và tạo Fulfillment Order bên WMS -> Chuyển trạng thái Order sang `PROCESSING`.
- `POST /orders/{id}/cancel`: Hủy đơn hàng.
  - **Logic:** Đánh dấu đơn là `CANCELLED` -> Trả lại số lượng tồn (gọi API Cancel của WMS) nếu đơn chưa giao.
- `PATCH /orders/{id}/status`: Cập nhật trạng thái một chiều.
  - **Logic:** API này thường không do End-user gọi mà là **Callback Endpoint** để WMS gọi sang sau khi Picker/Packer làm xong nhiệm vụ bên kho.
- `GET /orders/{id}/stock-check`: Gọi API WMS lấy tồn kho realtime cho từng SKU trong Order.
