import { useEffect, useRef } from "react";
import { UseFormSetValue, UseFormWatch } from "react-hook-form";
import { generateSkuCode } from "@/utils/skuHelper";
import { ProductFormValues } from "@/validations/productSchema";

interface UseVariantMatrixProps {
  watch: UseFormWatch<ProductFormValues>;
  setValue: UseFormSetValue<ProductFormValues>;
  manuallyEditedSkus?: Set<string>;
}

export function useVariantMatrix({ watch, setValue, manuallyEditedSkus }: UseVariantMatrixProps) {
  const watchTiers = watch("tier_variations");
  const watchParentSku = watch("product_code");
  const watchVariants = watch("variants");

  const tiersJson = JSON.stringify(watchTiers || []);
  const prevTiersRef = useRef<string>("");
  const prevParentSkuRef = useRef<string>("");

  useEffect(() => {
    const parentSku = watchParentSku || "";
    
    // Skip if neither tiers nor parent SKU has changed
    if (tiersJson === prevTiersRef.current && parentSku === prevParentSkuRef.current) return;
    prevTiersRef.current = tiersJson;
    prevParentSkuRef.current = parentSku;

    const parsedTiers = watchTiers || [];
    const tier1 = parsedTiers[0];
    const tier2 = parsedTiers[1];

    const t1_options = Array.from(new Set(
      tier1?.options?.map((o: any) => String(o).trim()).filter((o: string) => o !== "") || []
    )) as string[];

    const t2_options = Array.from(new Set(
      tier2?.options?.map((o: any) => String(o).trim()).filter((o: string) => o !== "") || []
    )) as string[];

    // Preserve existing variant data
    const existingMap = new Map<string, { price: number; sku_code: string; barcode: string }>();
    if (watchVariants) {
      watchVariants.forEach((v: any) => {
        const key = `${v.tier_1_option || ""}_${v.tier_2_option || ""}`;
        existingMap.set(key, {
          price: v.price,
          sku_code: v.sku_code,
          barcode: v.barcode || ""
        });
      });
    }

    let newVariants: ProductFormValues["variants"] = [];

    if (t1_options.length === 0) {
      // No tiers - single default variant
      const key = "_";
      const existing = existingMap.get(key);
      const wasManuallyEdited = manuallyEditedSkus?.has(key);

      newVariants = [{
        tier_1_option: null,
        tier_2_option: null,
        sku_code: wasManuallyEdited
          ? (existing?.sku_code || generateSkuCode(parentSku))
          : generateSkuCode(parentSku),
        barcode: existing?.barcode || "",
        price: existing?.price ?? 0,
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
            ? (existing?.sku_code || generateSkuCode(parentSku, opt1))
            : generateSkuCode(parentSku, opt1),
          barcode: existing?.barcode || "",
          price: existing?.price ?? 0,
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
              ? (existing?.sku_code || generateSkuCode(parentSku, opt1, opt2))
              : generateSkuCode(parentSku, opt1, opt2),
            barcode: existing?.barcode || "",
            price: existing?.price ?? 0,
          });
        });
      });
    }

    setValue("variants", newVariants);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiersJson, watchParentSku, setValue, manuallyEditedSkus]);
}
export type UseVariantMatrixReturn = ReturnType<typeof useVariantMatrix>;
