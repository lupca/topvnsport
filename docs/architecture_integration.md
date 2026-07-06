# Kiến trúc Tích hợp Hệ thống (System Integration Architecture)

## 1. Tổng quan giao tiếp
TopVNSport tuân thủ thiết kế Microservices. Mỗi service giữ Data Store riêng biệt (Database Per Service) để tránh dính dáng khóa ngoại chéo (Cross-DB Foreign Keys). Mọi giao tiếp và chia sẻ dữ liệu đều phải thông qua giao thức **HTTP REST API** qua mạng nội bộ Docker.

## 2. Mã Định Danh Xuyên Suốt (The Golden Thread)
Mọi hệ thống nói chuyện với nhau thông qua một mã định danh duy nhất: **`sku_code`**.
- Tại PMI: SKU là định danh biến thể sản phẩm mang thông tin giá và tên.
- Tại OMS: SKU là định danh Line Item của order, nhân với Quantity và Price để ra tổng tiền.
- Tại WMS: SKU là đơn vị lưu trữ hàng hóa vật lý trên một Location.

## 3. Các luồng Data Flow giữa các hệ thống

### A. Luồng Đặt Hàng (Checkout Flow)
1. **Frontend / Người dùng** gửi payload order (Danh sách `sku_code`, `quantity`) sang **OMS**.
2. **OMS API** ngay lập tức thực hiện *HTTP GET* sang **PMI API** (`/api/products/by-sku/{sku}`) để lấy giá sản phẩm chuẩn nhất trên hệ thống và validate SKU đó có bị khóa hay không.
3. Nếu giá hợp lệ, **OMS** tiếp tục tính tổng tiền, tạo Order (status = `DRAFT`).

### B. Luồng Xác Nhận & Xuất Kho (Fulfillment Flow)
1. Saler bấm "Confirm" đơn hàng trên OMS.
2. **OMS** bắn request *HTTP POST* sang **WMS** (`/fulfillment-orders`) bao gồm Order ID và danh sách Item.
3. **WMS** sẽ kiểm tra `inventory.qty_available`. Nếu đủ hàng, WMS sẽ tăng `qty_reserved` và sinh PickList. Trả về Response OK.
4. Nhận OK, **OMS** chuyển đơn sang `PROCESSING`.

### C. Luồng Đồng Bộ Trạng Thái (Callback Status Flow)
Thay vì OMS phải liên tục "Hỏi thăm" (Polling) WMS xem kho làm tới đâu rồi, hệ thống áp dụng cơ chế Webhook / Callback.
1. Thủ kho dùng Mobile App gọi WMS API đổi FO thành `PICKED` hoặc `PACKED`.
2. **WMS API** trong lúc cập nhật database của mình, sẽ fire một *HTTP PATCH* async sang **OMS** (`/orders/{oms_order_id}/status`).
3. **OMS** nhận thông báo, cập nhật database, từ đó màn hình Dashboard của Customer Service được cập nhật realtime.

### D. Luồng Hiển Thị Sản Phẩm Trên App Nhặt Hàng (PWA Flow)
1. Picker/Packer đang đứng trong kho dùng điện thoại quét mã vạch (EAN-13).
2. App gọi **WMS API** (`/inbound/{id}/receive-scan` hoặc `/barcode-mappings/lookup/{barcode}`).
3. WMS lấy được `sku_code`. Nhưng WMS không lưu Ảnh hay Tên dài của SKU.
4. **WMS** bắn request *HTTP GET* sang **PMI** (`/api/products/by-sku/{sku}`) để lấy `image_url` và `name`.
5. WMS trả dữ liệu trộn giữa số lượng Pick + Ảnh từ PMI về cho Mobile App hiển thị, giúp nhân viên nhìn ảnh nhặt cho đúng.
