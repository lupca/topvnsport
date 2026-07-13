# Task 08: Channel Override UX

## Mục tiêu
Cải thiện UX cho channel override fields - hiển thị rõ ràng khi field inherit từ master vs custom.

## Dependencies
- Task 05 completed (ProductForm refactored)

## Yêu cầu

### Hiện trạng:
- Title override: input text riêng biệt
- Description override: textarea riêng biệt
- Không có visual indicator nào cho biết field đang dùng giá trị master hay đã override

### Mục tiêu:
1. **Visual indicator**: Hiển thị badge "Từ master" khi field trống
2. **Toggle button**: Nút để switch giữa inherit/override mode
3. **Preview**: Hiển thị giá trị sẽ được sử dụng (master hoặc override)

## Tạo component: `InheritedField.tsx`

**Location**: `src/components/products/channel/InheritedField.tsx`

```typescript
import React, { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { cn } from '@/utils/cn';
import { Link2, Unlink, RefreshCw } from 'lucide-react';

interface InheritedFieldProps {
  masterFieldName: string;  // e.g., "name"
  overrideFieldName: string; // e.g., "channel_listings.0.title_override"
  label: string;
  multiline?: boolean;
  placeholder?: string;
}

export function InheritedField({
  masterFieldName,
  overrideFieldName,
  label,
  multiline = false,
  placeholder,
}: InheritedFieldProps) {
  const { register, setValue, watch } = useFormContext();
  
  const masterValue = watch(masterFieldName);
  const overrideValue = watch(overrideFieldName);
  
  const isOverriding = !!overrideValue && overrideValue.trim() !== '';
  
  // Effective value that will be used
  const effectiveValue = isOverriding ? overrideValue : masterValue;

  const handleResetToMaster = () => {
    setValue(overrideFieldName, '', { shouldDirty: true });
  };

  const InputComponent = multiline ? 'textarea' : 'input';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-gray-700">{label}</label>
        
        <div className="flex items-center gap-2">
          {isOverriding ? (
            <>
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Unlink className="h-3 w-3" />
                Tùy chỉnh
              </span>
              <button
                type="button"
                onClick={handleResetToMaster}
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                title="Reset về giá trị gốc"
              >
                <RefreshCw className="h-3 w-3" />
                Reset
              </button>
            </>
          ) : (
            <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Link2 className="h-3 w-3" />
              Từ master
            </span>
          )}
        </div>
      </div>

      <div className="relative">
        <InputComponent
          {...register(overrideFieldName)}
          placeholder={masterValue || placeholder || 'Nhập giá trị tùy chỉnh...'}
          className={cn(
            "pim-input w-full",
            multiline && "min-h-[100px] resize-y",
            !isOverriding && "bg-gray-50 text-gray-500"
          )}
          rows={multiline ? 4 : undefined}
        />
      </div>

      {/* Preview of effective value */}
      {!isOverriding && masterValue && (
        <p className="text-xs text-gray-500 mt-1">
          Giá trị sẽ dùng: <span className="font-medium">{masterValue.substring(0, 100)}{masterValue.length > 100 ? '...' : ''}</span>
        </p>
      )}
    </div>
  );
}
```

## Update `ChannelConfig.tsx`

```typescript
// In ChannelConfig.tsx

import { InheritedField } from './channel/InheritedField';

// Replace title override section:
<InheritedField
  masterFieldName="name"
  overrideFieldName={`channel_listings.${channelIndex}.title_override`}
  label="Tiêu đề sản phẩm"
  placeholder="Nhập tiêu đề cho kênh này"
/>

// Replace description override section:
<InheritedField
  masterFieldName="description"
  overrideFieldName={`channel_listings.${channelIndex}.description_override`}
  label="Mô tả sản phẩm"
  multiline
  placeholder="Nhập mô tả cho kênh này"
/>
```

## Variant Price Override UX

Variant prices cũng cần tương tự:

```typescript
// In ChannelConfig.tsx - Variant Overrides Table

interface VariantPriceOverrideProps {
  variantIndex: number;
  channelIndex: number;
  masterPrice: number;
}

function VariantPriceOverride({ variantIndex, channelIndex, masterPrice }: VariantPriceOverrideProps) {
  const { register, watch, setValue } = useFormContext();
  const fieldName = `channel_listings.${channelIndex}.variant_overrides.${variantIndex}.price_override`;
  const overridePrice = watch(fieldName);
  
  const isOverriding = overridePrice !== null && overridePrice !== undefined && overridePrice !== '';
  const effectivePrice = isOverriding ? overridePrice : masterPrice;

  return (
    <td className="px-4 py-2">
      <div className="flex items-center gap-2">
        <input
          type="number"
          {...register(fieldName, { valueAsNumber: true })}
          placeholder={masterPrice?.toLocaleString() || '0'}
          className={cn(
            "pim-input w-28 text-right",
            !isOverriding && "bg-gray-50"
          )}
        />
        {!isOverriding && (
          <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
            Master
          </span>
        )}
      </div>
    </td>
  );
}
```

## Tests

```typescript
describe('InheritedField', () => {
  it('shows "Từ master" badge when empty', () => {
    // Mock form with master value but no override
    render(
      <FormProvider {...methods}>
        <InheritedField 
          masterFieldName="name" 
          overrideFieldName="channel_listings.0.title_override"
          label="Title"
        />
      </FormProvider>
    );
    
    expect(screen.getByText('Từ master')).toBeInTheDocument();
  });

  it('shows "Tùy chỉnh" badge when override entered', async () => {
    render(
      <FormProvider {...methods}>
        <InheritedField 
          masterFieldName="name" 
          overrideFieldName="channel_listings.0.title_override"
          label="Title"
        />
      </FormProvider>
    );
    
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Custom Title');
    
    expect(screen.getByText('Tùy chỉnh')).toBeInTheDocument();
  });

  it('resets to master when Reset clicked', async () => {
    // Pre-fill with override
    const methods = useForm({
      defaultValues: {
        name: 'Master Name',
        channel_listings: [{ title_override: 'Custom' }]
      }
    });
    
    render(
      <FormProvider {...methods}>
        <InheritedField 
          masterFieldName="name" 
          overrideFieldName="channel_listings.0.title_override"
          label="Title"
        />
      </FormProvider>
    );
    
    await userEvent.click(screen.getByText('Reset'));
    
    expect(screen.getByText('Từ master')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('shows preview of master value when not overriding', () => {
    const methods = useForm({
      defaultValues: {
        name: 'Master Product Name',
        channel_listings: [{ title_override: '' }]
      }
    });
    
    render(
      <FormProvider {...methods}>
        <InheritedField 
          masterFieldName="name" 
          overrideFieldName="channel_listings.0.title_override"
          label="Title"
        />
      </FormProvider>
    );
    
    expect(screen.getByText(/Giá trị sẽ dùng:/)).toBeInTheDocument();
    expect(screen.getByText(/Master Product Name/)).toBeInTheDocument();
  });

  it('uses placeholder from master value', () => {
    const methods = useForm({
      defaultValues: {
        name: 'Master Name',
        channel_listings: [{ title_override: '' }]
      }
    });
    
    render(
      <FormProvider {...methods}>
        <InheritedField 
          masterFieldName="name" 
          overrideFieldName="channel_listings.0.title_override"
          label="Title"
        />
      </FormProvider>
    );
    
    expect(screen.getByPlaceholderText('Master Name')).toBeInTheDocument();
  });
});
```

## Checklist

- [ ] Create `InheritedField.tsx` component
- [ ] Update `ChannelConfig.tsx` to use `InheritedField`
- [ ] Apply same pattern to variant price overrides
- [ ] Write tests
- [ ] All tests pass

## Estimate
- 2-3 hours
