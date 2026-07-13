import { useState, useEffect } from "react";
import { fetchWithAuth } from "@/utils/apiClient";
import { Category, AttributeFamily } from "@/components/products/ProductBasicInfo";
import { Attribute } from "@/components/products/ProductTechSpecs";

export function useProductFormData(
  watchFamilyId: number | undefined,
  setAttributeValues: React.Dispatch<React.SetStateAction<Record<number, string>>>
) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [families, setFamilies] = useState<AttributeFamily[]>([]);
  const [familyAttributes, setFamilyAttributes] = useState<Attribute[]>([]);
  const [optionsLoaded, setOptionsLoaded] = useState(false);

  // Fetch categories & attribute families
  useEffect(() => {
    Promise.all([
      fetchWithAuth("/categories"),
      fetchWithAuth("/attribute-families")
    ])
      .then(([categoryData, familyData]) => {
        setCategories(Array.isArray(categoryData) ? categoryData : []);
        setFamilies(Array.isArray(familyData) ? familyData : []);
        setOptionsLoaded(true);
      })
      .catch(err => {
        console.error("Error fetching lookup data:", err);
      });
  }, []);

  // Fetch family attributes when family ID changes
  useEffect(() => {
    if (!watchFamilyId || Number(watchFamilyId) <= 0) {
      setFamilyAttributes([]);
      return;
    }

    fetchWithAuth(`/attribute-families/${watchFamilyId}/attributes`)
      .then((data: Attribute[]) => {
        if (!Array.isArray(data)) {
          setFamilyAttributes([]);
          return;
        }
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
  }, [watchFamilyId, setAttributeValues]);

  return {
    categories,
    families,
    familyAttributes,
    optionsLoaded,
  };
}
export type UseProductFormDataReturn = ReturnType<typeof useProductFormData>;
