# Task 01: Tests for Utility Functions

## Mục tiêu
Viết unit tests cho các utility functions trước khi refactor.

## Dependencies
- None (đây là task đầu tiên)

## Files cần test

### 1. `src/utils/skuHelper.ts`

**Test file**: `src/utils/skuHelper.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { cleanOptionForSku, generateSkuCode } from './skuHelper';

describe('cleanOptionForSku', () => {
  it('returns empty string for empty input', () => {
    expect(cleanOptionForSku('')).toBe('');
    expect(cleanOptionForSku(null as any)).toBe('');
    expect(cleanOptionForSku(undefined as any)).toBe('');
  });

  it('converts Vietnamese characters', () => {
    expect(cleanOptionForSku('Đỏ')).toBe('DO');
    expect(cleanOptionForSku('đen')).toBe('DEN');
    expect(cleanOptionForSku('Xanh dương')).toBe('XANH-DUONG');
  });

  it('removes accents', () => {
    expect(cleanOptionForSku('Trắng')).toBe('TRANG');
    expect(cleanOptionForSku('Vàng')).toBe('VANG');
    expect(cleanOptionForSku('Nâu')).toBe('NAU');
  });

  it('converts to uppercase', () => {
    expect(cleanOptionForSku('red')).toBe('RED');
    expect(cleanOptionForSku('Blue')).toBe('BLUE');
  });

  it('replaces special characters with hyphen', () => {
    expect(cleanOptionForSku('Red & Blue')).toBe('RED-BLUE');
    expect(cleanOptionForSku('Size (L)')).toBe('SIZE-L');
    expect(cleanOptionForSku('100% Cotton')).toBe('100-COTTON');
  });

  it('removes leading and trailing hyphens', () => {
    expect(cleanOptionForSku('--Red--')).toBe('RED');
    expect(cleanOptionForSku('  Blue  ')).toBe('BLUE');
  });

  it('handles complex Vietnamese strings', () => {
    expect(cleanOptionForSku('Xanh lá cây')).toBe('XANH-LA-CAY');
    expect(cleanOptionForSku('Đỏ đô')).toBe('DO-DO');
  });
});

describe('generateSkuCode', () => {
  it('generates code with DEFAULT suffix when no tiers', () => {
    expect(generateSkuCode('ABC')).toBe('ABC-DEFAULT');
    expect(generateSkuCode('abc')).toBe('ABC-DEFAULT');
  });

  it('generates code with tier 1 only', () => {
    expect(generateSkuCode('ABC', 'Red')).toBe('ABC-RED');
    expect(generateSkuCode('ABC', 'Đỏ')).toBe('ABC-DO');
  });

  it('generates code with tier 1 and tier 2', () => {
    expect(generateSkuCode('ABC', 'Red', 'Large')).toBe('ABC-RED-LARGE');
    expect(generateSkuCode('ABC', 'Đỏ', '3U')).toBe('ABC-DO-3U');
  });

  it('handles null/undefined tiers', () => {
    expect(generateSkuCode('ABC', null, null)).toBe('ABC-DEFAULT');
    expect(generateSkuCode('ABC', 'Red', null)).toBe('ABC-RED');
    expect(generateSkuCode('ABC', null, 'Large')).toBe('ABC-LARGE');
  });

  it('handles empty string tiers', () => {
    expect(generateSkuCode('ABC', '', '')).toBe('ABC-DEFAULT');
    expect(generateSkuCode('ABC', 'Red', '')).toBe('ABC-RED');
  });

  it('handles empty product code', () => {
    expect(generateSkuCode('', 'Red')).toBe('-RED');
    expect(generateSkuCode('', null, null)).toBe('-DEFAULT');
  });

  it('handles complex real-world examples', () => {
    expect(generateSkuCode('YONEX-AX77', 'Xanh navy', '4U (83g)')).toBe('YONEX-AX77-XANH-NAVY-4U-83G');
    expect(generateSkuCode('TSHIRT-001', 'Đỏ đô', 'Size L')).toBe('TSHIRT-001-DO-DO-SIZE-L');
  });
});
```

### 2. `src/utils/imageUrl.ts`

**Test file**: `src/utils/imageUrl.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeImageUrl } from './imageUrl';

describe('normalizeImageUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  it('returns null for empty input', () => {
    expect(normalizeImageUrl('')).toBeNull();
    expect(normalizeImageUrl(null as any)).toBeNull();
    expect(normalizeImageUrl(undefined as any)).toBeNull();
  });

  it('returns absolute URLs unchanged', () => {
    expect(normalizeImageUrl('https://example.com/image.jpg')).toBe('https://example.com/image.jpg');
    expect(normalizeImageUrl('http://example.com/image.jpg')).toBe('http://example.com/image.jpg');
  });

  it('prepends base URL to relative paths', () => {
    // This depends on APP_SETTINGS, mock as needed
    const result = normalizeImageUrl('/uploads/image.jpg');
    expect(result).toContain('/uploads/image.jpg');
  });

  it('handles paths without leading slash', () => {
    const result = normalizeImageUrl('uploads/image.jpg');
    expect(result).toContain('uploads/image.jpg');
  });
});
```

### 3. `src/utils/apiClient.ts`

**Test file**: `src/utils/apiClient.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithAuth, apiClient } from './apiClient';

describe('fetchWithAuth', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue('mock-token'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adds authorization header', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    } as Response);

    await fetchWithAuth('/api/test');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/test'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer mock-token',
        }),
      })
    );
  });

  it('throws error on non-ok response', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ detail: 'Not found' }),
    } as Response);

    await expect(fetchWithAuth('/api/test')).rejects.toThrow();
  });

  it('handles network errors', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

    await expect(fetchWithAuth('/api/test')).rejects.toThrow('Network error');
  });
});

describe('apiClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue('mock-token'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('post sends JSON body', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 1 }),
    } as Response);

    await apiClient.post('/api/products', { name: 'Test' });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Test' }),
      })
    );
  });

  it('put sends JSON body', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 1 }),
    } as Response);

    await apiClient.put('/api/products/1', { name: 'Updated' });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated' }),
      })
    );
  });

  it('post handles FormData (file upload)', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ image_url: '/uploads/test.jpg' }),
    } as Response);

    const formData = new FormData();
    formData.append('file', new Blob(['test']));

    await apiClient.post('/api/upload', formData);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: formData,
      })
    );
  });
});
```

## Checklist

- [ ] Create `src/utils/skuHelper.test.ts`
- [ ] Create `src/utils/imageUrl.test.ts`
- [ ] Create `src/utils/apiClient.test.ts`
- [ ] Run tests: `npm run test -- src/utils/`
- [ ] All tests pass
- [ ] Coverage > 80% for these files

## Commands

```bash
# Run specific test file
docker compose -f PMI/docker-compose.yml exec frontend npm run test -- src/utils/skuHelper.test.ts

# Run all utils tests
docker compose -f PMI/docker-compose.yml exec frontend npm run test -- src/utils/

# Run with coverage
docker compose -f PMI/docker-compose.yml exec frontend npm run test -- --coverage src/utils/
```

## Estimate
- 2 hours
