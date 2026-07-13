# TODO: Web Storefront - Performance Improvements

## Mức độ: MEDIUM
## Estimated Effort: Medium (4-6 hours)

---

## 1. NO CODE SPLITTING / LAZY LOADING

**File:** `web/src/App.tsx`

**Issue:** Tất cả routes được import đồng bộ. Bundle size lớn, load time chậm.

```typescript
// Current - all imported synchronously
import CatalogPage from './pages/CatalogPage';
import ProductDetailPage from './pages/ProductDetailPage';
import StoreLocator from './pages/StoreLocator';
import AboutPage from './pages/AboutPage';
```

**Fix - React.lazy + Suspense:**
```typescript
import { lazy, Suspense } from 'react';

// Lazy load routes
const CatalogPage = lazy(() => import('./pages/CatalogPage'));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'));
const StoreLocator = lazy(() => import('./pages/StoreLocator'));
const AboutPage = lazy(() => import('./pages/AboutPage'));

// Loading component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary" />
  </div>
);

// In Router
<Routes>
  <Route 
    path="/catalog" 
    element={
      <Suspense fallback={<PageLoader />}>
        <CatalogPage />
      </Suspense>
    } 
  />
  {/* ... other routes */}
</Routes>
```

---

## 2. NO BUNDLE CHUNKING STRATEGY

**File:** `web/vite.config.ts`

**Issue:** No manual chunks defined. Vendor libraries bundled with app code.

**Fix:**
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'redux-vendor': ['@reduxjs/toolkit', 'react-redux'],
          'ui-vendor': ['swiper', 'lucide-react'],
        },
      },
    },
    // Enable chunk size warnings
    chunkSizeWarningLimit: 500, // KB
  },
});
```

---

## 3. SEARCH INDEX REBUILT ON EVERY KEYSTROKE

**File:** `web/src/components/Header.tsx`, lines 56-70

```typescript
// Runs on every keystroke
const filteredProducts = products.filter(product => {
  const searchLower = searchTerm.toLowerCase();
  return (
    product.name.toLowerCase().includes(searchLower) ||
    product.category?.toLowerCase().includes(searchLower) ||
    product.brand?.toLowerCase().includes(searchLower)
  );
});
```

**Fix - Debounce + Memoization:**
```typescript
import { useMemo, useState, useEffect } from 'react';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

function Header() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  
  // Build search index once
  const searchIndex = useMemo(() => {
    return products.map(p => ({
      product: p,
      searchText: `${p.name} ${p.category} ${p.brand}`.toLowerCase(),
    }));
  }, [products]);
  
  // Filter using debounced value
  const filteredProducts = useMemo(() => {
    if (!debouncedSearch) return [];
    const term = debouncedSearch.toLowerCase();
    return searchIndex
      .filter(item => item.searchText.includes(term))
      .map(item => item.product)
      .slice(0, 10); // Limit results
  }, [debouncedSearch, searchIndex]);
  
  // ...
}

// hooks/useDebouncedValue.ts
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
}
```

---

## 4. NO React.memo ON COMPONENTS

**Issue:** List items re-render on any parent state change.

**Files affected:**
- `web/src/components/ProductCard.tsx`
- `web/src/components/CartItem.tsx`
- `web/src/components/CategoryCard.tsx`

**Fix:**
```typescript
// ProductCard.tsx
import { memo } from 'react';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
}

function ProductCard({ product, onAddToCart }: ProductCardProps) {
  // ... component logic
}

export default memo(ProductCard, (prevProps, nextProps) => {
  // Custom comparison - only re-render if product changes
  return prevProps.product.id === nextProps.product.id &&
         prevProps.product.price === nextProps.product.price;
});
```

---

## 5. IMAGES NOT OPTIMIZED

**Issue:** Product images loaded at full resolution regardless of display size.

**Fix - Add srcset and lazy loading:**
```typescript
// ProductImage.tsx
interface ProductImageProps {
  src: string;
  alt: string;
  className?: string;
}

export function ProductImage({ src, alt, className }: ProductImageProps) {
  // Generate thumbnail URL (assuming backend supports size param)
  const thumbnailSrc = `${src}?w=300`;
  const mediumSrc = `${src}?w=600`;
  const largeSrc = `${src}?w=1200`;
  
  return (
    <img
      src={thumbnailSrc}
      srcSet={`
        ${thumbnailSrc} 300w,
        ${mediumSrc} 600w,
        ${largeSrc} 1200w
      `}
      sizes="(max-width: 640px) 300px, (max-width: 1024px) 600px, 1200px"
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
    />
  );
}
```

---

## 6. PRODUCT SLUG COLLISION COMPUTED ON EVERY RENDER

**File:** `web/src/utils/productSlug.ts`, lines 14-28

**Issue:** Slug mapping computed on every call, not cached.

**Fix - Memoize at app level:**
```typescript
// store.ts or a dedicated hook
import { useMemo } from 'react';
import { useAppSelector } from './hooks';
import { createProductSlugMap } from '../utils/productSlug';

export function useProductSlugMap() {
  const products = useAppSelector(state => state.appData.products);
  
  return useMemo(() => createProductSlugMap(products), [products]);
}

// productSlug.ts
export function createProductSlugMap(products: Product[]) {
  const slugMap = new Map<string, Product>();
  const nameCount = new Map<string, number>();
  
  for (const product of products) {
    const baseSlug = slugify(product.name);
    const count = nameCount.get(baseSlug) || 0;
    const slug = count === 0 ? baseSlug : `${baseSlug}-${count + 1}`;
    
    nameCount.set(baseSlug, count + 1);
    slugMap.set(slug, product);
  }
  
  return slugMap;
}
```

---

## 7. HARDCODED DEFAULT VALUES

**File:** `web/src/features/cart/cartSlice.ts`, lines 63-64

```typescript
const selectedWeight = product.category === 'Vợt' ? '4U/G5' : 'Tiêu chuẩn';
```

**Issue:** Assumes '4U/G5' exists. May cause SKU mismatch.

**Fix:**
```typescript
const getDefaultVariant = (product: Product, variantType: 'weight' | 'color') => {
  if (variantType === 'weight') {
    // Get first available weight from product
    const weights = product.variants?.map(v => v.weight).filter(Boolean) || [];
    return weights[0] || 'Tiêu chuẩn';
  }
  // ... similar for color
};

const selectedWeight = getDefaultVariant(product, 'weight');
```

---

## Files Cần Modify

| File | Action |
|------|--------|
| `web/vite.config.ts` | Add chunking strategy |
| `web/src/App.tsx` | Add lazy loading |
| `web/src/components/Header.tsx` | Debounce search |
| `web/src/components/ProductCard.tsx` | Add React.memo |
| `web/src/components/CartItem.tsx` | Add React.memo |
| `web/src/features/cart/cartSlice.ts` | Fix default variant logic |
| `web/src/hooks/useDebouncedValue.ts` | NEW - debounce hook |
| `web/src/components/ProductImage.tsx` | NEW - optimized image component |

---

## Verification

```bash
# Analyze bundle size
npm run build
npx vite-bundle-visualizer

# Check lighthouse score
npx lighthouse http://localhost:3000 --view

# Target metrics:
# - First Contentful Paint: < 1.5s
# - Largest Contentful Paint: < 2.5s
# - Total Bundle Size: < 500KB (gzipped)
```
