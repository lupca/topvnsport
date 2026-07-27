# TopVNSport OMS - System Architecture Documentation

Tài liệu kiến trúc hệ thống tổng thể của TopVNSport Order Management System (OMS).

---

## Table of Contents

- [Architectural Overview](#architectural-overview)
- [System Context & Component Diagram](#system-context-component-diagram)
- [Core Service Responsibilities](#core-service-responsibilities)
- [Core Business Workflows](#core-business-workflows)
  - [1. Storefront OTP Authentication & Order Creation](#1-storefront-otp-authentication-order-creation)
  - [2. Order Confirmation & WMS Inventory Allocation](#2-order-confirmation-wms-inventory-allocation)
  - [3. Order Cancellation & Fulfillment Rollback](#3-order-cancellation-fulfillment-rollback)
  - [4. Zalo Token Background Scheduler & Security](#4-zalo-token-background-scheduler-security)
- [Order Lifecycle State Machine](#order-lifecycle-state-machine)
- [Related Documentation](#related-documentation)

---

## Architectural Overview

TopVNSport OMS đóng vai trò làm trung tâm điều phối đơn hàng đa kênh (Omnichannel Order Hub) cho thương hiệu thể thao TopVNSport. Hệ thống nhận đơn hàng từ nhiều nguồn khác nhau (Web Storefront, Shopee, Lazada, TikTok Shop, và Sales Admin nhập tay), thực hiện xác thực khách hàng qua Zalo OTP, tự động liên kết dữ liệu danh mục sản phẩm từ PMI, kiểm tra và giữ hàng tồn kho realtime từ WMS, và phát lệnh xuất kho (Fulfillment Orders).

---

## System Context & Component Diagram

```mermaid
graph TD
    Client[Web Storefront / Admin User] -->|HTTP / REST| Gateway[API Gateway / Nginx]
    
    Gateway -->|/api/auth| Identity[Identity Service - JWT Auth]
    Gateway -->|/orders, /customers, /api/sms| OMS_BE[OMS Backend - FastAPI Port 8000 / 18101]
    Gateway -->|Static / SPA| OMS_FE[OMS Frontend - Next.js Port 13101]
    
    OMS_BE -->|PostgreSQL / SQLite| OMS_DB[(OMS Database)]
    OMS_BE -->|Query SKU metadata| PMI[PMI Service - Product Info]
    OMS_BE -->|Check stock & create Fulfillments| WMS[WMS Service - Inventory & Fulfillment]
    OMS_BE -->|Send OTP & Webhook| Zalo[Zalo ZBS API]

    OMS_FE -->|API Calls| Gateway
```

---

## Core Service Responsibilities

1. **OMS Backend (FastAPI - Port 8000 / 18101)**:
   - Quản lý vòng đời đơn hàng, khách hàng, kênh bán hàng và cấu hình hệ thống.
   - Xử lý xác thực người dùng qua Gateway Headers, JWT Bearer Token, hoặc `X-API-Key`.
   - Xử lý gửi/xác minh mã OTP qua Zalo ZBS API với Rate Limiting (Cooldown 60s, Lockout 15m).
   - Mã hóa Fernet (`EncryptedString`) cho các token/cấu hình nhạy cảm trong `system_configs`.
   - Giao tiếp với PMI để lấy giá và tên sản phẩm.
   - Giao tiếp với WMS để phân bổ hàng hóa theo kho và phát hành lệnh xuất kho (`FulfillmentOrder`).

2. **OMS Frontend (Next.js - Port 13101)**:
   - Giao diện quản trị OMS cho bộ phận Vận hành, CSKH và Quản lý kho.
   - Dashboard thống kê KPI kinh doanh realtime, báo cáo doanh thu và sản lượng đơn hàng.
   - Quản lý đơn hàng, duyệt đơn nháp, phân kho và cập nhật trạng thái đơn hàng.

3. **Zalo ZBS Integration**:
   - Gửi mã xác thực OTP 6 chữ số qua tin nhắn Zalo OA ZBS.
   - Nhận Webhook xác nhận tin nhắn đã đến thiết bị người dùng.
   - Tự động xoay vòng Access Token / Refresh Token định kỳ 20 giờ qua Background Scheduler (`APScheduler`).

---

## Core Business Workflows

### 1. Storefront OTP Authentication & Order Creation

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Khách hàng (Storefront)
    participant OMS as OMS Backend
    participant Zalo as Zalo ZBS API
    participant DB as OMS Database

    Customer->>OMS: POST /api/sms/send-otp (phone_number)
    OMS->>DB: Check SmsRateLimit (Cooldown 60s, Lockout 15m)
    OMS->>Zalo: Call send_zalo_otp()
    Zalo-->>OMS: Response (message_id)
    OMS->>DB: Save OtpVerification (status=PENDING)
    OMS-->>Customer: 200 OK (OTP Sent)

    Customer->>OMS: POST /api/sms/verify-otp (phone_number, otp_code)
    OMS->>DB: Match hash & check expiration
    OMS->>DB: Generate verification_token (Valid 15 mins)
    OMS-->>Customer: 200 OK (verification_token)

    Customer->>OMS: POST /orders (channel=STOREFRONT, verification_token, items)
    OMS->>DB: Validate & Atomically Consume verification_token (used_at)
    OMS->>DB: Create Order (status=DRAFT)
    OMS-->>Customer: 201 Created (Order created)
```

---

### 2. Order Confirmation & WMS Inventory Allocation

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Staff / System Admin
    participant OMS as OMS Backend
    participant PMI as PMI Service
    participant WMS as WMS Service
    participant DB as OMS Database

    Admin->>OMS: POST /orders/{id}/confirm
    OMS->>DB: Fetch Order & OrderItems (Must be DRAFT)
    OMS->>PMI: GET /api/products/by-sku/{sku} (Verify price & names)
    OMS->>WMS: Check stock availability across warehouses
    
    alt Stock Sufficient
        OMS->>WMS: POST /fulfillment-orders (Create WMS Fulfillment Order)
        WMS-->>OMS: 200 OK (Fulfillment Created)
        OMS->>DB: Create FulfillmentOrder & Update Order status=PROCESSING
        OMS-->>Admin: 200 OK (Order Confirmed)
    else Stock Insufficient or WMS Error
        WMS-->>OMS: 400/500 Error
        OMS->>OMS: Rollback any created WMS fulfillments
        OMS-->>Admin: Error Exception (Order remains DRAFT)
    end
```

---

### 3. Order Cancellation & Fulfillment Rollback

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Staff / Customer
    participant OMS as OMS Backend
    participant WMS as WMS Service
    participant DB as OMS Database

    Admin->>OMS: POST /orders/{id}/cancel
    OMS->>DB: Check Order Status (Cannot cancel if SHIPPED/COMPLETED)
    
    loop For each active FulfillmentOrder
        OMS->>WMS: POST /fulfillment-orders/{fn}/cancel
        alt WMS Cancel Success
            WMS-->>OMS: 200 OK
            OMS->>DB: Update FulfillmentOrder status=CANCELLED
        else WMS Cancel Failure
            OMS->>DB: Mark order status=CANCELLATION_PENDING
        end
    end
    
    OMS->>DB: Update Order status=CANCELLED (if all fulfillments cancelled)
    OMS-->>Admin: 200 OK
```

---

### 4. Zalo Token Background Scheduler & Security

Hệ thống tích hợp `APScheduler` chạy background job `refresh_zalo_tokens_job` mỗi **20 giờ**:
- Tự động đọc `zalo_refresh_token`, `zalo_app_id` và secret từ database.
- Gửi yêu cầu đổi token mới sang Zalo OAuth Server.
- Cập nhật nguyên tử (`atomically`) cặp token mới vào bảng `system_configs` với kiểu dữ liệu `EncryptedString` (Fernet).

---

## Order Lifecycle State Machine

Đơn hàng tuân thủ nghiêm ngặt các bước chuyển trạng thái một chiều (`ALLOWED_TRANSITIONS`):

```mermaid
stateDiagram-v2
    [*] --> DRAFT : Create Order
    
    DRAFT --> CONFIRMED : Staff Confirm
    DRAFT --> CANCELLED : Cancel Order
    
    CONFIRMED --> PROCESSING : Allocate Stock & Create Fulfillments
    CONFIRMED --> CANCELLED : Cancel Order
    
    PROCESSING --> PICKING : Warehouse Pick Scan
    PROCESSING --> CANCELLED : Cancel Order
    
    PICKING --> PACKED : Warehouse Pack Scan
    PICKING --> CANCELLED : Cancel Order
    
    PACKED --> SHIPPED : Dispatch Carrier
    PACKED --> CANCELLED : Cancel Order
    
    SHIPPED --> COMPLETED : Customer Received
    
    PROCESSING --> CANCELLATION_PENDING : Partial Cancel Failure
    CANCELLATION_PENDING --> CANCELLED : Retry Cancel Success
    
    COMPLETED --> [*]
    CANCELLED --> [*]
```

---

## Related Documentation

- [API Reference Documentation](API.md)
- [Database Schema Documentation](DATABASE.md)
- [Project Overview README](../README.md)
