"use client";

import React, { useState, useEffect } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, AlertCircle, ChevronRight } from "lucide-react";
import { APP_SETTINGS } from "@/config/settings";
import { normalizeImageUrl } from "@/utils/imageUrl";
import { generateSkuCode } from "@/utils/skuHelper";

import ProductBasicInfo, { Category, AttributeFamily } from "./products/ProductBasicInfo";
import ProductTechSpecs, { Attribute } from "./products/ProductTechSpecs";
import ProductVariations from "./products/ProductVariations";
import ProductLogistics from "./products/ProductLogistics";
import ChannelConfig from "./products/ChannelConfig";

const API_BASE_URL = APP_SETTINGS.api.baseUrl;

// Zod validation schemas
const tierVariationSchema = z.object({
  tier_index: z.number().min(1).max(2),
  name: z.string().min(1, "Nhóm phân loại hàng không được trống"),
  options: z.array(z.string().min(1, "Phân loại không được trống")).min(1, "Tối thiểu 1 phân loại")
});

const variantSchema = z.object({
  tier_1_option: z.string().nullable(),
  tier_2_option: z.string().nullable(),
  sku_code: z.string().optional().nullable().or(z.literal("")),
  price: z.coerce.number().min(0, "Giá trị phải >= 0"),
  barcode: z.string().optional().nullable(),
  stock: z.coerce.number().min(0, "Kho hàng phải >= 0")
});

const productMediaSchema = z.object({
  image_url: z.string().url(),
  is_cover: z.boolean(),
  display_order: z.number().min(1).max(9),
  variant_tier_1_option: z.string().optional().nullable()
});

const productChannelAttributeValueSchema = z.object({
  attribute_mapping_id: z.number(),
  value_string: z.string().optional().nullable(),
  value_decimal: z.coerce.number().optional().nullable()
});

const variantChannelListingSchema = z.object({
  sku_code: z.string(),
  price_override: z.coerce.number().optional().nullable(),
  channel_variant_id: z.string().optional().nullable()
});

const productChannelListingSchema = z.object({
  channel_code: z.string(),
  status: z.enum(["Published", "Draft", "Hidden"]),
  title_override: z.string().optional().nullable(),
  description_override: z.string().optional().nullable(),
  shipping_config: z.any().optional().nullable(),
  channel_product_id: z.string().optional().nullable(),
  attribute_values: z.array(productChannelAttributeValueSchema).default([]),
  variant_overrides: z.array(variantChannelListingSchema).default([])
});

const productFormSchema = z.object({
  product_code: z.string().min(1, "Mã sản phẩm cha là bắt buộc"),
  name: z.string().min(5, "Tên sản phẩm phải từ 5 ký tự trở lên"),
  description: z.string().min(10, "Mô tả sản phẩm phải từ 10 ký tự trở lên"),
  category_id: z.coerce.number().min(1, "Vui lòng chọn ngành hàng"),
  family_id: z.coerce.number().min(1, "Vui lòng chọn bộ thuộc tính"),
  weight: z.coerce.number().min(1, "Cân nặng phải > 0"),
  length: z.coerce.number().optional().nullable(),
  width: z.coerce.number().optional().nullable(),
  height: z.coerce.number().optional().nullable(),
  hs_code: z.string().optional().nullable(),
  tax_code: z.string().optional().nullable(),
  is_pre_order: z.boolean().default(false),
  dts_days: z.coerce.number().min(7).max(30).optional().nullable(),
  status: z.enum(["Draft", "Published"]).default("Draft"),
  tier_variations: z.array(tierVariationSchema).max(2),
  variants: z.array(variantSchema).min(1),
  media: z.array(productMediaSchema),
  channel_listings: z.array(productChannelListingSchema).default([])
});

type ProductFormValues = z.infer<typeof productFormSchema>;

interface ProductFormProps {
  productId?: number | null;
  duplicateProductId?: number | null;
  onSaveSuccess?: () => void;
}

export default function ProductForm({ productId, duplicateProductId, onSaveSuccess }: ProductFormProps = {}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [families, setFamilies] = useState<AttributeFamily[]>([]);
  const [familyAttributes, setFamilyAttributes] = useState<Attribute[]>([]);
  const [attributeValues, setAttributeValues] = useState<Record<number, string>>({});
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [productImages, setProductImages] = useState<string[]>([]);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [tier1Images, setTier1Images] = useState<Record<string, string>>({}); // optionName -> imageUrl
  const [uploadingTier1, setUploadingTier1] = useState<Record<string, boolean>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"shopee" | "tiktok">("shopee");

  // Mass fill state
  const [bulkPrice, setBulkPrice] = useState<string>("");
  const [bulkStock, setBulkStock] = useState<string>("");

  const methods = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
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
    }
  });

  const { handleSubmit, watch, setValue, reset } = methods;

  const watchTiers = watch("tier_variations");
  const watchFamilyId = watch("family_id");
  const watchParentSku = watch("product_code");
  const watchVariants = watch("variants");

  // Fetch categories
  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE_URL}/categories`).then(res => res.json()),
      fetch(`${API_BASE_URL}/attribute-families`).then(res => res.json())
    ])
      .then(([categoryData, familyData]) => {
        setCategories(categoryData);
        setFamilies(familyData);
      })
      .catch(err => console.error("Error fetching lookup data:", err));
  }, []);

  useEffect(() => {
    if (!watchFamilyId || Number(watchFamilyId) <= 0) {
      setFamilyAttributes([]);
      return;
    }

    fetch(`${API_BASE_URL}/attribute-families/${watchFamilyId}/attributes`)
      .then(res => res.json())
      .then((data: Attribute[]) => {
        setFamilyAttributes(data);
        setAttributeValues(prev => {
          const allowedIds = new Set(data.map(attr => attr.id));
          const next: Record<number, string> = {};
          Object.entries(prev).forEach(([key, value]) => {
            const id = Number(key);
            if (allowedIds.has(id)) {
              next[id] = value;
            }
          });
          return next;
        });
      })
      .catch(err => {
        console.error("Error fetching family attributes:", err);
        setFamilyAttributes([]);
      });
  }, [watchFamilyId]);

  // Fetch product data if editing or copying
  const targetId = productId || duplicateProductId;
  useEffect(() => {
    if (!targetId) return;

    fetch(`${API_BASE_URL}/products/${targetId}`)
      .then(res => res.json())
      .then(data => {
        // Map Tier Variations
        const tiers = data.tier_variations.map((tv: any) => ({
          tier_index: tv.tier_index,
          name: tv.name,
          options: tv.options
        }));

        // Map Variants
        const variants = data.variants.map((v: any) => ({
          tier_1_option: v.tier_1_option,
          tier_2_option: v.tier_2_option,
          sku_code: duplicateProductId ? "" : v.sku_code,
          price: v.price,
          barcode: v.barcode || "",
          stock: v.stock
        }));

        const shopeeListing = data.channel_listings?.find((cl: any) => cl.channel_code === "shopee_vn") || {
          channel_code: "shopee_vn", status: "Draft", title_override: "", description_override: "", attribute_values: [], variant_overrides: []
        };
        const tiktokListing = data.channel_listings?.find((cl: any) => cl.channel_code === "tiktok_shop") || {
          channel_code: "tiktok_shop", status: "Draft", title_override: "", description_override: "", attribute_values: [], variant_overrides: []
        };

        reset({
          product_code: duplicateProductId ? "" : data.product_code,
          name: data.name,
          description: data.description || "",
          category_id: data.category_id || 0,
          family_id: data.family_id || 0,
          weight: data.weight,
          length: data.length,
          width: data.width,
          height: data.height,
          hs_code: data.hs_code || "",
          tax_code: data.tax_code || "",
          is_pre_order: data.is_pre_order,
          dts_days: data.dts_days,
          status: data.status,
          tier_variations: tiers,
          variants: variants,
          media: [],
          channel_listings: [
            {
              channel_code: "shopee_vn",
              status: shopeeListing.status || "Draft",
              title_override: shopeeListing.title_override || "",
              description_override: shopeeListing.description_override || "",
              channel_product_id: shopeeListing.channel_product_id || "",
              attribute_values: shopeeListing.attribute_values || [],
              variant_overrides: shopeeListing.variant_overrides || []
            },
            {
              channel_code: "tiktok_shop",
              status: tiktokListing.status || "Draft",
              title_override: tiktokListing.title_override || "",
              description_override: tiktokListing.description_override || "",
              channel_product_id: tiktokListing.channel_product_id || "",
              attribute_values: tiktokListing.attribute_values || [],
              variant_overrides: tiktokListing.variant_overrides || []
            }
          ]
        });

        const dynamicAttributeValues: Record<number, string> = {};
        (data.attribute_values || []).forEach((entry: any) => {
          const raw = entry.value_string ?? entry.value_decimal;
          if (raw !== null && raw !== undefined) {
            dynamicAttributeValues[entry.attribute_id] = String(raw);
          }
        });
        setAttributeValues(dynamicAttributeValues);

        // Map Media State
        const cover = data.media.find((m: any) => m.is_cover);
        if (cover) {
          setCoverImage(normalizeImageUrl(cover.image_url) || null);
        } else {
          setCoverImage(null);
        }

        const gallery = data.media
          .filter((m: any) => !m.is_cover && !m.variant_id)
          .sort((a: any, b: any) => a.display_order - b.display_order)
          .map((m: any) => normalizeImageUrl(m.image_url) || m.image_url);
        setProductImages(gallery);

        const tier1Imgs: Record<string, string> = {};
        data.media.forEach((m: any) => {
          if (m.variant_id) {
            const variant = data.variants.find((v: any) => v.id === m.variant_id);
            if (variant && variant.tier_1_option) {
              tier1Imgs[variant.tier_1_option] = normalizeImageUrl(m.image_url) || m.image_url;
            }
          }
        });
        setTier1Images(tier1Imgs);
      })
      .catch(err => {
        console.error("Error loading product data:", err);
        setSubmitError("Không thể tải thông tin sản phẩm.");
      });
  }, [targetId, duplicateProductId, reset]);

  const watchTiersJson = JSON.stringify(watchTiers);
  // Update variants combination matrix when tier variations configuration changes
  useEffect(() => {
    const parsedTiers = watchTiersJson ? JSON.parse(watchTiersJson) : [];
    const tier1 = parsedTiers?.[0];
    const tier2 = parsedTiers?.[1];

    const t1_options = Array.from(new Set(tier1?.options?.map((o: any) => String(o).trim()).filter((o: string) => o !== "") || [])) as string[];
    const t2_options = Array.from(new Set(tier2?.options?.map((o: any) => String(o).trim()).filter((o: string) => o !== "") || [])) as string[];

    // Keep map of existing variant values to avoid clearing inputs when adding/removing option characters
    const existingMap = new Map<string, { price: number; stock: number; sku_code: string; barcode: string }>();
    if (watchVariants) {
      watchVariants.forEach((v: any) => {
        const key = `${v.tier_1_option || ""}_${v.tier_2_option || ""}`;
        existingMap.set(key, { price: v.price, stock: v.stock, sku_code: v.sku_code, barcode: v.barcode || "" });
      });
    }

    let newVariants: ProductFormValues["variants"] = [];

    if (t1_options.length === 0) {
      // 0 Tiers
      const key = "_";
      const existing = existingMap.get(key);
      newVariants = [{
        tier_1_option: null,
        tier_2_option: null,
        sku_code: existing?.sku_code || "",
        barcode: existing?.barcode || "",
        price: existing?.price ?? 0,
        stock: existing?.stock ?? 0
      }];
    } else if (t2_options.length === 0) {
      // 1 Tier
      t1_options.forEach((opt1: string) => {
        const key = `${opt1}_`;
        const existing = existingMap.get(key);
        newVariants.push({
          tier_1_option: opt1,
          tier_2_option: null,
          sku_code: existing?.sku_code || "",
          barcode: existing?.barcode || "",
          price: existing?.price ?? 0,
          stock: existing?.stock ?? 0
        });
      });
    } else {
      // 2 Tiers
      t1_options.forEach((opt1: string) => {
        t2_options.forEach((opt2: string) => {
          const key = `${opt1}_${opt2}`;
          const existing = existingMap.get(key);
          newVariants.push({
            tier_1_option: opt1,
            tier_2_option: opt2,
            sku_code: existing?.sku_code || "",
            barcode: existing?.barcode || "",
            price: existing?.price ?? 0,
            stock: existing?.stock ?? 0
          });
        });
      });
    }

    // Set the state in hook form
    setValue("variants", newVariants);
  }, [watchTiersJson, watchParentSku, setValue]);

  // Submit Product Form
  const onSubmit = async (values: ProductFormValues) => {
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    // Build the Media payload
    const mediaPayload = [];

    // Add cover image if exists
    if (coverImage) {
      mediaPayload.push({
        image_url: coverImage,
        is_cover: true,
        display_order: 1,
        variant_tier_1_option: null
      });
    }

    productImages.forEach((url, index) => {
      mediaPayload.push({
        image_url: url,
        is_cover: false,
        display_order: index + 2,
        variant_tier_1_option: null
      });
    });

    // Add tier 1 options images if they exist
    Object.entries(tier1Images).forEach(([optionName, url], index) => {
      mediaPayload.push({
        image_url: url,
        is_cover: false,
        display_order: productImages.length + index + 2,
        variant_tier_1_option: optionName
      });
    });

    const updatedVariants = values.variants.map((v: any) => {
      if (!v.sku_code) {
        return {
          ...v,
          sku_code: generateSkuCode(values.product_code, v.tier_1_option, v.tier_2_option)
        };
      }
      return v;
    });

    const finalPayload = {
      ...values,
      variants: updatedVariants,
      channel_listings: values.channel_listings?.map((cl: any) => ({
        ...cl,
        variant_overrides: updatedVariants.map((v: any, idx: number) => {
          const existing = cl.variant_overrides?.find((vo: any) => vo.sku_code === v.sku_code) || cl.variant_overrides?.[idx];
          return {
            sku_code: v.sku_code,
            price_override: existing?.price_override || null,
            channel_variant_id: existing?.channel_variant_id || ""
          };
        })
      })) || [],
      media: mediaPayload,
      attributes: familyAttributes
        .map(attr => ({
          id: attr.id,
          value: (attributeValues[attr.id] || "").trim()
        }))
        .filter(attr => attr.value !== "")
    };

    try {
      const url = productId 
        ? `${API_BASE_URL}/products/${productId}` 
        : `${API_BASE_URL}/products`;
      const method = productId ? "PUT" : "POST";

      const res = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(finalPayload)
      });

      const data = await res.json();
      if (!res.ok) {
        let errMsg = `Đã xảy ra lỗi khi ${productId ? "cập nhật" : "tạo"} sản phẩm`;
        if (typeof data.detail === "string") {
            errMsg = data.detail;
        } else if (Array.isArray(data.detail)) {
            errMsg = data.detail.map((err: any) => `${err.loc?.join(".") || ""}: ${err.msg}`).join(", ");
        }
        throw new Error(errMsg);
      }

      setSubmitSuccess(true);
      if (onSaveSuccess) {
        setTimeout(() => {
          onSaveSuccess();
        }, 1000);
      }
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-10 px-4">
      {/* Title */}
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

      {submitSuccess && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-emerald-800">
          <Check className="h-5 w-5 mt-0.5 text-emerald-600 shrink-0" />
          <div>
            <h4 className="font-semibold text-emerald-900">Thành công!</h4>
            <p className="text-sm text-emerald-700 mt-0.5">Sản phẩm đã được lưu trữ thành công vào hệ thống database.</p>
          </div>
        </div>
      )}

      {submitError && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800">
          <AlertCircle className="h-5 w-5 mt-0.5 text-rose-600 shrink-0" />
          <div>
            <h4 className="font-semibold text-rose-900">Lỗi lưu trữ (ACID Rollback)</h4>
            <p className="text-sm text-rose-700 mt-0.5">{submitError}</p>
          </div>
        </div>
      )}

      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSubmit, (errors) => {
          console.error("Form validation errors", errors);
          const errorPaths: string[] = [];
          const extractErrors = (obj: any, path: string) => {
            if (obj && obj.message && typeof obj.message === 'string') {
              errorPaths.push(`${path}: ${obj.message}`);
            } else if (typeof obj === 'object' && obj !== null) {
              for (const key in obj) {
                if (key !== 'ref' && key !== 'type') {
                  extractErrors(obj[key], path ? `${path}.${key}` : key);
                }
              }
            }
          };
          extractErrors(errors, "");
          setSubmitError(`Lỗi điền form (chưa hợp lệ): ${errorPaths.join(" | ")}`);
        })} className="space-y-8">
          
          {/* SECTION 1: BASIC INFORMATION */}
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
          />

          {/* SECTION 2: TECHNICAL SPECS */}
          <ProductTechSpecs
            watchFamilyId={watchFamilyId}
            familyAttributes={familyAttributes}
            attributeValues={attributeValues}
            setAttributeValues={setAttributeValues}
          />

          {/* SECTION 3: SALES INFORMATION (VARIATIONS) */}
          <ProductVariations
            tier1Images={tier1Images}
            setTier1Images={setTier1Images}
            uploadingTier1={uploadingTier1}
            setUploadingTier1={setUploadingTier1}
            bulkPrice={bulkPrice}
            setBulkPrice={setBulkPrice}
            bulkStock={bulkStock}
            setBulkStock={setBulkStock}
          />

          {/* SECTION 4 & 5: LOGISTICS & SHIPPING & PRE-ORDER */}
          <ProductLogistics />

          {/* SECTION 6: SALES CHANNELS CONFIGURATIONS */}
          <div className="pim-card space-y-6">
            <h2 className="text-lg font-bold text-gray-900 border-b pb-3 border-gray-200">Cấu hình đa kênh bán hàng</h2>
            
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                <button
                  type="button"
                  onClick={() => setActiveTab("shopee")}
                  className={`border-b-2 py-4 px-1 text-sm font-semibold transition-all ${
                    activeTab === "shopee"
                      ? "border-brand-primary text-brand-primary font-bold"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }`}
                >
                  Cấu hình Shopee
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("tiktok")}
                  className={`border-b-2 py-4 px-1 text-sm font-semibold transition-all ${
                    activeTab === "tiktok"
                      ? "border-brand-primary text-brand-primary font-bold"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }`}
                >
                  Cấu hình TikTok Shop
                </button>
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

          {/* SUBMIT BUTTON */}
          <div className="flex justify-end gap-4">
            <button 
              type="button"
              onClick={onSaveSuccess}
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

        </form>
      </FormProvider>
    </div>
  );
}
