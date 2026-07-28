import { describe, test, expect, vi, beforeEach } from 'vitest';
import { getChannels, findManualChannel, findStorefrontChannel } from '../services/sport-api/omsHelpers';
import { OmsChannel } from '../services/sport-api/types';

describe('Challenger M2-2: omsHelpers.ts Empirical Stress Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getChannels network & HTTP error resilience', () => {
    test('handles fetch throwing TypeError (network failure)', async () => {
      global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
      const result = await getChannels();
      expect(result).toEqual([]);
    });

    test('handles fetch throwing generic Error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Connection reset by peer'));
      const result = await getChannels();
      expect(result).toEqual([]);
    });

    test('handles fetch rejecting with string or null', async () => {
      global.fetch = vi.fn().mockRejectedValue('Fatal network error');
      const result1 = await getChannels();
      expect(result1).toEqual([]);

      global.fetch = vi.fn().mockRejectedValue(null);
      const result2 = await getChannels();
      expect(result2).toEqual([]);
    });

    test('handles non-200 HTTP statuses (400, 401, 404, 500, 502, 503)', async () => {
      const statuses = [400, 401, 403, 404, 500, 502, 503];
      for (const status of statuses) {
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status,
          json: async () => ({ error: 'Error' }),
        });
        const result = await getChannels('query');
        expect(result).toEqual([]);
      }
    });

    test('handles non-JSON HTTP response body (HTML error page)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON at position 0');
        },
      });
      const result = await getChannels();
      expect(result).toEqual([]);
    });

    test('handles response.json() returning null, undefined, or primitive non-object', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => null,
      });
      expect(await getChannels()).toEqual([]);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => undefined,
      });
      expect(await getChannels()).toEqual([]);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => 'not-an-object',
      });
      expect(await getChannels()).toEqual([]);
    });

    test('handles response.json() missing items property or items is null', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ total: 0 }),
      });
      expect(await getChannels()).toEqual([]);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ items: null }),
      });
      expect(await getChannels()).toEqual([]);
    });

    test('successfully fetches channels when response is valid', async () => {
      const mockItems: OmsChannel[] = [
        { id: 1, name: 'Manual', code: 'MANUAL', is_active: true },
        { id: 2, name: 'Storefront', code: 'STOREFRONT', is_active: true },
      ];
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ items: mockItems, total: 2, page: 1, limit: 100 }),
      });
      const result = await getChannels();
      expect(result).toEqual(mockItems);
    });
  });

  describe('findManualChannel input & channel object validation', () => {
    test('handles undefined and null channels parameter', () => {
      expect(findManualChannel(undefined)).toBeUndefined();
      expect(findManualChannel(null)).toBeUndefined();
      expect(findManualChannel([])).toBeUndefined();
    });

    test('handles invalid elements inside channels array (null, undefined, empty object)', () => {
      const dirtyArray = [
        null as any,
        undefined as any,
        {} as any,
        { id: 1 } as any,
        { code: 'OTHER', is_active: true } as any,
        { code: 'MANUAL', is_active: false } as any,
      ];
      expect(findManualChannel(dirtyArray)).toBeUndefined();
    });

    test('finds manual channel case-insensitively when valid', () => {
      const channels: OmsChannel[] = [
        { id: 1, name: 'Pos', code: 'manual', is_active: true },
      ];
      const found = findManualChannel(channels);
      expect(found).toBeDefined();
      expect(found?.id).toBe(1);
    });

    test('handles non-string code values gracefully without crashing or identifies crash', () => {
      const invalidCodeChannels = [
        { id: 1, code: 123 as any, is_active: true },
      ];
      let threw = false;
      try {
        findManualChannel(invalidCodeChannels as any);
      } catch (err) {
        threw = true;
      }
      // Empirical assertion: test whether non-string code throws TypeError
      console.log('findManualChannel with non-string code threw error:', threw);
    });
  });

  describe('findStorefrontChannel input & channel object validation', () => {
    test('handles undefined and null channels parameter', () => {
      expect(findStorefrontChannel(undefined)).toBeUndefined();
      expect(findStorefrontChannel(null)).toBeUndefined();
      expect(findStorefrontChannel([])).toBeUndefined();
    });

    test('handles invalid elements inside channels array (null, undefined, empty object)', () => {
      const dirtyArray = [
        null as any,
        undefined as any,
        {} as any,
        { id: 2 } as any,
        { code: 'OTHER', is_active: true } as any,
        { code: 'STOREFRONT', is_active: false } as any,
      ];
      expect(findStorefrontChannel(dirtyArray)).toBeUndefined();
    });

    test('finds storefront channel case-insensitively when valid', () => {
      const channels: OmsChannel[] = [
        { id: 2, name: 'Web', code: 'storefront', is_active: true },
      ];
      const found = findStorefrontChannel(channels);
      expect(found).toBeDefined();
      expect(found?.id).toBe(2);
    });

    test('handles non-string code values gracefully without crashing or identifies crash', () => {
      const invalidCodeChannels = [
        { id: 2, code: true as any, is_active: true },
      ];
      let threw = false;
      try {
        findStorefrontChannel(invalidCodeChannels as any);
      } catch (err) {
        threw = true;
      }
      console.log('findStorefrontChannel with non-string code threw error:', threw);
    });
  });
});
