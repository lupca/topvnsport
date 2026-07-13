# Task 10: Cleanup Status Redundancy

## Mục tiêu
Loại bỏ trùng lặp giữa status radio buttons và footer action buttons.

## Dependencies
- Task 05 completed (ProductForm refactored)

## Vấn đề hiện tại

### Hiện trạng:
1. **Status radio buttons** trong form: Draft / Published
2. **Footer buttons**: "Lưu nháp" / "Lưu & Hiển thị"

→ User chọn "Published" rồi bấm "Lưu nháp" = confusing

### Giải pháp:
- **Bỏ** status radio buttons trong form
- **Giữ** footer buttons với ngữ nghĩa rõ ràng:
  - "Lưu nháp" → status = "Draft"
  - "Lưu & Hiển thị" → status = "Published"

## Thay đổi code

### 1. Remove status field từ form

```typescript
// Trong ProductBasicInfo.tsx hoặc section chứa status

// XÓA đoạn này:
<div className="space-y-2">
  <label className="text-sm font-semibold text-gray-700">
    Trạng thái phát hành
  </label>
  <div className="flex gap-4">
    <label className="flex items-center gap-2">
      <input 
        type="radio" 
        {...register("status")} 
        value="Draft"
        className="..."
      />
      <span>Nháp</span>
    </label>
    <label className="flex items-center gap-2">
      <input 
        type="radio" 
        {...register("status")} 
        value="Published"
        className="..."
      />
      <span>Hiển thị</span>
    </label>
  </div>
</div>
```

### 2. Update FormFooter component

```typescript
// Trong ProductForm.tsx hoặc FormFooter component

interface FormFooterProps {
  productId?: number | null;
  submitting: boolean;
  onSaveDraft: () => void;
  onSavePublish: () => void;
  onCancel?: () => void;
}

function FormFooter({ 
  productId, 
  submitting, 
  onSaveDraft,
  onSavePublish,
  onCancel 
}: FormFooterProps) {
  return (
    <div className="sticky bottom-0 bg-white border-t border-gray-200 -mx-4 px-4 py-4 mt-8">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        <button 
          type="button"
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700 text-sm"
        >
          Hủy bỏ
        </button>

        <div className="flex gap-3">
          <button 
            type="button"
            onClick={onSaveDraft}
            disabled={submitting}
            className="btn-outline px-6 py-2.5 rounded-xl text-sm flex items-center gap-2"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Lưu nháp
          </button>
          
          <button 
            type="button"
            onClick={onSavePublish}
            disabled={submitting}
            className="btn-primary px-6 py-2.5 rounded-xl text-sm shadow-sm flex items-center gap-2"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            {productId ? "Cập nhật & Hiển thị" : "Lưu & Hiển thị"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 3. Update submit handlers trong ProductForm

```typescript
// Trong ProductForm.tsx

const handleSaveDraft = () => {
  setValue('status', 'Draft');
  handleSubmit(onSubmit, onError)();
};

const handleSavePublish = () => {
  setValue('status', 'Published');
  handleSubmit(onSubmit, onError)();
};

// In render:
<FormFooter 
  productId={productId}
  submitting={submitting}
  onSaveDraft={handleSaveDraft}
  onSavePublish={handleSavePublish}
  onCancel={onSaveSuccess}
/>
```

### 4. Keep status in form values (hidden)

Status vẫn cần trong form values để gửi lên API, chỉ không hiển thị cho user.

```typescript
// defaultValues vẫn giữ status
function getDefaultValues(): ProductFormValues {
  return {
    // ...
    status: "Draft", // Default, will be set by button clicks
    // ...
  };
}
```

### 5. Update schema (optional)

Có thể thêm note trong schema:

```typescript
// productSchema.ts
status: z.enum(["Draft", "Published"]).default("Draft"),
// Note: status is set via footer buttons, not exposed in form UI
```

## Edit Mode Considerations

Khi edit product đã Published:
- Vẫn cho phép "Lưu nháp" để unpublish
- "Cập nhật & Hiển thị" để giữ published

```typescript
// Optional: Show current status indicator
{productId && (
  <div className="text-sm text-gray-500">
    Trạng thái hiện tại: 
    <span className={cn(
      "ml-2 px-2 py-0.5 rounded-full text-xs font-medium",
      currentStatus === 'Published' 
        ? "bg-emerald-100 text-emerald-700"
        : "bg-gray-100 text-gray-600"
    )}>
      {currentStatus === 'Published' ? 'Đang hiển thị' : 'Nháp'}
    </span>
  </div>
)}
```

## Channel Status

Channel listings vẫn giữ status riêng (có thể enable/disable per channel):

```typescript
// Trong ChannelConfig.tsx - KHÔNG THAY ĐỔI
<div className="flex items-center gap-2">
  <Switch 
    checked={isEnabled}
    onChange={(enabled) => setValue(`channel_listings.${idx}.status`, enabled ? 'Published' : 'Draft')}
  />
  <span className="text-sm">
    {isEnabled ? 'Đang bật' : 'Đã tắt'}
  </span>
</div>
```

## Tests

```typescript
describe('FormFooter - Status Actions', () => {
  it('sets status to Draft when "Lưu nháp" clicked', async () => {
    const mockSubmit = vi.fn();
    render(
      <FormProvider {...methods}>
        <FormFooter 
          onSaveDraft={() => {
            methods.setValue('status', 'Draft');
            mockSubmit(methods.getValues());
          }}
          onSavePublish={vi.fn()}
        />
      </FormProvider>
    );

    await userEvent.click(screen.getByRole('button', { name: /Lưu nháp/ }));

    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Draft' })
    );
  });

  it('sets status to Published when "Lưu & Hiển thị" clicked', async () => {
    const mockSubmit = vi.fn();
    render(
      <FormProvider {...methods}>
        <FormFooter 
          onSaveDraft={vi.fn()}
          onSavePublish={() => {
            methods.setValue('status', 'Published');
            mockSubmit(methods.getValues());
          }}
        />
      </FormProvider>
    );

    await userEvent.click(screen.getByRole('button', { name: /Lưu & Hiển thị/ }));

    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Published' })
    );
  });

  it('does not show status radio buttons', () => {
    render(<ProductForm />);

    expect(screen.queryByLabelText(/Nháp/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Hiển thị/)).not.toBeInTheDocument();
  });

  it('shows both action buttons', () => {
    render(<ProductForm />);

    expect(screen.getByRole('button', { name: /Lưu nháp/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Lưu & Hiển thị/ })).toBeInTheDocument();
  });

  it('disables buttons when submitting', () => {
    render(
      <FormFooter 
        submitting={true}
        onSaveDraft={vi.fn()}
        onSavePublish={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Lưu nháp/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Lưu & Hiển thị/ })).toBeDisabled();
  });
});
```

## Migration Notes

### Backend không cần thay đổi
- API vẫn nhận `status` field như cũ
- Frontend chỉ thay đổi cách user interact

### Update existing tests
- Remove tests cho status radio buttons
- Add tests cho footer button behaviors

## Checklist

- [ ] Remove status radio buttons từ form UI
- [ ] Update `FormFooter` component với 2 action buttons
- [ ] Add `handleSaveDraft` và `handleSavePublish` handlers
- [ ] Keep status in form values (hidden)
- [ ] Optional: Add current status indicator in edit mode
- [ ] Update tests
- [ ] All tests pass

## Estimate
- 1-2 hours
