# OMS (Order Management System) Architecture

## 1. Tổng quan
OMS là trung tâm tiếp nhận và xử lý đơn hàng đa kênh (Omnichannel Order Hub), quản lý thông tin khách hàng, kênh bán hàng, giữ tồn kho và phân bổ xuất kho. OMS đóng vai trò là "bộ não" điều phối thông tin từ lúc khách hàng đặt hàng cho đến khi hàng được đóng gói và giao đi.
- **Backend:** FastAPI (Port 8000 trực tiếp / Port 18101 Docker proxy)
- **Frontend:** Next.js (Port 13101)
- **Database:** PostgreSQL (`oms_db` - Port 15434) / SQLite (`test.db` cho dev/test)

## 2. Cấu trúc Database (Models & Migrations)

### Customer (`customers`)
- `id`, `name`, `phone` (Unique, regex `^(0|\+84|84)[35789]\d{8}$`), `email`, `address`, `created_at`.
- Soft deletion: `is_deleted` (Boolean), `deleted_at` (DateTime).
- Relationship: 1-nhiều tới `Order`.

### Channel (`channels`)
- `id`, `code` (Unique), `name`, `is_active` (Boolean).
- Soft deletion: `is_deleted` (Boolean), `deleted_at` (DateTime).
- Tự động seed dữ liệu ban đầu khi khởi chạy: `MANUAL`, `STOREFRONT`, `SHOPEE`, `TIKTOK_SHOP`, `LAZADA`.
- Relationship: 1-nhiều tới `Order`.

### Order (`orders`)
- `id`, `order_number` (Unique, tự động sinh theo chuỗi `ORD-YYYYMMDD-XXXX`), `status` (`DRAFT`, `CONFIRMED`, `PROCESSING`, `PICKING`, `PACKED`, `SHIPPED`, `COMPLETED`, `CANCELLED`, `CANCELLATION_PENDING`).
- `total_amount`, `shipping_fee`, `shipping_address`, `note`, `created_by`, `created_at`, `updated_at`.
- Foreign Keys: `customer_id`, `channel_id`.
- Relationship: `items` (OrderItems), `fulfillment_orders` (FulfillmentOrders).

### OrderItem (`order_items`)
- `id`, `order_id` (FK to `orders.id`, Cascade Delete).
- `sku_code`, `product_name`, `variant_name`, `image_url` (Fetch metadata từ PMI Service).
- `quantity`, `unit_price`, `subtotal`.

### FulfillmentOrder (`fulfillment_orders`)
- `id`, `order_id` (FK to `orders.id`), `fulfillment_number` (Unique, ví dụ `FM-ORD-YYYYMMDD-XXXX`).
- `warehouse_code`, `status` (`PENDING`, `PICKING`, `PACKED`, `SHIPPED`, `CANCELLED`), `tracking_number`, `carrier_name`, `shipped_at`, `created_at`.
- Đồng bộ thông tin xuất kho từ WMS Service.

### SystemConfig (`system_configs`)
- `id`, `config_key` (Unique, ví dụ `zalo_access_token`, `zalo_refresh_token`, `zalo_app_id`, `zalo_secret_key`, `zalo_template_id`).
- `config_value` (Mã hóa ở mức ứng dụng bằng `Fernet` / `EncryptedString`), `description`, `updated_at`.

### OtpVerification (`otp_verifications`) & SmsRateLimit (`sms_rate_limits`)
- Quản lý mã băm OTP 6 chữ số, `verification_token` (UUIDv4 cho đơn Storefront), trạng thái gửi Zalo ZBS (`zalo_message_id`, `provider_status`), và kiểm soát cooldown 60s / lockout 15 phút.

## 3. Quản lý Xác thực & Bảo mật (Authentication)

OMS Backend hỗ trợ 3 cơ chế xác thực:
1. **Gateway Headers (Primary)**: Nhận `X-User-Id`, `X-User-Username`, `X-User-Role`, `X-User-Permissions` do Nginx/API Gateway inject.
2. **JWT Bearer Token (Fallback)**: Đọc token từ header `Authorization: Bearer <token>` và giải mã bằng `JWT_SECRET_KEY`.
3. **Internal Service API Key (`X-API-Key`)**: Xác thực cuộc gọi nội bộ giữa các microservices bằng `INTERNAL_SERVICE_TOKEN` (`oms_wms_internal_api_key_secret_2026`).

## 4. Tích hợp Dịch vụ & Workflows

1. **Storefront OTP & Order Creation**:
   - Khách hàng yêu cầu gửi OTP -> Zalo ZBS gửi tin -> Khách nhập OTP xác minh -> Cấp `verification_token` (15 phút).
   - Khi tạo đơn Storefront (`POST /orders`), hệ thống kiểm tra và tiêu thụ nguyên tử (`atomically consume`) token để ngăn dùng lại.
2. **Order Confirmation & WMS Allocation**:
   - `POST /orders/{id}/confirm`: Xác minh thông tin từ PMI -> Kiểm tra tồn kho và phân bổ theo kho từ WMS -> Tạo `FulfillmentOrder` bên WMS và OMS -> Chuyển trạng thái đơn sang `PROCESSING`.
   - Nếu WMS báo lỗi, tự động rollback các lệnh xuất kho đã tạo (compensation pattern).
3. **Zalo Token Auto-refresh Scheduler**:
   - Chạy background job `APScheduler` mỗi **20 giờ** để tự động đổi Zalo OA Access/Refresh Token và lưu mã hóa vào database.

## 5. Danh sách API Endpoints Chi Tiết

- **Health Check**: `GET /`
- **OTP & SMS**: `POST /api/sms/send-otp`, `POST /api/sms/verify-otp`, `GET /api/sms/test-last-otp`, `POST /api/sms/zalo-webhook`
- **System Configs**: `GET /api/configs/sms`, `PUT /api/configs/sms` (Admin only)
- **Orders**: `POST /orders`, `GET /orders`, `GET /orders/{id}`, `PUT /orders/{id}`, `DELETE /orders/{id}`, `POST /orders/{id}/confirm`, `GET /orders/{id}/stock-check`, `POST /orders/{id}/cancel`, `PATCH /orders/{id}/status`, `PATCH /orders/{id}/fulfillments/{fulfillment_number}/status`
- **Customers**: `POST /customers`, `GET /customers`, `GET /customers/{customer_id}`, `PUT /customers/{customer_id}`, `DELETE /customers/{customer_id}`
- **Channels**: `POST /channels`, `GET /channels`, `GET /channels/{channel_id}`, `PUT /channels/{channel_id}`, `DELETE /channels/{channel_id}`
- **Dashboard**: `GET /dashboard/stats`
- **Products Proxy**: `GET /products/search`
