# Task 03: Tests for Edit/Duplicate Modes

## Mục tiêu
Viết tests cho edit mode và duplicate mode của ProductForm.

## Dependencies
- Task 01 completed
- Task 02 completed

## Test Cases

### Add to existing `ProductForm.test.tsx`

```typescript
// Add these tests to the existing describe block

describe('ProductForm - Edit Mode', () => {
  const mockProduct = {
    id: 123,
    product_code: 'EXISTING-001',
    name: 'Existing Product',
    description: 'Existing description that is long enough',
    category_id: 1,
    family_id: 1,
    weight: 150,
    length: 30,
    width: 20,
    height: 10,
    hs_code: '9506.51.00',
    tax_code: 'TAX-001',
    is_pre_order: false,
    dts_days: 7,
    status: 'Published',
    tier_variations: [
      { tier_index: 1, name: 'Màu sắc', options: ['Đỏ', 'Xanh'] }
    ],
    variants: [
      { id: 1, tier_1_option: 'Đỏ', tier_2_option: null, sku_code: 'EXISTING-001-DO', price: 500000, stock: 10, barcode: '123456' },
      { id: 2, tier_1_option: 'Xanh', tier_2_option: null, sku_code: 'EXISTING-001-XANH', price: 500000, stock: 15, barcode: '123457' },
    ],
    media: [
      { id: 1, image_url: '/uploads/cover.jpg', is_cover: true, display_order: 1 },
      { id: 2, image_url: '/uploads/gallery1.jpg', is_cover: false, display_order: 2 },
    ],
    attribute_values: [
      { attribute_id: 10, value_string: 'Cotton' }
    ],
    channel_listings: [
      {
        channel_code: 'shopee_vn',
        status: 'Published',
        title_override: 'Shopee Title',
        description_override: '',
        channel_product_id: 'shopee_123',
        attribute_values: [],
        variant_overrides: []
      }
    ]
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/products/123')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockProduct),
        });
      }
      // ... other mocks from existing setup
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      });
    }));
  });

  test('loads existing product data', async () => {
    render(<ProductForm productId={123} onSaveSuccess={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Existing Product')).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue('EXISTING-001')).toBeInTheDocument();
    expect(screen.getByDisplayValue('150')).toBeInTheDocument();
  });

  test('loads tier variations', async () => {
    render(<ProductForm productId={123} onSaveSuccess={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Màu sắc')).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue('Đỏ')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Xanh')).toBeInTheDocument();
  });

  test('loads variants with prices', async () => {
    render(<ProductForm productId={123} onSaveSuccess={vi.fn()} />);

    await waitFor(() => {
      const priceInputs = screen.getAllByDisplayValue('500000');
      expect(priceInputs.length).toBeGreaterThanOrEqual(2);
    });
  });

  test('loads channel listings', async () => {
    render(<ProductForm productId={123} onSaveSuccess={vi.fn()} />);

    await waitFor(() => {
      // Switch to Shopee tab and verify
      expect(screen.getByText('Cấu hình Shopee')).toBeInTheDocument();
    });

    // Shopee title override should be loaded
    await waitFor(() => {
      expect(screen.getByDisplayValue('Shopee Title')).toBeInTheDocument();
    });
  });

  test('shows "Cập Nhật Sản Phẩm" title in edit mode', async () => {
    render(<ProductForm productId={123} onSaveSuccess={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Cập Nhật Sản Phẩm')).toBeInTheDocument();
    });
  });

  test('uses PUT method when updating', async () => {
    render(<ProductForm productId={123} onSaveSuccess={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Existing Product')).toBeInTheDocument();
    });

    // Submit form
    await userEvent.click(screen.getByRole('button', { name: /Lưu/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/products/123'),
        expect.objectContaining({ method: 'PUT' })
      );
    });
  });

  test('preserves SKU codes in edit mode', async () => {
    render(<ProductForm productId={123} onSaveSuccess={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('EXISTING-001-DO')).toBeInTheDocument();
      expect(screen.getByDisplayValue('EXISTING-001-XANH')).toBeInTheDocument();
    });
  });
});

describe('ProductForm - Duplicate Mode', () => {
  const mockProduct = {
    id: 123,
    product_code: 'ORIGINAL-001',
    name: 'Original Product',
    description: 'Original description that is long enough',
    category_id: 1,
    family_id: 1,
    weight: 150,
    tier_variations: [
      { tier_index: 1, name: 'Màu sắc', options: ['Đỏ'] }
    ],
    variants: [
      { id: 1, tier_1_option: 'Đỏ', sku_code: 'ORIGINAL-001-DO', price: 500000, stock: 10 },
    ],
    media: [],
    attribute_values: [],
    channel_listings: []
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/products/123')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockProduct),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      });
    }));
  });

  test('clears product_code in duplicate mode', async () => {
    render(<ProductForm duplicateProductId={123} onSaveSuccess={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Original Product')).toBeInTheDocument();
    });

    // product_code should be empty
    const productCodeInput = screen.getByPlaceholderText(/TSHIRT-PARENT/i);
    expect(productCodeInput).toHaveValue('');
  });

  test('clears SKU codes in duplicate mode', async () => {
    render(<ProductForm duplicateProductId={123} onSaveSuccess={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Original Product')).toBeInTheDocument();
    });

    // SKU should be empty (will be auto-generated)
    expect(screen.queryByDisplayValue('ORIGINAL-001-DO')).not.toBeInTheDocument();
  });

  test('shows "Sao Chép Sản Phẩm" title', async () => {
    render(<ProductForm duplicateProductId={123} onSaveSuccess={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Sao Chép Sản Phẩm')).toBeInTheDocument();
    });
  });

  test('uses POST method for duplicate (creates new)', async () => {
    render(<ProductForm duplicateProductId={123} onSaveSuccess={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Original Product')).toBeInTheDocument();
    });

    // Fill required product_code
    const productCodeInput = screen.getByPlaceholderText(/TSHIRT-PARENT/i);
    await userEvent.type(productCodeInput, 'NEW-001');

    // Submit
    await userEvent.click(screen.getByRole('button', { name: /Lưu/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/products'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  test('copies all other data from original', async () => {
    render(<ProductForm duplicateProductId={123} onSaveSuccess={vi.fn()} />);

    await waitFor(() => {
      // Name copied
      expect(screen.getByDisplayValue('Original Product')).toBeInTheDocument();
      // Description copied
      expect(screen.getByDisplayValue(/Original description/)).toBeInTheDocument();
      // Weight copied
      expect(screen.getByDisplayValue('150')).toBeInTheDocument();
      // Tier variations copied
      expect(screen.getByDisplayValue('Màu sắc')).toBeInTheDocument();
    });
  });
});

describe('ProductForm - Error Handling', () => {
  test('shows error when product load fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/products/999')) {
        return Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ detail: 'Product not found' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      });
    }));

    render(<ProductForm productId={999} onSaveSuccess={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Không thể tải thông tin sản phẩm/)).toBeInTheDocument();
    });
  });

  test('shows error on submit failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, options?: any) => {
      if (options?.method === 'POST' && url.includes('/products')) {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ detail: 'Validation error' }),
        });
      }
      // Categories/families
      if (url.includes('/categories')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: 1, name: 'Cat', code: 'CAT' }]),
        });
      }
      if (url.includes('/attribute-families')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: 1, name: 'Fam', code: 'FAM' }]),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      });
    }));

    render(<ProductForm onSaveSuccess={vi.fn()} />);

    // Fill minimum required fields
    await waitFor(() => {
      expect(screen.getByText('Thông tin cơ bản')).toBeInTheDocument();
    });

    // ... fill form and submit

    // Should show error message
    // await waitFor(() => {
    //   expect(screen.getByText(/Lỗi/)).toBeInTheDocument();
    // });
  });
});
```

## Checklist

- [ ] Add edit mode tests to `ProductForm.test.tsx`
- [ ] Add duplicate mode tests to `ProductForm.test.tsx`
- [ ] Add error handling tests
- [ ] Run: `npm run test -- src/__tests__/components/ProductForm.test.tsx`
- [ ] All tests pass

## Notes

### Mocking Strategy
- Mock `fetch` globally in `beforeEach`
- Return different responses based on URL pattern
- Use `vi.stubGlobal` and `vi.unstubAllGlobals`

### Test Data
- Create `__mocks__/productData.ts` for reusable mock data
- Include all nested structures (variants, media, channel_listings)

### Edge Cases to Test
1. Product with no variants
2. Product with 2-tier variations
3. Product with channel overrides
4. Product with pre-order enabled
5. Network errors during load
6. Validation errors on submit

## Estimate
- 2-3 hours
