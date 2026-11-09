# TopVNSport OMS - API Documentation

Tài liệu API chi tiết của hệ thống TopVNSport Order Management System (OMS Backend).

---

## Table of Contents

- [Overview & Base URL](#overview-base-url)
- [Authentication & Security](#authentication-security)
- [Error Handling & Status Codes](#error-handling-status-codes)
- [API Endpoints](#api-endpoints)
  - [1. Root & Health Check](#1-root-health-check)
  - [2. OTP & SMS Verification (`/api/sms`)](#2-otp-sms-verification-apisms)
  - [3. Webhooks (`/api/sms`)](#3-webhooks-apisms)
  - [4. System Configurations (`/api/configs`)](#4-system-configurations-apiconfigs)
  - [5. Orders Management (`/orders`)](#5-orders-management-orders)
  - [6. Fulfillment Order Management (`/orders`)](#6-fulfillment-order-management-orders)
  - [7. Customer Management (`/customers`)](#7-customer-management-customers)
  - [8. Channel Management (`/channels`)](#8-channel-management-channels)
  - [9. Dashboard Analytics (`/dashboard`)](#9-dashboard-analytics-dashboard)
  - [10. Product Proxy Search (`/products`)](#10-product-proxy-search-products)
- [Related Documentation](#related-documentation)

---

## Overview & Base URL

- **Default Local Base URL**: `http://localhost:8000` (Direct FastAPI backend) / `http://localhost:18101` (Docker proxy)
- **Production Base URL**: `https://oms.topvnsport.com`
- **Content-Type**: `application/json`

---

## Authentication & Security

OMS Backend hỗ trợ 3 phương thức xác thực linh hoạt:

1. **Gateway-injected Headers (Primary)**:
   ```http
   X-User-Id: <user-id>
   X-User-Username: <username>
   X-User-Role: <role>
   X-User-Permissions: <perm1,perm2>
   ```
2. **JWT Bearer Token Fallback (Direct API access)**:
   ```http
   Authorization: Bearer <your-jwt-token>
   ```
3. **Internal Service API Key Fallback (`X-API-Key`)**:
   ```http
   X-API-Key: <INTERNAL_SERVICE_TOKEN>   # chỉ dùng giữa các service, Gateway xoá header này với request từ ngoài
   ```

- **Protected Endpoints**: Yêu cầu xác thực (thông qua Gateway headers, JWT Bearer Token, hoặc `X-API-Key`).
- **Admin-only Endpoints**: Yêu cầu tài khoản có `role: "admin"` (ví dụ: `PUT /api/configs/sms`).
- **Public / Optional Auth Endpoints**: Cho phép truy cập không cần xác thực hoặc có auth tùy chọn (ví dụ: `GET /`, `POST /orders` cho Storefront, `POST /customers`, `POST /api/sms/send-otp`, `POST /api/sms/verify-otp`, `POST /api/sms/zalo-webhook`, `GET /channels`).

---

## Error Handling & Status Codes

Hệ thống sử dụng các mã HTTP Status tiêu chuẩn:

| Status Code | Description | Reason / Trigger |
| --- | --- | --- |
| `200 OK` | Thành công | Request xử lý thành công (ví dụ: khôi phục customer soft-deleted) |
| `201 Created` | Tạo mới thành công | Tạo mới đơn hàng, khách hàng, kênh bán hàng |
| `204 No Content` | Xóa thành công | Xóa đơn nháp (`DRAFT`), soft-delete khách hàng hoặc kênh bán hàng |
| `400 Bad Request` | Dữ liệu không hợp lệ | Đơn hàng sai trạng thái, trùng code/phone/order_number, OTP sai, tồn kho không đủ |
| `401 Unauthorized` | Chưa xác thực | Thiếu Gateway Headers, JWT Token, hoặc `X-API-Key` trên các protected route |
| `403 Forbidden` | Không có quyền / Bị khóa | Số điện thoại bị khóa do rate limit, sai/hết hạn verification token, không có role `admin` |
| `404 Not Found` | Không tìm thấy | ID đơn hàng, khách hàng, kênh không tồn tại trong hệ thống |
| `409 Conflict` | Xung đột nghiệp vụ | Không thể xóa Customer/Channel đang có đơn hàng active (chưa CANCELLED/COMPLETED) |
| `422 Unprocessable Entity` | Lỗi Validation | Định dạng số điện thoại không hợp lệ (regex `^(0|\+84|84)[35789]\d{8}$`), thiếu trường bắt buộc |
| `429 Too Many Requests` | Gửi request quá nhanh | Cooldown gửi OTP trong vòng 60 giây |
| `500 Internal Server Error` | Lỗi hệ thống | Lỗi không xác định hoặc lỗi kết nối dịch vụ ngoài (WMS/PMI) |

---

## API Endpoints

### 1. Root & Health Check

#### `GET /`
- **Description**: Trả về trạng thái hoạt động của dịch vụ OMS Backend.
- **Authentication**: Public
- **Response `200 OK`**:
  ```json
  {
    "status": "ok",
    "service": "oms-backend"
  }
  ```

---

### 2. OTP & SMS Verification (`/api/sms`)

#### `GET /api/sms/test-last-otp`
- **Description**: Lấy mã OTP mới nhất của một số điện thoại (Chỉ hoạt động trong môi trường `development` khi `ALLOW_TEST_OTP_ENDPOINT=true`).
- **Authentication**: Public
- **Query Parameters**:
  - `phone` (string, required): Số điện thoại nhận OTP (được chuẩn hóa về dạng 84xxxxxxxxx).
- **Response `200 OK`**:
  ```json
  {
    "otp_code": "123456"
  }
  ```

#### `POST /api/sms/send-otp`
- **Description**: Gửi mã OTP 6 chữ số đến số điện thoại qua Zalo ZBS. Áp dụng Cooldown 60s và Lockout 15 phút nếu thử gửi quá 5 lần.
- **Authentication**: Public
- **Request Body** (`SendOtpRequest`):
  ```json
  {
    "phone_number": "0912345678"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true
  }
  ```

#### `POST /api/sms/verify-otp`
- **Description**: Xác minh mã OTP 6 chữ số. Nếu thành công, trả về `verification_token` (UUIDv4) có hiệu lực trong 15 phút để sử dụng khi tạo đơn Storefront.
- **Authentication**: Public
- **Request Body** (`VerifyOtpRequest`):
  ```json
  {
    "phone_number": "0912345678",
    "otp_code": "123456"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "verification_token": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
  ```

---

### 3. Webhooks (`/api/sms`)

#### `POST /api/sms/zalo-webhook`
- **Description**: Endpoint nhận callback webhook từ Zalo ZBS khi tin nhắn OTP thay đổi trạng thái (ví dụ: `user_received_message`).
- **Authentication**: Webhook Signature Check (Header `X-Zalo-Signature` HMAC-SHA256 với `zalo_secret_key`).
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "updated": true
  }
  ```

---

### 4. System Configurations (`/api/configs`)

#### `GET /api/configs/sms`
- **Description**: Lấy danh sách cấu hình Zalo ZBS đã được che mờ (masked) token.
- **Authentication**: Protected (Logged-in user)
- **Response `200 OK`**:
  ```json
  {
    "zalo_app_id": "zalo_*****",
    "zalo_secret_key": "secre*****",
    "zalo_access_token": "acces*****",
    "zalo_refresh_token": "refre*****",
    "zalo_template_id": "templ*****"
  }
  ```

#### `PUT /api/configs/sms`
- **Description**: Cập nhật cấu hình Zalo ZBS (Các giá trị chứa ký tự `*` sẽ được giữ nguyên, không bị ghi đè).
- **Authentication**: Admin Only (`role: "admin"`)
- **Request Body** (`ZaloConfigUpdate`):
  ```json
  {
    "zalo_app_id": "123456789",
    "zalo_secret_key": "new_secret_key",
    "zalo_access_token": "new_access_token",
    "zalo_refresh_token": "new_refresh_token",
    "zalo_template_id": "200123"
  }
  ```
- **Response `200 OK`**: Trả về cấu hình Zalo ZBS đã được cập nhật và masked.

---

### 5. Orders Management (`/orders`)

#### `POST /orders`
- **Description**: Tạo đơn hàng mới ở trạng thái `DRAFT`. Nếu là kênh `STOREFRONT` (`code="STOREFRONT"`), bắt buộc phải có `verification_token` hợp lệ và khớp với số điện thoại của khách hàng.
- **Authentication**: Optional
- **Request Body** (`OrderCreateInput`):
  ```json
  {
    "customer_id": 1,
    "channel_id": 2,
    "shipping_fee": 30000.00,
    "shipping_address": "123 Đường ABC, Quận 1, TP.HCM",
    "note": "Giao giờ hành chính",
    "created_by": "storefront",
    "order_number": "ORD-20260728-0001",
    "verification_token": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "discount_amount": 0,
    "seller_shipping_cost": 0,
    "platform_fee": null,
    "items": [
      {
        "sku_code": "YNX-AX99-RED",
        "quantity": 1
      }
    ]
  }
  ```
  - `discount_amount` (≥ 0, mặc định 0): voucher/giảm giá **shop chịu**; được trừ vào tổng: `total_amount = Σ(items) + shipping_fee − discount_amount` (vượt quá → `400`).
  - `seller_shipping_cost` (≥ 0, mặc định 0), `platform_fee` (≥ 0, tuỳ chọn): chi phí của shop, không ảnh hưởng `total_amount`.
- **Response `201 Created`**:
  ```json
  {
    "id": 10,
    "order_number": "ORD-20260728-0001",
    "customer_id": 1,
    "channel_id": 2,
    "status": "DRAFT",
    "total_amount": 3530000.00,
    "shipping_fee": 30000.00,
    "shipping_address": "123 Đường ABC, Quận 1, TP.HCM",
    "note": "Giao giờ hành chính",
    "created_by": "storefront",
    "channel_code": "WEB",
    "discount_amount": "0.00",
    "seller_shipping_cost": "0.00",
    "platform_fee": null,
    "returned_at": null,
    "created_at": "2026-07-28T03:00:00Z",
    "updated_at": "2026-07-28T03:00:00Z",
    "items": [
      {
        "id": 15,
        "sku_code": "YNX-AX99-RED",
        "product_name": "Vợt cầu lông Yonex Astrox 99",
        "variant_name": "Đỏ / 4U",
        "quantity": 1,
        "unit_price": 3500000.00,
        "subtotal": 3500000.00,
        "image_url": "http://pim-api:8000/images/ynx.jpg"
      }
    ],
    "fulfillment_orders": []
  }
  ```

#### `GET /orders`
- **Description**: Lấy danh sách đơn hàng có phân trang và bộ lọc, **kèm dòng hàng (`items`)**. Chỉ trả đơn của tenant/seller đang gọi (lọc tự động theo `X-Tenant-Id`/`X-Seller-Id` do Gateway gắn). Đây cũng là endpoint VOMA Insights dùng để đồng bộ (`/api/oms/orders` qua Gateway).
- **Authentication**: Protected (JWT/Gateway hoặc API key scope `insights:read`)
- **Query Parameters**:
  - `page` (int, default: 1; `< 1` được coi là 1)
  - `limit` (int, default: 100, **tối đa 100** — giá trị lớn hơn bị cắt về 100; giá trị thực tế trả lại trong `limit`)
  - `status` (string, optional): Lọc theo trạng thái (`DRAFT`, `CONFIRMED`, `PROCESSING`, `PICKING`, `PACKED`, `SHIPPED`, `COMPLETED`, `CANCELLED`, `CANCELLATION_PENDING`, `RETURNED`)
  - `channel_id` (int, optional): Lọc theo ID kênh bán hàng
  - `channel_code` (string, optional): Lọc theo mã kênh (`SHOPEE`, `TIKTOK`, …)
  - `payment_status` (string, optional)
  - `date` (string `YYYY-MM-DD`, optional): Lọc theo đúng một ngày tạo (giữ tương thích cũ; sai định dạng thì bỏ qua)
  - `date_from`, `date_to` (string `YYYY-MM-DD`, optional, bao gồm cả hai đầu): Lọc `created_at` (UTC) theo khoảng ngày. Sai định dạng → `422`.
  - `updated_since` (ISO 8601 datetime, optional): Chỉ trả đơn có `updated_at >= updated_since` (đồng bộ tăng dần). Có múi giờ (`Z`, `+07:00`) sẽ được quy đổi về UTC; không có múi giờ được hiểu là UTC. Nhớ URL-encode dấu `+`. Sai định dạng → `422`.
  - `search` (string, optional): Tìm kiếm theo order_number, tên hoặc số điện thoại khách hàng
- Sắp xếp: `created_at` giảm dần, rồi `id` giảm dần (ổn định khi phân trang).
- Tiền trong endpoint danh sách được trả dạng **số JSON** (như trước đây); endpoint chi tiết (`OrderOut`) trả dạng chuỗi thập phân.
- **Response `200 OK`** (`PaginatedOrders`):
  ```json
  {
    "items": [
      {
        "id": 10,
        "order_number": "ORD-SHOPEE-240101ABC",
        "status": "COMPLETED",
        "channel_code": "SHOPEE",
        "channel_order_id": "240101ABC",
        "total_amount": 3530000.0,
        "shipping_fee": 30000.0,
        "discount_amount": 50000.0,
        "seller_shipping_cost": 22000.0,
        "platform_fee": 180000.0,
        "returned_at": null,
        "payment_status": "PAID",
        "created_at": "2026-07-28T03:00:00",
        "updated_at": "2026-07-30T08:15:00",
        "customer": {"id": 1, "name": "...", "phone": "...", "created_at": "..."},
        "channel": {"id": 3, "code": "SHOPEE", "name": "Shopee", "is_active": true},
        "items": [
          {"id": 15, "order_id": 10, "sku_code": "YNX-AX99-RED", "product_name": "...", "variant_name": "Đỏ / 4U",
           "quantity": 1, "unit_price": 3500000.0, "subtotal": 3500000.0, "image_url": null}
        ],
        "fulfillment_orders": []
      }
    ],
    "total": 50,
    "page": 1,
    "pages": 1,
    "limit": 100
  }
  ```
  - `shipping_fee`: phí ship khách trả. `discount_amount`: voucher/giảm giá shop chịu (mặc định 0). `seller_shipping_cost`: ship shop thực trả, gồm ship hoàn (mặc định 0). `platform_fee`: phí sàn thực tế, `null` nếu chưa biết. `returned_at`: thời điểm hoàn hàng, `null` nếu không hoàn. Xem [architecture_oms.md](architecture_oms.md#6-finance-fields--returned).

#### `GET /orders/{id}`
- **Description**: Xem chi tiết đơn hàng theo ID.
- **Authentication**: Protected
- **Response `200 OK`**: Trả về chi tiết đối tượng `OrderOut`.

#### `PUT /orders/{id}`
- **Description**: Cập nhật thông tin đơn hàng (Chỉ cho phép khi đơn hàng đang ở trạng thái `DRAFT`).
- **Authentication**: Protected
- **Request Body** (`OrderUpdateInput`):
  ```json
  {
    "customer_id": 1,
    "channel_id": 2,
    "shipping_fee": 35000.00,
    "shipping_address": "456 Đường DEF, Quận 3, TP.HCM",
    "note": "Gọi trước khi giao",
    "items": [
      {
        "sku_code": "YNX-AX99-RED",
        "quantity": 2
      }
    ]
  }
  ```
  - Có thể kèm `discount_amount`, `seller_shipping_cost`, `platform_fee`; đổi `discount_amount`/`shipping_fee`/`items` sẽ tính lại `total_amount`.
- **Response `200 OK`**: Trả về thông tin `OrderOut` sau khi cập nhật.

#### `PATCH /orders/{id}/finance`
- **Description**: Ghi nhận chi phí chỉ biết sau khi giao/đối soát (`seller_shipping_cost`, `platform_fee`) ở **mọi trạng thái**. Không đổi `total_amount`. Ghi sự kiện `order.finance_updated` vào `order_events`.
- **Authentication**: Protected
- **Request Body** (`OrderFinanceUpdate`, chỉ gửi trường cần đổi; `platform_fee: null` = chưa biết):
  ```json
  { "seller_shipping_cost": 22000, "platform_fee": 180000 }
  ```
- **Response `200 OK`**: `OrderOut`. `400` nếu body rỗng hoặc `seller_shipping_cost: null`.

#### `POST /orders/{id}/return`
- **Description**: Đánh dấu đơn đã giao (`SHIPPED`/`COMPLETED`) bị hoàn → trạng thái `RETURNED`, gán `returned_at` (mặc định thời điểm hiện tại, UTC). `return_shipping_cost` (nếu có) được **cộng** vào `seller_shipping_cost`. Ghi sự kiện `order.returned`.
- **Authentication**: Protected
- **Request Body** (`OrderReturnInput`, tuỳ chọn):
  ```json
  { "returned_at": "2026-08-02T10:00:00+07:00", "return_shipping_cost": 15000, "reason": "Sai size" }
  ```
- **Response `200 OK`**: `OrderOut`. `400` nếu đơn không ở `SHIPPED`/`COMPLETED`.

#### `DELETE /orders/{id}`
- **Description**: Xóa đơn hàng (Chỉ cho phép khi đơn hàng ở trạng thái `DRAFT`).
- **Authentication**: Protected
- **Response `204 No Content`**

#### `POST /orders/{id}/confirm`
- **Description**: Xác nhận đơn hàng nháp, gọi WMS để kiểm tra và giữ hàng (inventory allocation) và tự động tạo các lệnh xuất kho (`FulfillmentOrder`). Chuyển trạng thái đơn sang `PROCESSING`.
- **Authentication**: Protected
- **Response `200 OK`**: Trả về `OrderOut` với danh sách `fulfillment_orders` đã tạo.

#### `GET /orders/{id}/stock-check`
- **Description**: Kiểm tra tồn kho realtime từ WMS cho tất cả sản phẩm trong đơn hàng.
- **Authentication**: Protected
- **Response `200 OK`**:
  ```json
  {
    "sufficient": true,
    "message": "Tồn kho đủ để duyệt đơn.",
    "allocations": [
      {
        "warehouse_code": "WH-MAIN",
        "items": [{"sku_code": "YNX-AX99-RED", "quantity": 1}]
      }
    ]
  }
  ```

#### `POST /orders/{id}/cancel`
- **Description**: Hủy đơn hàng. Nếu đơn hàng đã phân bổ tồn kho sang WMS, gửi yêu cầu hủy các `FulfillmentOrder` tương ứng trên WMS.
- **Authentication**: Protected
- **Response `200 OK`**: Trả về `OrderOut` với trạng thái `CANCELLED` (hoặc `CANCELLATION_PENDING` nếu có lệnh xuất kho chưa hủy thành công bên WMS).

#### `PATCH /orders/{id}/status`
- **Description**: Cập nhật trạng thái đơn hàng theo luồng chuyển dịch cho phép (`ALLOWED_TRANSITIONS`). `SHIPPED`/`COMPLETED` → `RETURNED` được phép (tự gán `returned_at`, ghi `order.returned`); `RETURNED` là trạng thái cuối.
- **Authentication**: Protected
- **Request Body** (`OrderStatusUpdate`):
  ```json
  {
    "status": "PROCESSING"
  }
  ```
- **Response `200 OK`**: Trả về `OrderOut` đã cập nhật.

---

### 6. Fulfillment Order Management (`/orders`)

#### `PATCH /orders/{id}/fulfillments/{fulfillment_number}/status`
- **Description**: Cập nhật trạng thái của từng lệnh xuất kho (thường do WMS callback). Tự động cập nhật trạng thái chung của đơn hàng. Không nhận `RETURNED` (dùng `POST /orders/{id}/return`).
- **Authentication**: Protected
- **Request Body** (`FulfillmentStatusUpdate`):
  ```json
  {
    "status": "SHIPPED"
  }
  ```
- **Response `200 OK`**: Trả về `OrderOut` đã cập nhật.

---

### 7. Customer Management (`/customers`)

#### `POST /customers`
- **Description**: Tạo mới khách hàng hoặc kích hoạt lại và cập nhật thông tin nếu số điện thoại đã tồn tại nhưng ở trạng thái bị xóa (`is_deleted=True`). Định dạng số điện thoại bắt buộc phải khớp với `^(0|\+84|84)[35789]\d{8}$`.
- **Authentication**: Optional
- **Request Body** (`CustomerCreate`):
  ```json
  {
    "name": "Nguyễn Văn A",
    "phone": "0912345678",
    "email": "nguyenvana@example.com",
    "address": "456 Đường XYZ, Quận 3, TP.HCM"
  }
  ```
- **Response `201 Created`** (hoặc `200 OK` nếu reactivated)

#### `GET /customers`
- **Description**: Danh sách khách hàng chưa bị xóa (`is_deleted=False`) có phân trang và tìm kiếm.
- **Authentication**: Protected
- **Query Parameters**:
  - `page` (int, default: 1)
  - `limit` (int, default: 20)
  - `search` (string, optional): Tìm kiếm theo tên, số điện thoại, email
- **Response `200 OK`**: Trả về đối tượng `PaginatedCustomers`:
  ```json
  {
    "items": [...],
    "total": 10,
    "page": 1,
    "pages": 1,
    "limit": 20
  }
  ```

#### `GET /customers/{customer_id}`
- **Description**: Lấy chi tiết khách hàng theo ID.
- **Authentication**: Protected

#### `PUT /customers/{customer_id}`
- **Description**: Cập nhật thông tin khách hàng.
- **Authentication**: Protected

#### `DELETE /customers/{customer_id}`
- **Description**: Soft delete khách hàng (`is_deleted=True`, `deleted_at=utcnow()`). Bị từ chối với lỗi `409 Conflict` nếu khách hàng đang có đơn hàng active.
- **Authentication**: Protected
- **Response `204 No Content`**

---

### 8. Channel Management (`/channels`)

#### `POST /channels`
- **Description**: Tạo mới kênh bán hàng (Shopee, Lazada, TikTok Shop, Storefront, Manual). Nếu mã kênh (`code`) đã từng tồn tại và bị soft-deleted, kênh sẽ được khôi phục.
- **Authentication**: Protected
- **Request Body** (`ChannelCreate`):
  ```json
  {
    "code": "TIKTOK_SHOP",
    "name": "TikTok Shop",
    "is_active": true
  }
  ```
- **Response `201 Created`** (hoặc `200 OK` nếu reactivated)

#### `GET /channels`
- **Description**: Danh sách kênh bán hàng chưa bị xóa (`is_deleted=False`) có phân trang.
- **Authentication**: Optional
- **Query Parameters**: `page` (default: 1), `limit` (default: 20), `search` (optional).
- **Response `200 OK`**: Trả về đối tượng `PaginatedChannels`.

#### `GET /channels/{channel_id}`
- **Description**: Lấy chi tiết kênh bán hàng.
- **Authentication**: Protected

#### `PUT /channels/{channel_id}`
- **Description**: Cập nhật thông tin kênh bán hàng (`name`, `is_active`).
- **Authentication**: Protected

#### `DELETE /channels/{channel_id}`
- **Description**: Soft delete kênh bán hàng (`is_deleted=True`, `deleted_at=utcnow()`). Bị từ chối với lỗi `409 Conflict` nếu kênh đang có đơn hàng active.
- **Authentication**: Protected
- **Response `204 No Content`**

---

### 9. Dashboard Analytics (`/dashboard`)

#### `GET /dashboard/stats`
- **Description**: Thống kê tổng quan KPI kinh doanh: tổng số đơn hàng, tổng doanh thu, số lượng khách hàng, số lượng đơn theo trạng thái, và thống kê đơn hàng 7 ngày gần nhất.
- **Authentication**: Protected
- **Response `200 OK`**:
  ```json
  {
    "order_count": 120,
    "revenue": 450000000.00,
    "customer_count": 85,
    "status_counts": {
      "DRAFT": 5,
      "PROCESSING": 15,
      "SHIPPED": 20,
      "COMPLETED": 75,
      "CANCELLED": 5
    },
    "daily_stats": [
      {
        "date": "2026-07-22",
        "count": 10,
        "revenue": 35000000.00
      }
    ]
  }
  ```

---

### 10. Product Proxy Search (`/products`)

#### `GET /products/search`
- **Description**: Proxy truy vấn danh sách/tìm kiếm sản phẩm sang dịch vụ PMI (`PIM_API_URL`).
- **Authentication**: Protected
- **Query Parameters**: `search` hoặc `q`, `category_id`, `limit`, ...
- **Response `200 OK`**: Trả về danh sách sản phẩm kết quả từ PMI.

---

## Related Documentation

- [Database Schema Documentation](DATABASE.md)
- [System Architecture Documentation](ARCHITECTURE.md)
- [Project Overview README](../README.md)
