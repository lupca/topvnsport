import { useState } from "react";
import { apiClient } from "@/utils/apiClient";
import { generateSkuCode } from "@/utils/skuHelper";
import { ProductFormValues } from "@/validations/productSchema";
import { Attribute } from "@/components/products/ProductTechSpecs";

interface UseProductSubmitProps {
  productId?: number | null;
  coverImage: string | null;
  productImages: string[];
  tier1Images: Record<string, string>;
  familyAttributes: Attribute[];
  attributeValues: Record<number, string>;
  onSuccess?: () => void;
}

export interface UseProductSubmitReturn {
  submitting: boolean;
  submitError: string | null;
  setSubmitError: React.Dispatch<React.SetStateAction<string | null>>;
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
            channel_variant_id: existing?.channel_variant_id || "",
          };
        }),
      })) || [],
      media: mediaPayload,
      attributes: familyAttributes
        .map(attr => ({
          id: attr.id,
          value: (attributeValues[attr.id] || "").trim(),
        }))
        .filter(attr => attr.value !== ""),
    };

    try {
      const path = productId ? `/products/${productId}` : "/products";
      
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
      setSubmitError(err.message || "Có lỗi xảy ra");
    } finally {
      setSubmitting(false);
    }
  };

  return {
    submitting,
    submitError,
    setSubmitError,
    submitSuccess,
    handleSubmit,
  };
}
