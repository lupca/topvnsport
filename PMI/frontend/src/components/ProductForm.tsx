"use client";

import React, { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, AlertCircle, ChevronRight, FileText, Eye } from "lucide-react";

import ProductBasicInfo from "./products/ProductBasicInfo";
import ProductTechSpecs from "./products/ProductTechSpecs";
import ProductVariations from "./products/ProductVariations";
import ProductLogistics from "./products/ProductLogistics";
import ChannelConfig from "./products/ChannelConfig";
import { ProductFormSidebar } from "./products/ProductFormSidebar";
import { ErrorSummary } from "./products/ErrorSummary";

import { productFormSchema, ProductFormValues } from "../validations/productSchema";

// Import custom hooks
import { useProductFormData } from "../hooks/useProductFormData";
import { useProductLoad } from "../hooks/useProductLoad";
import { useVariantMatrix } from "../hooks/useVariantMatrix";
import { useMediaUpload } from "../hooks/useMediaUpload";
import { useProductSubmit } from "../hooks/useProductSubmit";
import { useFormCompletion } from "../hooks/useFormCompletion";
import { useScrollNavigation } from "../hooks/useScrollNavigation";
import { useFormValidationUX } from "../hooks/useFormValidationUX";

// --- Helper Functions ---

export function getDefaultValues(): ProductFormValues {
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
    variants: [{ tier_1_option: null, tier_2_option: null, sku_code: "", barcode: "", price: 0 }],
    media: [],
    channel_listings: [
      { channel_code: "shopee_vn", status: "Draft", title_override: "", description_override: "", attribute_values: [], variant_overrides: [] },
      { channel_code: "tiktok_shop", status: "Draft", title_override: "", description_override: "", attribute_values: [], variant_overrides: [] }
    ]
  };
}

export function extractErrorPaths(errors: any): string[] {
  const errorPaths: string[] = [];
  const extractErrors = (obj: any, path: string) => {
    if (obj && obj.message && typeof obj.message === "string") {
      errorPaths.push(`${path}: ${obj.message}`);
    } else if (typeof obj === "object" && obj !== null) {
      for (const key in obj) {
        if (key !== "ref" && key !== "type") {
          extractErrors(obj[key], path ? `${path}.${key}` : key);
        }
      }
    }
  };
  extractErrors(errors, "");
  return errorPaths;
}

// --- Helper Components ---

interface FormHeaderProps {
  productId?: number | null;
  duplicateProductId?: number | null;
}

export function FormHeader({ productId, duplicateProductId }: FormHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 flex items-center gap-2">
          {productId ? "Cập Nhật Sản Phẩm" : duplicateProductId ? "Sao Chép Sản Phẩm" : "Thêm Sản Phẩm Mới"}
        </h1>
        <p className="text-gray-500 mt-1">
          {productId ? "Chỉnh sửa thông tin chi tiết của sản phẩm" : duplicateProductId ? "Tạo sản phẩm mới bằng cách sao chép thông tin" : "Đăng tải sản phẩm mới lên hệ thống Shopee PIM"}
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

interface SuccessMessageProps {
  message?: string;
}

export function SuccessMessage({ message = "Sản phẩm đã được lưu trữ thành công vào hệ thống database." }: SuccessMessageProps) {
  return (
    <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-emerald-800">
      <Check className="h-5 w-5 mt-0.5 text-emerald-600 shrink-0" />
      <div>
        <h4 className="font-semibold text-emerald-900">Thành công!</h4>
        <p className="text-sm text-emerald-700 mt-0.5">{message}</p>
      </div>
    </div>
  );
}

interface ErrorMessageProps {
  error: string;
}

export function ErrorMessage({ error }: ErrorMessageProps) {
  return (
    <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800">
      <AlertCircle className="h-5 w-5 mt-0.5 text-rose-600 shrink-0" />
      <div>
        <h4 className="font-semibold text-rose-900">Lỗi lưu trữ (ACID Rollback)</h4>
        <p className="text-sm text-rose-700 mt-0.5">{error}</p>
      </div>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
}

export function TabButton({ active, onClick, label }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 py-4 px-1 text-sm font-semibold transition-all ${
        active
          ? "border-brand-primary text-brand-primary font-bold"
          : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
      }`}
    >
      {label}
    </button>
  );
}

interface ChannelConfigSectionProps {
  activeTab: "shopee" | "tiktok";
  setActiveTab: (tab: "shopee" | "tiktok") => void;
}

export function ChannelConfigSection({ activeTab, setActiveTab }: ChannelConfigSectionProps) {
  return (
    <div className="pim-card space-y-6">
      <h2 className="text-lg font-bold text-gray-900 border-b pb-3 border-gray-200">Cấu hình đa kênh bán hàng</h2>
      
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <TabButton
            active={activeTab === "shopee"}
            onClick={() => setActiveTab("shopee")}
            label="Cấu hình Shopee"
          />
          <TabButton
            active={activeTab === "tiktok"}
            onClick={() => setActiveTab("tiktok")}
            label="Cấu hình TikTok Shop"
          />
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

interface FormFooterProps {
  submitting: boolean;
  productId?: number | null;
  onSaveDraft: () => void;
  onSavePublish: () => void;
  onCancel: () => void;
}

export function FormFooter({ submitting, productId, onSaveDraft, onSavePublish, onCancel }: FormFooterProps) {
  return (
    <div className="flex justify-end gap-4 mt-8">
      <button 
        type="button"
        onClick={onCancel}
        className="btn-outline px-6 py-3 rounded-2xl text-sm"
      >
        Hủy bỏ
      </button>
      <button 
        type="button"
        onClick={onSaveDraft}
        disabled={submitting}
        className="btn-outline px-6 py-3 rounded-2xl text-sm flex items-center gap-2"
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
        Lưu nháp
      </button>
      <button 
        type="button"
        onClick={onSavePublish}
        disabled={submitting}
        className="btn-primary px-8 py-3 rounded-2xl text-sm shadow-sm flex items-center gap-2"
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
        {productId ? "Cập nhật & Hiển thị" : "Lưu & Hiển thị"}
      </button>
    </div>
  );
}

// --- Main Component ---

interface ProductFormProps {
  productId?: number | null;
  duplicateProductId?: number | null;
  onSaveSuccess?: () => void;
}

export default function ProductForm({ productId, duplicateProductId, onSaveSuccess }: ProductFormProps = {}) {
  const [attributeValues, setAttributeValues] = useState<Record<number, string>>({});
  const [activeTab, setActiveTab] = useState<"shopee" | "tiktok">("shopee");
  const [manuallyEditedSkus, setManuallyEditedSkus] = useState<Set<string>>(new Set());
  const [productCodeManuallyEdited, setProductCodeManuallyEdited] = useState<boolean>(false);

  // Mass fill state
  const [bulkPrice, setBulkPrice] = useState<string>("");

  const methods = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: getDefaultValues()
  });

  const { handleSubmit: rhfHandleSubmit, watch, setValue, reset, formState: { errors, isSubmitted } } = methods;

  const watchFamilyId = watch("family_id");

  // Hook 1: Form Data (lookup categories, families, attributes)
  const {
    categories,
    families,
    familyAttributes,
    optionsLoaded
  } = useProductFormData(watchFamilyId, setAttributeValues);

  // Hook 4: Media Upload
  const {
    coverImage,
    setCoverImage,
    uploadingCover,
    setUploadingCover,
    productImages,
    setProductImages,
    uploadingGallery,
    setUploadingGallery,
    tier1Images,
    setTier1Images,
    uploadingTier1,
    setUploadingTier1
  } = useMediaUpload();

  const { activeSection, scrollToSection } = useScrollNavigation();
  const completionPercent = useFormCompletion({ watch, coverImage, productImages });
  const { getSectionErrorCounts, getErrorSummary, hasErrors } = useFormValidationUX({ errors, isSubmitted });

  // Hook 5: Product Submit
  const {
    submitting,
    submitError,
    setSubmitError,
    submitSuccess,
    handleSubmit
  } = useProductSubmit({
    productId,
    coverImage,
    productImages,
    tier1Images,
    familyAttributes,
    attributeValues,
    onSuccess: onSaveSuccess
  });

  // Hook 2: Product Load
  useProductLoad({
    productId,
    duplicateProductId,
    optionsLoaded,
    reset,
    setSubmitError,
    setAttributeValues,
    setCoverImage,
    setProductImages,
    setTier1Images,
    onLoadExistingSkus: setManuallyEditedSkus,
    onLoadExistingProductCode: setProductCodeManuallyEdited
  });

  // Hook 3: Variant combination matrix
  useVariantMatrix({
    watch,
    setValue,
    manuallyEditedSkus
  });



  const onSubmit = async (values: ProductFormValues) => {
    await handleSubmit(values);
  };

  const onError = (errors: any) => {
    console.error("Form validation errors", errors);
    const errorPaths = extractErrorPaths(errors);
    setSubmitError(`Lỗi điền form (chưa hợp lệ): ${errorPaths.join(" | ")}`);
  };

  const handleSaveDraft = () => {
    setValue('status', 'Draft');
    rhfHandleSubmit(onSubmit, onError)();
  };

  const handleSavePublish = () => {
    setValue('status', 'Published');
    rhfHandleSubmit(onSubmit, onError)();
  };

  const handleCancel = () => {
    if (onSaveSuccess) {
      onSaveSuccess();
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-10 px-4">
      <FormHeader productId={productId} duplicateProductId={duplicateProductId} />

      {isSubmitted && hasErrors && (
        <ErrorSummary 
          errors={getErrorSummary()} 
          totalCount={Object.values(getSectionErrorCounts()).reduce((a, b) => a + b, 0)}
        />
      )}

      {submitSuccess && <SuccessMessage />}

      {submitError && <ErrorMessage error={submitError} />}

      <div className="flex gap-6">
        {/* Sidebar */}
        <ProductFormSidebar
          activeSection={activeSection}
          onSectionClick={scrollToSection}
          completionPercent={completionPercent}
          sectionErrors={getSectionErrorCounts()}
        />

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <FormProvider {...methods}>
            <form onSubmit={(e) => e.preventDefault()} className="space-y-8">
              
              {/* SECTION 1: BASIC INFORMATION */}
              <div id="section-basic">
                <ProductBasicInfo
                  categories={categories}
                  families={families}
                  coverImage={coverImage}
                  setCoverImage={setCoverImage}
                  productImages={productImages}
                  setProductImages={setProductImages}
                  uploadingCover={uploadingCover}
                  setUploadingCover={setUploadingCover}
                  uploadingGallery={uploadingGallery}
                  setUploadingGallery={setUploadingGallery}
                  productCodeManuallyEdited={productCodeManuallyEdited}
                  setProductCodeManuallyEdited={setProductCodeManuallyEdited}
                />
              </div>

              {/* SECTION 2: TECHNICAL SPECS */}
              <div id="section-specs">
                <ProductTechSpecs
                  watchFamilyId={watchFamilyId}
                  familyAttributes={familyAttributes}
                  attributeValues={attributeValues}
                  setAttributeValues={setAttributeValues}
                />
              </div>

              {/* SECTION 3: SALES INFORMATION (VARIATIONS) */}
              <div id="section-sales">
                <ProductVariations
                  tier1Images={tier1Images}
                  setTier1Images={setTier1Images}
                  uploadingTier1={uploadingTier1}
                  setUploadingTier1={setUploadingTier1}
                  bulkPrice={bulkPrice}
                  setBulkPrice={setBulkPrice}
                  manuallyEditedSkus={manuallyEditedSkus}
                  setManuallyEditedSkus={setManuallyEditedSkus}
                />
              </div>

              {/* SECTION 4: LOGISTICS & SHIPPING */}
              <div id="section-logistics">
                <ProductLogistics showLogisticsOnly />
              </div>

              {/* SECTION 5: PRE-ORDER */}
              <div id="section-other">
                <ProductLogistics showOtherOnly />
              </div>

              {/* SECTION 6: SALES CHANNELS CONFIGURATIONS */}
              <div id="section-channels">
                <ChannelConfigSection activeTab={activeTab} setActiveTab={setActiveTab} />
              </div>

              {/* SUBMIT BUTTON */}
              <FormFooter 
                submitting={submitting} 
                productId={productId} 
                onSaveDraft={handleSaveDraft}
                onSavePublish={handleSavePublish}
                onCancel={handleCancel}
              />

            </form>
          </FormProvider>
        </div>
      </div>
    </div>
  );
}
