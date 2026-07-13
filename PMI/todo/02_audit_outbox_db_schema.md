# Todo 02: Thiết Kế Database Schema (Outbox & Logs)

**Mục tiêu**: Khởi tạo cấu trúc cơ sở dữ liệu trên PostgreSQL để chứa dữ liệu Audit Log. Chúng ta sẽ áp dụng **Outbox Pattern**: Mọi thao tác log sẽ được lưu tạm vào bảng `audit_outbox` *cùng chung transaction* với dữ liệu nghiệp vụ để chống mất log. Sau đó worker sẽ chuyển dần sang `audit_logs`.

## Hướng dẫn thực hiện chi tiết:

1.  **Thiết kế Bảng `audit_outbox` (Transaction Buffer)**:
    - Thêm model `AuditOutbox` vào `PMI/backend/models.py`. Bảng này làm nhiệm vụ hứng event tức thời.
    - **Các trường Định danh & Context**: `id` (UUID - PK), `correlation_id` (UUID).
    - **Các trường Actor**: `actor_id` (Integer/UUID, nullable), `actor_username` (String), `actor_type` (Enum: USER/SERVICE), `ip_address` (String).
    - **Các trường Request**: `method` (String), `path` (String), `source_service` (Mặc định 'PMI').
    - **Các trường Dữ liệu Log**: `module` (String), `action_type` (String: CREATE/UPDATE/DELETE/EXPORT/LOGIN), `entity_type` (String: e.g., 'Product', 'Channel'), `entity_id` (String), `changes` (JSONB - Chứa diff cũ/mới), `raw_details` (Text - Mô tả con người đọc được).
    - **Các trường Điều khiển Worker (Rất quan trọng để scale)**:
        - `status` (Enum: PENDING, PROCESSING, FAILED).
        - `attempt_count` (Integer, default 0).
        - `locked_by` (String, lưu ID của tiến trình worker đang xử lý dòng này).
        - `locked_at` (DateTime, nullable).
        - `last_error` (Text, nullable).
        - `next_retry_at` (DateTime, nullable).
        - `created_at` (DateTime, tự động điền giờ hiện tại).
2.  **Thiết kế Bảng `audit_logs` (Lưu trữ dài hạn)**:
    - Thêm model `AuditLog` vào `models.py`. Đây là nơi lưu trữ log vĩnh viễn sau khi Outbox xử lý xong.
    - Schema của bảng này giống hệt bảng `audit_outbox`, nhưng BỎ đi các trường Điều khiển Worker (`status`, `attempt_count`, `locked_by`...).
    - Thêm trường `processed_at` (DateTime) để biết lúc nào log được worker ghi nhận.
    - Cấu hình Index trên các cột thường xuyên query: `created_at`, `module`, `entity_id`, `actor_username`.
3.  **Xây dựng Tiện ích Che Giấu Dữ Liệu (Masking Policy)**:
    - Audit log không được phép chứa mật khẩu hay API Token. Tạo file `PMI/backend/utils/masking.py`.
    - Viết hàm `mask_sensitive_data(payload: dict)`. Hàm này sẽ lặp đệ quy qua dictionary.
    - Nếu gặp các keys như: `password`, `access_token`, `refresh_token`, `app_secret` (đặc biệt trong ChannelConfig), thay thế giá trị của chúng bằng chuỗi `"***MASKED***"`. Hàm này sẽ được gọi trước khi dump JSON vào cột `changes`.
4.  **Migration**: Tạo Alembic migration và apply để cấu trúc bảng được đẩy lên DB.
