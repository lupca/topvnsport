# Thiết Kế Hiển Thị (Frontend UI/UX)

Hệ thống PIM đa kênh nếu không được thiết kế UI/UX khéo léo sẽ trở thành "ác mộng" cho người nhập liệu vì số lượng trường dữ liệu khổng lồ bị nhồi nhét. 

Nguyên tắc thiết kế cho màn hình Create/Edit Product (Web Frontend dùng React + Vite) là: **Tách biệt Core và Channel thông qua cơ chế Tabs.**

## 1. Bố Cục Màn Hình Cập Nhật Sản Phẩm (Product Detail Form)

Màn hình sẽ được chia làm 2 phân khu lớn (Phân khu dọc).

### Phân khu 1: Thông Tin Gốc (Core Information)
Phân khu này luôn luôn hiển thị ở trên cùng. Đây là nơi chứa "Sự thật duy nhất" (Single Source of Truth). Bất cứ thay đổi nào ở đây cũng sẽ được kế thừa (hoặc dùng làm giá trị mặc định) cho các kênh bên dưới.

- **Mã sản phẩm (Product Code):** Unique, tự sinh hoặc nhập.
- **Tên sản phẩm (Product Name):** Tên chung chung, dễ quản lý.
- **Mô tả gốc:** Tối đa 5000 ký tự.
- **Logistics (Cân nặng, D x R x C):** Nhập 1 lần dùng chung cho mọi kênh.
- **Đa phương tiện (Media):** Vùng kéo thả upload ảnh/video. Nút chọn "Ảnh bìa" (Cover Image).
- **Phân loại biến thể (Variation Generator):** Giao diện tương tự Shopee (Thêm Nhóm Phân Loại 1: Màu sắc -> Thêm Option: Xanh, Đỏ). Tự động generate ra một bảng Matrix chứa các dòng SKU. Tại bảng này, người dùng nhập `Giá bán mặc định` và thấy được `Tồn kho`.

*(Trạng thái sau khi điền Phân khu 1: Sản phẩm đã hợp lệ và tự động được Publish lên kênh Webstore nội bộ).*

### Phân khu 2: Cấu Hình Đa Kênh (Channel Configurations)
Ngay dưới bảng biến thể, chúng ta hiển thị một hệ thống Tabs (Thẻ).

```text
[ Cấu Hình Shopee ] | [ Cấu Hình TikTok ] | [ Cấu Hình Webstore (Tùy chọn) ]
```

#### Khi click vào Tab `[ Cấu Hình Shopee ]`:
1. **Trạng thái đồng bộ:** Một nút gạt (Switch) lớn `[Bật/Tắt Niêm yết trên Shopee]`.
2. **Ghi đè thông tin cơ bản (Overrides):**
   - *Tên trên Shopee:* `[ Input Box - Mặc định lấy từ Core ]` (Giúp gõ tên giật tít SEO riêng cho sàn).
3. **Danh mục sàn (Platform Category):**
   - Hệ thống cố gắng auto-map từ danh mục Core.
   - Nếu không có, hiển thị Dropdown chứa danh sách `channel_category_mappings` để user chọn thủ công (VD: Chọn "Áo thể thao nam").
4. **Cấu hình giá riêng (Variant Overrides):**
   - Hiển thị lại bảng Matrix SKU ở Core, nhưng chỉ có cột `Giá Bán Shopee`. Hệ thống gợi ý `+10%` hoặc người dùng tự nhập tay để bù phí sàn.
5. **Thuộc tính đặc thù sàn (Dynamic Channel Attributes):**
   - Dựa vào Danh mục Shopee vừa chọn ở bước 3, frontend gọi API lấy danh sách các mapping thuộc tính.
   - UI render động các ô nhập liệu. Hệ thống thông minh tự fill giá trị nếu các thuộc tính này đã khai báo ở Core.
   - Nếu user nhập tay/sửa đổi giá trị khác với Core, dữ liệu sẽ được lưu xuống mảng `attribute_values` (Map vào bảng `product_channel_attribute_values`).

#### Khi click vào Tab `[ Cấu Hình TikTok ]`:
Tương tự như Shopee, nhưng UI sẽ render các fields bắt buộc khác của TikTok (dựa trên bảng mapping của TikTok):
- *Danh mục TikTok:* Dropdown hiển thị chuỗi dài (VD: `Thiết bị thể thao/Cầu lông (603065)`).
- *Thuộc tính TikTok:* Yêu cầu điền Bảng Kích thước (Size Chart URL), Hình thức Vận Chuyển (Delivery Option), và **Hỗ trợ thanh toán khi nhận hàng (COD)**.
- *Ghi đè giá TikTok:* Người dùng có thể set giá TikTok khác với giá Shopee.

## 2. Ưu Điểm & Đánh Đổi (Trade-offs) Của Thiết Kế UI Này

### Ưu điểm
- **Luồng thao tác rành mạch (Progressive Disclosure):** Người dùng nhập thông tin vật lý trước, không bị rối trí. Sau đó mới tinh chỉnh chi tiết cho từng kênh.
- **Tiết kiệm thời gian (DRY - Don't Repeat Yourself):** Không cần nhập lại Cân Nặng, Mã SKU, Hình Ảnh cho từng sàn. Mọi thứ được thừa kế từ Core.
- **Khả năng Mở rộng vô hạn (Infinite Scalability):** Nếu sau này công ty muốn tích hợp thêm sàn Lazada hay Amazon, team UI chỉ cần cắm thêm một Tab `[ Cấu Hình Lazada ]` mà không làm vỡ layout hay cấu trúc Database của trang Product Detail.

### Đánh đổi ở Giai đoạn 1 (Phase 1 Trade-off)
- **Thiếu kiểm tra tính hợp lệ trực tiếp (Real-time Validation):** Hệ thống PIM hiện không gọi API trực tiếp của Shopee/TikTok để biết "Danh mục này bắt buộc phải điền những ô nào". 
- **Cách hoạt động:** PIM bị "mù" luật của sàn. Giao diện Frontend sẽ **chỉ hiển thị các ô thuộc tính mà Admin đã tự tay cấu hình mapping** trong phần Settings. 
- **Quy trình:** Nếu user xuất file Excel up lên sàn bị báo lỗi "Thiếu Chất Liệu", thì Admin phải vào PIM Settings khai báo mapping cho "Chất Liệu". Sau đó Frontend mới hiện ô này ra cho User điền. Điều này giúp hệ thống rất nhẹ, không bị crash khi API sàn thay đổi, đánh đổi lại là User có thể gặp lỗi lúc up file lần đầu nếu Admin cấu hình thiếu mapping.

## 3. Kiến trúc Component (React + Vite)

```javascript
// Cấu trúc dự kiến cho trang chi tiết sản phẩm
<ProductForm>
  <CoreInfoSection />
  <LogisticsSection />
  <MediaSection />
  <VariantGeneratorSection />
  
  {/* Lớp Kênh */}
  <Tabs>
    <TabList>
      <Tab>Cấu hình Shopee</Tab>
      <Tab>Cấu hình TikTok</Tab>
    </TabList>
    
    <TabPanels>
      <TabPanel>
         <ShopeeConfig channelCode="shopee_vn" />
      </TabPanel>
      <TabPanel>
         <TikTokConfig channelCode="tiktok_shop" />
      </TabPanel>
    </TabPanels>
  </Tabs>
</ProductForm>
```
