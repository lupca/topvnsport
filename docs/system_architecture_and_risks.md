# TopVNSport System Architecture & Risk Assessment

## 1. Kiến Trúc Hệ Thống Tổng Quan (System Architecture)
Hệ thống bao gồm 4 thành phần dịch vụ chính chạy độc lập (Microservices), sử dụng FastAPI cho backend và Next.js/Vite cho frontend:
- **OMS (Order Management System)**: Quản lý đơn hàng, thông tin khách hàng, logic đặt hàng và phân bổ tồn kho.
- **WMS (Warehouse Management System)**: Quản lý hàng tồn kho thực tế, quy trình lấy hàng (pick), đóng gói (pack), giao hàng (ship) và nhập kho (inbound).
- **PMI (Product Master Index / PIM)**: Quản lý danh mục sản phẩm, biến thể (variants), giá cả và lưu trữ media (MinIO).
- **Web Frontend (Checkout)**: Giao diện cho khách hàng thực hiện checkout đơn hàng.

**Hạ tầng và Cơ sở dữ liệu:**
- Sử dụng PostgreSQL cho tất cả các DB của OMS, WMS, PMI.
- Sử dụng MinIO cho lưu trữ Object (Hình ảnh/Media sản phẩm).

---

## 2. Bảng Tổng Hợp Rủi Ro Hệ Thống (System Risk Assessment)

Dựa trên quá trình audit toàn diện codebase, dưới đây là danh sách các rủi ro nghiêm trọng về thiết kế kiến trúc, cấu hình production và logic nghiệp vụ, kèm theo giải pháp khắc phục Lean (sửa trực tiếp không làm phình to hệ thống).

### A. Lỗ Hổng Cấu Hình Production & Bảo Mật (Production Configs & Security)

| Vị trí/Thành phần | Mô tả kịch bản lỗi | Giải pháp khắc phục cụ thể (Lean) |
| --- | --- | --- |
| **Docker Compose / Restart Policies** | Service `wms-api` và `wms-db` không được bật cấu hình `restart: always`. Nếu service crash, hệ thống WMS sẽ chết hoàn toàn và cần start lại thủ công bằng tay. | Thêm `restart: always` vào `docker-compose.yml` cho `wms-api` và `wms-db` tương tự như OMS. |
| **Database & MinIO Credentials** | Cả PostgreSQL và MinIO đang chạy với mật khẩu mặc định (default credentials) và được expose trực tiếp ra public ports. Dữ liệu hệ thống đang đối mặt với rủi ro rò rỉ rất cao. | Cập nhật `.env` cho database và MinIO sang thông tin đăng nhập ngẫu nhiên. Chỉ map ports 127.0.0.1:port hoặc dùng Docker Network nội bộ. |
| **CORS Configuration** | Backend FastAPI đang cấu hình allow all origins `*` kèm theo `allow_credentials=True`. Điều này mở ra lỗ hổng CSRF nghiêm trọng từ mọi domain. | Đổi `allow_origins=["*"]` thành danh sách cụ thể các URL Frontend (VD: `localhost`, `topvnsport.com`) hoặc dùng `allow_origins_regex`. |
| **Database Backups** | Không có cơ chế sao lưu (backup) DB định kỳ được phát hiện trong các script deploy/start. | Thêm cronjob chạy script dump Postgres và sao lưu MinIO bucket hàng ngày vào `start_all.sh` hoặc cấu hình host. |

### B. Logic OMS & Mâu Thuẫn Dữ Liệu (OMS Business Logic & Concurrency)

| Vị trí/Thành phần | Mô tả kịch bản lỗi | Giải pháp khắc phục cụ thể (Lean) |
| --- | --- | --- |
| **Race Condition: `confirm_order`** | Phân bổ tồn kho giữa OMS và WMS không đồng bộ nguyên tử (atomic). Nếu OMS xác nhận thành công, nhưng lệnh `create_fulfillment` gọi sang WMS lỗi một nửa, lệnh rollback chỉ khôi phục dữ liệu trên OMS. Tồn kho đã reserve bên WMS sẽ trở thành "orphaned hold" (bị giữ vĩnh viễn). | Implement retry mechanism hoặc bù trừ (compensation logic) khi WMS call thất bại. Dùng ID của Order làm idempotency key để có thể retry an toàn. |
| **Timeouts & Connection Pool Exhaustion** | API `confirm_order` giữ transaction DB mở trong suốt thời gian gọi API sang WMS (có thể treo tới 5s do timeout). Dưới tải cao, connection pool của OMS Postgres sẽ bị cạn kiệt. | Fetch dữ liệu xong -> Đóng transaction / Commit sớm (hoặc chuyển sang dạng PENDING) -> Gọi WMS -> Mở transaction mới cập nhật kết quả. |
| **Mã Đơn Hàng (Order Number) trùng lặp** | Thuật toán tạo mã đơn hàng đang dựa trên count DB. Khi có nhiều request song song (concurrent), có thể tạo ra các mã đơn hàng trùng lặp. | Đổi chiến lược sinh mã đơn sang dạng Prefix + Timestamp + Hash hoặc UUID short/Snowflake ID để đảm bảo tính duy nhất. |
| **Giá sản phẩm từ PMI lỗi (Default 0.0)** | Khi OMS fetch giá từ PMI, nếu không thấy hoặc API PMI lỗi, giá mặc định bị set về `0.0`. Điều này làm hỏng dữ liệu báo cáo kinh doanh và doanh thu. | Ném lỗi `HTTPException(400)` nếu không fetch được giá hợp lệ từ PMI. Không bao giờ cho phép fallback về 0.0 đối với giá tiền. |
| **Timezone Mismatch (Dashboard Stats)** | OMS đang dùng `datetime.utcnow()` nhưng query lại so sánh với timestamp `server-default` tại local timezone, gây sai lệch tính toán doanh thu (lệch 7 tiếng so với thực tế). | Chuẩn hóa toàn bộ lưu trữ và query ở mức UTC. Xử lý lệch múi giờ (timezone +7) chỉ ở tầng Frontend hiển thị. |
| **Race Condition: Startup Migrations** | OMS dùng seed dạng module-level và `create_all` thay vì `alembic` chuẩn. Nó tạo ra rủi ro lỗi khởi tạo DB khi nhiều worker hoặc service start cùng lúc. | Chuyển logic khởi tạo bảng và seed data vào hook `@app.on_event("startup")` kết hợp với lock, hoặc dùng script migration độc lập trước khi start API. |

### C. Logic WMS (Warehouse Management System)

| Vị trí/Thành phần | Mô tả kịch bản lỗi | Giải pháp khắc phục cụ thể (Lean) |
| --- | --- | --- |
| **Quy trình Pick & Pack Hỏng (`scan_pick`, `complete_pick`)** | Endpoint `scan_pick` không chặn over-picking (lấy dư hàng) hoặc kiểm tra trạng thái FO. Endpoint `complete_pick` ép số lượng picked bằng với số lượng order bất chấp thực tế, che giấu tình trạng thiếu hàng. | Cập nhật `scan_pick` để validate limit số lượng. Cập nhật `complete_pick` để check `picked_qty == order_qty`, nếu thiếu báo lỗi (short-pick). |
| **Shipment Bypass / Partial Failures** | Lệnh xuất kho (Ship) cho phép bypass qua quá trình Pick/Pack thẳng từ trạng thái PENDING. Nếu vòng lặp trừ tồn kho lỗi giữa chừng, không có logic rollback, gây sai lệch tồn kho vĩnh viễn. | Bắt buộc trạng thái phải là PACKED trước khi SHIP. Gói logic vòng lặp trừ tồn trong một DB Transaction duy nhất (`with session.begin():`). |
| **Hủy đơn (Cancel) sai quy trình** | API WMS cho phép gọi `Cancel` trên một Fulfillment Order đã có trạng thái SHIPPED. Điều này làm unreserve hàng hóa đã bị trừ số lượng, gây lộn xộn tồn kho. | Thêm check `if FO.status == "SHIPPED": raise Error` ở đầu logic `cancel`. |
| **Nhập kho trùng lặp (Double Inbound)** | Nhập kho (`complete_inbound`) không ngăn chặn được gọi 2 lần thành công trên cùng 1 phiếu. Gọi lần 2 sẽ tiếp tục cộng dồn thêm số lượng tồn kho. | Check trạng thái phiếu nhập, nếu `status == "COMPLETED"` thì block ngay lập tức. |
| **Logic Reserve & Snapshot Race** | WMS reserve bắt buộc lấy 1 vị trí kệ có đủ số lượng tổng. Nếu tổng tồn nhiều kệ đủ nhưng không kệ nào đứng riêng mà đủ, lệnh cấp phát sẽ fail dù OMS báo còn hàng. | Sửa thuật toán `reserve` sang dạng lặp (greedy loop) trừ dần tồn kho trên nhiều location khác nhau cho đến khi đủ số lượng. |
| **Hardcode PMI URL & Fake Tracking** | Đồng bộ product hardcode PMI URL. Endpoint Pick/Pack legacy tự sinh tracking "TRK-AUTO-GEN" vào production data. | Truyền PMI URL qua `os.getenv("PMI_URL")`. Bỏ hardcode sinh tracking number tự động; yêu cầu input thật từ user/packer. |

### D. Logic PMI (Product Master Index)

| Vị trí/Thành phần | Mô tả kịch bản lỗi | Giải pháp khắc phục cụ thể (Lean) |
| --- | --- | --- |
| **Diverged Inventory Truth (Stock trong PMI)** | PMI tự lưu số lượng stock ở `ProductVariant` như một "source of truth" phụ độc lập với WMS. Front-end Web lại đang gọi PMI để lấy stock này thay vì OMS/WMS -> Hàng không bao giờ bị trừ tồn trên UI, gây over-selling. | Xóa trường `stock` hoặc không sử dụng trường `stock` trong `ProductVariant` của PMI. Bắt buộc Frontend fetch stock từ OMS hoặc WMS API real-time. |
| **Clear & Recreate Variants** | Khi Update sản phẩm, hệ thống đang xóa toàn bộ Variants cũ và tạo lại từ đầu. Nó làm thay đổi Variant ID, dẫn tới break liên kết khóa ngoại với Order Line Items ở OMS/WMS. | Chuyển logic Update sang "Upsert": Tìm variant ID cũ để cập nhật, nếu thiếu thì xóa, có mới thì thêm. Giữ nguyên Variant ID hiện tại. |
| **OOM Dashboard PMI** | Dashboard PMI load toàn bộ Products vào Memory RAM trong 1 lần thay vì dùng SQL aggregation. Gây Out of Memory khi lượng sản phẩm tăng lên. | Thay thế bằng Query SQL có COUNT, SUM, GROUP BY trả thẳng ra report, tránh fetch toàn bộ data list vào Python layer. |
| **Raw SQL Migrations** | Startup của PMI dùng Raw SQL script hỗn hợp cạnh Alembic. Gây crash ngẫu nhiên lúc deploy. | Bỏ raw SQL trong startup, gom hết file `.sql` thành 1 revision migration duy nhất trong Alembic. |
