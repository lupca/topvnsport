import { useState, useEffect } from "react";
import { fetchWithAuth } from "@/utils/apiClient";
import { normalizeImageUrl } from "@/utils/imageUrl";

interface UseProductLoadParams {
  productId: number | null | undefined;
  duplicateProductId: number | null | undefined;
  optionsLoaded: boolean;
  reset: (values: any) => void;
  setSubmitError: (error: string | null) => void;
  setAttributeValues: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setCoverImage: (url: string | null) => void;
  setProductImages: (urls: string[]) => void;
  setTier1Images: (images: Record<string, string>) => void;
  onLoadExistingSkus?: (skus: Set<string>) => void;
  onLoadExistingProductCode?: (hasProductCode: boolean) => void;
}

export function useProductLoad({
  productId,
  duplicateProductId,
  optionsLoaded,
  reset,
  setSubmitError,
  setAttributeValues,
  setCoverImage,
  setProductImages,
  setTier1Images,
  onLoadExistingSkus,
  onLoadExistingProductCode,
}: UseProductLoadParams) {
  const [pendingProductData, setPendingProductData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const targetId = productId || duplicateProductId;

  // Fetch product data - save temporarily, don't reset form yet
  useEffect(() => {
    if (!targetId) return;

    setLoading(true);
    fetchWithAuth(`/products/${targetId}`)
      .then(data => {
        setPendingProductData(data);
      })
      .catch(err => {
        console.error("Error loading product data:", err);
        setSubmitError("Không thể tải thông tin sản phẩm.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [targetId, setSubmitError]);

  // Reset form when BOTH options AND product data are loaded
  useEffect(() => {
    if (!optionsLoaded || !pendingProductData) return;

    const data = pendingProductData;

    // Map Tier Variations
    const tiers = (data.tier_variations || []).map((tv: any) => ({
      tier_index: tv.tier_index,
      name: tv.name,
      options: tv.options
    }));

    // Map Variants
    const variants = (data.variants || []).map((v: any) => ({
      tier_1_option: v.tier_1_option,
      tier_2_option: v.tier_2_option,
      sku_code: duplicateProductId ? "" : v.sku_code,
      price: v.price,
      barcode: v.barcode || ""
    }));

    // Extract existing SKUs as keys to mark as manually edited
    if (!duplicateProductId && onLoadExistingSkus) {
      const existingSkuKeys = new Set<string>();
      variants.forEach((v: any) => {
        const key = `${v.tier_1_option || ""}_${v.tier_2_option || ""}`;
        existingSkuKeys.add(key);
      });
      onLoadExistingSkus(existingSkuKeys);
    }

    // Mark product_code as manually edited in edit mode (not duplicate)
    if (!duplicateProductId && onLoadExistingProductCode && data.product_code) {
      onLoadExistingProductCode(true);
    }

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
    const cover = data.media?.find((m: any) => m.is_cover);
    if (cover) {
      setCoverImage(normalizeImageUrl(cover.image_url) || null);
    } else {
      setCoverImage(null);
    }

    const gallery = (data.media || [])
      .filter((m: any) => !m.is_cover && !m.variant_id)
      .sort((a: any, b: any) => a.display_order - b.display_order)
      .map((m: any) => normalizeImageUrl(m.image_url) || m.image_url);
    setProductImages(gallery);

    const tier1Imgs: Record<string, string> = {};
    (data.media || []).forEach((m: any) => {
      if (m.variant_id) {
        const variant = data.variants?.find((v: any) => v.id === m.variant_id);
        if (variant && variant.tier_1_option) {
          tier1Imgs[variant.tier_1_option] = normalizeImageUrl(m.image_url) || m.image_url;
        }
      }
    });
    setTier1Images(tier1Imgs);

    // Clear pending data after processing is done
    setPendingProductData(null);
  }, [optionsLoaded, pendingProductData, duplicateProductId, reset, setAttributeValues, setCoverImage, setProductImages, setTier1Images, onLoadExistingSkus, onLoadExistingProductCode]);

  return { loading, error: null };
}
export type UseProductLoadReturn = ReturnType<typeof useProductLoad>;
