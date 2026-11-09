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
- `id`, `order_number` (Unique, tự động sinh theo chuỗi `ORD-YYYYMMDD-XXXX`), `status` (`DRAFT`, `CONFIRMED`, `PROCESSING`, `PICKING`, `PACKED`, `SHIPPED`, `COMPLETED`, `CANCELLED`, `CANCELLATION_PENDING`, `RETURNED`).
- `total_amount`, `shipping_fee`, `shipping_address`, `note`, `created_by`, `created_at`, `updated_at` (có index, dùng cho đồng bộ tăng dần).
- Trường tài chính: `discount_amount`, `seller_shipping_cost`, `platform_fee`, `returned_at` — xem [mục 6](#6-finance-fields--returned).
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
3. **Internal Service API Key (`X-API-Key`)**: Xác thực cuộc gọi nội bộ giữa các microservices bằng `INTERNAL_SERVICE_TOKEN`. Giá trị **bắt buộc** lấy từ biến môi trường (không còn giá trị mặc định trong code; thiếu thì service dừng ngay khi khởi động). OMS gửi `PIM_API_KEY` nếu có, nếu không dùng chính `INTERNAL_SERVICE_TOKEN`. Token nội bộ không được bắt đầu bằng `vk_` — tiền tố này dành cho API key của seller (xem `docs/api_keys.md`); key `vk_…` gửi thẳng tới backend luôn bị từ chối (chỉ Gateway mới xác thực được).

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
- **Orders**: `POST /orders`, `GET /orders`, `GET /orders/{id}`, `PUT /orders/{id}`, `DELETE /orders/{id}`, `POST /orders/{id}/confirm`, `GET /orders/{id}/stock-check`, `POST /orders/{id}/cancel`, `PATCH /orders/{id}/status`, `POST /orders/{id}/return`, `PATCH /orders/{id}/finance`, `PATCH /orders/{id}/fulfillments/{fulfillment_number}/status`
- **Customers**: `POST /customers`, `GET /customers`, `GET /customers/{customer_id}`, `PUT /customers/{customer_id}`, `DELETE /customers/{customer_id}`
- **Channels**: `POST /channels`, `GET /channels`, `GET /channels/{channel_id}`, `PUT /channels/{channel_id}`, `DELETE /channels/{channel_id}`
- **Dashboard**: `GET /dashboard/stats`
- **Products Proxy**: `GET /products/search`

## 6. Finance fields & RETURNED

Các trường phục vụ báo cáo lãi/lỗ (VOMA Insights đọc qua `GET /api/oms/orders`), thêm bởi migration `0010_add_order_finance_fields`:

| Trường | Kiểu | Ý nghĩa |
|---|---|---|
| `discount_amount` | Numeric(12,2), NOT NULL, mặc định 0 | Voucher/giảm giá **shop chịu** (không gồm phần sàn tài trợ). Với đơn tạo tay, được trừ vào `total_amount`. |
| `seller_shipping_cost` | Numeric(12,2), NOT NULL, mặc định 0 | Phí ship shop thực trả, **gồm ship hoàn**. |
| `platform_fee` | Numeric(12,2), NULL | Phí sàn thực tế (hoa hồng + phí dịch vụ + phí thanh toán). `NULL` = chưa biết (chưa đối soát). |
| `returned_at` | DateTime (UTC), NULL | Thời điểm đơn bị hoàn; `NULL` nếu không hoàn. |

- `shipping_fee` vẫn là phí ship **khách trả**.
- Migration backfill `updated_at = created_at` cho các dòng cũ đang `NULL` và tạo index `ix_orders_updated_at`.
- Nguồn dữ liệu:
  - Đơn tạo tay: `POST /orders`/`PUT /orders/{id}` nhận cả 3 trường; chi phí biết sau (ship thực tế, phí sàn sau đối soát) ghi bằng `PATCH /orders/{id}/finance` ở mọi trạng thái (ghi sự kiện `order.finance_updated`).
  - Đơn sàn (`adapters/channels/*` → `NormalizedOrder` → `OrderService.create_or_ingest_order`): Shopee lấy `order_income.voucher_from_seller + seller_discount` → `discount_amount` và `commission_fee + service_fee + seller_transaction_fee` → `platform_fee` **nếu** payload là escrow detail; TikTok lấy `payment_info.seller_discount` → `discount_amount`. Các phần còn lại (ship shop trả, phí sàn TikTok/Lazada) cần API tài chính/đối soát của sàn — xem các `TODO(insights)` trong adapter.

**RETURNED** — đơn đã giao (`SHIPPED` hoặc `COMPLETED`) rồi bị khách hoàn:
- `ALLOWED_TRANSITIONS`: `SHIPPED → COMPLETED | RETURNED`, `COMPLETED → RETURNED`; `RETURNED` là trạng thái cuối (không huỷ, không chuyển tiếp).
- Đánh dấu bằng `POST /orders/{id}/return` (tuỳ chọn `returned_at`, `return_shipping_cost` — cộng vào `seller_shipping_cost`, `reason`) hoặc `PATCH /orders/{id}/status {"status": "RETURNED"}`. Cả hai gán `returned_at` (mặc định thời điểm hiện tại) và ghi sự kiện `order.returned` vào `order_events`.
- Endpoint trạng thái fulfillment không nhận `RETURNED` (hoàn hàng là trạng thái cấp đơn).
- `GET /dashboard/stats`: doanh thu loại trừ cả `CANCELLED` và `RETURNED`. Xoá kênh/khách hàng coi `RETURNED` là đơn đã kết thúc.
- Insights map: `CANCEL*` → huỷ; `RETURNED` hoặc `returned_at != null` → hoàn; `DRAFT`/`PENDING` → bỏ qua; còn lại → đã bán.
