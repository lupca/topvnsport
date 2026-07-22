import { useState, useEffect } from 'react';
import { PMI_API_URL } from '../services/sport-api/constants';

export interface ComputedPriceData {
  computedPrice: number | null;
  originalPrice: number | null;
  discountAmount: number;
  percentageDiscount: number;
  hasActivePromotion: boolean;
  loading: boolean;
  error: string | null;
}

export function useComputedPrice(
  variantId?: string | number | null,
  initialPrice?: number
): ComputedPriceData {
  const [data, setData] = useState<ComputedPriceData>({
    computedPrice: initialPrice ?? null,
    originalPrice: initialPrice ?? null,
    discountAmount: 0,
    percentageDiscount: 0,
    hasActivePromotion: false,
    loading: Boolean(variantId),
    error: null,
  });

  useEffect(() => {
    if (variantId === undefined || variantId === null || String(variantId).trim() === '') {
      setData({
        computedPrice: initialPrice ?? null,
        originalPrice: initialPrice ?? null,
        discountAmount: 0,
        percentageDiscount: 0,
        hasActivePromotion: false,
        loading: false,
        error: null,
      });
      return;
    }

    const controller = new AbortController();
    let isMounted = true;

    async function fetchComputedPrice() {
      setData((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const response = await fetch(
          `${PMI_API_URL}/api/variants/${encodeURIComponent(String(variantId))}/computed-price`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`Computed price API error: status ${response.status}`);
        }

        const json = await response.json();

        if (isMounted) {
          const orig = typeof json.original_price === 'number' ? Math.max(0, json.original_price) : (initialPrice ?? null);
          const comp = typeof json.computed_price === 'number' ? Math.max(0, json.computed_price) : (initialPrice ?? null);
          const hasPromo = Boolean(json.has_active_promotion);

          setData({
            computedPrice: comp,
            originalPrice: orig,
            discountAmount: typeof json.discount_amount === 'number' ? Math.max(0, json.discount_amount) : 0,
            percentageDiscount: typeof json.percentage_discount === 'number' ? Math.max(0, json.percentage_discount) : 0,
            hasActivePromotion: hasPromo,
            loading: false,
            error: null,
          });
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        if (isMounted) {
          setData({
            computedPrice: initialPrice ?? null,
            originalPrice: initialPrice ?? null,
            discountAmount: 0,
            percentageDiscount: 0,
            hasActivePromotion: false,
            loading: false,
            error: err.message || 'Failed to fetch computed price',
          });
        }
      }
    }

    fetchComputedPrice();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [variantId, initialPrice]);

  return data;
}
