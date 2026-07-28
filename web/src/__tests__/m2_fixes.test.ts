import { describe, test, expect, vi, beforeEach } from 'vitest';
import { getChannels, findManualChannel, findStorefrontChannel } from '../services/sport-api/omsHelpers';

describe('Milestone 2 Web Helper Fixes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('getChannels returns [] on network error or fetch failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const channels = await getChannels();
    expect(channels).toEqual([]);
  });

  test('getChannels returns [] on non-200 HTTP response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500
    });
    const channels = await getChannels();
    expect(channels).toEqual([]);
  });

  test('findManualChannel safely handles null or undefined channels input', () => {
    expect(findManualChannel(null)).toBeUndefined();
    expect(findManualChannel(undefined)).toBeUndefined();
    expect(findManualChannel([])).toBeUndefined();

    const sampleChannels = [
      { id: 1, name: 'Bán tại cửa hàng', code: 'MANUAL', is_active: true }
    ];
    expect(findManualChannel(sampleChannels as any)?.code).toBe('MANUAL');
  });

  test('findStorefrontChannel safely handles null or undefined channels input', () => {
    expect(findStorefrontChannel(null)).toBeUndefined();
    expect(findStorefrontChannel(undefined)).toBeUndefined();
    expect(findStorefrontChannel([])).toBeUndefined();

    const sampleChannels = [
      { id: 2, name: 'Website Storefront', code: 'STOREFRONT', is_active: true }
    ];
    expect(findStorefrontChannel(sampleChannels as any)?.code).toBe('STOREFRONT');
  });
});
