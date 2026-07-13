# Task 05: Refactor ProductForm.tsx

## Mục tiêu
Refactor ProductForm.tsx sử dụng custom hooks, giảm từ 583 dòng xuống ~200 dòng.

## Dependencies
- Task 04 completed (custom hooks created)

## Before vs After

### Before (583 lines):
```
ProductForm.tsx
├── 20+ useState hooks (30-50)
├── 5 useEffect blocks (87-252)
├── Variant generation logic (254-321)
├── Submit handler (324-415)
└── JSX render (417-583)
```

### After (~200 lines):
```
ProductForm.tsx
├── Import hooks
├── useForm setup
├── Hook calls (5-6 lines each)
├── Simple event handlers
└── Clean JSX render
```

## Refactored Code

```typescript
"use client";

import React, { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, AlertCircle, ChevronRight } from "lucide-react";

// Components
import ProductBasicInfo from "./products/ProductBasicInfo";
import ProductTechSpecs from "./products/ProductTechSpecs";
import ProductVariations from "./products/ProductVariations";
import ProductLogistics from "./products/ProductLogistics";
import ChannelConfig from "./products/ChannelConfig";

// Hooks
import { useProductFormData } from "@/hooks/useProductFormData";
import { useProductLoad } from "@/hooks/useProductLoad";
import { useVariantMatrix } from "@/hooks/useVariantMatrix";
import { useMediaUpload } from "@/hooks/useMediaUpload";
import { useProductSubmit } from "@/hooks/useProductSubmit";

// Schema
import { productFormSchema, ProductFormValues } from "@/validations/productSchema";

interface ProductFormProps {
  productId?: number | null;
  duplicateProductId?: number | null;
  onSaveSuccess?: () => void;
}

export default function ProductForm({ 
  productId, 
  duplicateProductId, 
  onSaveSuccess 
}: ProductFormProps = {}) {
  // Form setup
  const methods = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: getDefaultValues(),
  });

  const { handleSubmit, watch, setValue, reset } = methods;
  const watchFamilyId = watch("family_id");

  // State for attributes (managed separately from form)
  const [attributeValues, setAttributeValues] = useState<Record<number, string>>({});
  const [activeTab, setActiveTab] = useState<"shopee" | "tiktok">("shopee");
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkStock, setBulkStock] = useState("");

  // Custom hooks
  const { 
    categories, 
    families, 
    familyAttributes, 
    optionsLoaded 
  } = useProductFormData(watchFamilyId);

  const {
    coverImage, setCoverImage, uploadingCover, handleCoverUpload,
    productImages, setProductImages, uploadingGallery, handleGalleryUpload, removeGalleryImage,
    tier1Images, setTier1Images, uploadingTier1, handleTier1Upload,
  } = useMediaUpload();

  const { loading: productLoading, error: loadError } = useProductLoad({
    productId,
    duplicateProductId,
    optionsLoaded,
    reset,
    setCoverImage,
    setProductImages,
    setTier1Images,
    setAttributeValues,
  });

  useVariantMatrix({ watch, setValue });

  const { 
    submitting, 
    submitError, 
    submitSuccess, 
    handleSubmit: submitForm 
  } = useProductSubmit({
    productId,
    coverImage,
    productImages,
    tier1Images,
    familyAttributes,
    attributeValues,
    onSuccess: onSaveSuccess,
  });

  // Form submission
  const onSubmit = (values: ProductFormValues) => {
    submitForm(values);
  };

  const onError = (errors: any) => {
    console.error("Form validation errors", errors);
    // Extract and display errors
    const errorPaths = extractErrorPaths(errors);
    // This will be handled by useProductSubmit or a separate error handler
  };

  return (
    <div className="max-w-6xl mx-auto py-10 px-4">
      {/* Header */}
      <FormHeader 
        productId={productId} 
        duplicateProductId={duplicateProductId} 
      />

      {/* Success/Error Messages */}
      {submitSuccess && <SuccessMessage />}
      {(submitError || loadError) && <ErrorMessage error={submitError || loadError} />}

      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSubmit, onError)} className="space-y-8">
          
          {/* Section 1: Basic Info */}
          <ProductBasicInfo
            categories={categories}
            families={families}
            coverImage={coverImage}
            setCoverImage={setCoverImage}
            productImages={productImages}
            setProductImages={setProductImages}
            uploadingCover={uploadingCover}
            setUploadingCover={() => {}}
            uploadingGallery={uploadingGallery}
            setUploadingGallery={() => {}}
          />

          {/* Section 2: Tech Specs */}
          <ProductTechSpecs
            watchFamilyId={watchFamilyId}
            familyAttributes={familyAttributes}
            attributeValues={attributeValues}
            setAttributeValues={setAttributeValues}
          />

          {/* Section 3: Variations */}
          <ProductVariations
            tier1Images={tier1Images}
            setTier1Images={setTier1Images}
            uploadingTier1={uploadingTier1}
            setUploadingTier1={() => {}}
            bulkPrice={bulkPrice}
            setBulkPrice={setBulkPrice}
            bulkStock={bulkStock}
            setBulkStock={setBulkStock}
          />

          {/* Section 4: Logistics */}
          <ProductLogistics />

          {/* Section 5: Channel Config */}
          <ChannelConfigSection 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
          />

          {/* Submit Buttons */}
          <FormFooter 
            productId={productId}
            submitting={submitting}
            onCancel={onSaveSuccess}
          />

        </form>
      </FormProvider>
    </div>
  );
}

// Helper Components
function FormHeader({ productId, duplicateProductId }: { 
  productId?: number | null; 
  duplicateProductId?: number | null; 
}) {
  const title = productId 
    ? "Cập Nhật Sản Phẩm" 
    : duplicateProductId 
      ? "Sao Chép Sản Phẩm" 
      : "Thêm Sản Phẩm Mới";

  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
          {title}
        </h1>
        <p className="text-gray-500 mt-1">
          {productId ? "Chỉnh sửa thông tin chi tiết" : "Đăng tải sản phẩm mới"}
        </p>
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span>Kênh Người Bán</span>
        <ChevronRight className="h-4 w-4" />
        <span className="font-semibold text-brand-primary">Quản lý Sản Phẩm</span>
      </div>
    </div>
  );
}

function SuccessMessage() {
  return (
    <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
      <Check className="h-5 w-5 mt-0.5 text-emerald-600 shrink-0" />
      <div>
        <h4 className="font-semibold text-emerald-900">Thành công!</h4>
        <p className="text-sm text-emerald-700 mt-0.5">Sản phẩm đã được lưu.</p>
      </div>
    </div>
  );
}

function ErrorMessage({ error }: { error: string | null }) {
  if (!error) return null;
  
  return (
    <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
      <AlertCircle className="h-5 w-5 mt-0.5 text-rose-600 shrink-0" />
      <div>
        <h4 className="font-semibold text-rose-900">Lỗi</h4>
        <p className="text-sm text-rose-700 mt-0.5">{error}</p>
      </div>
    </div>
  );
}

function ChannelConfigSection({ 
  activeTab, 
  setActiveTab 
}: { 
  activeTab: "shopee" | "tiktok"; 
  setActiveTab: (tab: "shopee" | "tiktok") => void;
}) {
  return (
    <div className="pim-card space-y-6">
      <h2 className="text-lg font-bold text-gray-900 border-b pb-3 border-gray-200">
        Cấu hình đa kênh bán hàng
      </h2>
      
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <TabButton 
            active={activeTab === "shopee"} 
            onClick={() => setActiveTab("shopee")}
          >
            Cấu hình Shopee
          </TabButton>
          <TabButton 
            active={activeTab === "tiktok"} 
            onClick={() => setActiveTab("tiktok")}
          >
            Cấu hình TikTok Shop
          </TabButton>
        </nav>
      </div>

      <div className="py-4">
        <div className={activeTab === "shopee" ? "block" : "hidden"}>
          <ChannelConfig channelCode="shopee_vn" channelName="Shopee Việt Nam" />
        </div>
        <div className={activeTab === "tiktok" ? "block" : "hidden"}>
          <ChannelConfig channelCode="tiktok_shop" channelName="TikTok Shop" />
        </div>
      </div>
    </div>
  );
}

function TabButton({ 
  active, 
  onClick, 
  children 
}: { 
  active: boolean; 
  onClick: () => void; 
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 py-4 px-1 text-sm font-semibold transition-all ${
        active
          ? "border-brand-primary text-brand-primary font-bold"
          : "border-transparent text-gray-500 hover:border-gray-300"
      }`}
    >
      {children}
    </button>
  );
}

function FormFooter({ 
  productId, 
  submitting, 
  onCancel 
}: { 
  productId?: number | null;
  submitting: boolean;
  onCancel?: () => void;
}) {
  return (
    <div className="flex justify-end gap-4">
      <button 
        type="button"
        onClick={onCancel}
        className="btn-outline px-6 py-3 rounded-2xl text-sm"
      >
        Hủy bỏ
      </button>
      <button 
        type="submit"
        disabled={submitting}
        className="btn-primary px-8 py-3 rounded-2xl text-sm shadow-sm flex items-center gap-2"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...
          </>
        ) : productId ? (
          "Lưu thay đổi"
        ) : (
          "Lưu & Hiển thị"
        )}
      </button>
    </div>
  );
}

// Utility functions
function getDefaultValues(): ProductFormValues {
  return {
    product_code: "",
    name: "",
    description: "",
    category_id: 0,
    family_id: 0,
    weight: 0,
    length: null,
    width: null,
    height: null,
    hs_code: "",
    tax_code: "",
    is_pre_order: false,
    dts_days: 7,
    status: "Draft",
    tier_variations: [],
    variants: [{ tier_1_option: null, tier_2_option: null, sku_code: "", barcode: "", price: 0, stock: 0 }],
    media: [],
    channel_listings: [
      { channel_code: "shopee_vn", status: "Draft", title_override: "", description_override: "", attribute_values: [], variant_overrides: [] },
      { channel_code: "tiktok_shop", status: "Draft", title_override: "", description_override: "", attribute_values: [], variant_overrides: [] }
    ]
  };
}

function extractErrorPaths(errors: any): string[] {
  const paths: string[] = [];
  const extract = (obj: any, path: string) => {
    if (obj?.message && typeof obj.message === 'string') {
      paths.push(`${path}: ${obj.message}`);
    } else if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        if (key !== 'ref' && key !== 'type') {
          extract(obj[key], path ? `${path}.${key}` : key);
        }
      }
    }
  };
  extract(errors, "");
  return paths;
}
```

## Checklist

- [ ] Create backup of original `ProductForm.tsx`
- [ ] Refactor using custom hooks
- [ ] Extract helper components (FormHeader, SuccessMessage, ErrorMessage, etc.)
- [ ] Extract utility functions
- [ ] Run all existing tests - MUST PASS
- [ ] Manual testing: create, edit, duplicate product
- [ ] Code review: verify no functionality lost

## Migration Steps

1. **Backup original file**:
   ```bash
   cp src/components/ProductForm.tsx src/components/ProductForm.backup.tsx
   ```

2. **Import hooks at top**

3. **Replace useState calls with hook returns**

4. **Replace useEffect blocks with hook calls**

5. **Extract JSX into helper components**

6. **Run tests after each major change**

## Verification

After refactor, manually test these scenarios:
- [ ] Create new product with no variations
- [ ] Create new product with 1 tier variation
- [ ] Create new product with 2 tier variations
- [ ] Edit existing product
- [ ] Duplicate existing product
- [ ] Upload cover image
- [ ] Upload gallery images
- [ ] Upload tier 1 images
- [ ] Configure Shopee channel
- [ ] Configure TikTok channel
- [ ] Bulk apply price/stock

## Estimate
- 3-4 hours
