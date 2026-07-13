# Todo 06: Thiết Kế UI Frontend Bảng Lịch Sử (Server-Side Pagination)

**Mục tiêu**: Xây dựng giao diện hiển thị cho tính năng Audit Log trên ứng dụng Frontend (Next.js). Giao diện này chỉ dành riêng cho Admin và phải hỗ trợ xử lý hàng triệu dòng dữ liệu thông qua Server-Side Pagination.

## Hướng dẫn thực hiện chi tiết:

1.  **Phân Quyền (Role Guarding) và Menu**:
    - Audit Log chứa dữ liệu rất nhạy cảm (Toàn bộ hành vi nhân viên). 
    - Ở Backend, API `GET /api/audit-logs` chỉ được phép truy cập khi user có Role là `ADMIN`.
    - Ở Frontend, update file `Sidebar.tsx`: Bổ sung menu item "Lịch sử hoạt động" nhưng phải wrap nó trong điều kiện check Role Admin. Nếu là nhân viên thường, menu này sẽ bị ẩn.
2.  **Xây dựng API Backend**:
    - Mở endpoint `GET /api/audit-logs` tại FastAPI.
    - Nhận các query params: `page` (default 1), `limit` (max 100), `module_filter`, `actor_filter`, `keyword`.
    - Kết quả trả về JSON phải chuẩn hóa cấu trúc: `{ "data": [...], "total": X, "page": Y, "limit": Z }`.
3.  **Xây Dựng Màn Hình Giao Diện**:
    - Tạo route page mới ở Next.js: `PMI/frontend/src/app/settings/audit/page.tsx`.
    - Import component bảng có sẵn `DataTable.tsx`. Bảng này cần được tinh chỉnh để phục vụ Server-Side data fetching.
    - Khi User bấm "Next Page" trên giao diện, thay vì chuyển sang slide thứ 2 của một Array cục bộ (Client-side slice), Frontend phải gọi lại API `/api/audit-logs` với biến `page` mới và nạp dữ liệu từ server về.
4.  **Trình bày Dữ Liệu**:
    - Formatting Date: Hiển thị ngày giờ thân thiện (DD/MM/YYYY HH:mm:ss).
    - Cột "Chi tiết": Lấy dữ liệu từ cột JSON `changes` hoặc `raw_details`. Format chúng thành các chuỗi văn bản thân thiện với con người như thiết kế tham khảo (Ví dụ: `Thay đổi Tên Sản Phẩm từ 'Vợt X' -> 'Vợt Y'`). Có thể gắn màu sắc (Red/Green) cho các giá trị Old/New để trực quan hơn.
