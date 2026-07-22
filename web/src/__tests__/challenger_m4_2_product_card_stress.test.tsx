// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { Product } from '../types';
import { mapProductVariant, mapPmiProduct } from '../services/sport-api/productMappers';
import { PmiProduct, PmiVariant } from '../services/sport-api/types';

const baseMockProduct: Product = {
  id: 'prod-stress-1',
  slug: 'san-pham-thu-nghiem',
  name: 'Vợt Cầu Lông Thử Nghiệm',
  brand: 'Yonex',
  image: 'http://localhost:18100/images/test.jpg',
  category: 'Vợt',
  price: 1000000,
  specs: {
    weight: '4U',
    stiffness: 'Tiêu chuẩn',
    balance: 295,
    maxTension: 28
  },
  description: 'Mô tả thử nghiệm.',
  reviews: [],
  stock: 10
};

describe('Challenger 2 - ProductCard & productMappers Adversarial Stress Tests', () => {
  const onQuickViewMock = vi.fn();
  const onAddToCartMock = vi.fn();

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('ProductCard Edge Cases', () => {
    it('1. Handles 0% discount (computedPrice === originalPrice with active promotion)', () => {
      const product0Percent: Product = {
        ...baseMockProduct,
        hasActivePromotion: true,
        originalPrice: 1000000,
        computedPrice: 1000000,
        percentageDiscount: 0,
        salePrice: 1000000
      };

      render(
        <MemoryRouter>
          <ProductCard product={product0Percent} onQuickView={onQuickViewMock} onAddToCart={onAddToCartMock} />
        </MemoryRouter>
      );

      // Discount badge should NOT be rendered when discount is 0%
      expect(screen.queryByTestId('discount-badge')).toBeNull();

      // Sale price and original price are rendered
      const salePriceEl = screen.getByTestId('sale-price');
      const originalPriceEl = screen.getByTestId('original-price');

      expect(salePriceEl.textContent).toContain('1.000.000');
      expect(salePriceEl.className).toContain('font-bold');
      expect(salePriceEl.className).toContain('text-red-600');

      expect(originalPriceEl.textContent).toContain('1.000.000');
      expect(originalPriceEl.className).toContain('line-through');
      expect(originalPriceEl.className).toContain('text-gray-400');
    });

    it('2. Handles 100% discount (computedPrice === 0 with originalPrice > 0)', () => {
      const product100Percent: Product = {
        ...baseMockProduct,
        hasActivePromotion: true,
        originalPrice: 1000000,
        computedPrice: 0,
        percentageDiscount: 100,
        salePrice: 0
      };

      render(
        <MemoryRouter>
          <ProductCard product={product100Percent} onQuickView={onQuickViewMock} onAddToCart={onAddToCartMock} />
        </MemoryRouter>
      );

      const discountBadgeEl = screen.getByTestId('discount-badge');
      expect(discountBadgeEl).toBeTruthy();
      expect(discountBadgeEl.textContent).toBe('-100%');
      expect(discountBadgeEl.className).toContain('bg-red-600');
      expect(discountBadgeEl.className).toContain('text-white');

      const salePriceEl = screen.getByTestId('sale-price');
      expect(salePriceEl.textContent).toContain('0');
      expect(salePriceEl.className).toContain('text-red-600');

      const originalPriceEl = screen.getByTestId('original-price');
      expect(originalPriceEl.textContent).toContain('1.000.000');
      expect(originalPriceEl.className).toContain('line-through');
    });

    it('3. Handles Zero Price (originalPrice === 0, computedPrice === 0)', () => {
      // Unpromoted 0 price
      const productZeroUnpromoted: Product = {
        ...baseMockProduct,
        price: 0,
        hasActivePromotion: false
      };

      const { unmount } = render(
        <MemoryRouter>
          <ProductCard product={productZeroUnpromoted} onQuickView={onQuickViewMock} onAddToCart={onAddToCartMock} />
        </MemoryRouter>
      );

      const regularPriceEl = screen.getByTestId('regular-price');
      expect(regularPriceEl.textContent).toContain('0');
      expect(regularPriceEl.className).toContain('font-extrabold');
      expect(regularPriceEl.className).toContain('text-brand-primary');
      unmount();

      // Promoted 0 price
      const productZeroPromoted: Product = {
        ...baseMockProduct,
        price: 0,
        originalPrice: 0,
        computedPrice: 0,
        hasActivePromotion: true
      };

      render(
        <MemoryRouter>
          <ProductCard product={productZeroPromoted} onQuickView={onQuickViewMock} onAddToCart={onAddToCartMock} />
        </MemoryRouter>
      );

      // Division by zero check -> discount badge should NOT render -NaN%
      expect(screen.queryByTestId('discount-badge')).toBeNull();
      expect(screen.getByTestId('sale-price').textContent).toContain('0');
      expect(screen.getByTestId('original-price').textContent).toContain('0');
    });

    it('4. Handles NaN/Invalid numerical inputs gracefully', () => {
      const productNaN: Product = {
        ...baseMockProduct,
        hasActivePromotion: true,
        originalPrice: 1000000,
        computedPrice: NaN,
        percentageDiscount: NaN
      };

      render(
        <MemoryRouter>
          <ProductCard product={productNaN} onQuickView={onQuickViewMock} onAddToCart={onAddToCartMock} />
        </MemoryRouter>
      );

      // Discount badge should not render when percentage is NaN
      expect(screen.queryByTestId('discount-badge')).toBeNull();
      // sale-price renders NaN string without crashing the tree
      const salePriceEl = screen.getByTestId('sale-price');
      expect(salePriceEl.textContent).toContain('NaN');
    });

    it('5. Handles missing optional promotion fields cleanly', () => {
      const productMissingPromoFields: Product = {
        ...baseMockProduct,
        hasActivePromotion: false,
        computedPrice: undefined,
        originalPrice: undefined,
        percentageDiscount: undefined,
        salePrice: undefined
      };

      render(
        <MemoryRouter>
          <ProductCard product={productMissingPromoFields} onQuickView={onQuickViewMock} onAddToCart={onAddToCartMock} />
        </MemoryRouter>
      );

      expect(screen.getByTestId('regular-price').textContent).toContain('1.000.000');
      expect(screen.queryByTestId('sale-price')).toBeNull();
      expect(screen.queryByTestId('original-price')).toBeNull();
      expect(screen.queryByTestId('discount-badge')).toBeNull();
    });

    it('6. Handles out-of-stock items with active promotion', () => {
      const productOutOfStockPromo: Product = {
        ...baseMockProduct,
        stock: 0,
        hasActivePromotion: true,
        originalPrice: 2000000,
        computedPrice: 1500000,
        percentageDiscount: 25,
        salePrice: 1500000
      };

      render(
        <MemoryRouter>
          <ProductCard product={productOutOfStockPromo} onQuickView={onQuickViewMock} onAddToCart={onAddToCartMock} />
        </MemoryRouter>
      );

      // "Hết hàng" badge rendered
      expect(screen.getByText('Hết hàng')).toBeTruthy();

      // Discount badge is SUPPRESSED when stock <= 0 (per ProductCard.tsx line 63)
      expect(screen.queryByTestId('discount-badge')).toBeNull();

      // Promotional prices are still displayed
      const salePriceEl = screen.getByTestId('sale-price');
      expect(salePriceEl.textContent).toContain('1.500.000');

      const originalPriceEl = screen.getByTestId('original-price');
      expect(originalPriceEl.textContent).toContain('2.000.000');
    });

    it('7. Handles extreme string length and massive multi-billion numbers', () => {
      const longName = 'A'.repeat(500);
      const longBrand = 'B'.repeat(150);
      const hugeOriginalPrice = 999999999999;
      const hugeComputedPrice = 888888888888;

      const productExtreme: Product = {
        ...baseMockProduct,
        name: longName,
        brand: longBrand,
        price: hugeOriginalPrice,
        originalPrice: hugeOriginalPrice,
        computedPrice: hugeComputedPrice,
        hasActivePromotion: true,
        percentageDiscount: 11
      };

      render(
        <MemoryRouter>
          <ProductCard product={productExtreme} onQuickView={onQuickViewMock} onAddToCart={onAddToCartMock} />
        </MemoryRouter>
      );

      expect(screen.getByText(longName)).toBeTruthy();
      expect(screen.getByText(longBrand)).toBeTruthy();
      expect(screen.getByTestId('sale-price').textContent).toContain('888.888.888.888');
      expect(screen.getByTestId('original-price').textContent).toContain('999.999.999.999');
      expect(screen.getByTestId('discount-badge').textContent).toBe('-11%');
    });

    it('8. Verifies exact visual styling Tailwind CSS classes & data-testid attributes', () => {
      const promotedProduct: Product = {
        ...baseMockProduct,
        hasActivePromotion: true,
        originalPrice: 1000000,
        computedPrice: 800000,
        percentageDiscount: 20
      };

      render(
        <MemoryRouter>
          <ProductCard product={promotedProduct} onQuickView={onQuickViewMock} onAddToCart={onAddToCartMock} />
        </MemoryRouter>
      );

      const salePriceEl = screen.getByTestId('sale-price');
      expect(salePriceEl.getAttribute('data-testid')).toBe('sale-price');
      expect(salePriceEl.className).toContain('font-bold');
      expect(salePriceEl.className).toContain('text-red-600');

      const originalPriceEl = screen.getByTestId('original-price');
      expect(originalPriceEl.getAttribute('data-testid')).toBe('original-price');
      expect(originalPriceEl.className).toContain('line-through');
      expect(originalPriceEl.className).toContain('text-gray-400');

      const discountBadgeEl = screen.getByTestId('discount-badge');
      expect(discountBadgeEl.getAttribute('data-testid')).toBe('discount-badge');
      expect(discountBadgeEl.className).toContain('bg-red-600');
      expect(discountBadgeEl.className).toContain('text-white');
    });
  });

  describe('productMappers Edge Cases', () => {
    it('1. mapProductVariant calculates percentageDiscount and handles 0% and 100% discount', () => {
      const v100: PmiVariant = {
        id: 101,
        sku_code: 'SKU-100',
        price: 100000,
        original_price: 100000,
        computed_price: 0,
        has_active_promotion: true,
        stock: 5
      };

      const mapped100 = mapProductVariant(v100, 1);
      expect(mapped100.percentageDiscount).toBe(100);
      expect(mapped100.computedPrice).toBe(0);
      expect(mapped100.originalPrice).toBe(100000);
      expect(mapped100.hasActivePromotion).toBe(true);

      const v0: PmiVariant = {
        id: 102,
        sku_code: 'SKU-0',
        price: 100000,
        original_price: 100000,
        computed_price: 100000,
        has_active_promotion: true,
        stock: 5
      };

      const mapped0 = mapProductVariant(v0, 1);
      expect(mapped0.percentageDiscount).toBe(0);
      expect(mapped0.computedPrice).toBe(100000);
      expect(mapped0.originalPrice).toBe(100000);
      expect(mapped0.hasActivePromotion).toBe(true);
    });

    it('2. mapProductVariant handles zero price without division by zero NaN', () => {
      const vZero: PmiVariant = {
        id: 103,
        sku_code: 'SKU-ZERO',
        price: 0,
        original_price: 0,
        computed_price: 0,
        has_active_promotion: true,
        stock: 0
      };

      const mappedZero = mapProductVariant(vZero, 1);
      expect(mappedZero.percentageDiscount).toBe(0);
      expect(Number.isNaN(mappedZero.percentageDiscount)).toBe(false);
    });

    it('3. mapPmiProduct synthesizes active promotion from variant when product level has_active_promotion is false', () => {
      const pmiProduct: PmiProduct = {
        id: 50,
        name: 'Vợt Cầu Lông Astro',
        has_active_promotion: false,
        variants: [
          {
            id: 501,
            price: 2000000,
            original_price: 2000000,
            computed_price: 1600000,
            has_active_promotion: true,
            percentage_discount: 20,
            stock: 10
          }
        ]
      };

      const mappedProduct = mapPmiProduct(pmiProduct, []);
      expect(mappedProduct.hasActivePromotion).toBe(true);
      expect(mappedProduct.computedPrice).toBe(1600000);
      expect(mappedProduct.originalPrice).toBe(2000000);
      expect(mappedProduct.percentageDiscount).toBe(20);
      expect(mappedProduct.salePrice).toBe(1600000);
    });

    it('4. mapPmiProduct handles product with no variants gracefully', () => {
      const emptyProduct: PmiProduct = {
        id: 99,
        name: 'Sản Phẩm Trống',
        has_active_promotion: false,
        variants: []
      };

      const mappedEmpty = mapPmiProduct(emptyProduct, []);
      expect(mappedEmpty.hasActivePromotion).toBe(false);
      expect(mappedEmpty.price).toBe(100000); // Default fallback price
      expect(mappedEmpty.computedPrice).toBeUndefined();
      expect(mappedEmpty.originalPrice).toBeUndefined();
      expect(mappedEmpty.percentageDiscount).toBeUndefined();
      expect(mappedEmpty.salePrice).toBeUndefined();
    });

    it('5. mapPmiProduct selects minimum active computed price among multiple variants', () => {
      const multiVariantProduct: PmiProduct = {
        id: 60,
        name: 'Giày Thể Thao Multi-Variant',
        has_active_promotion: true,
        variants: [
          {
            id: 601,
            price: 1500000,
            original_price: 1500000,
            computed_price: 1200000,
            has_active_promotion: true,
            stock: 5
          },
          {
            id: 602,
            price: 1500000,
            original_price: 1500000,
            computed_price: 1000000, // lower computed price
            has_active_promotion: true,
            stock: 5
          }
        ]
      };

      const mappedMulti = mapPmiProduct(multiVariantProduct, []);
      expect(mappedMulti.hasActivePromotion).toBe(true);
      expect(mappedMulti.computedPrice).toBe(1000000);
      expect(mappedMulti.originalPrice).toBe(1500000);
      expect(mappedMulti.percentageDiscount).toBe(33); // Math.round((500000/1500000)*100)
    });
  });
});
