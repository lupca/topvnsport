# TopVNSport - Order Management System (OMS)

TopVNSport OMS (Order Management System) là hệ thống quản lý đơn hàng đa kênh thuộc hệ sinh thái TopVNSport. Hệ thống đảm nhận vai trò điều phối đơn hàng, quản lý thông tin khách hàng, tích hợp các kênh bán hàng (Storefront, Shopee, TikTok Shop, Lazada, Manual), xác thực OTP qua Zalo ZBS, và tự động phân bổ tồn kho với hệ thống WMS (Warehouse Management System) & PMI (Product Information Management).

---

## Table of Contents

- [Architectural Overview](#architectural-overview)
- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Local Setup & Development](#local-setup-development)
  - [Backend Setup (FastAPI)](#backend-setup-fastapi)
  - [Frontend Setup (Next.js)](#frontend-setup-nextjs)
- [Docker Deployment](#docker-deployment)
- [Testing & Verification](#testing-verification)
- [Documentation Links](#documentation-links)

---

## Architectural Overview

TopVNSport OMS bao gồm hai thành phần chính:
- **Backend**: FastAPI (Python 3.11+ / 3.14) chạy tại port `18101` (hoặc `8000` local).
- **Frontend**: Next.js 14 (React 18, TypeScript, TailwindCSS) chạy tại port `13101` (hoặc `3001` local).
- **Database**: PostgreSQL (hoặc SQLite cho local testing & CI).
- **Integrations**:
  - **Identity Service**: Shared JWT authentication.
  - **PMI**: Lấy thông tin sản phẩm và SKU.
  - **WMS**: Kiểm tra tồn kho realtime và tạo lệnh xuất kho (Fulfillment Orders).
  - **Zalo ZBS**: Gửi và xác thực mã OTP cho khách hàng đặt đơn trên Storefront.

---

## Prerequisites

Trước khi bắt đầu, hãy đảm bảo hệ thống của bạn đã cài đặt các công cụ sau:
- **Python**: v3.11 trở lên (khuyến nghị Python 3.11 hoặc 3.14).
- **Node.js**: v18.0.0 trở lên.
- **npm**: v9.0.0 trở lên.
- **PostgreSQL**: v14 trở lên (nếu sử dụng PostgreSQL làm DB chính).
- **Docker & Docker Compose**: v2.0+ (nếu chạy qua Docker).

---

## Environment Configuration

OMS Backend yêu cầu các biến môi trường bắt buộc sau. Tạo file `OMS/backend/.env` hoặc export các biến môi trường:

| Variable Name | Required | Default / Example | Description |
| --- | --- | --- | --- |
| `FERNET_KEY` | **Yes** | *(Generate Fernet key)* | Khóa Fernet 32-byte (base64 urlsafe) để mã hóa `system_configs.config_value` |
| `DATABASE_URL` | **Yes** | `postgresql://user:pass@localhost:5432/oms_db` | URL kết nối PostgreSQL (hoặc SQLite connection string `sqlite:///./test.db`) |
| `JWT_SECRET_KEY` | Optional | `your-shared-jwt-secret-key` | Secret key để xác thực JWT token từ Identity Service |
| `CORS_ALLOWED_ORIGINS` | Optional | `https://oms.topvnsport.com,http://localhost:13101,http://localhost:3000` | Danh sách origins được phép gọi API (phân cách bởi dấu phẩy) |
| `INTEGRITY_MODE` / `ENV` | Optional | `development` | Đặt `development` để bật các endpoint testing |
| `ALLOW_TEST_OTP_ENDPOINT` | Optional | `true` | Bật API `/api/sms/test-last-otp` trong môi trường dev |

### Sinh Fernet Key mới

```bash
python3 -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'
```

---

## Local Setup & Development

### Backend Setup (FastAPI)

1. **Di chuyển vào thư mục backend**:
   ```bash
   cd OMS/backend
   ```

2. **Tạo môi trường ảo Python & Cài đặt dependencies**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Thiết lập biến môi trường bắt buộc**:
   ```bash
   export FERNET_KEY=$(python3 -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())')
   export DATABASE_URL="sqlite:///./oms_local.db"
   ```

4. **Chạy Alembic Migrations để khởi tạo Database Schema**:
   ```bash
   alembic upgrade head
   ```

5. **Khởi chạy Backend Server**:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```
   API Documentation (Swagger UI) sẽ có sẵn tại: `http://localhost:8000/docs`.

---

### Frontend Setup (Next.js)

1. **Di chuyển vào thư mục frontend**:
   ```bash
   cd OMS/frontend
   ```

2. **Cài đặt Node modules**:
   ```bash
   npm install
   ```

3. **Tạo file `.env.local`**:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

4. **Khởi chạy Development Server**:
   ```bash
   npm run dev
   ```
   Giao diện web quản trị OMS sẽ chạy tại: `http://localhost:3001`.

---

## Docker Deployment

Để build và chạy toàn bộ OMS (Backend + Frontend + Database) bằng Docker Compose:

1. **Chạy Docker Compose (Môi trường Development)**:
   ```bash
   docker compose -f OMS/docker-compose.yml up -d --build
   ```

2. **Chạy Docker Compose (Môi trường Production)**:
   ```bash
   FERNET_KEY="<your-fernet-key>" DATABASE_URL="postgresql://user:pass@db:5432/oms_db" JWT_SECRET_KEY="<jwt-secret>" docker compose -f OMS/docker-compose.prod.yml up -d --build
   ```

---

## Testing & Verification

### Chạy Backend Test Suite (Pytest)

```bash
cd OMS/backend
FERNET_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())") TESTING=1 pytest
```

### Chạy Lint & Link Checkers Documentation

```bash
# Kiểm tra broken internal links trong README.md
npm exec -- markdown-link-check README.md

# Kiểm tra broken links trong toàn bộ tài liệu docs/
npm exec -- markdown-link-check docs/API.md
npm exec -- markdown-link-check docs/DATABASE.md
npm exec -- markdown-link-check docs/ARCHITECTURE.md

# Run full documentation lint command
npm run docs:lint
```

---

## Documentation Links

- [API Reference Documentation](docs/API.md)
- [Database Schema & Migrations Documentation](docs/DATABASE.md)
- [System Architecture Documentation](docs/ARCHITECTURE.md)
