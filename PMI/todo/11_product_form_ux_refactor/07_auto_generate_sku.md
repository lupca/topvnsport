# Task 07: Auto-generate SKU Realtime

## Mục tiêu
SKU tự động hiển thị và cập nhật realtime khi user thay đổi product_code hoặc tier options.

## Dependencies
- Task 05 completed (ProductForm refactored)
- Task 04 completed (useVariantMatrix hook)

## Yêu cầu

### Hành vi mong muốn:
1. **SKU hiển thị ngay**: Khi user nhập product_code, SKU variants tự động xuất hiện
2. **Auto-update**: Thay đổi product_code hoặc tier options → SKU update theo
3. **Respect manual edit**: Nếu user sửa SKU thủ công → giữ nguyên, không override
4. **Edit mode**: Load existing SKUs và mark as "manually edited" để không ghi đè

### Ví dụ:
```
product_code: "YONEX-AX77"
tier_1: ["Đỏ", "Xanh"]

Auto SKUs:
- YONEX-AX77-DO
- YONEX-AX77-XANH

User sửa "YONEX-AX77-DO" thành "CUSTOM-SKU"
→ Khi đổi product_code thành "ABC", SKU vẫn là "CUSTOM-SKU"
```

## Thay đổi code

### 1. Update `useVariantMatrix.ts`

Đã có trong Task 04. Cần thêm `manuallyEditedSkus` tracking.

### 2. Add state trong ProductForm.tsx

```typescript
// Track which SKUs have been manually edited
const [manuallyEditedSkus, setManuallyEditedSkus] = useState<Set<string>>(new Set());

// Pass to useVariantMatrix
useVariantMatrix({ 
  watch, 
  setValue, 
  manuallyEditedSkus 
});
```

### 3. Update ProductVariations.tsx

```typescript
interface ProductVariationsProps {
  // ... existing props
  manuallyEditedSkus: Set<string>;
  setManuallyEditedSkus: React.Dispatch<React.SetStateAction<Set<string>>>;
}

// In the variants table SKU input:
const handleSkuChange = (variantIndex: number, value: string) => {
  const variant = watchVariants[variantIndex];
  const key = `${variant.tier_1_option || ''}_${variant.tier_2_option || ''}`;
  
  // Mark as manually edited if user types something
  if (value) {
    setManuallyEditedSkus(prev => new Set([...prev, key]));
  } else {
    // If cleared, remove from manual edits (allow auto-gen)
    setManuallyEditedSkus(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }
  
  setValue(`variants.${variantIndex}.sku_code`, value);
};

// Input field
<input 
  type="text"
  value={v.sku_code}
  onChange={(e) => handleSkuChange(idx, e.target.value)}
  placeholder="Auto-generated"
  className={cn(
    "pim-input",
    !manuallyEditedSkus.has(getVariantKey(v)) && "bg-gray-50"
  )}
/>
```

### 4. Visual indicator for auto-generated SKU

```tsx
<td className="px-6 py-3">
  <div className="relative">
    <input 
      type="text"
      value={v.sku_code}
      onChange={(e) => handleSkuChange(idx, e.target.value)}
      className={cn(
        "pim-input pr-14",
        !manuallyEditedSkus.has(key) && "bg-gray-50 text-gray-600"
      )}
    />
    {!manuallyEditedSkus.has(key) && v.sku_code && (
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
        Auto
      </span>
    )}
  </div>
</td>
```

### 5. Update useProductLoad to preserve existing SKUs

```typescript
// In useProductLoad.ts, when loading existing product:
useEffect(() => {
  if (!optionsLoaded || !pendingData) return;
  
  // Mark all existing SKUs as manually edited (preserve them)
  const existingSkuKeys = new Set<string>();
  pendingData.variants.forEach((v: any) => {
    const key = `${v.tier_1_option || ''}_${v.tier_2_option || ''}`;
    existingSkuKeys.add(key);
  });
  
  // Pass this to parent via callback or context
  onLoadExistingSkus?.(existingSkuKeys);
  
  // ... rest of loading
}, [optionsLoaded, pendingData]);
```

### 6. Edge case: Duplicate mode

```typescript
// In duplicate mode, don't mark as manually edited
// SKUs should be empty and auto-generated
if (isDuplicate) {
  // Don't call onLoadExistingSkus
  // Keep manuallyEditedSkus empty
}
```

## Tests

```typescript
describe('Auto-generate SKU', () => {
  it('generates SKU immediately when product_code entered', async () => {
    render(<ProductForm />);
    
    // Add a tier variation
    await userEvent.click(screen.getByText(/Thêm nhóm phân loại/));
    await userEvent.type(screen.getByPlaceholderText('Ví dụ: Màu sắc'), 'Màu');
    
    const optionInput = screen.getAllByPlaceholderText('Thêm phân loại')[0];
    await userEvent.type(optionInput, 'Đỏ');
    fireEvent.blur(optionInput);
    
    // Enter product code
    await userEvent.type(screen.getByPlaceholderText(/TSHIRT-PARENT/), 'ABC');
    
    // SKU should be generated
    await waitFor(() => {
      expect(screen.getByDisplayValue('ABC-DO')).toBeInTheDocument();
    });
  });

  it('updates SKU when product_code changes', async () => {
    // ... setup with existing SKU
    // Change product_code
    // Verify SKU updated
  });

  it('preserves manually edited SKU', async () => {
    // ... generate auto SKU
    // Manually edit it
    // Change product_code
    // Verify SKU unchanged
  });

  it('shows "Auto" badge on auto-generated SKU', async () => {
    // ... generate auto SKU
    expect(screen.getByText('Auto')).toBeInTheDocument();
  });

  it('removes "Auto" badge when manually edited', async () => {
    // ... generate auto SKU
    // Edit it
    expect(screen.queryByText('Auto')).not.toBeInTheDocument();
  });

  it('preserves existing SKUs in edit mode', async () => {
    render(<ProductForm productId={123} />);
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('EXISTING-SKU')).toBeInTheDocument();
    });
    
    // Change product_code
    // SKU should remain unchanged
  });

  it('generates new SKUs in duplicate mode', async () => {
    render(<ProductForm duplicateProductId={123} />);
    
    await waitFor(() => {
      // SKU should be empty initially, waiting for product_code
      expect(screen.queryByDisplayValue('EXISTING-SKU')).not.toBeInTheDocument();
    });
  });
});
```

## Checklist

- [ ] Update `useVariantMatrix.ts` to support `manuallyEditedSkus`
- [ ] Add `manuallyEditedSkus` state to ProductForm
- [ ] Update `ProductVariations.tsx` with SKU change handler
- [ ] Add visual "Auto" badge
- [ ] Handle edit mode (preserve existing)
- [ ] Handle duplicate mode (generate new)
- [ ] Write tests
- [ ] All tests pass

## Estimate
- 2-3 hours
