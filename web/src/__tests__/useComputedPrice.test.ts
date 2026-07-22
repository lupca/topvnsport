// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useComputedPrice } from '../hooks/useComputedPrice';

describe('useComputedPrice hook', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    global.fetch = originalFetch;
  });

  it('handles empty / undefined / null variantId without making network requests', () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    const { result } = renderHook(() => useComputedPrice(null, 150000));

    expect(result.current.loading).toBe(false);
    expect(result.current.hasActivePromotion).toBe(false);
    expect(result.current.computedPrice).toBe(150000);
    expect(result.current.originalPrice).toBe(150000);
    expect(result.current.discountAmount).toBe(0);
    expect(result.current.percentageDiscount).toBe(0);
    expect(result.current.error).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetches active promotion price successfully', async () => {
    const mockApiResponse = {
      id: 'cp-1',
      variant_id: '101',
      promotion_id: 'p-1',
      original_price: 1000000,
      computed_price: 800000,
      discount_amount: 200000,
      percentage_discount: 20,
      has_active_promotion: true,
      promotion_code: 'SUMMER20',
      promotion_name: 'Giảm giá mùa hè'
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse
    });

    const { result } = renderHook(() => useComputedPrice('101', 1000000));

    // Initial loading state
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.hasActivePromotion).toBe(true);
    expect(result.current.computedPrice).toBe(800000);
    expect(result.current.originalPrice).toBe(1000000);
    expect(result.current.discountAmount).toBe(200000);
    expect(result.current.percentageDiscount).toBe(20);
    expect(result.current.error).toBeNull();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/variants/101/computed-price'),
      expect.any(Object)
    );
  });

  it('handles unpromoted variant gracefully', async () => {
    const mockApiResponse = {
      variant_id: '102',
      original_price: 500000,
      computed_price: 500000,
      discount_amount: 0,
      percentage_discount: 0,
      has_active_promotion: false
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse
    });

    const { result } = renderHook(() => useComputedPrice('102', 500000));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.hasActivePromotion).toBe(false);
    expect(result.current.computedPrice).toBe(500000);
    expect(result.current.originalPrice).toBe(500000);
    expect(result.current.discountAmount).toBe(0);
    expect(result.current.percentageDiscount).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('falls back gracefully to initialPrice when fetch fails (HTTP error)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    });

    const { result } = renderHook(() => useComputedPrice('999', 600000));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.hasActivePromotion).toBe(false);
    expect(result.current.computedPrice).toBe(600000);
    expect(result.current.originalPrice).toBe(600000);
    expect(result.current.discountAmount).toBe(0);
    expect(result.current.percentageDiscount).toBe(0);
    expect(result.current.error).toContain('status 404');
  });

  it('falls back gracefully on network exception', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network connectivity failure'));

    const { result } = renderHook(() => useComputedPrice('103', 750000));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.hasActivePromotion).toBe(false);
    expect(result.current.computedPrice).toBe(750000);
    expect(result.current.originalPrice).toBe(750000);
    expect(result.current.error).toBe('Network connectivity failure');
  });

  it('re-fetches when variantId changes', async () => {
    const response1 = {
      variant_id: 'v1',
      original_price: 100000,
      computed_price: 80000,
      discount_amount: 20000,
      percentage_discount: 20,
      has_active_promotion: true
    };

    const response2 = {
      variant_id: 'v2',
      original_price: 200000,
      computed_price: 150000,
      discount_amount: 50000,
      percentage_discount: 25,
      has_active_promotion: true
    };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => response1 })
      .mockResolvedValueOnce({ ok: true, json: async () => response2 });

    const { result, rerender } = renderHook(
      ({ id, price }) => useComputedPrice(id, price),
      { initialProps: { id: 'v1', price: 100000 } }
    );

    await waitFor(() => {
      expect(result.current.computedPrice).toBe(80000);
    });

    // Change variantId
    rerender({ id: 'v2', price: 200000 });

    await waitFor(() => {
      expect(result.current.computedPrice).toBe(150000);
    });

    expect(result.current.discountAmount).toBe(50000);
    expect(result.current.percentageDiscount).toBe(25);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
