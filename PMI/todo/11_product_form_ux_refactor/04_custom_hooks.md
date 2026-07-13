# Task 04: Extract Custom Hooks

## Mục tiêu
Tách logic từ ProductForm.tsx thành custom hooks để code dễ maintain và test.

## Dependencies
- Task 01, 02, 03 completed (all tests passing)

## Hooks cần tạo

### 1. `useProductFormData.ts`

**Purpose**: Fetch categories, families, and family attributes

**Location**: `src/hooks/useProductFormData.ts`

```typescript
import { useState, useEffect } from 'react';
import { fetchWithAuth } from '@/utils/apiClient';

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

interface UseProductFormDataReturn {
  categories: Category[];
  families: AttributeFamily[];
  familyAttributes: Attribute[];
  optionsLoaded: boolean;
  error: string | null;
}

export function useProductFormData(watchFamilyId: number): UseProductFormDataReturn {
  const [categories, setCategories] = useState<Category[]>([]);
  const [families, setFamilies] = useState<AttributeFamily[]>([]);
  const [familyAttributes, setFamilyAttributes] = useState<Attribute[]>([]);
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch categories and families on mount
  useEffect(() => {
    Promise.all([
      fetchWithAuth('/categories'),
      fetchWithAuth('/attribute-families')
    ])
      .then(([categoryData, familyData]) => {
        setCategories(Array.isArray(categoryData) ? categoryData : []);
        setFamilies(Array.isArray(familyData) ? familyData : []);
        setOptionsLoaded(true);
      })
      .catch(err => {
        console.error('Error fetching lookup data:', err);
        setError('Không thể tải dữ liệu danh mục');
      });
  }, []);

  // Fetch family attributes when family changes
  useEffect(() => {
    if (!watchFamilyId || Number(watchFamilyId) <= 0) {
      setFamilyAttributes([]);
      return;
    }

    fetchWithAuth(`/attribute-families/${watchFamilyId}/attributes`)
      .then((data: Attribute[]) => {
        setFamilyAttributes(Array.isArray(data) ? data : []);
      })
      .catch(err => {
        console.error('Error fetching family attributes:', err);
        setFamilyAttributes([]);
      });
  }, [watchFamilyId]);

  return {
    categories,
    families,
    familyAttributes,
    optionsLoaded,
    error,
  };
}
```

### 2. `useProductLoad.ts`

**Purpose**: Load existing product for edit/duplicate mode

**Location**: `src/hooks/useProductLoad.ts`

```typescript
import { useState, useEffect } from 'react';
import { UseFormReset } from 'react-hook-form';
import { fetchWithAuth } from '@/utils/apiClient';
import { normalizeImageUrl } from '@/utils/imageUrl';
import { ProductFormValues } from '@/validations/productSchema';

interface UseProductLoadProps {
  productId?: number | null;
  duplicateProductId?: number | null;
  optionsLoaded: boolean;
  reset: UseFormReset<ProductFormValues>;
  setCoverImage: (url: string | null) => void;
  setProductImages: (urls: string[]) => void;
  setTier1Images: (images: Record<string, string>) => void;
  setAttributeValues: (values: Record<number, string>) => void;
}

interface UseProductLoadReturn {
  loading: boolean;
  error: string | null;
}

export function useProductLoad({
  productId,
  duplicateProductId,
  optionsLoaded,
  reset,
  setCoverImage,
  setProductImages,
  setTier1Images,
  setAttributeValues,
}: UseProductLoadProps): UseProductLoadReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingData, setPendingData] = useState<any>(null);

  const targetId = productId || duplicateProductId;
  const isDuplicate = !!duplicateProductId;

  // Fetch product data
  useEffect(() => {
    if (!targetId) return;

    setLoading(true);
    fetchWithAuth(`/products/${targetId}`)
      .then(data => {
        setPendingData(data);
      })
      .catch(err => {
        console.error('Error loading product:', err);
        setError('Không thể tải thông tin sản phẩm');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [targetId]);

  // Reset form when both options and data are loaded
  useEffect(() => {
    if (!optionsLoaded || !pendingData) return;

    const data = pendingData;

    // Map data to form values
    const tiers = data.tier_variations.map((tv: any) => ({
      tier_index: tv.tier_index,
      name: tv.name,
      options: tv.options,
    }));

    const variants = data.variants.map((v: any) => ({
      tier_1_option: v.tier_1_option,
      tier_2_option: v.tier_2_option,
      sku_code: isDuplicate ? '' : v.sku_code,
      price: v.price,
      barcode: v.barcode || '',
      stock: v.stock,
    }));

    // Build channel listings
    const shopeeListing = data.channel_listings?.find((cl: any) => cl.channel_code === 'shopee_vn') || {
      channel_code: 'shopee_vn', status: 'Draft', title_override: '', description_override: '',
      attribute_values: [], variant_overrides: []
    };
    const tiktokListing = data.channel_listings?.find((cl: any) => cl.channel_code === 'tiktok_shop') || {
      channel_code: 'tiktok_shop', status: 'Draft', title_override: '', description_override: '',
      attribute_values: [], variant_overrides: []
    };

    reset({
      product_code: isDuplicate ? '' : data.product_code,
      name: data.name,
      description: data.description || '',
      category_id: data.category_id || 0,
      family_id: data.family_id || 0,
      weight: data.weight,
      length: data.length,
      width: data.width,
      height: data.height,
      hs_code: data.hs_code || '',
      tax_code: data.tax_code || '',
      is_pre_order: data.is_pre_order,
      dts_days: data.dts_days,
      status: data.status,
      tier_variations: tiers,
      variants,
      media: [],
      channel_listings: [
        { ...shopeeListing, channel_code: 'shopee_vn' },
        { ...tiktokListing, channel_code: 'tiktok_shop' },
      ],
    });

    // Set attribute values
    const attrValues: Record<number, string> = {};
    (data.attribute_values || []).forEach((entry: any) => {
      const raw = entry.value_string ?? entry.value_decimal;
      if (raw !== null && raw !== undefined) {
        attrValues[entry.attribute_id] = String(raw);
      }
    });
    setAttributeValues(attrValues);

    // Set media
    const cover = data.media.find((m: any) => m.is_cover);
    setCoverImage(cover ? normalizeImageUrl(cover.image_url) : null);

    const gallery = data.media
      .filter((m: any) => !m.is_cover && !m.variant_id)
      .sort((a: any, b: any) => a.display_order - b.display_order)
      .map((m: any) => normalizeImageUrl(m.image_url) || m.image_url);
    setProductImages(gallery);

    const tier1Imgs: Record<string, string> = {};
    data.media.forEach((m: any) => {
      if (m.variant_id) {
        const variant = data.variants.find((v: any) => v.id === m.variant_id);
        if (variant?.tier_1_option) {
          tier1Imgs[variant.tier_1_option] = normalizeImageUrl(m.image_url) || m.image_url;
        }
      }
    });
    setTier1Images(tier1Imgs);

    setPendingData(null);
  }, [optionsLoaded, pendingData, isDuplicate, reset, setCoverImage, setProductImages, setTier1Images, setAttributeValues]);

  return { loading, error };
}
```

### 3. `useVariantMatrix.ts`

**Purpose**: Generate variants from tier variations

**Location**: `src/hooks/useVariantMatrix.ts`

```typescript
import { useEffect, useRef } from 'react';
import { UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { generateSkuCode } from '@/utils/skuHelper';
import { ProductFormValues } from '@/validations/productSchema';

interface UseVariantMatrixProps {
  watch: UseFormWatch<ProductFormValues>;
  setValue: UseFormSetValue<ProductFormValues>;
  manuallyEditedSkus?: Set<string>;
}

export function useVariantMatrix({ watch, setValue, manuallyEditedSkus }: UseVariantMatrixProps) {
  const watchTiers = watch('tier_variations');
  const watchParentSku = watch('product_code');
  const watchVariants = watch('variants');
  
  const prevTiersRef = useRef<string>('');

  useEffect(() => {
    const tiersJson = JSON.stringify(watchTiers);
    
    // Skip if tiers haven't changed
    if (tiersJson === prevTiersRef.current) return;
    prevTiersRef.current = tiersJson;

    const parsedTiers = watchTiers || [];
    const tier1 = parsedTiers[0];
    const tier2 = parsedTiers[1];

    const t1_options = Array.from(new Set(
      tier1?.options?.map((o: any) => String(o).trim()).filter((o: string) => o !== '') || []
    )) as string[];
    
    const t2_options = Array.from(new Set(
      tier2?.options?.map((o: any) => String(o).trim()).filter((o: string) => o !== '') || []
    )) as string[];

    // Preserve existing variant data
    const existingMap = new Map<string, { price: number; stock: number; sku_code: string; barcode: string }>();
    if (watchVariants) {
      watchVariants.forEach((v: any) => {
        const key = `${v.tier_1_option || ''}_${v.tier_2_option || ''}`;
        existingMap.set(key, { 
          price: v.price, 
          stock: v.stock, 
          sku_code: v.sku_code, 
          barcode: v.barcode || '' 
        });
      });
    }

    const getVariantKey = (t1: string | null, t2: string | null) => 
      `${t1 || ''}_${t2 || ''}`;

    let newVariants: ProductFormValues['variants'] = [];

    if (t1_options.length === 0) {
      // No tiers - single default variant
      const key = '_';
      const existing = existingMap.get(key);
      const wasManuallyEdited = manuallyEditedSkus?.has(key);
      
      newVariants = [{
        tier_1_option: null,
        tier_2_option: null,
        sku_code: wasManuallyEdited 
          ? (existing?.sku_code || generateSkuCode(watchParentSku))
          : generateSkuCode(watchParentSku),
        barcode: existing?.barcode || '',
        price: existing?.price ?? 0,
        stock: existing?.stock ?? 0,
      }];
    } else if (t2_options.length === 0) {
      // 1 Tier
      t1_options.forEach((opt1) => {
        const key = `${opt1}_`;
        const existing = existingMap.get(key);
        const wasManuallyEdited = manuallyEditedSkus?.has(key);
        
        newVariants.push({
          tier_1_option: opt1,
          tier_2_option: null,
          sku_code: wasManuallyEdited
            ? (existing?.sku_code || generateSkuCode(watchParentSku, opt1))
            : generateSkuCode(watchParentSku, opt1),
          barcode: existing?.barcode || '',
          price: existing?.price ?? 0,
          stock: existing?.stock ?? 0,
        });
      });
    } else {
      // 2 Tiers
      t1_options.forEach((opt1) => {
        t2_options.forEach((opt2) => {
          const key = `${opt1}_${opt2}`;
          const existing = existingMap.get(key);
          const wasManuallyEdited = manuallyEditedSkus?.has(key);
          
          newVariants.push({
            tier_1_option: opt1,
            tier_2_option: opt2,
            sku_code: wasManuallyEdited
              ? (existing?.sku_code || generateSkuCode(watchParentSku, opt1, opt2))
              : generateSkuCode(watchParentSku, opt1, opt2),
            barcode: existing?.barcode || '',
            price: existing?.price ?? 0,
            stock: existing?.stock ?? 0,
          });
        });
      });
    }

    setValue('variants', newVariants);
  }, [watchTiers, watchParentSku, setValue, manuallyEditedSkus]);
}
```

### 4. `useMediaUpload.ts`

**Purpose**: Handle image uploads (cover, gallery, tier1)

**Location**: `src/hooks/useMediaUpload.ts`

```typescript
import { useState } from 'react';
import { apiClient } from '@/utils/apiClient';
import { normalizeImageUrl } from '@/utils/imageUrl';
import { popupService } from '@/components/ui/popupService';

interface UseMediaUploadReturn {
  // Cover image
  coverImage: string | null;
  setCoverImage: (url: string | null) => void;
  uploadingCover: boolean;
  handleCoverUpload: (file: File) => Promise<void>;
  
  // Gallery images
  productImages: string[];
  setProductImages: React.Dispatch<React.SetStateAction<string[]>>;
  uploadingGallery: boolean;
  handleGalleryUpload: (files: FileList) => Promise<void>;
  removeGalleryImage: (index: number) => void;
  
  // Tier 1 images
  tier1Images: Record<string, string>;
  setTier1Images: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  uploadingTier1: Record<string, boolean>;
  handleTier1Upload: (optionName: string, file: File) => Promise<void>;
  removeTier1Image: (optionName: string) => void;
}

export function useMediaUpload(): UseMediaUploadReturn {
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  
  const [productImages, setProductImages] = useState<string[]>([]);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  
  const [tier1Images, setTier1Images] = useState<Record<string, string>>({});
  const [uploadingTier1, setUploadingTier1] = useState<Record<string, boolean>>({});

  const handleCoverUpload = async (file: File) => {
    setUploadingCover(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const data = await apiClient.post('/upload', formData);
      setCoverImage(normalizeImageUrl(data.image_url) || data.image_url);
    } catch (err) {
      console.error(err);
      void popupService.alert('Không thể tải lên ảnh bìa');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleGalleryUpload = async (files: FileList) => {
    const remainingSlots = 8 - productImages.length;
    if (remainingSlots <= 0) {
      void popupService.alert('Đã đạt giới hạn tối đa 8 ảnh phụ.');
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    setUploadingGallery(true);

    try {
      const newUrls: string[] = [];
      for (const file of filesToUpload) {
        const formData = new FormData();
        formData.append('file', file);
        const data = await apiClient.post('/upload', formData);
        newUrls.push(normalizeImageUrl(data.image_url) || data.image_url);
      }
      setProductImages(prev => [...prev, ...newUrls]);
    } catch (err) {
      console.error(err);
      void popupService.alert('Tải lên ảnh phụ thất bại.');
    } finally {
      setUploadingGallery(false);
    }
  };

  const removeGalleryImage = (index: number) => {
    setProductImages(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleTier1Upload = async (optionName: string, file: File) => {
    setUploadingTier1(prev => ({ ...prev, [optionName]: true }));
    const formData = new FormData();
    formData.append('file', file);

    try {
      const data = await apiClient.post('/upload', formData);
      setTier1Images(prev => ({ 
        ...prev, 
        [optionName]: normalizeImageUrl(data.image_url) || data.image_url 
      }));
    } catch (err) {
      console.error(err);
      void popupService.alert(`Không thể tải lên ảnh cho ${optionName}`);
    } finally {
      setUploadingTier1(prev => ({ ...prev, [optionName]: false }));
    }
  };

  const removeTier1Image = (optionName: string) => {
    setTier1Images(prev => {
      const next = { ...prev };
      delete next[optionName];
      return next;
    });
  };

  return {
    coverImage,
    setCoverImage,
    uploadingCover,
    handleCoverUpload,
    productImages,
    setProductImages,
    uploadingGallery,
    handleGalleryUpload,
    removeGalleryImage,
    tier1Images,
    setTier1Images,
    uploadingTier1,
    handleTier1Upload,
    removeTier1Image,
  };
}
```

### 5. `useProductSubmit.ts`

**Purpose**: Handle form submission and payload building

**Location**: `src/hooks/useProductSubmit.ts`

```typescript
import { useState } from 'react';
import { apiClient } from '@/utils/apiClient';
import { generateSkuCode } from '@/utils/skuHelper';
import { ProductFormValues } from '@/validations/productSchema';
import { Attribute } from '@/components/products/ProductTechSpecs';

interface UseProductSubmitProps {
  productId?: number | null;
  coverImage: string | null;
  productImages: string[];
  tier1Images: Record<string, string>;
  familyAttributes: Attribute[];
  attributeValues: Record<number, string>;
  onSuccess?: () => void;
}

interface UseProductSubmitReturn {
  submitting: boolean;
  submitError: string | null;
  submitSuccess: boolean;
  handleSubmit: (values: ProductFormValues) => Promise<void>;
}

export function useProductSubmit({
  productId,
  coverImage,
  productImages,
  tier1Images,
  familyAttributes,
  attributeValues,
  onSuccess,
}: UseProductSubmitProps): UseProductSubmitReturn {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleSubmit = async (values: ProductFormValues) => {
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    // Build media payload
    const mediaPayload = [];

    if (coverImage) {
      mediaPayload.push({
        image_url: coverImage,
        is_cover: true,
        display_order: 1,
        variant_tier_1_option: null,
      });
    }

    productImages.forEach((url, index) => {
      mediaPayload.push({
        image_url: url,
        is_cover: false,
        display_order: index + 2,
        variant_tier_1_option: null,
      });
    });

    Object.entries(tier1Images).forEach(([optionName, url], index) => {
      mediaPayload.push({
        image_url: url,
        is_cover: false,
        display_order: productImages.length + index + 2,
        variant_tier_1_option: optionName,
      });
    });

    // Ensure SKU codes exist
    const updatedVariants = values.variants.map((v) => {
      if (!v.sku_code) {
        return {
          ...v,
          sku_code: generateSkuCode(values.product_code, v.tier_1_option, v.tier_2_option),
        };
      }
      return v;
    });

    // Build final payload
    const finalPayload = {
      ...values,
      variants: updatedVariants,
      channel_listings: values.channel_listings?.map((cl) => ({
        ...cl,
        variant_overrides: updatedVariants.map((v, idx) => {
          const existing = cl.variant_overrides?.find((vo: any) => vo.sku_code === v.sku_code) 
            || cl.variant_overrides?.[idx];
          return {
            sku_code: v.sku_code,
            price_override: existing?.price_override || null,
            channel_variant_id: existing?.channel_variant_id || '',
          };
        }),
      })) || [],
      media: mediaPayload,
      attributes: familyAttributes
        .map(attr => ({
          id: attr.id,
          value: (attributeValues[attr.id] || '').trim(),
        }))
        .filter(attr => attr.value !== ''),
    };

    try {
      const path = productId ? `/products/${productId}` : '/products';
      
      if (productId) {
        await apiClient.put(path, finalPayload);
      } else {
        await apiClient.post(path, finalPayload);
      }

      setSubmitSuccess(true);
      if (onSuccess) {
        setTimeout(onSuccess, 1000);
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Có lỗi xảy ra');
    } finally {
      setSubmitting(false);
    }
  };

  return {
    submitting,
    submitError,
    submitSuccess,
    handleSubmit,
  };
}
```

## Checklist

- [ ] Create `src/hooks/` directory
- [ ] Create `useProductFormData.ts`
- [ ] Create `useProductLoad.ts`
- [ ] Create `useVariantMatrix.ts`
- [ ] Create `useMediaUpload.ts`
- [ ] Create `useProductSubmit.ts`
- [ ] Write tests for each hook in `src/hooks/__tests__/`
- [ ] All existing tests still pass

## Tests for Hooks

Create `src/hooks/__tests__/` with tests for each hook:
- `useProductFormData.test.ts`
- `useProductLoad.test.ts`
- `useVariantMatrix.test.ts`
- `useMediaUpload.test.ts`
- `useProductSubmit.test.ts`

## Estimate
- 4-5 hours
