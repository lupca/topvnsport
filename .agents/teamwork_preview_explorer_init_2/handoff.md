# Handoff Report — Requirement R2: Web Storefront Integration

## 1. Observation
* **Observed File Paths & Line Numbers**:
  1. `web/src/services/sport-api/constants.ts:2-3`:
     ```typescript
     export const PMI_API_URL = (import.meta as any).env?.VITE_PMI_API_URL || 'http://localhost:18100';
     export const OMS_API_URL = (import.meta as any).env?.VITE_OMS_API_URL || 'http://localhost:18101';
     ```
  2. `web/src/services/sport-api/index.ts:23-37`:
     ```typescript
     async function getProducts(): Promise<Product[]> {
       ...
       const [response, categories] = await Promise.all([
         fetch(`${PMI_API_URL}/public/products?limit=100`),
         getCategories()
       ]);
       ...
       const data = await response.json();
       const pmiProducts = extractItems<PmiProduct>(data);
       return pmiProducts.map((product) => mapPmiProduct(product, categories));
     }
     ```
  3. `web/src/services/sport-api/productMappers.ts:94, 145, 168`:
     Line 94: `const stock = variants.reduce((sum, variant) => sum + Number(variant.stock || 0), 0);`
     Line 145: `stock: Number(variant.stock || 0)`
     Line 168: `stock: stock > 0 ? stock : 100,`
  4. `web/src/components/ProductDetailPage.tsx:62-78`:
     ```typescript
     const matchedVariant = product.variants?.find((v) => {
       const t1Match = !product.tier_variations?.some(tv => tv.tier_index === 1) || v.tier_1_option === selectedTier1;
       const t2Match = !product.tier_variations?.some(tv => tv.tier_index === 2) || v.tier_2_option === selectedTier2;
       return t1Match && t2Match;
     });
     const getVariantStock = (tier1: string, tier2: string): number => { ... };
     const currentStock = matchedVariant?.stock ?? product.stock ?? 0;
     const isOutOfStock = currentStock <= 0;
     ```
  5. `web/src/components/product-detail/ProductPurchaseSection.tsx:149-169, 245-265`:
     Line 149: `const optionOutOfStock = stockForOption <= 0;`
     Line 157: `disabled={optionOutOfStock}`
     Line 158: `optionOutOfStock ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-60 line-through' : ...`
     Line 166: `{optionOutOfStock && (<span className="...">Hết</span>)}`
     Line 245-251: `{isOutOfStock && (<div className="...">Sản phẩm này tạm hết hàng</div>)}`
     Line 256: `disabled={isOutOfStock}`
     Line 264: `{isOutOfStock ? 'Hết hàng' : 'Thêm vào giỏ hàng'}`
  6. `web/src/components/ProductCard.tsx:46, 81-87`:
     Line 46: `product.stock <= 0` shows badge `"Hết hàng"`.
     Line 82: `disabled={product.stock <= 0}` on Quick Cart button.
  7. `WMS/backend/routers/inventory.py:11-13`:
     ```python
     @router.get("/inventory", response_model=List[schemas.InventoryResponse])
     def list_inventory(db: Session = Depends(get_db)):
         return db.query(models.Inventory).all()
     ```
     (Note: Router mounted in `WMS/backend/main.py:89` with `dependencies=[Depends(get_current_user)]`).

---

## 2. Logic Chain
1. **Observation 1 & 2** establish that the web storefront (`web/src/services/sport-api/index.ts`) fetches product catalog data exclusively from PMI API (`${PMI_API_URL}/public/products`). No network request is currently made to WMS (`http://localhost:18102`).
2. **Observation 3** reveals a critical mapper defect in `web/src/services/sport-api/productMappers.ts:168`, where `stock: stock > 0 ? stock : 100` forces products with 0 stock to present a top-level stock count of 100.
3. **Observation 4 & 5** demonstrate that the storefront UI (`ProductDetailPage.tsx` & `ProductPurchaseSection.tsx`) already has comprehensive logic for evaluating variant matching (`matchedVariant`), per-option stock (`getVariantStock`), disabling out-of-stock options with line-through styling and "Hết" badges, rendering "Sản phẩm này tạm hết hàng" banners, and disabling the "Thêm vào giỏ hàng" button.
4. **Observation 6** demonstrates that grid items (`ProductCard.tsx`) also respect `product.stock <= 0` by rendering an "Hết hàng" badge and disabling the quick cart action.
5. **Observation 7** shows that existing WMS inventory endpoints in `WMS/backend/routers/inventory.py` require staff authentication (`get_current_user`), meaning a new public WMS stock API endpoint (Requirement R1) is needed before storefront can fetch stock directly from WMS without user authentication.

---

## 3. Caveats
* **Network Mode**: Investigation was conducted under CODE_ONLY network mode using local filesystem and code knowledge graph.
* **Backend Scope**: Explorer 2 is read-only and did not modify any source code files.
* **Requirement R1 Dependency**: The precise live API path and schema for WMS stock lookup depend on Requirement R1 implementation details (e.g. `GET /public/stock` vs `POST /public/stock/batch`).

---

## 4. Conclusion
The Web Storefront (`web`) possesses a fully functional, production-ready UI for out-of-stock variant disabling, banner display, and purchase button locking. However, it currently relies on PMI database stock values loaded at initial app startup, suffers from a hardcoded `stock: 100` fallback bug in `productMappers.ts:168`, and does not communicate with WMS. 

To integrate R2:
1. Fix the mapper fallback bug in `productMappers.ts`.
2. Connect `web/src/services/sport-api/` to the new public WMS stock API endpoint created under Requirement R1.
3. Refresh product & variant stock from WMS in `fetchAppData` (catalog level) and on `ProductDetailPage` mount (detail level).

---

## 5. Verification Method
1. **Inspect Files**:
   * Inspect `web/src/services/sport-api/productMappers.ts` line 168 to confirm `stock: stock > 0 ? stock : 100`.
   * Inspect `web/src/components/product-detail/ProductPurchaseSection.tsx` lines 145–171 & 245–265 to verify out-of-stock UI components.
2. **Run E2E Storefront Test**:
   ```bash
   pytest e2e_tests/tests/test_storefront_otp_flow.py -v
   ```
3. **Invalidation Conditions**:
   * If WMS public API is implemented under R1 and `productMappers.ts` is updated to remove the `100` fallback, setting WMS inventory for a SKU to `0` should immediately disable the corresponding option button in `ProductDetailPage.tsx` and render the "Sản phẩm này tạm hết hàng" banner.
