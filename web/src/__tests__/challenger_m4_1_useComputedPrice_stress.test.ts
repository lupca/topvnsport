// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useComputedPrice } from '../hooks/useComputedPrice';

describe('Adversarial Stress Suite: useComputedPrice', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    global.fetch = originalFetch;
  });

  // ==========================================
  // 1. Edge cases on variantId input values
  // ==========================================
  describe('Variant ID Edge Cases', () => {
    it('handles empty string, whitespace string, null, and undefined without fetching', () => {
      const fetchSpy = vi.fn();
      global.fetch = fetchSpy;

      const inputs = ['', '   ', null, undefined];
      inputs.forEach((input) => {
        const { result } = renderHook(() => useComputedPrice(input, 100000));
        expect(result.current.loading).toBe(false);
        expect(result.current.computedPrice).toBe(100000);
        expect(result.current.originalPrice).toBe(100000);
        expect(result.current.hasActivePromotion).toBe(false);
        expect(result.current.error).toBeNull();
      });

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('triggers fetch for numerical zero (variantId = 0)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          variant_id: 0,
          original_price: 50000,
          computed_price: 40000,
          discount_amount: 10000,
          percentage_discount: 20,
          has_active_promotion: true,
        }),
      });

      const { result } = renderHook(() => useComputedPrice(0, 50000));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.computedPrice).toBe(40000);
      expect(result.current.hasActivePromotion).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/variants/0/computed-price'),
        expect.any(Object)
      );
    });

    it('encodes special characters in variantId correctly', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          variant_id: 'var/123?test=true#hash',
          original_price: 100000,
          computed_price: 100000,
          has_active_promotion: false,
        }),
      });

      const specialId = 'var/123?test=true#hash';
      const { result } = renderHook(() => useComputedPrice(specialId, 100000));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const expectedPath = `/api/variants/${encodeURIComponent(specialId)}/computed-price`;
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(expectedPath),
        expect.any(Object)
      );
    });
  });

  // ==========================================
  // 2. Rapid switching & Race condition stress
  // ==========================================
  describe('Rapid Variant ID Switching & Race Conditions', () => {
    it('discards stale response when variantId changes and slow request resolves after fast request', async () => {
      let resolveSlow: (val: any) => void;
      let resolveFast: (val: any) => void;

      const slowPromise = new Promise((resolve) => { resolveSlow = resolve; });
      const fastPromise = new Promise((resolve) => { resolveFast = resolve; });

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/variants/slow-v1/computed-price')) {
          return slowPromise;
        }
        if (url.includes('/api/variants/fast-v2/computed-price')) {
          return fastPromise;
        }
        return Promise.reject(new Error('Unknown url'));
      });

      const { result, rerender } = renderHook(
        ({ id }) => useComputedPrice(id, 100000),
        { initialProps: { id: 'slow-v1' } }
      );

      expect(result.current.loading).toBe(true);

      // Rapidly switch to fast-v2 before slow-v1 resolves
      rerender({ id: 'fast-v2' });

      // Resolve fast-v2 first
      resolveFast!({
        ok: true,
        json: async () => ({
          variant_id: 'fast-v2',
          original_price: 100000,
          computed_price: 70000,
          discount_amount: 30000,
          percentage_discount: 30,
          has_active_promotion: true,
        }),
      });

      await waitFor(() => {
        expect(result.current.computedPrice).toBe(70000);
      });

      // Now resolve slow-v1 late
      resolveSlow!({
        ok: true,
        json: async () => ({
          variant_id: 'slow-v1',
          original_price: 100000,
          computed_price: 90000,
          discount_amount: 10000,
          percentage_discount: 10,
          has_active_promotion: true,
        }),
      });

      // Give microtasks a tick to settle
      await new Promise((r) => setTimeout(r, 50));

      // Result MUST remain fast-v2 (70000), slow-v1 (90000) MUST NOT overwrite it
      expect(result.current.computedPrice).toBe(70000);
      expect(result.current.percentageDiscount).toBe(30);
    });

    it('resets state immediately when switched to empty variantId mid-flight', async () => {
      let resolvePending: (val: any) => void;
      const pendingPromise = new Promise((resolve) => { resolvePending = resolve; });

      global.fetch = vi.fn().mockReturnValue(pendingPromise);

      const { result, rerender } = renderHook(
        ({ id }) => useComputedPrice(id, 100000),
        { initialProps: { id: 'pending-v1' } }
      );

      expect(result.current.loading).toBe(true);

      // Switch to empty variantId
      rerender({ id: '' });

      expect(result.current.loading).toBe(false);
      expect(result.current.computedPrice).toBe(100000);

      // Late resolve of pending request
      resolvePending!({
        ok: true,
        json: async () => ({
          original_price: 100000,
          computed_price: 50000,
          has_active_promotion: true,
        }),
      });

      await new Promise((r) => setTimeout(r, 50));

      expect(result.current.computedPrice).toBe(100000);
      expect(result.current.hasActivePromotion).toBe(false);
    });
  });

  // ==========================================
  // 3. Unmounting while fetch in-flight & AbortController
  // ==========================================
  describe('Unmounting & AbortController Cleanup', () => {
    it('aborts fetch signal when component unmounts while request is in-flight', async () => {
      let signalCaptured: AbortSignal | undefined;

      global.fetch = vi.fn().mockImplementation((url, options) => {
        signalCaptured = options?.signal;
        return new Promise(() => {}); // Never resolves
      });

      const { unmount } = renderHook(() => useComputedPrice('v-unmount', 200000));

      expect(signalCaptured).toBeDefined();
      expect(signalCaptured?.aborted).toBe(false);

      unmount();

      expect(signalCaptured?.aborted).toBe(true);
    });

    it('does not cause state update error or unhandled rejection when unmounted fetch rejects with AbortError', async () => {
      let rejectFetch: (err: any) => void;
      const fetchPromise = new Promise((_, reject) => {
        rejectFetch = reject;
      });

      global.fetch = vi.fn().mockImplementation((url, options) => {
        options?.signal?.addEventListener('abort', () => {
          const err = new Error('The user aborted a request.');
          err.name = 'AbortError';
          rejectFetch(err);
        });
        return fetchPromise;
      });

      const { unmount } = renderHook(() => useComputedPrice('v-abort-test', 150000));

      // Unmount triggers signal.abort() which rejects fetchPromise with AbortError
      unmount();

      // Wait a tick to ensure promise rejection is handled without crash
      await new Promise((r) => setTimeout(r, 50));
    });
  });

  // ==========================================
  // 4. Network and HTTP Failure Stress
  // ==========================================
  describe('Network and HTTP Failures', () => {
    it('handles HTTP 500 Server Error gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const { result } = renderHook(() => useComputedPrice('v-500', 300000));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasActivePromotion).toBe(false);
      expect(result.current.computedPrice).toBe(300000);
      expect(result.current.originalPrice).toBe(300000);
      expect(result.current.error).toContain('status 500');
    });

    it('handles HTTP 502 Bad Gateway gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
      });

      const { result } = renderHook(() => useComputedPrice('v-502', 300000));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toContain('status 502');
    });

    it('handles non-Error objects thrown during fetch (raw string or object)', async () => {
      global.fetch = vi.fn().mockRejectedValue('Raw string network error');

      const { result } = renderHook(() => useComputedPrice('v-raw-err', 400000));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasActivePromotion).toBe(false);
      expect(result.current.computedPrice).toBe(400000);
      expect(result.current.error).toBe('Failed to fetch computed price');
    });
  });

  // ==========================================
  // 5. Malformed & Invalid API Payloads
  // ==========================================
  describe('Malformed and Invalid API Payload Stress', () => {
    it('handles invalid JSON body (syntax error / HTML response)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON at position 0');
        },
      });

      const { result } = renderHook(() => useComputedPrice('v-html-res', 250000));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasActivePromotion).toBe(false);
      expect(result.current.computedPrice).toBe(250000);
      expect(result.current.error).toContain('Unexpected token <');
    });

    it('handles null JSON response gracefully without breaking hook', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => null,
      });

      const { result } = renderHook(() => useComputedPrice('v-null-json', 200000));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasActivePromotion).toBe(false);
      expect(result.current.computedPrice).toBe(200000);
      expect(result.current.error).toBeTruthy();
    });

    it('handles string prices in API response by falling back to initialPrice', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          original_price: '100000', // String instead of number
          computed_price: '80000',   // String instead of number
          discount_amount: '20000',
          percentage_discount: '20',
          has_active_promotion: true,
        }),
      });

      const { result } = renderHook(() => useComputedPrice('v-string-prices', 100000));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Since typeof check is strict (typeof json.original_price === 'number'),
      // string values fall back to initialPrice (100000) and discount amount 0.
      expect(result.current.computedPrice).toBe(100000);
      expect(result.current.originalPrice).toBe(100000);
      expect(result.current.discountAmount).toBe(0);
      expect(result.current.percentageDiscount).toBe(0);
      expect(result.current.hasActivePromotion).toBe(true);
    });

    it('handles empty payload object {}', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const { result } = renderHook(() => useComputedPrice('v-empty-obj', 120000));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.computedPrice).toBe(120000);
      expect(result.current.originalPrice).toBe(120000);
      expect(result.current.discountAmount).toBe(0);
      expect(result.current.percentageDiscount).toBe(0);
      expect(result.current.hasActivePromotion).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });
});
