# Task 09: Form Validation UX

## Mục tiêu
Cải thiện trải nghiệm khi form có lỗi validation - scroll đến lỗi, highlight section, hiển thị tổng hợp lỗi.

## Dependencies
- Task 06 completed (Navigation & Progress)
- Task 05 completed (ProductForm refactored)

## Yêu cầu

### Hiện trạng:
- Lỗi validation hiển thị inline dưới mỗi field
- Không có tổng hợp lỗi
- Không scroll đến lỗi đầu tiên
- Sidebar không highlight section có lỗi

### Mục tiêu:
1. **Scroll to error**: Tự động scroll đến field lỗi đầu tiên khi submit
2. **Error summary**: Hiển thị tổng hợp lỗi ở đầu form
3. **Section highlight**: Sidebar highlight section có lỗi
4. **Error count**: Hiển thị số lỗi trong mỗi section

## Tạo hook: `useFormValidationUX.ts`

**Location**: `src/hooks/useFormValidationUX.ts`

```typescript
import { useCallback, useEffect } from 'react';
import { FieldErrors } from 'react-hook-form';
import { ProductFormValues } from '@/validations/productSchema';

interface UseFormValidationUXProps {
  errors: FieldErrors<ProductFormValues>;
  isSubmitted: boolean;
}

interface SectionErrorCount {
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
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (element as HTMLElement).focus?.();
      return;
    }

    // Fallback: scroll to section
    const rootField = firstPath.split('.')[0];
    const section = FIELD_SECTION_MAP[rootField];
    if (section) {
      const sectionEl = document.getElementById(`section-${section}`);
      sectionEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
```

## Tạo component: `ErrorSummary.tsx`

**Location**: `src/components/products/ErrorSummary.tsx`

```typescript
import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorSummaryProps {
  errors: string[];
  totalCount: number;
}

export function ErrorSummary({ errors, totalCount }: ErrorSummaryProps) {
  if (errors.length === 0) return null;

  return (
    <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-semibold text-rose-900">
            Có {totalCount} lỗi cần sửa
          </h4>
          <ul className="mt-2 space-y-1">
            {errors.map((msg, i) => (
              <li key={i} className="text-sm text-rose-700 flex items-start gap-2">
                <span className="text-rose-400 mt-1">•</span>
                <span>{msg}</span>
              </li>
            ))}
            {totalCount > errors.length && (
              <li className="text-sm text-rose-600 italic">
                ...và {totalCount - errors.length} lỗi khác
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
```

## Update `ProductFormSidebar.tsx`

```typescript
// Update interface
interface ProductFormSidebarProps {
  activeSection: string;
  onSectionClick: (sectionId: string) => void;
  completionPercent: number;
  sectionErrors: Record<string, number>; // Changed from boolean to number
}

// Update section button rendering
{SECTIONS.map(section => {
  const errorCount = sectionErrors[section.id] || 0;
  
  return (
    <button
      key={section.id}
      type="button"
      onClick={() => onSectionClick(section.id)}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors border-l-[3px]",
        activeSection === section.id
          ? "border-brand-primary bg-blue-50 text-brand-primary font-semibold"
          : "border-transparent text-gray-600 hover:bg-gray-50",
        errorCount > 0 && "bg-rose-50 border-rose-400"
      )}
    >
      <span>{section.icon}</span>
      <span className="flex-1 text-left">{section.label}</span>
      
      {errorCount > 0 && (
        <span className="min-w-[20px] h-5 flex items-center justify-center bg-rose-500 text-white text-xs font-bold rounded-full">
          {errorCount}
        </span>
      )}
    </button>
  );
})}
```

## Update `ProductForm.tsx`

```typescript
import { useFormValidationUX } from '@/hooks/useFormValidationUX';
import { ErrorSummary } from './products/ErrorSummary';

// Inside component:
const { formState: { errors, isSubmitted } } = methods;

const {
  getSectionErrorCounts,
  getErrorSummary,
  hasErrors,
} = useFormValidationUX({ errors, isSubmitted });

// In render:
return (
  <div className="max-w-7xl mx-auto py-10 px-4">
    <FormHeader ... />
    
    {/* Error Summary - only show after submit attempt */}
    {isSubmitted && hasErrors && (
      <ErrorSummary 
        errors={getErrorSummary()} 
        totalCount={Object.values(getSectionErrorCounts()).reduce((a, b) => a + b, 0)}
      />
    )}

    {submitSuccess && <SuccessMessage />}
    
    <div className="flex gap-6">
      <ProductFormSidebar
        activeSection={activeSection}
        onSectionClick={scrollToSection}
        completionPercent={completionPercent}
        sectionErrors={getSectionErrorCounts()} // Now passes counts
      />
      
      {/* ... rest of form */}
    </div>
  </div>
);
```

## CSS cho error highlight

```css
/* Trong globals.css hoặc component styles */

/* Field error state */
.pim-input-error {
  @apply border-rose-400 ring-2 ring-rose-100 focus:border-rose-500 focus:ring-rose-200;
}

/* Shake animation for errors */
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

.error-shake {
  animation: shake 0.3s ease-in-out;
}
```

## Tests

```typescript
describe('useFormValidationUX', () => {
  it('counts errors per section correctly', () => {
    const errors = {
      name: { message: 'Required' },
      product_code: { message: 'Required' },
      weight: { message: 'Must be > 0' },
    };

    const { result } = renderHook(() => 
      useFormValidationUX({ errors, isSubmitted: true })
    );

    const counts = result.current.getSectionErrorCounts();
    expect(counts.basic).toBe(2);
    expect(counts.logistics).toBe(1);
  });

  it('scrolls to first error field', () => {
    const mockElement = { scrollIntoView: vi.fn(), focus: vi.fn() };
    vi.spyOn(document, 'querySelector').mockReturnValue(mockElement as any);

    const errors = { name: { message: 'Required' } };
    const { result } = renderHook(() => 
      useFormValidationUX({ errors, isSubmitted: true })
    );

    result.current.scrollToFirstError();

    expect(mockElement.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center'
    });
  });

  it('returns max 5 errors in summary', () => {
    const errors = {
      name: { message: 'Error 1' },
      product_code: { message: 'Error 2' },
      category_id: { message: 'Error 3' },
      family_id: { message: 'Error 4' },
      description: { message: 'Error 5' },
      weight: { message: 'Error 6' },
    };

    const { result } = renderHook(() => 
      useFormValidationUX({ errors, isSubmitted: true })
    );

    expect(result.current.getErrorSummary()).toHaveLength(5);
  });
});

describe('ErrorSummary', () => {
  it('renders error messages', () => {
    render(<ErrorSummary errors={['Error 1', 'Error 2']} totalCount={2} />);
    
    expect(screen.getByText('Error 1')).toBeInTheDocument();
    expect(screen.getByText('Error 2')).toBeInTheDocument();
  });

  it('shows "and X more" when truncated', () => {
    render(<ErrorSummary errors={['Error 1']} totalCount={5} />);
    
    expect(screen.getByText(/và 4 lỗi khác/)).toBeInTheDocument();
  });

  it('renders nothing when no errors', () => {
    const { container } = render(<ErrorSummary errors={[]} totalCount={0} />);
    
    expect(container.firstChild).toBeNull();
  });
});

describe('ProductFormSidebar with errors', () => {
  it('shows error count badge on section', () => {
    render(
      <ProductFormSidebar
        activeSection="basic"
        onSectionClick={vi.fn()}
        completionPercent={50}
        sectionErrors={{ basic: 3, specs: 0, sales: 1, logistics: 0, other: 0, channels: 0 }}
      />
    );

    // Should show "3" badge on basic section
    expect(screen.getByText('3')).toBeInTheDocument();
    // Should show "1" badge on sales section
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('highlights section with errors', () => {
    render(
      <ProductFormSidebar
        activeSection="sales"
        onSectionClick={vi.fn()}
        completionPercent={50}
        sectionErrors={{ basic: 2, specs: 0, sales: 0, logistics: 0, other: 0, channels: 0 }}
      />
    );

    const basicButton = screen.getByRole('button', { name: /Thông tin cơ bản/ });
    expect(basicButton).toHaveClass('bg-rose-50');
  });
});
```

## Checklist

- [ ] Create `useFormValidationUX.ts` hook
- [ ] Create `ErrorSummary.tsx` component
- [ ] Update `ProductFormSidebar.tsx` to show error counts
- [ ] Update `ProductForm.tsx` to integrate validation UX
- [ ] Add CSS for error states
- [ ] Write tests
- [ ] All tests pass

## Estimate
- 2-3 hours
