import { describe, test, expect, vi, beforeEach } from 'vitest';
import { mapPmiProduct } from '../services/sport-api/productMappers';
import { sportApi } from '../services/sport-api/index';
import { WMS_API_URL } from '../services/sport-api/constants';

describe('Forensic Integrity Audit M2-1 for Requirement R2', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('Check 1 & 2: productMappers.ts maps 0 stock accurately and does NOT force stock to 100', () => {
    const pmiProduct = {
      id: 9999,
      name: 'Empirical Zero Stock Product',
      variants: [
        { id: 1, sku_code: 'SKU-EMP-0', price: 200000, stock: 0, tier_1_option: 'Standard' }
      ]
    };
    const categories = [{ id: 1, name: 'Vợt', code: 'rackets' }];
    const mapped = mapPmiProduct(pmiProduct as any, categories as any);

    expect(mapped.stock).toBe(0);
    expect(mapped.stock).not.toBe(100);
    expect(mapped.variants?.[0].stock).toBe(0);
  });

  test('Check 3: sportApi.getProducts genuinely issues fetch call to GET /public/stock', async () => {
    const calledUrls: string[] = [];

    global.fetch = vi.fn().mockImplementation((url: string) => {
      calledUrls.push(url);
      if (url.includes('/public/stock')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ stock: { 'SKU-WMS-TEST': 42 } })
        });
      }
      if (url.includes('/public/products')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            items: [
              {
                id: 8888,
                name: 'Product Testing Genuine WMS Call',
                variants: [
                  { id: 801, sku_code: 'SKU-WMS-TEST', price: 300000, stock: 5 }
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
      return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
    }) as any;

    const products = await sportApi.getProducts();

    // Verify GET /public/stock was called
    const wmsStockCalls = calledUrls.filter((u) => u.includes('/public/stock'));
    expect(wmsStockCalls.length).toBeGreaterThan(0);
    expect(wmsStockCalls[0]).toContain(`${WMS_API_URL}/public/stock?sku_codes=SKU-WMS-TEST`);

    // Verify fetched stock (42) was merged over initial stock (5)
    expect(products[0].stock).toBe(42);
    expect(products[0].variants?.[0].stock).toBe(42);
  });
});
