// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { Product } from '../types';

const mockUnpromotedProduct: Product = {
  id: 'prod-1',
  slug: 'vot-badminton-astrox-88d',
  name: 'Vợt Badminton Astrox 88D Pro',
  brand: 'Yonex',
  image: 'http://localhost:18100/images/astrox88d.jpg',
  category: 'Vợt',
  price: 2500000,
  hasActivePromotion: false,
  characteristics: 'Tấn Công',
  specs: {
    weight: '4U',
    stiffness: 'Cứng',
    balance: 300,
    maxTension: 28
  },
  description: 'Vợt cầu lông cao cấp.',
  reviews: [],
  stock: 15
};

const mockPromotedProduct: Product = {
  id: 'prod-2',
  slug: 'giay-badminton-65z3',
  name: 'Giày Badminton Power Cushion 65Z3',
  brand: 'Yonex',
  image: 'http://localhost:18100/images/65z3.jpg',
  category: 'Giày',
  price: 2000000,
  salePrice: 1600000,
  computedPrice: 1600000,
  originalPrice: 2000000,
  percentageDiscount: 20,
  hasActivePromotion: true,
  badge: 'HOT',
  isWide: true,
  specs: {
    weight: 'Tiêu chuẩn',
    stiffness: 'Tiêu chuẩn',
    balance: 0,
    maxTension: 0
  },
  description: 'Giày cầu lông chuyên nghiệp.',
  reviews: [],
  stock: 10
};

const mockOutOfStockProduct: Product = {
  ...mockUnpromotedProduct,
  id: 'prod-3',
  stock: 0
};

describe('ProductCard component', () => {
  const onQuickViewMock = vi.fn();
  const onAddToCartMock = vi.fn();

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders unpromoted product card with standard price and no discount badge', () => {
    render(
      <MemoryRouter>
        <ProductCard
          product={mockUnpromotedProduct}
          onQuickView={onQuickViewMock}
          onAddToCart={onAddToCartMock}
        />
      </MemoryRouter>
    );

    const regularPriceEl = screen.getByTestId('regular-price');
    expect(regularPriceEl).toBeTruthy();
    expect(regularPriceEl.textContent).toContain('2.500.000');

    expect(screen.queryByTestId('sale-price')).toBeNull();
    expect(screen.queryByTestId('original-price')).toBeNull();
    expect(screen.queryByTestId('discount-badge')).toBeNull();
  });

  it('renders promoted product card with sale price, strikethrough original price, and discount badge', () => {
    render(
      <MemoryRouter>
        <ProductCard
          product={mockPromotedProduct}
          onQuickView={onQuickViewMock}
          onAddToCart={onAddToCartMock}
        />
      </MemoryRouter>
    );

    const salePriceEl = screen.getByTestId('sale-price');
    expect(salePriceEl).toBeTruthy();
    expect(salePriceEl.textContent).toContain('1.600.000');
    expect(salePriceEl.className).toContain('text-red-600');

    const originalPriceEl = screen.getByTestId('original-price');
    expect(originalPriceEl).toBeTruthy();
    expect(originalPriceEl.textContent).toContain('2.000.000');
    expect(originalPriceEl.className).toContain('line-through');
    expect(originalPriceEl.className).toContain('text-gray-400');

    const discountBadgeEl = screen.getByTestId('discount-badge');
    expect(discountBadgeEl).toBeTruthy();
    expect(discountBadgeEl.textContent).toBe('-20%');
    expect(discountBadgeEl.className).toContain('bg-red-600');

    expect(screen.queryByTestId('regular-price')).toBeNull();
  });

  it('renders out of stock badge and disables cart action when stock is 0', () => {
    render(
      <MemoryRouter>
        <ProductCard
          product={mockOutOfStockProduct}
          onQuickView={onQuickViewMock}
          onAddToCart={onAddToCartMock}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Hết hàng')).toBeTruthy();

    const addToCartBtn = screen.getByTitle('Sản phẩm hết hàng');
    expect(addToCartBtn).toBeTruthy();
    fireEvent.click(addToCartBtn);
    expect(onAddToCartMock).not.toHaveBeenCalled();
  });

  it('renders racket specific specs and characteristics badge', () => {
    render(
      <MemoryRouter>
        <ProductCard
          product={mockUnpromotedProduct}
          onQuickView={onQuickViewMock}
          onAddToCart={onAddToCartMock}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Trọng lượng:')).toBeTruthy();
    expect(screen.getByText('Điểm CB:')).toBeTruthy();
    expect(screen.getByText('300mm')).toBeTruthy();
    expect(screen.getByText('Tấn Công')).toBeTruthy();
  });

  it('renders shoe wide fit indicator when category is Giày and isWide is true', () => {
    render(
      <MemoryRouter>
        <ProductCard
          product={mockPromotedProduct}
          onQuickView={onQuickViewMock}
          onAddToCart={onAddToCartMock}
        />
      </MemoryRouter>
    );

    expect(screen.getByText(/Form chân bè \(Wide Fit\)/)).toBeTruthy();
  });

  it('handles Quick View, Add to Cart, and detail navigation click events', () => {
    render(
      <MemoryRouter>
        <ProductCard
          product={mockPromotedProduct}
          onQuickView={onQuickViewMock}
          onAddToCart={onAddToCartMock}
        />
      </MemoryRouter>
    );

    const quickViewBtn = screen.getByTitle('Xem nhanh thông số');
    fireEvent.click(quickViewBtn);
    expect(onQuickViewMock).toHaveBeenCalledWith(mockPromotedProduct);

    const addToCartBtn = screen.getByTitle('Thêm nhanh vào giỏ');
    fireEvent.click(addToCartBtn);
    expect(onAddToCartMock).toHaveBeenCalledWith(mockPromotedProduct, expect.any(Object));

    const detailBtn = screen.getByText('Chi tiết →');
    fireEvent.click(detailBtn);
  });
});
