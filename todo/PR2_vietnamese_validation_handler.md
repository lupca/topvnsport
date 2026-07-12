# PR2: Custom Vietnamese Error Handling

## Mục tiêu
Dịch các thông báo lỗi validation mặc định của Pydantic (ví dụ: "Field required", "Input should be less than or equal to") sang tiếng Việt một cách ổn định, không dựa vào string parsing mà dựa vào mã lỗi (error type) của Pydantic.

## Chi tiết các bước thực hiện

1. **Thêm Global Exception Handler cho PMI**
   - File: `PMI/backend/main.py`
   - Action: Implement `@app.exception_handler(RequestValidationError)`
   - Logic: 
     - Lặp qua từng lỗi trong `exc.errors()`.
     - Dựa vào `err["type"]` (ví dụ: `missing`, `string_too_short`, `less_than_equal`, `greater_than_equal`) để ánh xạ sang câu thông báo lỗi tiếng Việt tương ứng.
     - Dùng giá trị trong `err["ctx"]` (nếu có, ví dụ `limit_value` cho `less_than_equal`) để format câu thông báo (vd: `f"Giá trị phải nhỏ hơn hoặc bằng {err['ctx']['le']}"`).
     - Trả về JSON format để frontend có thể dễ dàng map lỗi vào từng field (nếu cần) hoặc hiển thị toast.

2. **Viết Test Formatting (PMI)**
   - File: Tạo mới file test (nếu cần) hoặc viết thêm vào `PMI/backend/tests/integration/test_api_products.py`.
   - Bắn 1 payload cố tình sai (ví dụ thiếu field `name`, và `price` = -1).
   - Assert: Đảm bảo response message là tiếng Việt ("Trường này là bắt buộc", "Giá trị phải lớn hơn hoặc bằng 0") dựa vào JSON trả về.

3. **Áp dụng tương tự cho OMS (Nếu cần thiết)**
   - Đánh giá xem OMS Backend có cần áp dụng ngay handler này không (vì OMS hiện chủ yếu search, ít thao tác nhập liệu phức tạp gây lỗi validation cho người dùng). Nếu có, thêm handler vào `OMS/backend/main.py` và viết test vào `OMS/backend/test_main.py`.

4. **Cập nhật Zod Messages trên Frontend (PMI & OMS)**
   - File: `PMI/frontend/src/components/ProductForm.tsx` (và OMS nếu dùng).
   - Thêm câu thông báo tiếng Việt vào các rules Zod (ví dụ: `.min(1, "Bắt buộc nhập")`) để phòng hờ hiển thị phía giao diện.
