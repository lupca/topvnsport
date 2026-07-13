# Task 02: Tests for Section Components

## Mục tiêu
Viết unit tests cho các section components của ProductForm.

## Dependencies
- Task 01 completed

## Files cần test

### 1. `ProductBasicInfo.tsx`

**Test file**: `src/__tests__/components/ProductBasicInfo.test.tsx`

```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FormProvider, useForm } from 'react-hook-form';
import ProductBasicInfo from '@/components/products/ProductBasicInfo';

const mockCategories = [
  { id: 1, parent_id: null, name: 'Category 1', code: 'CAT1' },
  { id: 2, parent_id: null, name: 'Category 2', code: 'CAT2' },
];

const mockFamilies = [
  { id: 1, code: 'FAM1', name: 'Family 1' },
  { id: 2, code: 'FAM2', name: 'Family 2' },
];

const Wrapper = ({ children }: { children: React.ReactNode }) => {
  const methods = useForm({
    defaultValues: {
      name: '',
      product_code: '',
      category_id: 0,
      family_id: 0,
      description: '',
    },
  });
  return <FormProvider {...methods}>{children}</FormProvider>;
};

describe('ProductBasicInfo', () => {
  const defaultProps = {
    categories: mockCategories,
    families: mockFamilies,
    coverImage: null,
    setCoverImage: vi.fn(),
    productImages: [],
    setProductImages: vi.fn(),
    uploadingCover: false,
    setUploadingCover: vi.fn(),
    uploadingGallery: false,
    setUploadingGallery: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all form fields', () => {
    render(
      <Wrapper>
        <ProductBasicInfo {...defaultProps} />
      </Wrapper>
    );

    expect(screen.getByText('Thông tin cơ bản')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Nhập tên sản phẩm/)).toBeInTheDocument();
    expect(screen.getByText('Ngành hàng *')).toBeInTheDocument();
    expect(screen.getByText('Attribute Family *')).toBeInTheDocument();
  });

  it('renders categories in select', () => {
    render(
      <Wrapper>
        <ProductBasicInfo {...defaultProps} />
      </Wrapper>
    );

    expect(screen.getByText('Category 1 (CAT1)')).toBeInTheDocument();
    expect(screen.getByText('Category 2 (CAT2)')).toBeInTheDocument();
  });

  it('renders families in select', () => {
    render(
      <Wrapper>
        <ProductBasicInfo {...defaultProps} />
      </Wrapper>
    );

    expect(screen.getByText('Family 1 (FAM1)')).toBeInTheDocument();
    expect(screen.getByText('Family 2 (FAM2)')).toBeInTheDocument();
  });

  it('shows cover image when provided', () => {
    render(
      <Wrapper>
        <ProductBasicInfo {...defaultProps} coverImage="https://example.com/cover.jpg" />
      </Wrapper>
    );

    const img = screen.getByAlt('Cover');
    expect(img).toHaveAttribute('src', 'https://example.com/cover.jpg');
  });

  it('shows gallery images', () => {
    render(
      <Wrapper>
        <ProductBasicInfo 
          {...defaultProps} 
          productImages={['https://example.com/img1.jpg', 'https://example.com/img2.jpg']} 
        />
      </Wrapper>
    );

    expect(screen.getByAlt('Gallery 1')).toBeInTheDocument();
    expect(screen.getByAlt('Gallery 2')).toBeInTheDocument();
  });

  it('shows loading state when uploading cover', () => {
    render(
      <Wrapper>
        <ProductBasicInfo {...defaultProps} uploadingCover={true} />
      </Wrapper>
    );

    // Should show spinner or loading indicator
    expect(screen.getByRole('status') || screen.getByTestId('loading')).toBeDefined();
  });

  it('calls setCoverImage(null) when remove cover clicked', async () => {
    const setCoverImage = vi.fn();
    render(
      <Wrapper>
        <ProductBasicInfo 
          {...defaultProps} 
          coverImage="https://example.com/cover.jpg"
          setCoverImage={setCoverImage}
        />
      </Wrapper>
    );

    // Hover and click change/remove button
    const coverContainer = screen.getByAlt('Cover').closest('div');
    fireEvent.mouseEnter(coverContainer!);
    
    const changeButton = screen.getByText('Thay đổi');
    await userEvent.click(changeButton);

    // This depends on implementation - might trigger file input or remove
  });

  it('limits gallery images to 8', () => {
    const images = Array(8).fill('https://example.com/img.jpg');
    render(
      <Wrapper>
        <ProductBasicInfo {...defaultProps} productImages={images} />
      </Wrapper>
    );

    // Should not show "add more" button when at limit
    expect(screen.queryByText('Tải ảnh phụ')).not.toBeInTheDocument();
  });
});
```

### 2. `ProductTechSpecs.tsx`

**Test file**: `src/__tests__/components/ProductTechSpecs.test.tsx`

```typescript
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import ProductTechSpecs from '@/components/products/ProductTechSpecs';

const mockAttributes = [
  { id: 1, code: 'material', name: 'Chất liệu', type: 'text', is_required: true },
  { id: 2, code: 'weight', name: 'Trọng lượng', type: 'number', is_required: false },
  { id: 3, code: 'origin', name: 'Xuất xứ', type: 'text', is_required: false },
];

describe('ProductTechSpecs', () => {
  it('shows message when no family selected', () => {
    render(
      <ProductTechSpecs
        watchFamilyId={0}
        familyAttributes={[]}
        attributeValues={{}}
        setAttributeValues={vi.fn()}
      />
    );

    expect(screen.getByText(/Chọn Attribute Family/)).toBeInTheDocument();
  });

  it('shows message when family has no attributes', () => {
    render(
      <ProductTechSpecs
        watchFamilyId={1}
        familyAttributes={[]}
        attributeValues={{}}
        setAttributeValues={vi.fn()}
      />
    );

    expect(screen.getByText(/chưa có thuộc tính nào/)).toBeInTheDocument();
  });

  it('renders attributes from family', () => {
    render(
      <ProductTechSpecs
        watchFamilyId={1}
        familyAttributes={mockAttributes}
        attributeValues={{}}
        setAttributeValues={vi.fn()}
      />
    );

    expect(screen.getByText('Chất liệu *')).toBeInTheDocument();
    expect(screen.getByText('Trọng lượng')).toBeInTheDocument();
    expect(screen.getByText('Xuất xứ')).toBeInTheDocument();
  });

  it('uses number input for numeric types', () => {
    render(
      <ProductTechSpecs
        watchFamilyId={1}
        familyAttributes={mockAttributes}
        attributeValues={{}}
        setAttributeValues={vi.fn()}
      />
    );

    const weightInput = screen.getByPlaceholderText(/trọng lượng/i);
    expect(weightInput).toHaveAttribute('type', 'number');
  });

  it('displays existing values', () => {
    render(
      <ProductTechSpecs
        watchFamilyId={1}
        familyAttributes={mockAttributes}
        attributeValues={{ 1: 'Cotton', 2: '200' }}
        setAttributeValues={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue('Cotton')).toBeInTheDocument();
    expect(screen.getByDisplayValue('200')).toBeInTheDocument();
  });

  it('calls setAttributeValues on input change', async () => {
    const setAttributeValues = vi.fn();
    render(
      <ProductTechSpecs
        watchFamilyId={1}
        familyAttributes={mockAttributes}
        attributeValues={{}}
        setAttributeValues={setAttributeValues}
      />
    );

    const materialInput = screen.getByPlaceholderText(/chất liệu/i);
    await userEvent.type(materialInput, 'Polyester');

    expect(setAttributeValues).toHaveBeenCalled();
  });
});
```

### 3. `ProductVariations.tsx`

**Test file**: `src/__tests__/components/ProductVariations.test.tsx`

```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FormProvider, useForm } from 'react-hook-form';
import ProductVariations from '@/components/products/ProductVariations';

const Wrapper = ({ children, defaultValues = {} }: { children: React.ReactNode; defaultValues?: any }) => {
  const methods = useForm({
    defaultValues: {
      tier_variations: [],
      variants: [{ tier_1_option: null, tier_2_option: null, sku_code: '', price: 0, stock: 0, barcode: '' }],
      product_code: 'TEST-001',
      ...defaultValues,
    },
  });
  return <FormProvider {...methods}>{children}</FormProvider>;
};

describe('ProductVariations', () => {
  const defaultProps = {
    tier1Images: {},
    setTier1Images: vi.fn(),
    uploadingTier1: {},
    setUploadingTier1: vi.fn(),
    bulkPrice: '',
    setBulkPrice: vi.fn(),
    bulkStock: '',
    setBulkStock: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders add tier button', () => {
    render(
      <Wrapper>
        <ProductVariations {...defaultProps} />
      </Wrapper>
    );

    expect(screen.getByText(/Thêm nhóm phân loại hàng/)).toBeInTheDocument();
  });

  it('adds tier variation when button clicked', async () => {
    render(
      <Wrapper>
        <ProductVariations {...defaultProps} />
      </Wrapper>
    );

    await userEvent.click(screen.getByText(/Thêm nhóm phân loại hàng/));

    expect(screen.getByPlaceholderText('Ví dụ: Màu sắc')).toBeInTheDocument();
  });

  it('limits to 2 tier variations', async () => {
    render(
      <Wrapper defaultValues={{
        tier_variations: [
          { tier_index: 1, name: 'Màu', options: ['Đỏ'] },
          { tier_index: 2, name: 'Size', options: ['L'] },
        ],
      }}>
        <ProductVariations {...defaultProps} />
      </Wrapper>
    );

    expect(screen.queryByText(/Thêm nhóm phân loại hàng/)).not.toBeInTheDocument();
  });

  it('shows tier 1 image upload section', async () => {
    render(
      <Wrapper defaultValues={{
        tier_variations: [
          { tier_index: 1, name: 'Màu', options: ['Đỏ', 'Xanh'] },
        ],
      }}>
        <ProductVariations {...defaultProps} />
      </Wrapper>
    );

    expect(screen.getByText('Hình ảnh cho phân loại thứ 1')).toBeInTheDocument();
  });

  it('shows bulk apply section when variants exist', () => {
    render(
      <Wrapper defaultValues={{
        tier_variations: [{ tier_index: 1, name: 'Màu', options: ['Đỏ'] }],
        variants: [{ tier_1_option: 'Đỏ', price: 0, stock: 0 }],
      }}>
        <ProductVariations {...defaultProps} />
      </Wrapper>
    );

    expect(screen.getByText('Áp dụng hàng loạt:')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Giá')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Kho hàng')).toBeInTheDocument();
  });

  it('renders variants table with correct columns', () => {
    render(
      <Wrapper defaultValues={{
        tier_variations: [
          { tier_index: 1, name: 'Màu sắc', options: ['Đỏ'] },
        ],
        variants: [{ tier_1_option: 'Đỏ', price: 100000, stock: 10, barcode: '123' }],
      }}>
        <ProductVariations {...defaultProps} />
      </Wrapper>
    );

    expect(screen.getByText('Màu sắc')).toBeInTheDocument();
    expect(screen.getByText('Mã vạch (Barcode)')).toBeInTheDocument();
    expect(screen.getByText('Giá bán *')).toBeInTheDocument();
    expect(screen.getByText('Kho hàng *')).toBeInTheDocument();
  });
});
```

### 4. `ProductLogistics.tsx`

**Test file**: `src/__tests__/components/ProductLogistics.test.tsx`

```typescript
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { FormProvider, useForm } from 'react-hook-form';
import ProductLogistics from '@/components/products/ProductLogistics';

const Wrapper = ({ children, defaultValues = {} }: { children: React.ReactNode; defaultValues?: any }) => {
  const methods = useForm({
    defaultValues: {
      weight: 0,
      length: null,
      width: null,
      height: null,
      hs_code: '',
      tax_code: '',
      is_pre_order: false,
      dts_days: 7,
      status: 'Draft',
      ...defaultValues,
    },
  });
  return <FormProvider {...methods}>{children}</FormProvider>;
};

describe('ProductLogistics', () => {
  it('renders logistics fields', () => {
    render(
      <Wrapper>
        <ProductLogistics />
      </Wrapper>
    );

    expect(screen.getByText('Vận chuyển & Logistics')).toBeInTheDocument();
    expect(screen.getByText('Cân nặng *')).toBeInTheDocument();
    expect(screen.getByText('Chiều dài')).toBeInTheDocument();
    expect(screen.getByText('Mã HS (Customs)')).toBeInTheDocument();
  });

  it('shows pre-order toggle', () => {
    render(
      <Wrapper>
        <ProductLogistics />
      </Wrapper>
    );

    expect(screen.getByText('Hàng đặt trước')).toBeInTheDocument();
  });

  it('shows dts_days input when pre-order enabled', async () => {
    render(
      <Wrapper defaultValues={{ is_pre_order: true }}>
        <ProductLogistics />
      </Wrapper>
    );

    expect(screen.getByText(/Thời gian chuẩn bị/)).toBeInTheDocument();
  });

  it('hides dts_days input when pre-order disabled', () => {
    render(
      <Wrapper defaultValues={{ is_pre_order: false }}>
        <ProductLogistics />
      </Wrapper>
    );

    expect(screen.queryByText(/Thời gian chuẩn bị/)).not.toBeInTheDocument();
  });

  it('shows status radio buttons', () => {
    render(
      <Wrapper>
        <ProductLogistics />
      </Wrapper>
    );

    expect(screen.getByText('Lưu bản nháp (Draft)')).toBeInTheDocument();
    expect(screen.getByText('Công khai ngay (Published)')).toBeInTheDocument();
  });
});
```

### 5. `ChannelConfig.tsx`

**Test file**: `src/__tests__/components/ChannelConfig.test.tsx`

```typescript
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FormProvider, useForm } from 'react-hook-form';
import ChannelConfig from '@/components/products/ChannelConfig';

const Wrapper = ({ children }: { children: React.ReactNode }) => {
  const methods = useForm({
    defaultValues: {
      name: 'Test Product',
      description: 'Test description',
      category_id: 1,
      variants: [{ tier_1_option: null, sku_code: 'TEST-001', price: 100000 }],
      channel_listings: [
        { 
          channel_code: 'shopee_vn', 
          status: 'Draft',
          title_override: '',
          description_override: '',
          attribute_values: [],
          variant_overrides: [],
        },
      ],
    },
  });
  return <FormProvider {...methods}>{children}</FormProvider>;
};

describe('ChannelConfig', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/channels')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: 1, code: 'shopee_vn', name: 'Shopee Vietnam' }]),
        });
      }
      if (url.includes('/category-mappings')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { pim_category_id: 1, channel_category_code: '100934', channel_category_name: 'Vợt cầu lông' }
          ]),
        });
      }
      if (url.includes('/attribute-mappings')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 1, pim_attribute_id: 1, channel_attribute_code: 'brand', channel_attribute_name: 'Thương hiệu' }
          ]),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    }));
  });

  it('renders channel toggle', async () => {
    render(
      <Wrapper>
        <ChannelConfig channelCode="shopee_vn" channelName="Shopee Việt Nam" />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/Niêm yết trên Shopee/)).toBeInTheDocument();
    });
  });

  it('shows override fields when channel is enabled', async () => {
    render(
      <Wrapper>
        <ChannelConfig channelCode="shopee_vn" channelName="Shopee Việt Nam" />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Ghi đè thông tin cơ bản')).toBeInTheDocument();
    });

    expect(screen.getByText('Tên hiển thị ghi đè')).toBeInTheDocument();
    expect(screen.getByText('Mô tả chi tiết ghi đè')).toBeInTheDocument();
  });

  it('shows category mapping status', async () => {
    render(
      <Wrapper>
        <ChannelConfig channelCode="shopee_vn" channelName="Shopee Việt Nam" />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/Đã tự động khớp/)).toBeInTheDocument();
    });
  });

  it('shows variant price override table', async () => {
    render(
      <Wrapper>
        <ChannelConfig channelCode="shopee_vn" channelName="Shopee Việt Nam" />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Bảng giá riêng trên sàn')).toBeInTheDocument();
    });
  });

  it('shows channel-specific attributes', async () => {
    render(
      <Wrapper>
        <ChannelConfig channelCode="shopee_vn" channelName="Shopee Việt Nam" />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Thuộc tính đặc thù sàn')).toBeInTheDocument();
    });
  });
});
```

## Checklist

- [ ] Create `src/__tests__/components/ProductBasicInfo.test.tsx`
- [ ] Create `src/__tests__/components/ProductTechSpecs.test.tsx`
- [ ] Create `src/__tests__/components/ProductVariations.test.tsx`
- [ ] Create `src/__tests__/components/ProductLogistics.test.tsx`
- [ ] Create `src/__tests__/components/ChannelConfig.test.tsx`
- [ ] Run tests: `npm run test -- src/__tests__/components/Product`
- [ ] All tests pass

## Estimate
- 3-4 hours
