# WMS (Warehouse Management System) Architecture

## 1. Tổng quan
WMS quản lý mọi nghiệp vụ vật lý bên trong nhà kho. Bao gồm thiết lập sơ đồ kho, nhập hàng, quản lý số lượng tồn, xuất kho, kiểm kho và in mã vận đơn.
- **Backend:** FastAPI (Port 18102)
- **Frontend / PWA:** Quản lý Web Desktop (13102) & Web Mobile quét mã vạch bằng Camera.
- **Database:** PostgreSQL (`wms_db` - Port 15435)

## 2. Cấu trúc Database (Models)

### Sơ đồ kho (Warehouse Layout)
- `Warehouse`: Quản lý các nhà kho vật lý độc lập (`id`, `code`, `name`, `address`).
- `Location`: Mã hóa chi tiết từng ô trên kệ hàng (`location_code`, `zone`, `aisle`, `rack`, `shelf`, `type` như pick/reserve).
  
### Quản lý tồn (Inventory & Tracking)
- `Inventory`: Record ghi nhận số lượng của một `sku_code` tại một `Location` duy nhất.
  - Cột: `qty_on_hand` (Số thực tế đang nằm trên kệ), `qty_reserved` (Số đã được Order/OMS giữ chỗ nhưng chưa lấy đi).
  - Computed property: `qty_available = qty_on_hand - qty_reserved`.
- `StockTransaction`: Bảng Log/Sổ kho. Ghi lại mọi biến động (+/-) với loại giao dịch (INBOUND, OUTBOUND, RESERVE, UNRESERVE).

### Nhận diện mã vạch
- `BarcodeMapping`: Ánh xạ `barcode` (Mã vạch trên hộp/sản phẩm) -> `sku_code` (Mã định danh trong PMI).

### Nhập kho (Inbound)
- `InboundShipment`: Phiếu nhập hàng (`inbound_number`, `supplier_name`, `status`, `expected_date`).
- `InboundItem`: Sản phẩm cần nhập (`sku_code`, `expected_qty`, `received_qty`, `location_id`).

### Xuất kho (Outbound & Fulfillment)
- `FulfillmentOrder_WMS`: Phiếu xuất kho sinh ra từ OMS Order (`fulfillment_number`, `oms_order_id`, `status`).
- `PickListItem`: Lệnh nhặt hàng chi tiết (Lấy SKU nào, ở `location_id` nào, số lượng bao nhiêu).
- `PackingSession`: Phiên đóng gói, lưu `tracking_number` và `carrier_name`.

## 3. Các API Endpoints Chi Tiết

### Vận hành hạ tầng
- `POST/GET /warehouses`
- `POST/GET /locations`
- `GET /inventory`: Xem tồn kho toàn hệ thống.
- `POST /inventory/adjust`: Kiểm kê, bù trừ số lượng.
- `POST /barcode-mappings`: Đăng ký mã vạch mới cho hệ thống Mobile Scanner.

### Luồng Nhập Kho (Inbound API)
- `POST /inbound-shipments`: Sinh phiếu nhập.
- `POST /inbound/{id}/receive-scan`: Payload chứa list barcode quét được -> Dịch barcode ra SKU -> Tăng `received_qty`.
- `POST /inbound/{id}/put-away`: Chọn location_id -> Nhập kho -> Cộng `qty_on_hand` vào Inventory -> Ghi sổ kho (StockTransaction).

### Luồng Xuất Kho (Outbound API)
- `POST /fulfillment-orders`: Lắng nghe yêu cầu từ OMS. Thực thi thuật toán duyệt tồn kho -> Tăng `qty_reserved` -> Phân bổ `PickListItem`.
- `POST /fulfillment-orders/{id}/scan-pick`: Nhân viên nhặt hàng cầm di động quét mã EAN-13. Đủ số lượng -> Đổi trạng thái `PICKED`.
- `POST /fulfillment-orders/{id}/scan-pack`: Nhặt xong chuyển qua bàn đóng gói. Quét mã vận đơn sinh ra `tracking_number` -> Đổi trạng thái `PACKED`.
- `POST /fulfillment-orders/{id}/ship`: Nhấn nút xác nhận đã giao cho shipper -> Trừ thẳng `qty_on_hand` và giảm `qty_reserved`. Đổi FO thành `SHIPPED`.
