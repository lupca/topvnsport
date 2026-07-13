# Todo 01: Xây Dựng Lớp Định Danh (Auth & Identity)

**Mục tiêu**: Xây dựng nền tảng xác thực (Authentication) từ con số 0 cho PMI. Tính năng Audit Log cần biết chính xác "Ai" đang thực hiện thao tác. Hệ thống cần phân biệt giữa thao tác của Người Dùng (Human) qua giao diện và thao tác của Hệ Thống Khác (Service - như OMS/WMS) gọi qua API.

## Hướng dẫn thực hiện chi tiết:

1.  **Xây dựng Model User (Human Actor)**:
    - Trong `PMI/backend/models.py`, tạo model `User` với các trường: `id` (UUID hoặc Integer), `username` (String, unique), `email` (String), `hashed_password` (String), `role` (String, mặc định 'admin' hoặc 'staff'), `is_active` (Boolean, default True).
    - Tạo file migration bằng Alembic và apply để tạo bảng `users` trong PostgreSQL.
2.  **Thiết lập Cơ chế Token Nội bộ (Service Actor)**:
    - Để OMS và WMS có thể gọi API PMI mà không cần đăng nhập như user thường, cần tạo cơ chế xác thực bằng Service Token.
    - Định nghĩa một hằng số `INTERNAL_SERVICE_TOKEN` trong `.env` hoặc tạo bảng `ServiceAccount`.
3.  **Cài đặt JWT & Viết Dependency Xác Thực**:
    - Cài đặt thư viện: `pip install python-jose passlib bcrypt`.
    - Viết các hàm tiện ích băm mật khẩu và tạo JWT Token trong `PMI/backend/utils/auth.py`.
    - Viết FastAPI Dependency `get_current_identity`:
        - *Luồng 1*: Kiểm tra header `X-API-Key` (hoặc cấu hình tương đương). Nếu khớp với Service Token -> Trả về danh tính: `actor_type = 'SERVICE'`, `actor_username = 'OMS'`.
        - *Luồng 2*: Kiểm tra header `Authorization: Bearer <Token>`. Nếu hợp lệ -> Trả về danh tính: `actor_type = 'USER'`, `actor_username = user.username`.
    - Áp dụng dependency này vào các route bảo mật.
4.  **Thiết lập ContextVars để Tracking Khắp Nơi**:
    - Tạo module `PMI/backend/utils/context.py` sử dụng thư viện `contextvars`.
    - Tạo một Middleware (hoặc gọi ngay trong Dependency) để lưu thông tin danh tính (`actor_username`, `actor_type`) và `IP` của request vào `contextvars`.
    - Tạo thêm một UUID gắn vào `correlation_id` của context để theo dõi luồng log. Nhờ vậy, tầng Service/Database sau này có thể truy xuất "Ai đang thao tác" mà không cần phải truyền biến `user` qua hàng chục function con.
5.  **Tích hợp Frontend**:
    - Ở ứng dụng Next.js (`PMI/frontend`), xây dựng form Đăng nhập thật. Gọi API sinh JWT.
    - Sửa đổi các file mock state (như trang Users/Account) để gọi API backend với JWT Header.
