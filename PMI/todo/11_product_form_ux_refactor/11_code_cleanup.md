# Task 11: Code Cleanup sau Refactor

## Mục tiêu
Dọn dẹp code thừa và fix các vấn đề phát hiện sau review.

## Dependencies
- Phase 1-3 đã hoàn thành

---

## Vấn đề 1: Unused Variables trong ProductForm.tsx

**File**: `src/components/ProductForm.tsx`

### 1.1 Xóa `handleCoverUpload` (line 280)

```diff
  const {
    coverImage,
    setCoverImage,
    uploadingCover,
    setUploadingCover,
-   handleCoverUpload,
    productImages,
    setProductImages,
    uploadingGallery,
    setUploadingGallery,
-   handleGalleryUpload,
    tier1Images,
    setTier1Images,
    uploadingTier1,
    setUploadingTier1
  } = useMediaUpload();
```

**Lý do**: `ProductBasicInfo.tsx` đã có implementation riêng (lines 147-197), không dùng từ hook.

### 1.2 Xóa `watchVariants` (line 335)

```diff
- const watchVariants = watch("variants");
```

**Lý do**: Khai báo nhưng không sử dụng ở đâu trong component.

---

## Vấn đề 2: Missing Dependency trong useEffect

**File**: `src/hooks/useProductLoad.ts`

**Line 176**: `onLoadExistingProductCode` được sử dụng trong useEffect (line 89-90) nhưng thiếu trong dependency array.

```diff
  }, [
    optionsLoaded,
    pendingProductData,
    duplicateProductId,
    reset,
    setAttributeValues,
    setCoverImage,
    setProductImages,
    setTier1Images,
-   onLoadExistingSkus
+   onLoadExistingSkus,
+   onLoadExistingProductCode
  ]);
```

**Lý do**: React hooks rule - tất cả dependencies phải được khai báo để tránh stale closure bugs.

---

## Vấn đề 3: Backup File chưa xóa

**File cần xóa**: `src/components/ProductForm.backup.txt`

```bash
rm src/components/ProductForm.backup.txt
```

**Lý do**: File backup không cần thiết, đã có git history.

---

## Checklist

| # | Task | File | Line | Status |
|---|------|------|------|--------|
| 1 | Xóa `handleCoverUpload` khỏi destructure | ProductForm.tsx | 280 | ☐ |
| 2 | Xóa `handleGalleryUpload` khỏi destructure | ProductForm.tsx | 285 | ☐ |
| 3 | Xóa `const watchVariants = watch("variants")` | ProductForm.tsx | 335 | ☐ |
| 4 | Thêm `onLoadExistingProductCode` vào deps | useProductLoad.ts | 176 | ☐ |
| 5 | Xóa file backup | ProductForm.backup.txt | - | ☐ |
| 6 | Chạy tests verify | - | - | ☐ |

---

## Verification

Sau khi sửa, chạy:

```bash
docker compose -f PMI/docker-compose.yml exec frontend npm run test
```

**Expected**: 116 tests passed (không thay đổi)

---

## Estimate

| Task | Time |
|------|------|
| Fix code | 10 phút |
| Verify tests | 5 phút |
| **Total** | **15 phút** |
