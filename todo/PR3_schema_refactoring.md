# PR3: Refactor Schemas (Backend & Frontend)

## Mục tiêu
Tách các file schemas khổng lồ hiện tại (`schemas.py`, các schemas khai báo inline trong `ProductForm.tsx`) thành cấu trúc module/directory riêng biệt để dễ bảo trì, quản lý mà không làm gãy import hoặc forward references trong kiến trúc hiện tại.

## Chi tiết các bước thực hiện

### 1. PMI Backend Refactoring
- Tạo folder `PMI/backend/schemas/`.
- Tách `schemas.py` thành:
  - `product.py`
  - `category.py`
  - `attribute.py`
  - `tier_variation.py`
  - `channel_config.py` (nếu có các schema liên quan đến Channel đang được dùng bởi `channels.py`, `dashboard.py`).
- **Xử lý Forward References (Rất quan trọng):** 
  - Tại `PMI/backend/schemas/__init__.py`, import TẤT CẢ các models/schemas từ các file con để đảm bảo tính tương thích ngược cho các file import cũ (vd: `from schemas import ProductCreate`).
  - Gọi `model_rebuild()` (của Pydantic v2) ngay trong `__init__.py` hoặc ở một file đăng ký tập trung cho các model có quan hệ chéo (vd: `ProductResponse` chứa `CategoryResponse` hoặc `TierVariationResponse`). Việc để quên `model_rebuild()` sẽ gây crash lúc startup ứng dụng.

### 2. PMI Frontend Refactoring
- Tạo folder `PMI/frontend/src/validations/`.
- Di chuyển toàn bộ các schemas Zod (e.g., `tierVariationSchema`, `variantSchema`, `productMediaSchema`, `productFormSchema`) từ `ProductForm.tsx` sang `validations/productSchema.ts`.
- Cập nhật import cho các file liên quan.

### 3. OMS Backend & Frontend Refactoring (Cần khảo sát lại)
- Do OMS có hệ thống schemas khác biệt (SMS, OTP, Pagination, Order), tiến hành tạo `OMS/backend/schemas/` và chia theo module (`auth.py`, `order.py`, `common.py`).
- Xuất tất cả qua `__init__.py` và chạy test `test_main.py` để đảm bảo hệ thống không vỡ cấu trúc import.
- Ở Frontend, nếu OMS có các form sử dụng Zod thì cũng tách ra folder `OMS/frontend/src/validations/` tương tự PMI.
