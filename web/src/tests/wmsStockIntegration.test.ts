import { describe, test, expect, vi, beforeEach } from 'vitest';
import { mapPmiProduct } from '../services/sport-api/productMappers';
import { sportApi } from '../services/sportApi';
import { WMS_API_URL } from '../services/sport-api/constants';

describe('WMS Stock Integration & Product Mappers Tests (Requirement R2)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('mapPmiProduct maps 0 stock correctly without fallback to 100', () => {
    const pmiProduct = {
      id: 101,
      name: 'Vợt Badminton Test Zero Stock',
      variants: [
        { id: 1, sku_code: 'SKU-ZERO-1', price: 1000000, stock: 0, tier_1_option: 'Standard' }
      ]
    };

    const categories = [{ id: 1, name: 'Vợt', code: 'rackets' }];
    const mapped = mapPmiProduct(pmiProduct as any, categories as any);

    expect(mapped.stock).toBe(0);
    expect(mapped.variants?.[0].stock).toBe(0);
  });

  test('WMS_API_URL constant defaults to http://localhost:18102', () => {
    expect(WMS_API_URL).toBeDefined();
    expect(WMS_API_URL).toContain('18102');
  });

  test('fetchWmsStock & mergeWmsStock merges WMS stock data into variants and aggregate product stock', async () => {
    const mockWmsResponse = {
      stock: {
        'SKU-TEST-1': 15,
        'SKU-TEST-2': 0
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
                id: 200,
                name: 'Test Product WMS Merge',
                variants: [
                  { id: 201, sku_code: 'SKU-TEST-1', price: 500000, stock: 5 },
                  { id: 202, sku_code: 'SKU-TEST-2', price: 500000, stock: 10 }
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
      return Promise.reject(new Error('Unknown URL'));
    }) as any;

    const products = await sportApi.getProducts();
    expect(products.length).toBe(1);

    const p = products[0];
    expect(p.variants).toBeDefined();
    expect(p.variants?.length).toBe(2);

    const v1 = p.variants?.find((v) => v.sku_code === 'SKU-TEST-1');
    const v2 = p.variants?.find((v) => v.sku_code === 'SKU-TEST-2');

    expect(v1?.stock).toBe(15);
    expect(v2?.stock).toBe(0);
    // Aggregate stock should be 15 + 0 = 15
    expect(p.stock).toBe(15);
  });

  test('fetchWmsStock chunks requests when querying more than 50 SKUs', async () => {
    const fetchCalls: string[] = [];
    global.fetch = vi.fn().mockImplementation((url: string) => {
      fetchCalls.push(url);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ stock: {} })
      });
    }) as any;

    const largeSkuList = Array.from({ length: 120 }, (_, i) => `SKU-LARGE-${i}`);
    const result = await sportApi.getWmsStock(largeSkuList);

    expect(fetchCalls.length).toBe(3); // 50 + 50 + 20 = 120 SKUs
    expect(result).toBeDefined();
  });
});
