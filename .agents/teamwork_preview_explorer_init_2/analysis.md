# Comprehensive Investigation Report: Requirement R2 - Web Storefront Integration

## Executive Summary
This report analyzes Requirement R2 (Web Storefront Integration) in the `topvnsport` codebase (`/home/lupca/projects/topvnsport/web`). The web storefront is a Vite + React + Redux Toolkit application that currently fetches product catalog metadata and variant stock static values from the Product Information Management (PMI) public API (`http://localhost:18100/public/products`). Stock is currently **not** fetched live from the Warehouse Management System (WMS), and a fallback bug in the frontend product mapper (`mapPmiProduct`) overrides zero stock values with a hardcoded fallback of `100`. The UI possesses robust variant-level out-of-stock handling (button disabling, line-through styling, "Hết" badges, banner alerts, disabled purchase buttons), which will seamlessly operate once stock data is connected directly to WMS live inventory APIs.

---

## 1. Web Storefront Architecture & Framework Overview

### 1.1 Frontend Stack & Structure
* **Location**: `/home/lupca/projects/topvnsport/web`
* **Framework**: React 18, Vite, TypeScript, Tailwind CSS, Lucide icons, Framer Motion (`motion/react`).
* **State Management**: Redux Toolkit (`web/src/app/store.ts`).
  * `appDataSlice.ts` (`web/src/features/appData/appDataSlice.ts`): Fetches global app data (products, categories, blogs, branches, string options) on app initialization.
  * `catalogSlice.ts` (`web/src/features/catalog/catalogSlice.ts`): Controls UI filtering state (brand, category, max price, weight, stiffness, balance, search query).
  * `cartSlice.ts` (`web/src/features/cart/cartSlice.ts`): Manages cart items, drawer open/close state, quick-view modal target, and variant SKU resolution (`resolveSkuCode`).

### 1.2 API Client & Service Layer
* **Constants**: `web/src/services/sport-api/constants.ts`
  * `PMI_API_URL`: `http://localhost:18100` (or `VITE_PMI_API_URL`)
  * `OMS_API_URL`: `http://localhost:18101` (or `VITE_OMS_API_URL`)
* **API Entrypoint**: `web/src/services/sport-api/index.ts` exported via `web/src/services/sportApi.ts`
  * `getProducts()` (lines 23–42): Calls `GET ${PMI_API_URL}/public/products?limit=100` and `GET ${PMI_API_URL}/public/categories`.
  * `getProductById(id)` (lines 44–66): Calls `GET ${PMI_API_URL}/public/products/${id}`.
  * `createOrder(orderData)` (lines 123–138): Calls `POST ${OMS_API_URL}/orders`.
  * `sendOtp` / `verifyOtp` (lines 140–174): Calls `POST ${OMS_API_URL}/api/sms/send-otp` and `POST ${OMS_API_URL}/api/sms/verify-otp`.
* **Data Mapping Layer**: `web/src/services/sport-api/productMappers.ts`
  * `mapPmiProduct(pmiProduct, categories)` (lines 90–176): Transforms PMI API json objects (`PmiProduct`) into the frontend TypeScript interface `Product` (`web/src/types.ts`).

---

## 2. Stock/Inventory Fetching Mechanism & Current Data Source

### 2.1 Current Source: PMI Database Query
Currently, the storefront fetches product stock from PMI:
* **PMI Backend Endpoint**: `PMI/backend/routers/public.py` -> `get_public_products` (lines 163–323) & `get_public_product` (lines 327–421).
* **PMI Database**: Queries `Product` and child `ProductVariant` tables (`models.ProductVariant.stock`).
* **Storefront Call Chain**:
  ```
  App.tsx / App.refactor.tsx
    └── dispatch(fetchAppData())  [appDataSlice.ts:23]
          └── sportApi.getProducts()  [sport-api/index.ts:23]
                └── fetch('http://localhost:18100/public/products?limit=100')
                      └── mapPmiProduct()  [productMappers.ts:90]
  ```

### 2.2 Critical Flaw: Hardcoded Stock Fallback Bug
In `web/src/services/sport-api/productMappers.ts`:
* Line 94 computes aggregate variant stock:
  ```typescript
  const stock = variants.reduce((sum, variant) => sum + Number(variant.stock || 0), 0);
  ```
* Line 168 assigns top-level `stock` to the `Product` object:
  ```typescript
  stock: stock > 0 ? stock : 100,  // <-- FALLBACK FLAW!
  ```
* **Impact**: If a product has 0 stock in PMI, `mapPmiProduct` artificially forces top-level `product.stock` to `100`. Note that individual `variant.stock` in `mappedVariants` still retains `Number(variant.stock || 0)`.

---

## 3. UI Component Architecture, Variants, Stock Display & Out-of-Stock Handling

### 3.1 Data Types (`web/src/types.ts`)
* `Product`: Contains top-level `stock: number`, `variants?: ProductVariant[]`, `tier_variations?: TierVariation[]`.
* `ProductVariant`: `{ id, product_id, tier_1_option, tier_2_option, sku_code, price, barcode, stock: number }`.
* `TierVariation`: `{ id, product_id, tier_index: number, name: string, options: string[] }`.

### 3.2 Component Breakdown & Out-of-Stock Mechanics

#### 1. `ProductCard.tsx` (`web/src/components/ProductCard.tsx`)
* **Out-of-Stock Badge** (line 46): If `product.stock <= 0`, renders `<span className="... bg-gray-600 text-white">Hết hàng</span>`.
* **Quick Cart Button** (lines 81–91):
  * `disabled={product.stock <= 0}`
  * CSS: `bg-gray-300 text-gray-500 cursor-not-allowed` when out of stock.
  * Title: `"Sản phẩm hết hàng"`.

#### 2. `ProductDetailPage.tsx` (`web/src/components/ProductDetailPage.tsx`)
* **Variant State**: Tracks `selectedTier1` and `selectedTier2` (lines 27–34).
* **Variant Matching**:
  ```typescript
  const matchedVariant = product.variants?.find((v) => {
    const t1Match = !product.tier_variations?.some(tv => tv.tier_index === 1) || v.tier_1_option === selectedTier1;
    const t2Match = !product.tier_variations?.some(tv => tv.tier_index === 2) || v.tier_2_option === selectedTier2;
    return t1Match && t2Match;
  });
  ```
* **Stock Computation**:
  ```typescript
  const getVariantStock = (tier1: string, tier2: string): number => {
    const variant = product.variants?.find((v) => { ... });
    return variant?.stock ?? product.stock ?? 0;
  };

  const currentStock = matchedVariant?.stock ?? product.stock ?? 0;
  const isOutOfStock = currentStock <= 0;
  ```

#### 3. `ProductPurchaseSection.tsx` (`web/src/components/product-detail/ProductPurchaseSection.tsx`)
* **Option Button Evaluation** (lines 145–172):
  * Calculates `stockForOption` for each variation button using `getVariantStock(option, otherTierValue)`.
  * `const optionOutOfStock = stockForOption <= 0;`
  * When `optionOutOfStock`:
    * Button disabled: `disabled={optionOutOfStock}`
    * Click blocked: `onClick={() => !optionOutOfStock && setValue(option)}`
    * Class: `bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-60 line-through`
    * Badge: `<span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[8px] px-1 py-0.5 rounded-sm font-bold">Hết</span>`
* **Out-of-Stock Callout Banner** (lines 245–251):
  * Displays: `<div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center"><span className="text-red-600 font-semibold text-sm">Sản phẩm này tạm hết hàng</span></div>`
* **Add-to-Cart Button** (lines 254–265):
  * `disabled={isOutOfStock}`
  * Class: `isOutOfStock ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'btn-primary'`
  * Button text: `isOutOfStock ? 'Hết hàng' : 'Thêm vào giỏ hàng'`

#### 4. `QuickViewModal.tsx` (`web/src/components/QuickViewModal.tsx`)
* Line 73: Renders `<p className="text-xs text-red-500 font-semibold mt-1">Tạm hết hàng</p>` if `product.stock <= 0`.
* Lines 84–94: Disables add button `disabled={product.stock <= 0}` with text `'Hết hàng'`.

#### 5. `MobilePurchaseBar.tsx` (`web/src/components/product-detail/MobilePurchaseBar.tsx`)
* Lines 34–44: Takes `isOutOfStock` prop, disables "Mua ngay" button (`disabled={isOutOfStock}`), changes text to `'Hết hàng'`.

---

## 4. Recommendations for WMS Public API Integration (R2)

To satisfy Requirement R2 (connecting storefront to live WMS stock API from Requirement R1) and ensuring complete inventory accuracy across the storefront, we recommend the following design:

### 4.1 WMS Public Stock API Architecture (R1 Dependency)
WMS backend (`WMS/backend/`) must expose an unauthenticated public endpoint:
* **Endpoint**: `GET /public/stock` or `POST /public/stock/batch` (or proxied via Gateway `/api/wms/public/stock`).
* **Parameters**: List of SKU codes (`sku_codes: string[]`).
* **Calculation**:
  $$\text{qty\_available} = \max(0, \text{qty\_on\_hand} - \text{qty\_reserved})$$
* **Response Schema**:
  ```json
  {
    "items": [
      {
        "sku_code": "SKU-ASTROX77-4U",
        "qty_on_hand": 15,
        "qty_reserved": 2,
        "qty_available": 13
      }
    ]
  }
  ```

### 4.2 Web Service Updates (`web/src/services/sport-api/`)
1. **Add WMS Endpoint Constant**:
   * Add `export const WMS_API_URL = (import.meta as any).env?.VITE_WMS_API_URL || 'http://localhost:18102';` in `constants.ts`.
2. **Add Live Stock Fetching Function**:
   * Implement `getWmsStock(skuCodes: string[])` in `web/src/services/sport-api/index.ts`.
3. **Fix Product Mapper Stock Fallback**:
   * In `web/src/services/sport-api/productMappers.ts`, change line 168 from:
     `stock: stock > 0 ? stock : 100,`
     to:
     `stock: stock,`

### 4.3 Hybrid Live Stock Refresh Pattern
We recommend a two-phase stock resolution model in React/Redux:
1. **Catalog Bulk Load (Phase 1)**: In `fetchAppData` (`appDataSlice.ts`), after retrieving products from PMI, extract all SKU codes, call WMS `getWmsStock(skuCodes)`, and update `variant.stock` and `product.stock` values in Redux.
2. **Detail Page Real-time Refresh (Phase 2)**: In `ProductDetailPage.tsx`, on mount or variant selection, fetch live stock for the product's SKUs from WMS API to ensure up-to-the-second inventory accuracy before cart addition.

### 4.4 Checkout Stock Guard
In `cartSlice.ts` or checkout modal (`CartModal.tsx`), perform a final stock check against WMS API before invoking `OMS` order creation (`sportApi.createOrder`). If stock is insufficient, notify the user with a popup error.

---

## 5. Evidence Chain Summary Matrix

| Finding / Component | File Path & Line Numbers | Verified Evidence |
|---|---|---|
| Frontend Stack & State | `web/src/app/store.ts`<br>`web/src/features/appData/appDataSlice.ts` | Redux store configuration and global product thunk |
| PMI Product Fetch API | `web/src/services/sport-api/index.ts`:23-42 | `fetch('${PMI_API_URL}/public/products?limit=100')` |
| PMI Backend Router | `PMI/backend/routers/public.py`:163-323 | `get_public_products` querying PMI database `ProductVariant` |
| Stock Mapper Bug | `web/src/services/sport-api/productMappers.ts`:168 | `stock: stock > 0 ? stock : 100` fallback override |
| Product & Variant Types | `web/src/types.ts`:48-96 | `Product`, `ProductVariant`, `TierVariation` definitions |
| Detail Page Variant Stock | `web/src/components/ProductDetailPage.tsx`:62-78 | `matchedVariant`, `getVariantStock`, `isOutOfStock` logic |
| Purchase Section UI | `web/src/components/product-detail/ProductPurchaseSection.tsx`:146-171, 245-265 | Option button disabling, line-through CSS, "Hết" badge, out-of-stock banner, disabled purchase button |
| Product Card UI | `web/src/components/ProductCard.tsx`:46, 81-87 | Card out-of-stock badge and disabled cart button |
| Quick View UI | `web/src/components/QuickViewModal.tsx`:73, 84-94 | Out-of-stock text and disabled button |
| Mobile Bar UI | `web/src/components/product-detail/MobilePurchaseBar.tsx`:34-44 | Mobile "Mua ngay" disabled state |
| E2E Storefront Flow | `e2e_tests/tests/test_storefront_otp_flow.py`:13-114 | Playwright E2E storefront checkout test |
