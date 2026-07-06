"use client";

import React, { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Plus, Trash, Upload, Check, Loader2, 
  HelpCircle, AlertCircle, Sparkles, Image as ImageIcon, ChevronRight 
} from "lucide-react";
import { APP_SETTINGS } from "@/config/settings";
import { popupService } from "@/components/ui/popupService";
import { normalizeImageUrl } from "@/utils/imageUrl";

const API_BASE_URL = APP_SETTINGS.api.baseUrl;

// Interface definitions
interface Category {
  id: number;
  parent_id: number | null;
  name: string;
  code: string;
}

interface AttributeFamily {
  id: number;
  code: string;
  name: string;
}

interface Attribute {
  id: number;
  code: string;
  name: string;
  type: string;
  is_required: boolean;
}

// Zod schemas
const tierVariationSchema = z.object({
  tier_index: z.number().min(1).max(2),
  name: z.string().min(1, "Nhóm phân loại hàng không được trống"),
  options: z.array(z.string().min(1, "Phân loại không được trống")).min(1, "Tối thiểu 1 phân loại")
});

const variantSchema = z.object({
  tier_1_option: z.string().nullable(),
  tier_2_option: z.string().nullable(),
  sku_code: z.string().min(1, "SKU không được để trống"),
  price: z.coerce.number().min(0, "Giá trị phải >= 0"),
  stock: z.coerce.number().min(0, "Kho hàng phải >= 0")
});

const productMediaSchema = z.object({
  image_url: z.string().url(),
  is_cover: z.boolean(),
  display_order: z.number().min(1).max(9),
  variant_tier_1_option: z.string().optional().nullable()
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
  is_pre_order: z.boolean().default(false),
  dts_days: z.coerce.number().min(7).max(30).optional().nullable(),
  status: z.enum(["Draft", "Published"]).default("Draft"),
  tier_variations: z.array(tierVariationSchema).max(2),
  variants: z.array(variantSchema).min(1),
  media: z.array(productMediaSchema)
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

  // Mass fill state
  const [bulkPrice, setBulkPrice] = useState<string>("");
  const [bulkStock, setBulkStock] = useState<string>("");

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors }
  } = useForm<ProductFormValues>({
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
      is_pre_order: false,
      dts_days: 7,
      status: "Draft",
      tier_variations: [],
      variants: [{ tier_1_option: null, tier_2_option: null, sku_code: "", price: 0, stock: 0 }],
      media: []
    }
  });

  const { fields: tierFields, append: appendTier, remove: removeTier } = useFieldArray({
    control,
    name: "tier_variations"
  });

  const watchTiers = watch("tier_variations");
  const watchFamilyId = watch("family_id");
  const watchParentSku = watch("product_code");
  const watchIsPreOrder = watch("is_pre_order");
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
          stock: v.stock
        }));

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
          is_pre_order: data.is_pre_order,
          dts_days: data.dts_days,
          status: data.status,
          tier_variations: tiers,
          variants: variants,
          media: []
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

  // Update variants combination matrix when tier variations configuration changes
  useEffect(() => {
    const tier1 = watchTiers?.[0];
    const tier2 = watchTiers?.[1];

    const t1_options = tier1?.options?.filter(o => o.trim() !== "") || [];
    const t2_options = tier2?.options?.filter(o => o.trim() !== "") || [];

    // Keep map of existing variant values to avoid clearing inputs when adding/removing option characters
    const existingMap = new Map<string, { price: number; stock: number; sku_code: string }>();
    if (watchVariants) {
      watchVariants.forEach(v => {
        const key = `${v.tier_1_option || ""}_${v.tier_2_option || ""}`;
        existingMap.set(key, { price: v.price, stock: v.stock, sku_code: v.sku_code });
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
        sku_code: existing?.sku_code || (watchParentSku ? watchParentSku : ""),
        price: existing?.price ?? 0,
        stock: existing?.stock ?? 0
      }];
    } else if (t2_options.length === 0) {
      // 1 Tier
      t1_options.forEach(opt1 => {
        const key = `${opt1}_`;
        const existing = existingMap.get(key);
        newVariants.push({
          tier_1_option: opt1,
          tier_2_option: null,
          sku_code: existing?.sku_code || (watchParentSku ? `${watchParentSku}-${opt1.replace(/\s+/g, "")}` : ""),
          price: existing?.price ?? 0,
          stock: existing?.stock ?? 0
        });
      });
    } else {
      // 2 Tiers
      t1_options.forEach(opt1 => {
        t2_options.forEach(opt2 => {
          const key = `${opt1}_${opt2}`;
          const existing = existingMap.get(key);
          newVariants.push({
            tier_1_option: opt1,
            tier_2_option: opt2,
            sku_code: existing?.sku_code || (watchParentSku ? `${watchParentSku}-${opt1.replace(/\s+/g, "")}-${opt2.replace(/\s+/g, "")}` : ""),
            price: existing?.price ?? 0,
            stock: existing?.stock ?? 0
          });
        });
      });
    }

    // Set the state in hook form
    setValue("variants", newVariants);
  }, [watchTiers, watchParentSku, setValue]);

  // Handle image upload to MinIO
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCover(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE_URL}/upload`, {
        method: "POST",
        body: formData
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setCoverImage(normalizeImageUrl(data.image_url) || data.image_url);
    } catch (err) {
      console.error(err);
      void popupService.alert("Không thể tải lên ảnh bìa");
    } finally {
      setUploadingCover(false);
    }
  };

  const handleTier1ImageUpload = async (optionName: string, file: File) => {
    setUploadingTier1(prev => ({ ...prev, [optionName]: true }));
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE_URL}/upload`, {
        method: "POST",
        body: formData
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setTier1Images(prev => ({ ...prev, [optionName]: normalizeImageUrl(data.image_url) || data.image_url }));
    } catch (err) {
      console.error(err);
      void popupService.alert(`Không thể tải lên ảnh cho phân loại ${optionName}`);
    } finally {
      setUploadingTier1(prev => ({ ...prev, [optionName]: false }));
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 8 - productImages.length;
    if (remainingSlots <= 0) {
      void popupService.alert("Đã đạt giới hạn tối đa 8 ảnh phụ.");
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    setUploadingGallery(true);

    try {
      const newUrls: string[] = [];
      for (const file of filesToUpload) {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(`${API_BASE_URL}/upload`, {
          method: "POST",
          body: formData
        });
        if (!res.ok) throw new Error("Upload failed");

        const data = await res.json();
        newUrls.push(normalizeImageUrl(data.image_url) || data.image_url);
      }

      setProductImages(prev => [...prev, ...newUrls]);
    } catch (err) {
      console.error(err);
      void popupService.alert("Tải lên ảnh phụ thất bại.");
    } finally {
      setUploadingGallery(false);
      e.target.value = "";
    }
  };

  const removeGalleryImage = (indexToRemove: number) => {
    setProductImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Mass Apply values (Price, Stock, and auto-generated SKUs)
  const handleMassApply = () => {
    if (!watchVariants) return;

    const price = parseFloat(bulkPrice);
    const stock = parseInt(bulkStock);

    const updated = watchVariants.map(v => {
      const val: typeof v = { ...v };
      if (!isNaN(price)) val.price = price;
      if (!isNaN(stock)) val.stock = stock;
      
      // Auto-regenerate SKU if empty or currently matching old parent SKU
      if (watchParentSku) {
        let suffix = "";
        if (v.tier_1_option) suffix += `-${v.tier_1_option.replace(/\s+/g, "")}`;
        if (v.tier_2_option) suffix += `-${v.tier_2_option.replace(/\s+/g, "")}`;
        val.sku_code = `${watchParentSku}${suffix}`;
      }
      return val;
    });

    setValue("variants", updated);
  };

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

    const finalPayload = {
      ...values,
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
        throw new Error(data.detail || `Đã xảy ra lỗi khi ${productId ? "cập nhật" : "tạo"} sản phẩm`);
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
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            {productId ? "Cập Nhật Sản Phẩm" : duplicateProductId ? "Sao Chép Sản Phẩm" : "Thêm Sản Phẩm Mới"} <Sparkles className="h-6 w-6 text-primary-500 fill-primary-100" />
          </h1>
          <p className="text-slate-400 mt-1">
            {productId ? "Chỉnh sửa thông tin chi tiết của sản phẩm" : duplicateProductId ? "Tạo sản phẩm mới bằng cách sao chép thông tin" : "Đăng tải sản phẩm mới lên hệ thống Shopee PIM"}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span>Kênh Người Bán</span>
          <ChevronRight className="h-4 w-4" />
          <span className="font-semibold text-primary-600">Quản lý Sản Phẩm</span>
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

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        
        {/* SECTION 1: BASIC INFORMATION */}
        <div className="bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-800 space-y-6">
          <h2 className="text-lg font-bold text-slate-900 border-b pb-3 border-slate-800">Thông tin cơ bản</h2>
          
          {/* Product Image Upload */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-200">Hình ảnh sản phẩm (Tối đa 9 ảnh chung)</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-9 gap-4 items-end">
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-slate-400 font-semibold">Ảnh bìa</span>
                <div className="relative h-24 w-24 border-2 border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center bg-slate-950 overflow-hidden group hover:border-primary-400 transition-colors">
                  {coverImage ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={coverImage} alt="Cover" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setCoverImage(null)}
                        className="absolute inset-0 bg-black/55 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-semibold"
                      >
                        Thay đổi
                      </button>
                    </>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center justify-center h-full w-full">
                      {uploadingCover ? (
                        <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
                      ) : (
                        <>
                          <ImageIcon className="h-6 w-6 text-slate-400" />
                          <span className="text-[9px] text-slate-400 mt-1 font-medium">Tải ảnh bìa</span>
                        </>
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                    </label>
                  )}
                </div>
              </div>

              {productImages.map((url, idx) => (
                <div key={idx} className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-slate-400 font-semibold">Ảnh phụ {idx + 1}</span>
                  <div className="relative h-24 w-24 border border-slate-700 rounded-2xl overflow-hidden group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Gallery ${idx + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeGalleryImage(idx)}
                      className="absolute inset-0 bg-black/55 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-semibold"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              ))}

              {productImages.length < 8 && (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-slate-400 font-semibold">Thêm ảnh</span>
                  <label className="h-24 w-24 border-2 border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center bg-slate-950 hover:bg-slate-800/50 cursor-pointer hover:border-primary-400 transition-colors">
                    {uploadingGallery ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary-500" />
                    ) : (
                      <>
                        <Plus className="h-5 w-5 text-slate-400" />
                        <span className="text-[9px] text-slate-400 mt-1 font-medium">Tải ảnh phụ</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleGalleryUpload}
                    />
                  </label>
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Khuyên dùng hình ảnh kích thước 800 x 800 trở lên. Bạn có thể tải lên tối đa 1 ảnh bìa và 8 ảnh phụ.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-200">Tên sản phẩm *</label>
              <input 
                type="text" 
                placeholder="Nhập tên sản phẩm (Ví dụ: Áo thun nam Cotton 100% cổ tròn)"
                className="w-full bg-slate-950 px-4 py-3 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                {...register("name")}
              />
              {errors.name && <p className="text-xs text-rose-500 font-medium">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-200">Mã SKU sản phẩm cha *</label>
                <input 
                  type="text" 
                  placeholder="Ví dụ: TSHIRT-PARENT"
                  className="w-full bg-slate-950 px-4 py-3 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  {...register("product_code")}
                />
                {errors.product_code && <p className="text-xs text-rose-500 font-medium">{errors.product_code.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-200">Ngành hàng *</label>
                <select 
                  className="w-full bg-slate-950 px-4 py-3 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-slate-900 transition-all"
                  {...register("category_id")}
                >
                  <option value={0}>Chọn ngành hàng</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.code})
                    </option>
                  ))}
                </select>
                {errors.category_id && <p className="text-xs text-rose-500 font-medium">{errors.category_id.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-200">Attribute Family *</label>
                <select
                  className="w-full bg-slate-950 px-4 py-3 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-slate-900 transition-all"
                  {...register("family_id")}
                >
                  <option value={0}>Chọn bộ thuộc tính</option>
                  {families.map(fam => (
                    <option key={fam.id} value={fam.id}>
                      {fam.name} ({fam.code})
                    </option>
                  ))}
                </select>
                {errors.family_id && <p className="text-xs text-rose-500 font-medium">{errors.family_id.message}</p>}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-200">Mô tả sản phẩm *</label>
            <textarea 
              rows={4}
              placeholder="Mô tả thông tin chi tiết về sản phẩm của bạn (chất liệu, công dụng, thông số kỹ thuật...)"
              className="w-full bg-slate-950 px-4 py-3 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              {...register("description")}
            />
            {errors.description && <p className="text-xs text-rose-500 font-medium">{errors.description.message}</p>}
          </div>
        </div>

        {/* SECTION 2: TECHNICAL SPECS (DYNAMIC BY FAMILY) */}
        <div className="bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-800 space-y-6">
          <h2 className="text-lg font-bold text-slate-900 border-b pb-3 border-slate-800">Thuộc tính kỹ thuật</h2>

          {!watchFamilyId || Number(watchFamilyId) <= 0 ? (
            <p className="text-sm text-slate-400">Chọn Attribute Family để tải danh sách thông số kỹ thuật phù hợp.</p>
          ) : familyAttributes.length === 0 ? (
            <p className="text-sm text-slate-400">Family hiện tại chưa có thuộc tính nào được gán.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {familyAttributes.map(attr => (
                <div key={attr.id} className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-200">
                    {attr.name}{attr.is_required ? " *" : ""}
                  </label>
                  <input
                    type={attr.type === "decimal" || attr.type === "number" || attr.type === "float" ? "number" : "text"}
                    step={attr.type === "decimal" || attr.type === "number" || attr.type === "float" ? "any" : undefined}
                    placeholder={`Nhập ${attr.name.toLowerCase()}`}
                    value={attributeValues[attr.id] || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      setAttributeValues(prev => ({ ...prev, [attr.id]: value }));
                    }}
                    className="w-full bg-slate-950 px-4 py-3 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  />
                  <p className="text-[11px] text-slate-400">Code: {attr.code}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION 3: SALES INFORMATION (VARIATIONS) */}
        <div className="bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-800 space-y-6">
          <div className="flex items-center justify-between border-b pb-3 border-slate-800">
            <h2 className="text-lg font-bold text-slate-900">Thông tin bán hàng</h2>
            <div className="text-xs text-slate-400 flex items-center gap-1">
              <HelpCircle className="h-4 w-4" />
              <span>Hỗ trợ tối đa 2 nhóm phân loại</span>
            </div>
          </div>

          {/* Tier Variation Creation UI */}
          <div className="space-y-6">
            {tierFields.map((field, tierIndex) => (
              <div key={field.id} className="p-6 bg-slate-950/50 border border-slate-800 rounded-2xl space-y-4 relative">
                <button 
                  type="button" 
                  onClick={() => removeTier(tierIndex)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-rose-500 transition-colors"
                >
                  <Trash className="h-5 w-5" />
                </button>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-300">Tên nhóm phân loại {tierIndex + 1}</label>
                    <input 
                      type="text" 
                      placeholder={tierIndex === 0 ? "Ví dụ: Màu sắc" : "Ví dụ: Kích cỡ"}
                      className="w-full bg-slate-950 px-4 py-2 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      {...register(`tier_variations.${tierIndex}.name` as const)}
                    />
                    {errors.tier_variations?.[tierIndex]?.name && (
                      <p className="text-xs text-rose-500 font-medium">{errors.tier_variations[tierIndex]?.name?.message}</p>
                    )}
                  </div>
                  
                  {/* Options Input list (comma separated or tag-based, let's use dynamic options inside a single text field or an array) */}
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-sm font-semibold text-slate-300">Phân loại hàng (Các tùy chọn, cách nhau bằng dấu phẩy)</label>
                    <input 
                      type="text" 
                      placeholder={tierIndex === 0 ? "Đỏ, Xanh, Vàng" : "M, L, XL"}
                      className="w-full bg-slate-950 px-4 py-2 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      onChange={(e) => {
                        const val = e.target.value;
                        const opts = val.split(",").map(s => s.trim()).filter(s => s !== "");
                        setValue(`tier_variations.${tierIndex}.options` as const, opts, { shouldValidate: true });
                        setValue(`tier_variations.${tierIndex}.tier_index` as const, tierIndex + 1);
                      }}
                      defaultValue={watchTiers?.[tierIndex]?.options?.join(", ")}
                    />
                    {errors.tier_variations?.[tierIndex]?.options && (
                      <p className="text-xs text-rose-500 font-medium">{errors.tier_variations[tierIndex]?.options?.message}</p>
                    )}
                  </div>
                </div>

                {/* Tier 1 specific option media uploads */}
                {tierIndex === 0 && watchTiers?.[0]?.options && watchTiers[0].options.length > 0 && (
                  <div className="pt-4 border-t border-slate-800">
                    <label className="block text-xs font-semibold text-slate-400 mb-2">Hình ảnh cho phân loại thứ 1</label>
                    <div className="flex flex-wrap gap-4">
                      {watchTiers[0].options.map((opt) => (
                        <div key={opt} className="flex flex-col items-center gap-1.5 p-3 bg-slate-900 border border-slate-800 rounded-xl">
                          <span className="text-xs text-slate-300 font-medium max-w-[80px] truncate">{opt}</span>
                          <div className="relative h-14 w-14 border border-dashed border-slate-700 rounded-lg flex items-center justify-center bg-slate-950/50 overflow-hidden hover:border-primary-400 cursor-pointer">
                            {tier1Images[opt] ? (
                              <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={tier1Images[opt]} alt={opt} className="h-full w-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => setTier1Images(prev => {
                                    const next = { ...prev };
                                    delete next[opt];
                                    return next;
                                  })}
                                  className="absolute inset-0 bg-black/55 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity text-[8px] font-bold"
                                >
                                  Xóa
                                </button>
                              </>
                            ) : (
                              <label className="h-full w-full flex items-center justify-center cursor-pointer">
                                {uploadingTier1[opt] ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-primary-500" />
                                ) : (
                                  <Upload className="h-4 w-4 text-slate-400" />
                                )}
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleTier1ImageUpload(opt, file);
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {tierFields.length < 2 && (
              <button 
                type="button" 
                onClick={() => appendTier({ tier_index: tierFields.length + 1, name: "", options: [] })}
                className="w-full py-3 border-2 border-dashed border-slate-700 rounded-2xl flex items-center justify-center gap-2 text-slate-400 hover:text-primary-500 hover:border-primary-300 hover:bg-primary-50/10 transition-all font-semibold"
              >
                <Plus className="h-5 w-5" /> Thêm nhóm phân loại hàng
              </button>
            )}
          </div>

          {/* Mass Edit / Apply to all Row */}
          {watchVariants && watchVariants.length > 0 && (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-wrap gap-4 items-end justify-between">
              <div className="flex flex-wrap gap-4 items-center">
                <span className="text-sm font-bold text-slate-200">Áp dụng hàng loạt:</span>
                <div className="w-32">
                  <input 
                    type="number" 
                    placeholder="Giá"
                    className="w-full px-3 py-2 bg-slate-900 text-sm rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    value={bulkPrice}
                    onChange={(e) => setBulkPrice(e.target.value)}
                  />
                </div>
                <div className="w-32">
                  <input 
                    type="number" 
                    placeholder="Kho hàng"
                    className="w-full px-3 py-2 bg-slate-900 text-sm rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    value={bulkStock}
                    onChange={(e) => setBulkStock(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleMassApply}
                  className="px-4 py-2 bg-primary-50 text-primary-600 border border-primary-100 rounded-xl hover:bg-primary-100 font-semibold text-sm transition-colors"
                >
                  Áp dụng cho tất cả
                </button>
              </div>
              <span className="text-xs text-slate-400">Tự động cấu hình SKU dựa trên SKU cha</span>
            </div>
          )}

          {/* Variations Table / Matrix */}
          <div className="overflow-x-auto border border-slate-800 rounded-2xl">
            <table className="w-full border-collapse text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-xs font-bold uppercase text-slate-200 border-b border-slate-800">
                <tr>
                  {watchTiers?.[0]?.name && <th className="px-6 py-4">{watchTiers[0].name}</th>}
                  {watchTiers?.[1]?.name && <th className="px-6 py-4">{watchTiers[1].name}</th>}
                  <th className="px-6 py-4">Mã SKU phân loại *</th>
                  <th className="px-6 py-4">Giá bán *</th>
                  <th className="px-6 py-4">Kho hàng *</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {watchVariants?.map((v, idx) => (
                  <tr key={idx} className="hover:bg-slate-950/50 transition-colors">
                    {v.tier_1_option !== null && (
                      <td className="px-6 py-4 font-semibold text-slate-900">{v.tier_1_option}</td>
                    )}
                    {v.tier_2_option !== null && (
                      <td className="px-6 py-4 text-slate-400">{v.tier_2_option}</td>
                    )}
                    <td className="px-6 py-3">
                      <input 
                        type="text" 
                        className="px-3 py-1.5 border border-slate-700 rounded-lg w-full focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                        {...register(`variants.${idx}.sku_code` as const)}
                      />
                      {errors.variants?.[idx]?.sku_code && (
                        <p className="text-[10px] text-rose-500 mt-0.5">{errors.variants[idx]?.sku_code?.message}</p>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₫</span>
                        <input 
                          type="number" 
                          className="pl-6 pr-3 py-1.5 border border-slate-700 rounded-lg w-32 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                          {...register(`variants.${idx}.price` as const)}
                        />
                      </div>
                      {errors.variants?.[idx]?.price && (
                        <p className="text-[10px] text-rose-500 mt-0.5">{errors.variants[idx]?.price?.message}</p>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <input 
                        type="number" 
                        className="px-3 py-1.5 border border-slate-700 rounded-lg w-24 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                        {...register(`variants.${idx}.stock` as const)}
                      />
                      {errors.variants?.[idx]?.stock && (
                        <p className="text-[10px] text-rose-500 mt-0.5">{errors.variants[idx]?.stock?.message}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 4: LOGISTICS & SHIPPING */}
        <div className="bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-800 space-y-6">
          <h2 className="text-lg font-bold text-slate-900 border-b pb-3 border-slate-800">Vận chuyển & Logistics</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-200">Cân nặng (sau đóng gói) *</label>
              <div className="relative">
                <input 
                  type="number" 
                  placeholder="0"
                  className="w-full bg-slate-950 pr-12 pl-4 py-3 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  {...register("weight")}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-xs">gram</span>
              </div>
              {errors.weight && <p className="text-xs text-rose-500 font-medium">{errors.weight.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-200">Chiều dài</label>
              <div className="relative">
                <input 
                  type="number" 
                  placeholder="0"
                  className="w-full bg-slate-950 pr-12 pl-4 py-3 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  {...register("length")}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-xs">cm</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-200">Chiều rộng</label>
              <div className="relative">
                <input 
                  type="number" 
                  placeholder="0"
                  className="w-full bg-slate-950 pr-12 pl-4 py-3 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  {...register("width")}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-xs">cm</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-200">Chiều cao</label>
              <div className="relative">
                <input 
                  type="number" 
                  placeholder="0"
                  className="w-full bg-slate-950 pr-12 pl-4 py-3 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  {...register("height")}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-xs">cm</span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 5: PRE-ORDER & STATUS */}
        <div className="bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-800 space-y-6">
          <h2 className="text-lg font-bold text-slate-900 border-b pb-3 border-slate-800">Thông tin khác</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            
            {/* Pre Order Switch */}
            <div className="p-6 bg-slate-950/50 border border-slate-800 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-100">Hàng đặt trước</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Tôi cần thêm thời gian chuẩn bị hàng (7-30 ngày)</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    {...register("is_pre_order")}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-900 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                </label>
              </div>

              {watchIsPreOrder && (
                <div className="space-y-1.5 pt-2 border-t border-slate-700/50">
                  <label className="text-xs font-semibold text-slate-300">Thời gian chuẩn bị hàng (dts_days) *</label>
                  <div className="relative w-36">
                    <input 
                      type="number" 
                      min={7}
                      max={30}
                      className="w-full bg-slate-950 pr-12 pl-4 py-2 rounded-xl border border-slate-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      {...register("dts_days")}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">ngày</span>
                  </div>
                  {errors.dts_days && <p className="text-xs text-rose-500 font-medium">{errors.dts_days.message}</p>}
                </div>
              )}
            </div>

            {/* Status Option */}
            <div className="p-6 bg-slate-950/50 border border-slate-800 rounded-2xl space-y-4">
              <h4 className="font-bold text-slate-100">Trạng thái phát hành</h4>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-sm text-slate-200">
                  <input 
                    type="radio" 
                    value="Draft"
                    className="text-primary-500 focus:ring-primary-500"
                    {...register("status")}
                  />
                  Lưu bản nháp (Draft)
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-medium text-sm text-slate-200">
                  <input 
                    type="radio" 
                    value="Published"
                    className="text-primary-500 focus:ring-primary-500"
                    {...register("status")}
                  />
                  Công khai ngay (Published)
                </label>
              </div>
            </div>

          </div>
        </div>

        {/* SUBMIT BUTTON */}
        <div className="flex justify-end gap-4">
          <button 
            type="button"
            onClick={onSaveSuccess}
            className="px-6 py-3 bg-slate-800 text-slate-200 rounded-2xl hover:bg-slate-200 transition-colors font-bold text-sm"
          >
            Hủy bỏ
          </button>
          <button 
            type="submit"
            disabled={submitting}
            className="px-8 py-3 bg-primary-600 text-white rounded-2xl hover:bg-primary-700 disabled:opacity-50 transition-colors font-bold text-sm shadow-lg shadow-primary-500/20 flex items-center gap-2"
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
    </div>
  );
}
