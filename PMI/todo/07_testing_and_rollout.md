# Todo 07: Chiến Lược Kiểm Thử và Triển Khai Lên Production

**Mục tiêu**: Một tính năng lõi (như Auth và Log) cần có các chốt chặn tự động để đảm bảo khi code xong sẽ chạy ổn định, không làm sập server hay gây tắc nghẽn Database. Các bài Unit Test và chiến lược Rollout này phải được Dev hoàn thành.

## Hướng dẫn thực hiện chi tiết:

1.  **Viết Unit Test cho Logic Semantic Diff**:
    - Target: Logic so sánh state ở `product_service.py` (File Todo 03).
    - Dữ liệu Test: Tạo một đối tượng Product rỗng, gán nó với một vài biến thể (Variants). Code logic xóa biến thể đó đi và check mảng Diff đầu ra.
    - **Assert**: Hàm Diff phải in ra đúng chữ "Đã xóa biến thể", không được phép output ra hàng chục dòng Database raw (insert/delete id).
2.  **Viết Integration Test cho Outbox Pattern**:
    - Target: Bảng `audit_outbox` và cơ chế rollback.
    - Dữ liệu Test: Fake một API Request update dữ liệu bình thường. Chủ động dùng Mock để bắn ra (Raise) một `Exception` Database ngay sau bước insert dữ liệu thành công nhưng chưa gọi `commit()`.
    - **Assert**: Phải đảm bảo Test kiểm chứng được rằng sau khi bị crash, cả Dữ Liệu Business Mới VÀ Audit Event Log đều phải bốc hơi hoàn toàn khỏi DB (Được Rollback sạch sẽ).
3.  **Viết Concurrent Test cho Worker Bất Đồng Bộ**:
    - Target: Cơ chế `FOR UPDATE SKIP LOCKED` ở `audit_worker.py`.
    - Dữ liệu Test: Fake 100 record vào `audit_outbox`. Dùng lệnh `asyncio.gather` để kích hoạt 3 con worker chạy cùng 1 lúc y hệt môi trường Production có 3 instances.
    - **Assert**: Số lượng bản ghi bay sang bảng `audit_logs` phải chẵn đúng bằng 100. Không có bản ghi nào bị Duplicate (nhân bản lên 2 lần do 2 worker cùng với lấy).
4.  **Chiến Lược Deploy (Rollout Prod) An Toàn (3 Bước)**:
    - **Bước 1**: Đẩy tính năng Auth (Lớp định danh và Service Token) lên trước. Monitor xem có hệ thống vệ tinh nào (OMS, WMS) bị báo lỗi 401 Unauthorized khi chọc API sang PMI không. Nếu có lỗi phải fix ngay và dừng lại.
    - **Bước 2**: Đẩy tính năng "Hứng Outbox". Tức là dữ liệu cứ nạp vào `audit_outbox` nhưng **Chưa bật Worker**. Theo dõi sức tải của Database Postgres trong 1-2 tiếng.
    - **Bước 3**: Sau khi 2 bước trên chạy trơn tru, tiến hành kích hoạt Background Worker với Batch nhỏ (ví dụ quét 50 dòng/lần). Dữ liệu sẽ từ từ chảy sang bảng Logs. Tính năng hoàn thiện.
