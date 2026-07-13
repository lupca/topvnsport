# Todo 03: Xây Dựng Semantic Diffing tại Service Layer

**Mục tiêu**: Ghi nhận lại các thay đổi dữ liệu (Data-level logging). Do tính phức tạp của Aggregate (ví dụ: Product chứa nhiều Variants và Media, khi update thường bị xóa và tạo lại toàn bộ bảng con), ta không thể dùng ORM Hooks đơn thuần. Ta phải chụp Snapshot dữ liệu tại tầng Service để so sánh tạo ra Semantic Diff (Sự khác biệt mang ý nghĩa nghiệp vụ).

## Hướng dẫn thực hiện chi tiết:

1.  **Quy hoạch lại Layer Kiến Trúc (Refactoring)**:
    - Khảo sát file `PMI/backend/routers/products.py`. Toàn bộ logic cập nhật Product (bao gồm clear `tier_variations`, clear `variants`, clear `media`) đang nằm tại Router.
    - **Nhiệm vụ**: Chuyển logic này vào `PMI/backend/services/product_service.py` thành một hàm `update_product_aggregate()`. Router sẽ chỉ lo phần Parse payload và trả response. Việc này giúp đóng gói Transaction gọn gàng tại Service.
2.  **Xây dựng Hàm Tiện Ích `AuditLogger`**:
    - Viết module hỗ trợ lưu log: `def record_audit_event(db_session, event_data)`.
    - Hàm này sẽ tạo một record `AuditOutbox` và gọi `db_session.add(record)`.
    - **LƯU Ý**: Hàm này tuyệt đối không tự gọi `db_session.commit()`. Nó chỉ nạp data vào session để ăn theo Transaction chính của ứng dụng.
3.  **Thực thi Logic Snapshot & Diff (Ví dụ với Product)**:
    - Khi có request update Product, trong hàm Service `update_product_aggregate()`:
        - **Bước 1 (Snapshot Cũ)**: Đọc Entity Product từ DB ra (kèm toàn bộ relationship con). Serialize nó thành một Dictionary (Ví dụ: `old_state_dict`). Đảm bảo gọi hàm `mask_sensitive_data` lên dict này (đề phòng có dữ liệu ẩn).
        - **Bước 2 (Mutate)**: Chạy logic xóa/sửa/thêm mới các bản ghi con như bình thường.
        - **Bước 3 (Snapshot Mới)**: `db_session.flush()` để các thay đổi cập nhật vào context, sau đó Serialize lại Entity Product thành Dictionary mới (`new_state_dict`).
        - **Bước 4 (Semantic Diffing)**: Viết một thuật toán so sánh giữa `old_state_dict` và `new_state_dict`. 
            - Nếu phát hiện giá `price` của Variant bị đổi: Output dạng `"Thay đổi giá của SKU-123 từ 100k -> 200k"`.
            - Gộp tất cả các diễn giải này thành chuỗi `raw_details` hoặc nhét nguyên cụm Diff vào cột JSON `changes`.
        - **Bước 5 (Log)**: Gọi `record_audit_event(db_session, ...)` truyền vào dữ liệu diff.
4.  **Transaction Đồng Bộ**:
    - Ở Router (hoặc cuối hàm Service), khi gọi lệnh `db_session.commit()`, cả Dữ Liệu Business mới và Audit Event trong Outbox sẽ được lưu xuống DB cùng một lúc. Nếu business fail, log tự động bị rollback.
