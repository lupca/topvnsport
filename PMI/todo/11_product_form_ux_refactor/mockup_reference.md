# Mockup Reference

## Interactive Mockup URL
https://claude.ai/code/artifact/1f589c8a-56cd-42f9-984a-06c442b3d9d4

## Final UI Structure

```
┌────────────────────────────────────────────────────────────────────┐
│  Header: "Thêm Sản Phẩm Mới" + [Đang công khai] badge (edit mode)  │
├──────────────┬─────────────────────────────────────────────────────┤
│              │                                                     │
│  SIDEBAR     │  MAIN CONTENT                                       │
│              │                                                     │
│  ┌────────┐  │  ┌─────────────────────────────────────────────┐   │
│  │Progress│  │  │ Section 1: Thông tin cơ bản                 │   │
│  │  75%   │  │  │ - Ảnh (9 slots)                              │   │
│  └────────┘  │  │ - Tên, SKU (auto-gen), Category, Family     │   │
│              │  │ - Mô tả                                      │   │
│  ○ Cơ bản   │  └─────────────────────────────────────────────┘   │
│  ○ Thuộc tính│                                                     │
│  ● Bán hàng │  ┌─────────────────────────────────────────────┐   │
│  ○ Vận chuyển│  │ Section 2: Thuộc tính kỹ thuật              │   │
│  ○ Khác     │  │ - Dynamic fields từ Family                   │   │
│  ○ Đa kênh  │  └─────────────────────────────────────────────┘   │
│              │                                                     │
│              │  ┌─────────────────────────────────────────────┐   │
│              │  │ Section 3: Thông tin bán hàng               │   │
│              │  │ - Tier 1 + Images                            │   │
│              │  │ - Tier 2                                     │   │
│              │  │ - Bulk apply                                 │   │
│              │  │ - Variants table (SKU auto-gen)              │   │
│              │  └─────────────────────────────────────────────┘   │
│              │                                                     │
│              │  ┌─────────────────────────────────────────────┐   │
│              │  │ Section 4: Vận chuyển & Logistics           │   │
│              │  │ - Weight, Dimensions, HS Code, Tax Code      │   │
│              │  └─────────────────────────────────────────────┘   │
│              │                                                     │
│              │  ┌─────────────────────────────────────────────┐   │
│              │  │ Section 5: Thông tin khác                   │   │
│              │  │ - Pre-order toggle + DTS days                │   │
│              │  │ - (Status radio REMOVED)                     │   │
│              │  └─────────────────────────────────────────────┘   │
│              │                                                     │
│              │  ┌─────────────────────────────────────────────┐   │
│              │  │ Section 6: Cấu hình đa kênh                 │   │
│              │  │ [Shopee (2)] [TikTok (1)]                   │   │
│              │  │                                              │   │
│              │  │ ○ Toggle niêm yết                           │   │
│              │  │ ○ Title override [🔗 Từ master]             │   │
│              │  │ ○ Channel Product ID                         │   │
│              │  │ ○ Description [↩ Reset]                      │   │
│              │  │ ○ Category mapping ✓                         │   │
│              │  │ ○ Price overrides                            │   │
│              │  │ ○ Channel attributes                         │   │
│              │  └─────────────────────────────────────────────┘   │
│              │                                                     │
├──────────────┴─────────────────────────────────────────────────────┤
│  Footer: [Hủy bỏ] [Lưu nháp] [Lưu & Công khai]                     │
└────────────────────────────────────────────────────────────────────┘
```

## Key UX Patterns

### 1. Sidebar Navigation
- Sticky position
- Active section highlighted
- Error indicator (red dot) on sections with validation errors
- Progress bar at top

### 2. Auto-generate SKU
- SKU hiển thị ngay khi nhập product_code
- Auto-update khi thay đổi tier options
- "Auto" badge khi chưa edit thủ công
- Giữ nguyên nếu user sửa

### 3. Channel Override Fields
```
┌─────────────────────────────────────────┐
│ Tên hiển thị              [🔗 Từ master]│
│ ┌─────────────────────────────────────┐ │
│ │ Vợt cầu lông Yonex...   (greyed)    │ │
│ └─────────────────────────────────────┘ │
│ Nhập để ghi đè giá trị master           │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Mô tả chi tiết            [↩ Reset]     │
│ ┌─────────────────────────────────────┐ │
│ │ 🔥 VỢT SIÊU HOT...      (edited)    │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### 4. Footer Buttons
```
[Hủy bỏ]  [Lưu nháp]  [Lưu & Công khai]
  gray     outline       primary
```

- "Lưu nháp" = status: Draft
- "Lưu & Công khai" = status: Published
- No separate status radio needed

### 5. Category Mapping Status
```
✓ Đã khớp ngành hàng                 (green)
  Thể Thao & Dã Ngoại › Vợt [100934]

⚠️ Chưa cấu hình ánh xạ              (yellow)
   Vào Cài đặt → Ánh xạ danh mục
```

### 6. Price Override Table
```
| Biến thể      | Giá gốc   | Giá trên sàn        |
|---------------|-----------|---------------------|
| Navy / 3U     | ₫3,500,000| [₫3,710,000] [↩]   |
| Navy / 4U     | ₫3,500,000| [Dùng giá gốc]      |
```

## Styling Guidelines

### Giữ nguyên:
- Tailwind classes hiện tại
- Color palette (`brand-primary`, `gray-*`, etc.)
- Border radius (`rounded-2xl`, `rounded-xl`)
- Spacing scale
- Font sizes và weights

### Thêm mới (nếu cần):
- `border-l-3` for sidebar active indicator
- `bg-gray-50` for inherited field background
- `text-gray-400` for inherited badge text

## Không thay đổi:
- Backend API
- Data schema
- Validation rules
- Component structure (chỉ thêm, không refactor lớn)
