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
   X-API-Key: oms_wms_internal_api_key_secret_2026
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
    "items": [
      {
        "sku_code": "YNX-AX99-RED",
        "quantity": 1
      }
    ]
  }
  ```
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
- **Description**: Lấy danh sách đơn hàng có phân trang và bộ lọc.
- **Authentication**: Protected
- **Query Parameters**:
  - `page` (int, default: 1)
  - `limit` (int, default: 100)
  - `status` (string, optional): Lọc theo trạng thái (`DRAFT`, `CONFIRMED`, `PROCESSING`, `PICKING`, `PACKED`, `SHIPPED`, `COMPLETED`, `CANCELLED`, `CANCELLATION_PENDING`)
  - `channel_id` (int, optional): Lọc theo ID kênh bán hàng
  - `date` (string `YYYY-MM-DD`, optional): Lọc theo ngày tạo
  - `search` (string, optional): Tìm kiếm theo order_number, tên hoặc số điện thoại khách hàng
- **Response `200 OK`**:
  ```json
  {
    "items": [...],
    "total": 50,
    "page": 1,
    "pages": 1,
    "limit": 100
  }
  ```

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
- **Response `200 OK`**: Trả về thông tin `OrderOut` sau khi cập nhật.

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
- **Description**: Cập nhật trạng thái đơn hàng theo luồng chuyển dịch cho phép (`ALLOWED_TRANSITIONS`).
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
- **Description**: Cập nhật trạng thái của từng lệnh xuất kho (thường do WMS callback). Tự động cập nhật trạng thái chung của đơn hàng.
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
