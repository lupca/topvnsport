# Frontend Package: Shared Hooks

## Task ID: FE-04
## Prerequisites: FE-00 (Setup)
## Estimated: 1 hour

---

## Mục Tiêu

Tạo shared React hooks:
- useDebounce - debounce values
- usePagination - pagination state management

---

## Implementation

### File: `packages/ui-kit/src/hooks/useDebounce.ts`

```typescript
import { useState, useEffect } from 'react';

/**
 * Debounce a value.
 * 
 * @param value - Value to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced value
 * 
 * @example
 * const [search, setSearch] = useState('');
 * const debouncedSearch = useDebounce(search, 300);
 * 
 * useEffect(() => {
 *   fetchResults(debouncedSearch);
 * }, [debouncedSearch]);
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
```

### File: `packages/ui-kit/src/hooks/usePagination.ts`

```typescript
import { useState, useMemo, useCallback, useEffect } from 'react';

export interface UsePaginationOptions {
  total: number;
  pageSize?: number;
  initialPage?: number;
  resetOnTotalChange?: boolean;
}

export interface UsePaginationReturn {
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  startIndex: number;
  endIndex: number;
  nextPage: () => void;
  prevPage: () => void;
  goToPage: (page: number) => void;
  setPageSize: (size: number) => void;
}

/**
 * Manage pagination state.
 * 
 * @param options - Pagination options
 * @returns Pagination state and actions
 * 
 * @example
 * const {
 *   page,
 *   totalPages,
 *   hasNext,
 *   hasPrev,
 *   nextPage,
 *   prevPage,
 *   goToPage,
 * } = usePagination({ total: 100, pageSize: 10 });
 */
export function usePagination({
  total,
  pageSize: initialPageSize = 10,
  initialPage = 1,
  resetOnTotalChange = true,
}: UsePaginationOptions): UsePaginationReturn {
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(total / pageSize));
  }, [total, pageSize]);

  // Reset to page 1 when total changes (e.g., new search)
  useEffect(() => {
    if (resetOnTotalChange) {
      setPage(1);
    }
  }, [total, resetOnTotalChange]);

  // Ensure page doesn't exceed totalPages
  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize - 1, total - 1);

  const nextPage = useCallback(() => {
    setPage(p => Math.min(p + 1, totalPages));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setPage(p => Math.max(p - 1, 1));
  }, []);

  const goToPage = useCallback((newPage: number) => {
    const validPage = Math.max(1, Math.min(newPage, totalPages));
    setPage(validPage);
  }, [totalPages]);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPage(1); // Reset to first page when page size changes
  }, []);

  return {
    page,
    pageSize,
    totalPages,
    hasNext,
    hasPrev,
    startIndex,
    endIndex,
    nextPage,
    prevPage,
    goToPage,
    setPageSize,
  };
}
```

---

## Test Cases

### File: `packages/ui-kit/src/hooks/__tests__/useDebounce.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '../useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500));
    
    expect(result.current).toBe('initial');
  });

  it('debounces value changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'initial' } }
    );
    
    expect(result.current).toBe('initial');
    
    // Change value
    rerender({ value: 'changed' });
    
    // Should still be initial (debouncing)
    expect(result.current).toBe('initial');
  });

  it('updates after delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'initial' } }
    );
    
    rerender({ value: 'changed' });
    
    // Before delay
    expect(result.current).toBe('initial');
    
    // Advance time
    act(() => {
      vi.advanceTimersByTime(500);
    });
    
    // After delay
    expect(result.current).toBe('changed');
  });

  it('resets timer on rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'a' } }
    );
    
    // Rapid changes
    rerender({ value: 'b' });
    act(() => { vi.advanceTimersByTime(200); });
    
    rerender({ value: 'c' });
    act(() => { vi.advanceTimersByTime(200); });
    
    rerender({ value: 'd' });
    
    // Not enough time for any to complete
    expect(result.current).toBe('a');
    
    // Advance full delay from last change
    act(() => { vi.advanceTimersByTime(500); });
    
    // Only final value
    expect(result.current).toBe('d');
  });

  it('cleanup cancels pending timeout', () => {
    const { result, unmount, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'initial' } }
    );
    
    rerender({ value: 'changed' });
    
    // Unmount before delay completes
    unmount();
    
    // Advance time - should not throw
    act(() => {
      vi.advanceTimersByTime(500);
    });
    
    // No error means cleanup worked
  });

  it('works with different types', () => {
    // Number
    const { result: numResult } = renderHook(() => useDebounce(42, 100));
    expect(numResult.current).toBe(42);
    
    // Object
    const obj = { a: 1 };
    const { result: objResult } = renderHook(() => useDebounce(obj, 100));
    expect(objResult.current).toEqual({ a: 1 });
    
    // Array
    const arr = [1, 2, 3];
    const { result: arrResult } = renderHook(() => useDebounce(arr, 100));
    expect(arrResult.current).toEqual([1, 2, 3]);
  });

  it('handles zero delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 0),
      { initialProps: { value: 'initial' } }
    );
    
    rerender({ value: 'changed' });
    
    act(() => {
      vi.advanceTimersByTime(0);
    });
    
    expect(result.current).toBe('changed');
  });

  it('updates when delay changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );
    
    rerender({ value: 'changed', delay: 100 });
    
    act(() => {
      vi.advanceTimersByTime(100);
    });
    
    expect(result.current).toBe('changed');
  });
});
```

### File: `packages/ui-kit/src/hooks/__tests__/usePagination.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePagination } from '../usePagination';

describe('usePagination', () => {
  it('initializes with page 1', () => {
    const { result } = renderHook(() => 
      usePagination({ total: 100, pageSize: 10 })
    );
    
    expect(result.current.page).toBe(1);
  });

  it('initializes with custom initial page', () => {
    const { result } = renderHook(() => 
      usePagination({ total: 100, pageSize: 10, initialPage: 3 })
    );
    
    expect(result.current.page).toBe(3);
  });

  it('calculates total pages', () => {
    const { result } = renderHook(() => 
      usePagination({ total: 95, pageSize: 10 })
    );
    
    expect(result.current.totalPages).toBe(10);
  });

  it('calculates total pages for exact division', () => {
    const { result } = renderHook(() => 
      usePagination({ total: 100, pageSize: 10 })
    );
    
    expect(result.current.totalPages).toBe(10);
  });

  it('handles zero total', () => {
    const { result } = renderHook(() => 
      usePagination({ total: 0, pageSize: 10 })
    );
    
    expect(result.current.totalPages).toBe(1);
    expect(result.current.page).toBe(1);
  });

  describe('goToPage', () => {
    it('updates current page', () => {
      const { result } = renderHook(() => 
        usePagination({ total: 100, pageSize: 10 })
      );
      
      act(() => {
        result.current.goToPage(3);
      });
      
      expect(result.current.page).toBe(3);
    });

    it('clamps to valid range (min)', () => {
      const { result } = renderHook(() => 
        usePagination({ total: 100, pageSize: 10 })
      );
      
      act(() => {
        result.current.goToPage(-5);
      });
      
      expect(result.current.page).toBe(1);
    });

    it('clamps to valid range (max)', () => {
      const { result } = renderHook(() => 
        usePagination({ total: 100, pageSize: 10 })
      );
      
      act(() => {
        result.current.goToPage(999);
      });
      
      expect(result.current.page).toBe(10);
    });
  });

  describe('nextPage', () => {
    it('increments page', () => {
      const { result } = renderHook(() => 
        usePagination({ total: 100, pageSize: 10 })
      );
      
      act(() => {
        result.current.nextPage();
      });
      
      expect(result.current.page).toBe(2);
    });

    it('does nothing on last page', () => {
      const { result } = renderHook(() => 
        usePagination({ total: 100, pageSize: 10, initialPage: 10 })
      );
      
      act(() => {
        result.current.nextPage();
      });
      
      expect(result.current.page).toBe(10);
    });
  });

  describe('prevPage', () => {
    it('decrements page', () => {
      const { result } = renderHook(() => 
        usePagination({ total: 100, pageSize: 10, initialPage: 5 })
      );
      
      act(() => {
        result.current.prevPage();
      });
      
      expect(result.current.page).toBe(4);
    });

    it('does nothing on first page', () => {
      const { result } = renderHook(() => 
        usePagination({ total: 100, pageSize: 10 })
      );
      
      act(() => {
        result.current.prevPage();
      });
      
      expect(result.current.page).toBe(1);
    });
  });

  describe('hasNext/hasPrev', () => {
    it('hasNext is false on last page', () => {
      const { result } = renderHook(() => 
        usePagination({ total: 100, pageSize: 10, initialPage: 10 })
      );
      
      expect(result.current.hasNext).toBe(false);
    });

    it('hasNext is true on other pages', () => {
      const { result } = renderHook(() => 
        usePagination({ total: 100, pageSize: 10, initialPage: 5 })
      );
      
      expect(result.current.hasNext).toBe(true);
    });

    it('hasPrev is false on first page', () => {
      const { result } = renderHook(() => 
        usePagination({ total: 100, pageSize: 10 })
      );
      
      expect(result.current.hasPrev).toBe(false);
    });

    it('hasPrev is true on other pages', () => {
      const { result } = renderHook(() => 
        usePagination({ total: 100, pageSize: 10, initialPage: 5 })
      );
      
      expect(result.current.hasPrev).toBe(true);
    });
  });

  describe('resetOnTotalChange', () => {
    it('resets to page 1 when total changes', () => {
      const { result, rerender } = renderHook(
        ({ total }) => usePagination({ total, pageSize: 10 }),
        { initialProps: { total: 100 } }
      );
      
      // Go to page 5
      act(() => {
        result.current.goToPage(5);
      });
      expect(result.current.page).toBe(5);
      
      // Change total (new search)
      rerender({ total: 50 });
      
      expect(result.current.page).toBe(1);
    });

    it('respects resetOnTotalChange=false', () => {
      const { result, rerender } = renderHook(
        ({ total }) => usePagination({ total, pageSize: 10, resetOnTotalChange: false }),
        { initialProps: { total: 100 } }
      );
      
      act(() => {
        result.current.goToPage(5);
      });
      
      rerender({ total: 200 });
      
      expect(result.current.page).toBe(5);
    });
  });

  describe('setPageSize', () => {
    it('updates page size', () => {
      const { result } = renderHook(() => 
        usePagination({ total: 100, pageSize: 10 })
      );
      
      expect(result.current.pageSize).toBe(10);
      
      act(() => {
        result.current.setPageSize(20);
      });
      
      expect(result.current.pageSize).toBe(20);
    });

    it('resets to page 1 when page size changes', () => {
      const { result } = renderHook(() => 
        usePagination({ total: 100, pageSize: 10, initialPage: 5 })
      );
      
      act(() => {
        result.current.setPageSize(20);
      });
      
      expect(result.current.page).toBe(1);
    });

    it('recalculates total pages', () => {
      const { result } = renderHook(() => 
        usePagination({ total: 100, pageSize: 10 })
      );
      
      expect(result.current.totalPages).toBe(10);
      
      act(() => {
        result.current.setPageSize(20);
      });
      
      expect(result.current.totalPages).toBe(5);
    });
  });

  describe('startIndex/endIndex', () => {
    it('calculates correct indices for first page', () => {
      const { result } = renderHook(() => 
        usePagination({ total: 100, pageSize: 10 })
      );
      
      expect(result.current.startIndex).toBe(0);
      expect(result.current.endIndex).toBe(9);
    });

    it('calculates correct indices for middle page', () => {
      const { result } = renderHook(() => 
        usePagination({ total: 100, pageSize: 10, initialPage: 5 })
      );
      
      expect(result.current.startIndex).toBe(40);
      expect(result.current.endIndex).toBe(49);
    });

    it('calculates correct indices for partial last page', () => {
      const { result } = renderHook(() => 
        usePagination({ total: 95, pageSize: 10, initialPage: 10 })
      );
      
      expect(result.current.startIndex).toBe(90);
      expect(result.current.endIndex).toBe(94);
    });
  });

  describe('auto-clamp page', () => {
    it('clamps page when total decreases', () => {
      const { result, rerender } = renderHook(
        ({ total }) => usePagination({ total, pageSize: 10, resetOnTotalChange: false }),
        { initialProps: { total: 100 } }
      );
      
      act(() => {
        result.current.goToPage(10);
      });
      expect(result.current.page).toBe(10);
      
      // Total decreases to 50 (only 5 pages)
      rerender({ total: 50 });
      
      expect(result.current.page).toBe(5);
    });
  });
});
```

---

## Verification

```bash
cd packages/ui-kit

# Run hooks tests
pnpm test src/hooks

# Run with coverage
pnpm test:coverage

# Expected coverage: 100%
```

---

## Checklist

- [ ] useDebounce.ts implemented
  - [ ] Returns initial value immediately
  - [ ] Debounces value changes
  - [ ] Resets timer on rapid changes
  - [ ] Cleanup on unmount
  - [ ] Works with different types
- [ ] usePagination.ts implemented
  - [ ] Page state management
  - [ ] nextPage/prevPage
  - [ ] goToPage with clamping
  - [ ] hasNext/hasPrev
  - [ ] setPageSize
  - [ ] Reset on total change
  - [ ] startIndex/endIndex calculation
- [ ] All 32 test cases pass
- [ ] 100% code coverage
