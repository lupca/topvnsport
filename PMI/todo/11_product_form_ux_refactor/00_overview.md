# Product Form UX Refactor - Overview

## Mục tiêu
1. Cải thiện UI/UX của form sản phẩm PMI
2. Refactor ProductForm.tsx theo kiến trúc chuẩn (custom hooks, separation of concerns)
3. Viết đầy đủ tests cho các components và utils

## Nguyên tắc
1. **Tests first**: Viết tests cho code hiện tại TRƯỚC KHI refactor
2. **Giữ nguyên styling**: Sử dụng Tailwind classes và màu sắc hiện có
3. **Không thay đổi API**: Backend API không đổi
4. **Backward compatible**: Data cũ vẫn hoạt động
5. **Incremental refactor**: Từng bước nhỏ, verify sau mỗi bước

## Các thay đổi chính

### Phase 1: Tests (PHẢI HOÀN THÀNH TRƯỚC)
- Task 01: Viết tests cho utils (skuHelper, imageUrl, apiClient)
- Task 02: Viết tests cho section components
- Task 03: Viết tests cho edit/duplicate modes

### Phase 2: Refactor Architecture
- Task 04: Tạo custom hooks để tách logic
- Task 05: Refactor ProductForm.tsx

### Phase 3: UX Improvements
- Task 06: Navigation & Progress bar
- Task 07: Auto-generate SKU
- Task 08: Channel Override UX
- Task 09: Form Validation UX
- Task 10: Cleanup Status

## Current State Analysis

### ProductForm.tsx (583 lines) - Problems:
```
Lines 30-50:   20+ useState hooks (quá nhiều)
Lines 87-129:  useEffect fetch categories/families
Lines 131-144: useEffect fetch product data
Lines 146-252: useEffect reset form with loaded data
Lines 254-321: useEffect generate variants matrix
Lines 324-415: onSubmit handler (quá phức tạp)
Lines 417-583: JSX render
```

### Missing Tests:
```
src/utils/
├── skuHelper.ts        → skuHelper.test.ts      ❌ MISSING
├── imageUrl.ts         → imageUrl.test.ts       ❌ MISSING
└── apiClient.ts        → apiClient.test.ts      ❌ MISSING

src/components/products/
├── ProductBasicInfo.tsx    → test ❌ MISSING
├── ProductTechSpecs.tsx    → test ❌ MISSING
├── ProductVariations.tsx   → test ❌ MISSING
├── ProductLogistics.tsx    → test ❌ MISSING
└── ChannelConfig.tsx       → test ❌ MISSING

ProductForm.test.tsx exists but missing:
├── Edit mode tests         ❌ MISSING
├── Duplicate mode tests    ❌ MISSING
└── Channel config tests    ❌ MISSING
```

## Target Architecture

### Custom Hooks (to be created):
```
src/hooks/
├── useProductFormData.ts    # Fetch categories, families, attributes
├── useProductLoad.ts        # Load product for edit/duplicate
├── useVariantMatrix.ts      # Generate variants from tiers
├── useMediaUpload.ts        # Handle image uploads
├── useProductSubmit.ts      # Handle form submission
└── useFormCompletion.ts     # Calculate completion %
```

### Refactored Components:
```
src/components/
├── ProductForm.tsx              # Main orchestrator (simplified)
├── products/
│   ├── ProductFormSidebar.tsx   # NEW: Navigation + Progress
│   ├── ProductFormFooter.tsx    # NEW: Action buttons
│   ├── ProductBasicInfo.tsx     # Existing
│   ├── ProductTechSpecs.tsx     # Existing
│   ├── ProductVariations.tsx    # Existing
│   ├── ProductLogistics.tsx     # Existing (simplified)
│   └── ChannelConfig.tsx        # Existing (enhanced)
└── ui/
    ├── InheritedField.tsx       # NEW: Override indicator
    └── FormError.tsx            # NEW: Error display
```

## Thứ tự thực hiện

```
Phase 1: Tests
├── 01_tests_utils.md           ← START HERE
├── 02_tests_components.md
└── 03_tests_modes.md

Phase 2: Refactor
├── 04_custom_hooks.md
└── 05_refactor_productform.md

Phase 3: UX
├── 06_navigation_progress.md
├── 07_auto_generate_sku.md
├── 08_channel_override_ux.md
├── 09_form_validation_ux.md
└── 10_cleanup_status.md
```

## Estimate

| Phase | Tasks | Hours |
|-------|-------|-------|
| Phase 1 | 01-03 | 6-8h |
| Phase 2 | 04-05 | 6-8h |
| Phase 3 | 06-10 | 10-12h |
| **Total** | | **22-28h** |

## Files Index
- `00_overview.md` - This file
- `01_tests_utils.md` - Tests for utility functions
- `02_tests_components.md` - Tests for section components
- `03_tests_modes.md` - Tests for edit/duplicate modes
- `04_custom_hooks.md` - Extract logic to custom hooks
- `05_refactor_productform.md` - Refactor main component
- `06_navigation_progress.md` - Sidebar + Progress bar
- `07_auto_generate_sku.md` - Auto-gen SKU logic
- `08_channel_override_ux.md` - Override indicators
- `09_form_validation_ux.md` - Validation UX
- `10_cleanup_status.md` - Status cleanup
- `mockup_reference.md` - UI reference
