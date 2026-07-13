import { useCallback, useEffect } from 'react';
import { FieldErrors } from 'react-hook-form';
import { ProductFormValues } from '@/validations/productSchema';

interface UseFormValidationUXProps {
  errors: FieldErrors<ProductFormValues>;
  isSubmitted: boolean;
}

interface SectionErrorCount {
  [key: string]: number;
  basic: number;
  specs: number;
  sales: number;
  logistics: number;
  other: number;
  channels: number;
}

// Map field paths to sections
const FIELD_SECTION_MAP: Record<string, keyof SectionErrorCount> = {
  name: 'basic',
  product_code: 'basic',
  category_id: 'basic',
  family_id: 'basic',
  description: 'basic',
  // specs uses familyAttributes - handled separately
  tier_variations: 'sales',
  variants: 'sales',
  weight: 'logistics',
  length: 'logistics',
  width: 'logistics',
  height: 'logistics',
  hs_code: 'other',
  tax_code: 'other',
  is_pre_order: 'other',
  dts_days: 'other',
  channel_listings: 'channels',
};

export function useFormValidationUX({ errors, isSubmitted }: UseFormValidationUXProps) {
  // Count errors per section
  const getSectionErrorCounts = useCallback((): SectionErrorCount => {
    const counts: SectionErrorCount = {
      basic: 0,
      specs: 0,
      sales: 0,
      logistics: 0,
      other: 0,
      channels: 0,
    };

    const countErrors = (obj: any, path: string = '') => {
      if (!obj) return;
      
      if (obj.message && typeof obj.message === 'string') {
        // Found an error
        const rootField = path.split('.')[0];
        const section = FIELD_SECTION_MAP[rootField];
        if (section) {
          counts[section]++;
        }
        return;
      }

      if (typeof obj === 'object') {
        for (const key in obj) {
          if (key !== 'ref' && key !== 'type') {
            countErrors(obj[key], path ? `${path}.${key}` : key);
          }
        }
      }
    };

    countErrors(errors);
    return counts;
  }, [errors]);

  // Get first error field path
  const getFirstErrorPath = useCallback((): string | null => {
    const findFirst = (obj: any, path: string = ''): string | null => {
      if (!obj) return null;
      
      if (obj.message && typeof obj.message === 'string') {
        return path;
      }

      if (typeof obj === 'object') {
        for (const key in obj) {
          if (key !== 'ref' && key !== 'type') {
            const result = findFirst(obj[key], path ? `${path}.${key}` : key);
            if (result) return result;
          }
        }
      }
      return null;
    };

    return findFirst(errors);
  }, [errors]);

  // Scroll to first error
  const scrollToFirstError = useCallback(() => {
    const firstPath = getFirstErrorPath();
    if (!firstPath) return;

    // Try to find the element by name attribute
    const element = document.querySelector(`[name="${firstPath}"]`);
    if (element) {
      element.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      (element as HTMLElement).focus?.();
      return;
    }

    // Fallback: scroll to section
    const rootField = firstPath.split('.')[0];
    const section = FIELD_SECTION_MAP[rootField];
    if (section) {
      const sectionEl = document.getElementById(`section-${section}`);
      sectionEl?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    }
  }, [getFirstErrorPath]);

  // Auto-scroll when form is submitted with errors
  useEffect(() => {
    if (isSubmitted && Object.keys(errors).length > 0) {
      // Small delay to let form render error states
      setTimeout(scrollToFirstError, 100);
    }
  }, [isSubmitted, errors, scrollToFirstError]);

  // Get flattened error messages for summary
  const getErrorSummary = useCallback((): string[] => {
    const messages: string[] = [];
    
    const extract = (obj: any, path: string = '') => {
      if (!obj) return;
      
      if (obj.message && typeof obj.message === 'string') {
        messages.push(obj.message);
        return;
      }

      if (typeof obj === 'object') {
        for (const key in obj) {
          if (key !== 'ref' && key !== 'type') {
            extract(obj[key], path ? `${path}.${key}` : key);
          }
        }
      }
    };

    extract(errors);
    return messages.slice(0, 5); // Show max 5 errors
  }, [errors]);

  return {
    getSectionErrorCounts,
    scrollToFirstError,
    getErrorSummary,
    hasErrors: Object.keys(errors).length > 0,
  };
}
