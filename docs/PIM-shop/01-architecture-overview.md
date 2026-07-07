# Kiến trúc Tổng quan PIM Đa Kênh (Multi-Channel E-commerce)

## 1. Nguồn Dữ Liệu Phân Tích
Kiến trúc này được đúc kết từ việc phân tích tài liệu chuẩn của 2 nền tảng lớn (lưu tại thư mục `docs/shopee_mass_upload` và `docs/tiktok_batchupload`), kết hợp với nhu cầu bán hàng trên Webstore (Next.js).

- **Nguồn Shopee:** Dựa trên File `Shopee_mass_upload_2026-06-08_100637.xlsx - Bản đăng tải.csv` và các file Hướng dẫn.
- **Nguồn TikTok:** Dựa trên File `Tiktoksellercenter_batchupload_20260707_template.xlsx - Template.csv` và `Category.csv`.

## 2. Triết lý Thiết Kế: "Core" & "Channel"

Tất cả các nền tảng thương mại điện tử đều chia sẻ một mô hình lõi (Sản phẩm Cha - Các biến thể Con), nhưng hoàn toàn khác biệt ở cách định danh Danh mục, Thuộc tính bắt buộc, Cấu trúc giá và Cách gộp nhóm (Grouping).

Để hệ thống PIM xử lý được sự khác biệt này mà không làm phình to bảng dữ liệu chính, kiến trúc được chia làm 2 lớp (Layer):

### Lớp Core (Single Source of Truth)
Đây là dữ liệu gốc vật lý, tuyệt đối không thay đổi theo nền tảng:
- **Định danh:** SKU (Ví dụ: `SP-12345-RED-M`), Barcode (Dùng để quét ở kho WMS).
- **Logistics:** Cân nặng (grams), Kích thước (Dài x Rộng x Cao). Dữ liệu này dùng để tính cước phí vận chuyển trên mọi sàn.
- **Media:** Hình ảnh, Video chuẩn chất lượng cao.
- **Biến thể:** Cấu trúc phân loại (Tier Variations) tối đa 2 cấp (VD: Màu sắc & Kích cỡ).
- **Kho hàng (Inventory):** Số lượng tồn vật lý đồng bộ từ hệ thống WMS (Kho).

### Lớp Channel (Mapping & Overrides)
Đây là dữ liệu "đội lốt" tùy thuộc vào nền tảng mà sản phẩm được đẩy lên:
- **Ánh xạ Danh mục (Category Mapping):** Ở PIM là "Vợt cầu lông" (ID: 10), qua Shopee là ID `120039`, qua TikTok là chuỗi `Thiết bị các môn thể thao bóng/Cầu lông (603065)`.
- **Ánh xạ Thuộc tính (Attribute Mapping):** "Thương hiệu" (brand) qua Shopee gọi là cột `ps_brand`, qua TikTok gọi là `product_property/100107`.
- **Ghi đè Niêm yết (Listings):** 
  - Khác biệt về **Trạng thái**: Có thể ẩn trên TikTok nhưng vẫn hiện trên Shopee.
  - Khác biệt về **Giá bán**: Cùng một SKU nhưng giá Shopee có thể set cao hơn Webstore 10% để bù phí sàn.

## 3. Sự Khác Biệt Cốt Lõi Về Định Dạng (Export Format)

Khi hệ thống Backend generate file Excel cho từng nền tảng, cơ chế gộp nhóm biến thể (Grouping) là điểm khác biệt lớn nhất:

- **Shopee:** Sử dụng trường **Mã Sản Phẩm (Integration No)** làm khóa gộp. Các dòng nào có cùng `Integration No` sẽ được Shopee tự hiểu là các biến thể của chung 1 Sản phẩm Cha. *(Hệ thống PIM sẽ gán trường `Product.product_code` vào cột này. **Lưu ý:** Cần validate `product_code` ở Frontend/Backend chỉ chứa chữ, số, dấu gạch ngang và giới hạn độ dài để không vi phạm quy tắc Integration No của Shopee).*
- **TikTok Shop:** Dùng **Tên Sản Phẩm (Product Name)** để gộp nhóm. Các dòng liên tiếp có chung `Product Name` (và Category) sẽ được TikTok gộp lại thành 1 sản phẩm đa biến thể.
- **Webstore:** Frontend gọi API trực tiếp theo JSON Payload, không cần dùng file Excel. Dữ liệu trả về từ API `/products` đã được nest (gộp sẵn) các `variants` vào trong 1 object `Product`.
