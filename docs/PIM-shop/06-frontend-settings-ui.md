# Thiết Kế UI: Quản Lý Kênh Bán Hàng (Settings > Channels)

Tài liệu này đặc tả chi tiết kiến trúc và thiết kế giao diện (UI) cho module **Cài đặt Kênh Bán Hàng** trong hệ thống PIM, dựa trên Next.js 14 (App Router) và TailwindCSS.

## 1. Cấu Trúc Thư Mục (Routing)

Trong thư mục `src/app/settings/`, chúng ta sẽ bổ sung các route sau:

```text
app/settings/channels/
├── page.tsx               # Màn hình 1: Danh sách các kênh (Webstore, Shopee, TikTok...)
├── [code]/                # Dynamic Route (dùng channel.code thay vì ID)
│   ├── page.tsx           # Màn hình 2: Chi tiết cấu hình Kênh (Tabs)
│   ├── components/        # Components dùng riêng cho trang chi tiết
│   │   ├── GeneralTab.tsx           # Tab Thông tin & API Config
│   │   ├── CategoryMappingTab.tsx   # Tab Ánh xạ Danh mục
│   │   └── AttributeMappingTab.tsx  # Tab Ánh xạ Thuộc tính
```

## 2. Thiết Kế Các Màn Hình Chi Tiết

### Màn Hình 1: Danh Sách Kênh (`channels/page.tsx`)
- **Header:** Tiêu đề "Sales Channels" kèm nút "Add New Channel" (Để mở rộng Lazada, Amazon trong tương lai).
- **Giao diện chính (Cards/Grid):**
  - Hiển thị mỗi kênh là một Card (Thẻ).
  - Thông tin trên Card: Logo kênh, Tên kênh (`Shopee VN`), Trạng thái (`Active`/`Inactive`), Nút `[ Cấu hình ]`.
- **UX:** Giao diện lưới đơn giản, tập trung vào trực quan.

### Màn Hình 2: Cấu Hình Kênh (`channels/[code]/page.tsx`)
Khi người dùng click `[ Cấu hình ]` Shopee, hệ thống chuyển sang trang chi tiết với một **Header** chứa tên Kênh và nút "Quay lại", bên dưới là **Hệ thống Tabs**.

#### Tab 1: Cấu hình Chung & API (GeneralTab.tsx)
- Form sử dụng `react-hook-form` + `zod` để validate.
- **Fields:**
  - `name`: Tên kênh (Input).
  - `is_active`: Trạng thái Bật/Tắt (Toggle Switch).
  - Khu vực **API Credentials** (Chỉ hiển thị với các kênh cần API): `app_key`, `app_secret`, `access_token`.
- **Hành động:** Nút "Lưu Cấu Hình" và "Test Connection" (Tùy chọn).

#### Tab 2: Ánh Xạ Danh Mục (CategoryMappingTab.tsx)
- Giao diện dạng Bảng (Table).
- **Bên Trái (Cố định):** Cây danh mục PIM (PIM Categories). Render theo cấu trúc cha-con (Ví dụ: `Thể thao > Vợt`).
- **Bên Phải (Input):** Ô nhập liệu cho Admin điền `channel_category_code` và `channel_category_name` của Sàn.
- **Tính năng mở rộng:** Ô tìm kiếm (Search) để lọc nhanh danh mục PIM chưa được ánh xạ (Unmapped).
- **Hành động:** Lưu đồng loạt (Bulk Save) hoặc Auto-save khi rời khỏi ô input.

#### Tab 3: Ánh Xạ Thuộc Tính (AttributeMappingTab.tsx)
- Giao diện dạng Bảng (Table).
- Liệt kê các Thuộc tính PIM (PIM Attributes).
- **Các cột Input cho Admin:**
  - Cột `Thuộc Tính PIM`: Dropdown chọn thuộc tính gốc.
  - Cột `Cột Sàn Yêu Cầu`: Text Input để nhập mã trên file Excel sàn (VD: `ps_brand`).
  - Cột `Áp dụng cho Danh mục`: Dropdown chọn danh mục sàn cụ thể (Nếu để trống thì áp dụng Global).
- **Hành động:** Nút "Thêm Mapping Mới" (Add Row). Nút Xóa (Delete Row).

## 3. Tái Sử Dụng Thư Viện UI (Components)

Để đồng bộ với giao diện hiện có của PIM (VD: trang Users), module này sẽ tái sử dụng:
- Bảng CSS: `@import '../styles/table.css'` và `@import '../styles/form.css'`.
- Nút bấm: `btn-primary`, `btn-secondary`.
- Icons: Dùng thư viện `lucide-react` (VD: `Settings`, `Link`, `ListTree`).
- Thông báo (Toasts/Alerts): Dùng `popupService` có sẵn của hệ thống.
