# Task 06: Navigation Tabs & Progress Bar

## Mục tiêu
Thêm sidebar navigation tabs và thanh progress % hoàn thành.

## Dependencies
- Task 05 completed (ProductForm refactored)

## Tạo component: `ProductFormSidebar.tsx`

**Location**: `src/components/products/ProductFormSidebar.tsx`

```typescript
import React from 'react';
import { cn } from '@/utils/cn';

const SECTIONS = [
  { id: 'basic', label: 'Thông tin cơ bản', icon: '📦' },
  { id: 'specs', label: 'Thuộc tính kỹ thuật', icon: '⚙️' },
  { id: 'sales', label: 'Thông tin bán hàng', icon: '🛒' },
  { id: 'logistics', label: 'Vận chuyển', icon: '🚚' },
  { id: 'other', label: 'Thông tin khác', icon: '📋' },
  { id: 'channels', label: 'Cấu hình đa kênh', icon: '🌐' },
];

interface ProductFormSidebarProps {
  activeSection: string;
  onSectionClick: (sectionId: string) => void;
  completionPercent: number;
  sectionErrors: Record<string, boolean>;
}

export function ProductFormSidebar({
  activeSection,
  onSectionClick,
  completionPercent,
  sectionErrors,
}: ProductFormSidebarProps) {
  return (
    <div className="w-56 flex-shrink-0 sticky top-24 self-start">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Progress */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-600">Hoàn thành</span>
            <span className="font-semibold text-brand-primary">{completionPercent}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-brand-primary rounded-full transition-all duration-300"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="py-2">
          {SECTIONS.map(section => (
            <button
              key={section.id}
              type="button"
              onClick={() => onSectionClick(section.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors border-l-[3px]",
                activeSection === section.id
                  ? "border-brand-primary bg-blue-50 text-brand-primary font-semibold"
                  : "border-transparent text-gray-600 hover:bg-gray-50"
              )}
            >
              <span>{section.icon}</span>
              <span className="flex-1 text-left">{section.label}</span>
              {sectionErrors[section.id] && (
                <span className="w-2 h-2 bg-rose-500 rounded-full" />
              )}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
```

## Hook: `useFormCompletion.ts`

**Location**: `src/hooks/useFormCompletion.ts`

```typescript
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
      productImages.length > 0,              // 10%
      variants?.length > 0 && variants.every(v => Number(v.price) > 0), // 10%
      variants?.length > 0 && variants.every(v => Number(v.stock) > 0), // 10%
    ];
    
    const completed = checks.filter(Boolean).length;
    return Math.round((completed / checks.length) * 100);
  }, [name, productCode, categoryId, familyId, description, weight, coverImage, productImages, variants]);
}
```

## Hook: `useScrollNavigation.ts`

**Location**: `src/hooks/useScrollNavigation.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';

const SECTION_IDS = ['basic', 'specs', 'sales', 'logistics', 'other', 'channels'];

export function useScrollNavigation() {
  const [activeSection, setActiveSection] = useState('basic');

  // Track scroll position
  useEffect(() => {
    const handleScroll = () => {
      for (const sectionId of SECTION_IDS) {
        const element = document.getElementById(`section-${sectionId}`);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 150 && rect.bottom > 150) {
            setActiveSection(sectionId);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll to section
  const scrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(`section-${sectionId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setActiveSection(sectionId);
  }, []);

  return { activeSection, scrollToSection };
}
```

## Update ProductForm Layout

```tsx
// In ProductForm.tsx

import { ProductFormSidebar } from './products/ProductFormSidebar';
import { useFormCompletion } from '@/hooks/useFormCompletion';
import { useScrollNavigation } from '@/hooks/useScrollNavigation';

// Inside component:
const { activeSection, scrollToSection } = useScrollNavigation();
const completionPercent = useFormCompletion({ watch, coverImage, productImages });

// Calculate section errors from form errors
const getSectionErrors = (): Record<string, boolean> => {
  const errors = methods.formState.errors;
  return {
    basic: !!(errors.name || errors.product_code || errors.category_id || 
              errors.family_id || errors.description),
    specs: false,
    sales: !!(errors.tier_variations || errors.variants),
    logistics: !!(errors.weight),
    other: !!(errors.dts_days),
    channels: !!(errors.channel_listings),
  };
};

// Updated layout:
return (
  <div className="max-w-7xl mx-auto py-10 px-4">
    <FormHeader ... />
    
    <div className="flex gap-6">
      {/* Sidebar */}
      <ProductFormSidebar
        activeSection={activeSection}
        onSectionClick={scrollToSection}
        completionPercent={completionPercent}
        sectionErrors={getSectionErrors()}
      />
      
      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <FormProvider {...methods}>
          <form onSubmit={...} className="space-y-8">
            <div id="section-basic">
              <ProductBasicInfo ... />
            </div>
            <div id="section-specs">
              <ProductTechSpecs ... />
            </div>
            <div id="section-sales">
              <ProductVariations ... />
            </div>
            <div id="section-logistics">
              <ProductLogistics />
            </div>
            <div id="section-other">
              {/* Pre-order section */}
            </div>
            <div id="section-channels">
              <ChannelConfigSection ... />
            </div>
            
            <FormFooter ... />
          </form>
        </FormProvider>
      </div>
    </div>
  </div>
);
```

## Tests

```typescript
describe('ProductFormSidebar', () => {
  it('renders all sections', () => {});
  it('highlights active section', () => {});
  it('shows progress percentage', () => {});
  it('shows error indicator on section with errors', () => {});
  it('calls onSectionClick when clicked', () => {});
});

describe('useFormCompletion', () => {
  it('returns 0 for empty form', () => {});
  it('returns 100 for complete form', () => {});
  it('calculates partial completion', () => {});
});

describe('useScrollNavigation', () => {
  it('updates activeSection on scroll', () => {});
  it('scrolls to section on click', () => {});
});
```

## Checklist

- [ ] Create `ProductFormSidebar.tsx`
- [ ] Create `useFormCompletion.ts`
- [ ] Create `useScrollNavigation.ts`
- [ ] Update `ProductForm.tsx` layout
- [ ] Add `id="section-*"` to each section wrapper
- [ ] Write tests
- [ ] All tests pass

## Estimate
- 3-4 hours
