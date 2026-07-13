# Todo 05: Xây Dựng Worker Xử Lý Outbox Bất Đồng Bộ

**Mục tiêu**: Bảng `audit_outbox` chỉ là nơi lưu đệm. Cần xây dựng một Background Worker chạy ngầm để liên tục quét bảng này, xử lý và di chuyển dữ liệu sang bảng lưu trữ dài hạn `audit_logs`. Hệ thống phải được thiết kế sao cho dù chạy 5 hay 10 replica/container song song cũng không bị xung đột hay xử lý trùng lặp.

## Hướng dẫn thực hiện chi tiết:

1.  **Thiết kế Hàm Xử lý Lô (Batch Processing) An Toàn**:
    - Tạo file `PMI/backend/services/audit_worker.py`.
    - Viết hàm `process_outbox_batch(batch_size=100)`.
    - **CƠ CHẾ KHÓA ĐỘC QUYỀN**: Khi fetch 100 dòng PENDING từ bảng Outbox, **bắt buộc** phải sử dụng cú pháp `FOR UPDATE SKIP LOCKED` của PostgreSQL. Điều này đảm bảo rằng: Nếu Worker A vừa lấy 100 dòng đầu tiên, Worker B vào sau sẽ tự động bỏ qua 100 dòng đó và lấy 100 dòng tiếp theo, tránh việc 2 worker cùng xử lý 1 event sinh ra log rác.
2.  **Luồng Xử lý Dữ liệu**:
    - Khi đã lock được batch dữ liệu, cập nhật cột `locked_by` (gắn ID của worker hiện tại), `locked_at` và đổi `status` thành `PROCESSING`.
    - Thực hiện thao tác Insert dữ liệu này sang bảng `audit_logs` chính.
    - Sau khi insert thành công, xóa các bản ghi này khỏi bảng `audit_outbox` (hoặc update `status = PROCESSED` nếu muốn giữ lại debug trong thời gian đầu).
3.  **Xử lý Lỗi và Retry (Backoff)**:
    - Nếu quá trình insert sang Log DB bị lỗi (ví dụ rớt mạng), Catch Exception lại.
    - Tăng cột `attempt_count += 1`. Ghi lỗi vào cột `last_error`. Đổi `status` thành `FAILED`.
    - Tính toán cột `next_retry_at` (ví dụ: lần 1 chờ 1 phút, lần 2 chờ 5 phút, lần 3 chờ 30 phút).
4.  **Tích hợp vào Vòng Đời Ứng Dụng (App Lifespan)**:
    - Trong file `PMI/backend/main.py`, sử dụng block `lifespan` của FastAPI để kích hoạt vòng lặp `asyncio` gọi hàm `process_outbox_batch()` mỗi N giây (ví dụ: 10s).
    - Đảm bảo cơ chế Graceful Shutdown: Khi người quản trị Stop Docker, app phải đợi Worker xử lý xong batch hiện tại rồi mới tắt hẳn, không được ngắt điện đột ngột gây hư hỏng data đang lock.
