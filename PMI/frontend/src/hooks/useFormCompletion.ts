import { useMemo } from 'react';
import { UseFormWatch } from 'react-hook-form';
import { ProductFormValues } from '@/validations/productSchema';

interface UseFormCompletionProps {
  watch: UseFormWatch<ProductFormValues>;
  coverImage: string | null;
  productImages: string[];
}

export function useFormCompletion({ 
  watch, 
  coverImage, 
  productImages 
}: UseFormCompletionProps): number {
  const name = watch('name');
  const productCode = watch('product_code');
  const categoryId = watch('category_id');
  const familyId = watch('family_id');
  const description = watch('description');
  const weight = watch('weight');
  const variants = watch('variants');

  return useMemo(() => {
    const checks = [
      // Required fields (60%)
      !!name && name.length >= 5,           // 10%
      !!productCode,                         // 10%
      Number(categoryId) > 0,                // 10%
      Number(familyId) > 0,                  // 10%
      !!description && description.length >= 10, // 10%
      Number(weight) > 0,                    // 10%
      
      // Optional but recommended (40%)
      !!coverImage,                          // 10%
      variants?.length > 0 && variants.every(v => Number(v.price) > 0), // 10%
      variants?.length > 0 && variants.every(v => !!v.sku_code || !!v.barcode), // 10%
    ];
    
    const completed = checks.filter(Boolean).length;
    return Math.round((completed / checks.length) * 100);
  }, [name, productCode, categoryId, familyId, description, weight, coverImage, productImages, variants]);
}
