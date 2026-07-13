# Todo 04: Xây Dựng Middleware Ghi Nhận Hành Động (Action-Level)

**Mục tiêu**: Bắt các sự kiện thao tác nghiệp vụ quan trọng nhưng không làm thay đổi DB trực tiếp (Ví dụ: Đăng nhập, Xuất file Excel, Xem danh sách khách hàng). Cơ chế này phải đảm bảo không làm gãy (break) transaction hiện tại hoặc tạo transaction log rác khi nghiệp vụ lỗi.

## Hướng dẫn thực hiện chi tiết:

1.  **Xây dựng Decorator `@audit_action` an toàn**:
    - Tạo một Python Decorator (hoặc FastAPI Dependency) tại `PMI/backend/utils/audit.py`.
    - Decorator này sẽ bọc (wrap) các router endpoint cần log. Nó nhận các biến đầu vào như `module_name`, `action_title`.
    - Khi endpoint được gọi, Decorator sẽ lấy thông tin Actor và IP từ `contextvars` (đã xây dựng ở Todo 01).
    - Tạo object event dữ liệu và truyền vào hàm `session.add(audit_outbox_record)`.
    - **LƯU Ý CỰC KỲ QUAN TRỌNG**: Decorator tuyệt đối **KHÔNG ĐƯỢC** gọi `session.commit()`. Nó chỉ nạp event vào session chung. Nếu API endpoint thực thi thành công, lệnh commit ở tầng business sẽ tự động lưu event này. Nếu API lỗi, event này sẽ tự động bị rollback theo.
2.  **Xử lý các Endpoint Read-Only hoặc Streaming (Ví dụ: Export Excel)**:
    - Nếu API là API Get/Download (không có logic đổi DB và không gọi `commit` ở cuối), ta sẽ phải gọi lệnh commit chủ động.
    - Với các endpoint trả về `StreamingResponse` (như Export Shopee Excel): Dữ liệu log phải được commit vào Outbox ngay lập tức **trước khi** trả về luồng stream. Nếu chờ stream xong mới commit, khi bị lỗi kết nối giữa chừng, log sẽ không được ghi.
3.  **Tích hợp Decorator vào các Router**:
    - Mở các file `routers/channels.py`, `routers/categories.py`, `routers/products.py` và `routers/upload.py`.
    - Gắn `@audit_action` lên các endpoint như Export Data, Download template, Login.
