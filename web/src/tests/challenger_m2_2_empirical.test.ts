import { describe, test, expect, vi, beforeEach } from 'vitest';
import { mapPmiProduct } from '../services/sport-api/productMappers';
import { sportApi } from '../services/sport-api/index';
import { WMS_API_URL } from '../services/sport-api/constants';

describe('Empirical Challenge R2: Stock Mapper & UI Integration Verification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Stock Mapper Verification for 0 Stock Inputs', () => {
    test('mapPmiProduct maps single variant with stock 0 to product stock 0 (no fallback to 100)', () => {
      const pmiProduct = {
        id: 1001,
        name: 'Vợt Cầu Lông Zero Stock Single',
        variants: [
          { id: 10, sku_code: 'SKU-001', price: 1200000, stock: 0, tier_1_option: '3U/G5' }
        ]
      };
      const categories = [{ id: 1, name: 'Vợt', code: 'rackets' }];
      const result = mapPmiProduct(pmiProduct as any, categories as any);

      expect(result.stock).toBe(0);
      expect(result.variants?.[0].stock).toBe(0);
    });

    test('mapPmiProduct maps multiple variants all with stock 0 to aggregate product stock 0', () => {
      const pmiProduct = {
        id: 1002,
        name: 'Vợt Cầu Lông Zero Stock Multi',
        variants: [
          { id: 11, sku_code: 'SKU-002A', price: 1500000, stock: 0, tier_1_option: '3U/G5' },
          { id: 12, sku_code: 'SKU-002B', price: 1500000, stock: 0, tier_1_option: '4U/G5' }
        ]
      };
      const categories = [{ id: 1, name: 'Vợt', code: 'rackets' }];
      const result = mapPmiProduct(pmiProduct as any, categories as any);

      expect(result.stock).toBe(0);
      expect(result.variants?.[0].stock).toBe(0);
      expect(result.variants?.[1].stock).toBe(0);
    });

    test('mapPmiProduct maps negative or undefined/null stock to 0', () => {
      const pmiProduct = {
        id: 1003,
        name: 'Vợt Cầu Lông Negative Stock',
        variants: [
          { id: 13, sku_code: 'SKU-NEG', price: 1000000, stock: -10, tier_1_option: '3U/G5' },
          { id: 14, sku_code: 'SKU-NULL', price: 1000000, stock: null, tier_1_option: '4U/G5' }
        ]
      };
      const categories = [{ id: 1, name: 'Vợt', code: 'rackets' }];
      const result = mapPmiProduct(pmiProduct as any, categories as any);

      expect(result.stock).toBe(0);
      expect(result.variants?.[0].stock).toBe(-10); // Variant raw stock preserved, but aggregate product stock is 0
    });

    test('mapPmiProduct correctly computes positive total stock for mixed variants', () => {
      const pmiProduct = {
        id: 1004,
        name: 'Vợt Cầu Lông Mixed Stock',
        variants: [
          { id: 15, sku_code: 'SKU-ZERO', price: 1000000, stock: 0, tier_1_option: '3U/G5' },
          { id: 16, sku_code: 'SKU-POS', price: 1000000, stock: 5, tier_1_option: '4U/G5' }
        ]
      };
      const categories = [{ id: 1, name: 'Vợt', code: 'rackets' }];
      const result = mapPmiProduct(pmiProduct as any, categories as any);

      expect(result.stock).toBe(5);
      expect(result.variants?.[0].stock).toBe(0);
      expect(result.variants?.[1].stock).toBe(5);
    });
  });

  describe('2. WMS Stock Integration Verification', () => {
    test('WMS_API_URL exports correct fallback URL', () => {
      expect(WMS_API_URL).toBeDefined();
      expect(WMS_API_URL).toBe('http://localhost:18102');
    });

    test('getProducts merges WMS stock 0 into product and variants', async () => {
      const mockWmsResponse = {
        stock: {
          'SKU-WMS-01': 0,
          'SKU-WMS-02': 0
        }
      };

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/public/stock')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockWmsResponse)
          });
        }
        if (url.includes('/public/products')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              items: [
                {
                  id: 2001,
                  name: 'Product WMS 0 Stock',
                  variants: [
                    { id: 201, sku_code: 'SKU-WMS-01', price: 500000, stock: 10 },
                    { id: 202, sku_code: 'SKU-WMS-02', price: 500000, stock: 20 }
                  ]
                }
              ]
            })
          });
        }
        if (url.includes('/public/categories')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([])
          });
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      }) as any;

      const products = await sportApi.getProducts();
      expect(products.length).toBe(1);

      const p = products[0];
      expect(p.variants?.[0].stock).toBe(0);
      expect(p.variants?.[1].stock).toBe(0);
      expect(p.stock).toBe(0); // Overridden by live WMS 0 stock!
    });

    test('getProductById updates product stock to 0 when WMS stock returns 0', async () => {
      const mockWmsResponse = {
        stock: {
          'SKU-SINGLE-WMS': 0
        }
      };

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/public/stock')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockWmsResponse)
          });
        }
        if (url.includes('/public/products/2002')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              id: 2002,
              name: 'Single Product WMS 0',
              variants: [
                { id: 301, sku_code: 'SKU-SINGLE-WMS', price: 800000, stock: 50 }
              ]
            })
          });
        }
        if (url.includes('/public/categories')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([])
          });
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      }) as any;

      const product = await sportApi.getProductById('2002');
      expect(product).not.toBeNull();
      expect(product?.stock).toBe(0);
      expect(product?.variants?.[0].stock).toBe(0);
    });
  });
});
