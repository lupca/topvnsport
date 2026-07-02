# Hướng Dẫn Sử Dụng Hệ Thống TOP VN SPORT (PMI + OMS + WMS)

Tài liệu này cung cấp hướng dẫn từng bước cho luồng nghiệp vụ hoàn chỉnh từ góc độ người dùng (Saler, Quản lý kho, Thủ kho/Picker, Người đóng gói/Packer).

---

## 🚀 Luồng 1: Tạo Sản Phẩm & Khởi Tạo Dữ Liệu (Dành cho Admin/Quản lý)

Trước khi bán hàng, hệ thống cần có sản phẩm và hàng tồn kho.

### Bước 1: Tạo Sản Phẩm (Hệ thống PMI)
1. Truy cập **PMI Frontend** (mặc định: `http://localhost:13100`).
2. Vào mục **Sản Phẩm**, chọn **Thêm mới sản phẩm**.
3. Điền thông tin cơ bản: Tên (Ví dụ: *Vợt Yonex Astrox 99 Pro*), Phân loại, Hình ảnh.
4. Tạo biến thể sản phẩm (Variant). Ví dụ: 
   - Màu sắc: Đỏ, Trọng lượng: 4U. 
   - Mã SKU: **AX99PRO-RED-4U**.
5. Nhấn **Lưu**. Sản phẩm hiện đã sẵn sàng để OMS và WMS sử dụng chung.

### Bước 2: Nhập Kho Ban Đầu & Cấu hình Barcode (Hệ thống WMS)
1. Truy cập **WMS Desktop** (mặc định: `http://localhost:13102`).
2. Vào **Barcode Mappings**, quét mã vạch (EAN-13) trên vỏ hộp cây vợt Astrox 99 Pro.
3. Hệ thống sẽ báo mã chưa được cấu hình. Chọn SKU **AX99PRO-RED-4U** để map với mã vạch vừa quét.
4. Vào **Phiếu Nhập Kho (Inbound)** -> Tạo mới phiếu nhập cho SKU **AX99PRO-RED-4U**, số lượng 100 chiếc.
5. Thủ kho dùng điện thoại vào **WMS Mobile** trên IP LAN của máy chạy server, ví dụ `http://192.168.1.10:13102/m/receive`.
   Lưu ý: không dùng `localhost` trên điện thoại, vì `localhost` lúc đó là chính điện thoại.
6. Xác nhận vị trí cất hàng (Ví dụ: `Kệ A01`).
7. Hệ thống cập nhật: Tồn kho khả dụng = 100.

---

## 🛒 Luồng 2: Bán Hàng & Tạo Đơn (Dành cho Saler)

Khi có khách hàng đặt mua qua điện thoại, tin nhắn hoặc website.

### Bước 1: Tạo Thông Tin Khách Hàng (Hệ thống OMS)
1. Truy cập **OMS Frontend** (mặc định: `http://localhost:13101`).
2. Vào mục **Khách Hàng** -> **Thêm Mới**.
3. Nhập số điện thoại khách hàng. Nếu khách đã từng mua, hệ thống sẽ tự điền thông tin. Nếu chưa, nhập Tên, Địa chỉ giao hàng và Lưu.

### Bước 2: Tạo Đơn Hàng Mới
1. Chuyển sang mục **Đơn Hàng** -> **Tạo Đơn Hàng**.
2. Chọn **Khách hàng** vừa tạo.
3. Chọn **Kênh bán** (Ví dụ: Facebook, Zalo, Cửa hàng).
4. Ở phần **Sản phẩm**, tìm kiếm SKU **AX99PRO-RED-4U** hoặc tên sản phẩm.
5. Nhập số lượng: `2` chiếc.
6. Kiểm tra phí vận chuyển, tổng tiền và nhấn **Lưu Nháp (DRAFT)**.

### Bước 3: Xác Nhận Đơn Hàng
1. Sau khi khách đã chuyển khoản hoặc chốt đơn, Saler mở lại đơn hàng nháp.
2. Nhấn nút **Xác Nhận (CONFIRM)**.
3. Hệ thống OMS sẽ gọi sang WMS để kiểm tra tồn kho (hiện đang có 100, đủ xuất 2).
4. Đơn hàng chuyển sang trạng thái **PROCESSING** (Đang xử lý). Lệnh xuất kho đã được tự động đẩy sang Kho (WMS).
5. Tồn kho khả dụng trong WMS tự động trừ đi 2 (còn 98), tồn kho chờ xuất tăng lên 2.

---

## 📦 Luồng 3: Lấy Hàng & Đóng Gói (Dành cho Thủ kho / Packer)

Bộ phận kho nhận được lệnh và tiến hành xuất hàng.

### Bước 1: Lấy Hàng (Picking)
1. Thủ kho (Picker) cầm điện thoại, mở **WMS Mobile Scanner** tại đường dẫn `http://localhost:13102/m/pick`.
2. Danh sách các Lệnh lấy hàng sẽ hiện ra. Chọn Lệnh xuất kho vừa được tạo.
3. Màn hình hiển thị: *Cần lấy 2x Vợt Yonex Astrox 99 Pro tại Kệ A01*.
4. Thủ kho đi tới Kệ A01, lấy 2 cây vợt.
5. Bấm nút **Quét** trên điện thoại, chĩa camera vào mã vạch trên hộp vợt lần lượt 2 lần.
6. Mỗi lần quét thành công, điện thoại rung nhẹ và hiển thị số lượng lấy hàng tăng lên (1/2 -> 2/2).
7. Nhấn **Hoàn thành lấy hàng**. Trạng thái đơn hàng trên cả WMS và OMS tự động chuyển thành **PICKING** (Đang lấy hàng).

### Bước 2: Đóng Gói (Packing)
1. Hàng được chuyển ra bàn đóng gói. Nhân viên đóng gói (Packer) bọc chống sốc, cho vào thùng carton.
2. Packer in phiếu giao hàng của đơn vị vận chuyển (Ví dụ: Giao Hàng Tiết Kiệm - GHTK) dán lên thùng.
3. Mở điện thoại vào **WMS Mobile Scanner** mục đóng gói: `http://localhost:13102/m/pack`.
4. Chọn đơn hàng tương ứng.
5. Bấm nút **Quét Vận Đơn**, chĩa camera vào mã vạch (Code 128) in trên phiếu GHTK.
6. Hệ thống tự động nhận diện mã vận đơn (Tracking Number) và lưu lại.
7. Nhấn **Hoàn thành đóng gói**. Trạng thái đơn trên OMS tự động cập nhật thành **PACKED** (Đã đóng gói).

---

## 🚚 Luồng 4: Giao Hàng & Hoàn Tất (Dành cho Quản lý / Saler)

### Bước 1: Xuất Hàng Cho Shipper
1. Khi bưu tá GHTK đến lấy hàng, quản lý kho hoặc Packer bàn giao thùng hàng.
2. Trên WMS Desktop, chọn các lệnh xuất kho vừa giao và nhấn **Xác nhận Đã Giao (SHIP)**.
3. Lúc này, Tồn kho thực tế trong hệ thống bị trừ đi 2 cây vợt, kết thúc quá trình giữ hàng.
4. Trạng thái đơn hàng trên OMS tự động chuyển sang **SHIPPED** (Đang giao).

### Bước 2: Theo Dõi & Hoàn Tất Đơn Hàng (Hệ thống OMS)
1. Saler theo dõi tiến trình giao hàng qua hệ thống của GHTK bằng Tracking Number.
2. Khi khách hàng báo đã nhận được hàng và thanh toán đầy đủ.
3. Saler truy cập **OMS**, mở đơn hàng và nhấn **Hoàn Tất (COMPLETED)**.
4. Đơn hàng kết thúc vòng đời. Doanh thu được ghi nhận trên Dashboard của OMS.

---

## Cổng Mặc Định Đã Cập Nhật

- PMI Frontend: `http://localhost:13100`
- PMI API: `http://localhost:18100`
- PMI Postgres: `localhost:15433`
- PMI MinIO API / Console: `localhost:19005` / `localhost:19006`
- OMS Frontend: `http://localhost:13101`
- OMS API: `http://localhost:18101`
- OMS Postgres: `localhost:15434`
- WMS Frontend: `http://localhost:13102`
- WMS API: `http://localhost:18102`
- WMS Postgres: `localhost:15435`

Trên điện thoại, thay `localhost` bằng IP LAN của máy đang chạy server, ví dụ `http://192.168.1.10:13102/m/receive`, `http://192.168.1.10:13102/m/pick`, `http://192.168.1.10:13102/m/pack`.

**🎉 Chúc mừng! Bạn đã hoàn thành một chu trình bán hàng khép kín (End-to-End) hoàn hảo từ lúc tạo sản phẩm cho đến khi khách nhận hàng.**
