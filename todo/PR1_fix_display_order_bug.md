# PR1: Fix Display Order Bug (Backend PMI)

## Mục tiêu
Sửa lỗi `ACID Rollback` do `display_order` vượt quá 9 khi lưu ảnh phân loại (variation images) tại PMI Backend, đồng thời đảm bảo quy tắc nghiệp vụ: Tối đa 9 ảnh chính (không liên kết variant).

## Chi tiết các bước thực hiện

1. **Cập nhật Backend Schema (PMI)**
   - File: `PMI/backend/schemas.py`
   - Action: Tìm class `ProductMediaBase` (hoặc `ProductMediaCreate`).
   - Sửa `display_order: int = Field(1, ge=1, le=9)` thành `display_order: int = Field(1, ge=1)`. 
   - Thêm logic validation (dùng `@model_validator` trong `ProductCreate` hoặc xử lý tại layer router/service) để kiểm tra: Tổng số lượng ảnh có `is_cover = True` hoặc không có `variant_tier_1_option` (ảnh chính) không được vượt quá 9.

2. **Viết Test Case Xác Nhận (PMI)**
   - File: `PMI/backend/tests/integration/test_api_products.py`
   - Viết test tạo một Product có 2 ảnh chính và 10 ảnh biến thể (tổng 12 ảnh, `display_order` lên tới 12).
   - Assert: API trả về HTTP 200/201 (Thành công, không còn lỗi 422 ACID Rollback).
   - Viết thêm 1 test tạo Product có 10 ảnh chính (không có variant).
   - Assert: API trả về lỗi 422 (từ chối do vượt quá 9 ảnh chính).

3. **Cập nhật Frontend Schema (PMI)**
   - File: `PMI/frontend/src/components/ProductForm.tsx`
   - Sửa `display_order: z.number().min(1).max(9)` thành `display_order: z.number().min(1)` trong `productMediaSchema` để nhất quán, tránh form ngăn chặn submit nếu người dùng thêm nhiều phân loại.
