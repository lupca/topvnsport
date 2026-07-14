# Kiến Trúc Hệ Thống PMI + OMS + WMS (TOP VN SPORT)

Tài liệu này mô tả chi tiết kiến trúc hệ thống và toàn bộ luồng nghiệp vụ của chuỗi hệ thống **PMI + OMS + WMS** bằng sơ đồ Mermaid.

### Sơ đồ định tuyến qua Gateway (Centralized Auth & Routing)

```mermaid
graph TB
    Client[Browser/App]
    Gateway["🛡️ Gateway Nginx (:8080)"]
    Identity["🔑 Identity Service (:18110)"]
    PMI["⚙️ PMI API (:18100)"]
    OMS["⚙️ OMS API (:18101)"]
    WMS["⚙️ WMS API (:18102)"]
    
    Client --> Gateway
    Gateway -->|auth_request| Identity
    Gateway -->|/api/pmi/*| PMI
    Gateway -->|/api/oms/*| OMS
    Gateway -->|/api/wms/*| WMS
```

## 2. Kiến Trúc Chi Tiết Các Thành Phần (System Components Architecture)

Sơ đồ dưới đây biểu diễn 3 hệ thống chạy độc lập dưới dạng Microservices, các thành phần bên trong (Frontend, API, DB), phân quyền tác vụ của từng đối tượng (Saler, Thủ kho, Packer) và các kênh giao tiếp API giữa các service.

```mermaid
graph TD
    %% Định nghĩa Style cho đẹp mắt và đồng bộ
    classDef pmiClass fill:#E3F2FD,stroke:#1565C0,stroke-width:2px;
    classDef omsClass fill:#EDE7F6,stroke:#4527A0,stroke-width:2px;
    classDef wmsClass fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px;
    classDef actorClass fill:#FFF3E0,stroke:#EF6C00,stroke-width:2px;
    classDef extClass fill:#ECEFF1,stroke:#37474F,stroke-dasharray: 5 5;
    
    subgraph PMI ["PMI (Product Information Management) - Port 13100/18100"]
        PMI_FE["💻 PMI Frontend (:13100)<br/>Quản lý thông tin & media sản phẩm"]:::pmiClass
        PMI_API["⚙️ PMI API (:18100)<br/>FastAPI Product Service"]:::pmiClass
        PMI_DB[("🗄️ Database: pim_db<br/>(Postgres :15433)")]:::pmiClass
        PMI_MinIO[("📦 MinIO Object Storage<br/>(Media :19005)")]:::pmiClass
        
        PMI_FE --> PMI_API
        PMI_API --> PMI_DB
        PMI_API --> PMI_MinIO
    end

    subgraph OMS ["OMS (Order Management System) - Port 13101/18101"]
        OMS_FE["💻 OMS Frontend (:13101)<br/>Dashboard, Order CRUD, Channels, Customer"]:::omsClass
        OMS_API["⚙️ OMS API (:18101)<br/>FastAPI Order Service"]:::omsClass
        OMS_DB[("🗄️ Database: oms_db<br/>(Postgres :15434)")]:::omsClass
        
        OMS_FE --> OMS_API
        OMS_API --> OMS_DB
    end

    subgraph WMS ["WMS (Warehouse Management System) - Port 13102/18102"]
        WMS_FE["💻 WMS Desktop (:13102)<br/>Quản lý vị trí, kiểm kho, inbound"]:::wmsClass
        WMS_MOB["📱 WMS Mobile Scanner (/m/*)<br/>PWA Quét barcode di động"]:::wmsClass
        WMS_API["⚙️ WMS API (:18102)<br/>FastAPI Inventory Service"]:::wmsClass
        WMS_DB[("🗄️ Database: wms_db<br/>(Postgres :15435)")]:::wmsClass
        
        WMS_FE --> WMS_API
        WMS_MOB --> WMS_API
        WMS_API --> WMS_DB
    end

    %% Các Tác Nhân (Actors)
    Saler["👤 Nhân viên Bán Hàng (Saler)"]:::actorClass
    WarehouseManager["👤 Quản lý Kho (Manager)"]:::actorClass
    Picker["👤 Nhân viên lấy hàng (Picker)"]:::actorClass
    Packer["👤 Nhân viên đóng gói (Packer)"]:::actorClass
    
    Saler -->|Tạo & xác nhận đơn| OMS_FE
    WarehouseManager -->|Tạo phiếu nhập / Cấu hình kho| WMS_FE
    Picker -->|Xác nhận lấy hàng trên mobile| WMS_MOB
    Packer -->|Xác nhận đóng gói trên mobile| WMS_MOB

    %% Liên Kết Tương Tác Giữa Các Service
    OMS_API -.->|1. GET /api/products/by-sku/{sku}<br/>Validate sản phẩm| PMI_API
    OMS_API ===>|2. POST /fulfillment-orders<br/>Tạo lệnh xuất kho| WMS_API
    
    WMS_API -.->|3. GET /api/products/by-sku/{sku}<br/>Validate & Đồng bộ SP| PMI_API
    WMS_API ===>|4. PATCH /orders/{id}/status<br/>Callback trạng thái đơn hàng<br/>(PICKING/PACKED/SHIPPED)| OMS_API
    
    OMS_API -.->|5. POST /fulfillment-orders/.../cancel<br/>Hủy lệnh xuất| WMS_API
```

## 2. Luồng Nghiệp Vụ 1: Xuất Kho (Outbound Flow)

Luồng đi từ khi tạo đơn hàng thủ công trên OMS, xác nhận để đẩy qua WMS lập phiếu xuất, thực hiện pick-pack bằng thiết bị di động (quét barcode EAN-13 và Code 128 vận đơn) và cập nhật ngược lại OMS.

```mermaid
graph TD
    classDef omsClass fill:#EDE7F6,stroke:#4527A0,stroke-width:2px;
    classDef wmsClass fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px;
    classDef actionClass fill:#FFF8E1,stroke:#FFB300,stroke-width:2px;
    
    Start[("1. Đơn hàng mới (DRAFT)<br/>Saler tạo tay trên OMS")]:::omsClass --> Confirm["2. Saler nhấn Confirm đơn hàng"]:::omsClass
    Confirm --> CheckStock{"3. Kiểm tra tồn kho khả dụng<br/>trong WMS?"}:::omsClass
    
    CheckStock -->|Còn hàng| CreateFO["4. Chuyển trạng thái đơn: PROCESSING<br/>& Gọi WMS POST /fulfillment-orders"]:::omsClass
    CheckStock -->|Hết hàng| Block["Báo lỗi thiếu hàng trên UI"]
    
    CreateFO --> WMS_Receive["5. WMS tạo Pick List & vị trí lấy hàng<br/>Tạm giữ tồn (qty_reserved += qty)"]:::wmsClass
    WMS_Receive --> Picker_m["6. Picker mở Mobile /m/pick<br/>Xem danh sách cần lấy và vị trí"]:::actionClass
    
    Picker_m --> ScanProduct["7. Picker lấy hàng thực tế<br/>& quét EAN-13 trên hộp sản phẩm"]:::actionClass
    
    ScanProduct -->|Khớp SKU| Picked["8. Đánh dấu PICKED thành công<br/>WMS Callback OMS: PICKING"]:::wmsClass
    ScanProduct -->|Không khớp| ErrorPick["Báo lỗi sai sản phẩm hoặc sai vị trí"]
    
    Picked --> Packer_m["9. Chuyển sang khu đóng gói<br/>Packer mở Mobile /m/pack"]:::actionClass
    Packer_m --> ScanTracking["10. Đóng gói xong, dán phiếu giao hàng<br/>& quét mã vận đơn (Code 128/QR)"]:::actionClass
    
    ScanTracking --> Packed["11. Cập nhật tracking_number & carrier<br/>WMS Callback OMS: PACKED"]:::wmsClass
    
    Packed --> Ship["12. Giao cho Đơn vị vận chuyển<br/>Trừ tồn thực tế (qty_on_hand -= qty)<br/>Giải phóng tạm giữ (qty_reserved -= qty)"]:::wmsClass
    
    Ship --> Completed[("13. Đơn hàng hoàn tất giao vận<br/>WMS Callback OMS: SHIPPED")]:::omsClass
```

## 3. Luồng Nghiệp Vụ 2: Nhập Kho (Inbound Flow)

Luồng nhập hàng hóa từ nhà cung cấp về kho, quét barcode kiểm tra số lượng và đưa hàng vào các vị trí kệ (Put-away).

```mermaid
graph TD
    classDef wmsClass fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px;
    classDef actionClass fill:#FFF8E1,stroke:#FFB300,stroke-width:2px;

    StartIn["1. Tạo phiếu nhập (InboundShipment)<br/>Manager nhập NCC & số lượng dự kiến"]:::wmsClass --> ValidateIn{"2. Gọi PMI API<br/>Validate các SKU tồn tại?"}:::wmsClass
    
    ValidateIn -->|Hợp lệ| SavedIn["3. Lưu phiếu nhập dạng PENDING"]:::wmsClass
    
    SavedIn --> Receive_m["4. Hàng về, Thủ kho mở /m/receive<br/>Chọn phiếu nhập tương ứng"]:::actionClass
    
    Receive_m --> ScanEAN["5. Thực hiện quét EAN-13<br/>trên sản phẩm thực tế nhận"]:::actionClass
    
    ScanEAN --> MapSKU{"6. Barcode đã có trong<br/>bảng BarcodeMapping?"}:::wmsClass
    
    MapSKU -->|Đã map| UpdateQty["7. Tăng số lượng đã nhận<br/>(received_qty += 1)"]:::wmsClass
    
    MapSKU -->|Chưa map| MapNew["8. Popup di động yêu cầu map SKU<br/>Chọn SKU từ PMI và lưu mapping"]:::actionClass
    MapNew --> UpdateQty
    
    UpdateQty --> PutAway["9. Quét mã vị trí kệ (Location)<br/>và đặt sản phẩm vào kệ"]:::actionClass
    
    PutAway --> CompleteIn[("10. Hoàn thành phiếu nhập (COMPLETED)<br/>Cập nhật tồn (qty_on_hand += qty)<br/>Ghi nhận StockTransaction (INBOUND)")]:::wmsClass
```

## 4. Luồng Nghiệp Vụ 3: Thiết Kế Quét & Mapping Barcode Di Động (Mobile Scanning & Mapping Flow)

Cơ chế quét di động sử dụng camera để tự động map barcode EAN-13 chưa cấu hình vào SKU của PMI, giảm thiểu thao tác nhập tay.

```mermaid
graph TD
    classDef actionClass fill:#FFF8E1,stroke:#FFB300,stroke-width:2px;
    classDef decisionClass fill:#ECEFF1,stroke:#37474F,stroke-width:2px;
    
    StartScan["📱 Nhấn nút QUÉT trên Mobile Screen"]:::actionClass --> OpenCam["Mở Camera & Hiển thị khung ngắm (viewfinder)"]:::actionClass
    OpenCam --> Decode{"Giải mã Barcode thành công?"}:::decisionClass
    
    Decode -->|Thành công| Beep["🔔 Beep + Rung điện thoại"]:::actionClass
    Decode -->|Thất bại| ManualInput["Hiển thị ô nhập mã thủ công"]:::actionClass
    
    ManualInput --> LookUp
    Beep --> LookUp{"Kiểm tra database WMS:<br/>Mã có trong BarcodeMapping?"}:::decisionClass
    
    LookUp -->|Có| Success["✅ Nhận diện sản phẩm:<br/>Hiển thị Tên SP, SKU, Ảnh minh họa"]:::actionClass
    
    LookUp -->|Không| SetupMapping["⚠️ Thông báo barcode chưa cấu hình"]:::actionClass
    SetupMapping --> SelectSKU["Hiển thị danh sách tìm kiếm SKU từ PMI"]:::actionClass
    SelectSKU --> SaveMap["Chọn SKU khớp -> Lưu BarcodeMapping"]:::actionClass
    SaveMap --> Success
    
    Success --> CompleteScan["Cập nhật số lượng/tiến trình & Tiếp tục quét"]:::actionClass
```

## Giải thích các loại Barcode trong hệ thống:
1. **Barcode Sản Phẩm (EAN-13)**: In sẵn trên vỏ hộp sản phẩm cầu lông của Yonex, Victor, Li-Ning (gồm 13 chữ số). Được map với SKU của PMI thông qua bảng `BarcodeMapping` trong WMS.
2. **Barcode Vận Đơn (Code 128 / QR)**: In trên phiếu giao hàng của các đơn vị vận chuyển (Shopee Express, GHTK, GHN, TikTok Shop...). Hệ thống quét mã này ở bước đóng gói (`packing`) để tự động điền `tracking_number` và chuyển trạng thái sang `PACKED`.
3. **Barcode Vị Trí (Location Code)**: Mã hóa dưới dạng `[Zone][Aisle]-K[Rack]-T[Shelf]` (Ví dụ: `A01-K02-T01` - Khu A, lối đi 1, kệ 2, tầng 1). Dán trực tiếp tại các vị trí kệ trong kho để thủ kho quét xác nhận vị trí khi nhập kho (Put-away) hoặc lấy hàng (Picking).
