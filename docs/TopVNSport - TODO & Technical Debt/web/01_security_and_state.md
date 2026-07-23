# TODO: Web Storefront - Security & State Management

## Mức độ: CRITICAL/HIGH
## Estimated Effort: Medium (4-6 hours)

---

## 1. OTP BYPASS BUTTON IN PRODUCTION (RESOLVED)

**File:** `web/src/components/OtpModal.tsx`, lines 150-156

**Former impact:** Nút test từng cho phép khách hàng bỏ qua xác minh OTP và gửi một
token hard-code đến backend.

**Resolution:** Nút và token hard-code đã bị xóa hoàn toàn. Storefront chỉ tiếp tục
checkout sau khi `/api/sms/verify-otp` trả về một token xác minh hợp lệ.

---

## 2. CART NOT PERSISTED (HIGH)

**File:** `web/src/features/cart/cartSlice.ts`

**Issue:** Cart state chỉ trong Redux memory. Refresh page = mất cart.

**Fix - LocalStorage persistence:**
```typescript
// cartSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

const CART_STORAGE_KEY = 'topvnsport_cart';

const loadCartFromStorage = (): CartItem[] => {
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveCartToStorage = (items: CartItem[]) => {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
};

const initialState: CartState = {
  items: loadCartFromStorage(),  // Load on init
  // ...
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addCartItem: (state, action: PayloadAction<CartItem>) => {
      state.items.push(action.payload);
      saveCartToStorage(state.items);  // Persist
    },
    removeCartItem: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(item => item.id !== action.payload);
      saveCartToStorage(state.items);  // Persist
    },
    clearCart: (state) => {
      state.items = [];
      saveCartToStorage([]);  // Clear storage
    },
  },
});
```

---

## 3. CART QUANTITY UPDATE MISSING

**File:** `web/src/features/cart/cartSlice.ts`

**Issue:** Chỉ có `addCartItem` và `removeCartItem`. Không có update quantity.

**Fix:**
```typescript
reducers: {
  // ... existing reducers
  
  updateCartItemQuantity: (state, action: PayloadAction<{id: string, quantity: number}>) => {
    const item = state.items.find(i => i.id === action.payload.id);
    if (item) {
      if (action.payload.quantity <= 0) {
        state.items = state.items.filter(i => i.id !== action.payload.id);
      } else {
        item.quantity = action.payload.quantity;
      }
      saveCartToStorage(state.items);
    }
  },
},
```

---

## 4. CART ID COLLISION RISK

**File:** `web/src/features/cart/cartSlice.ts`, line 89

```typescript
const id = `${product.id}-${selectedColor}-${selectedWeight}-${Date.now()}`;
```

**Issue:** `Date.now()` có độ phân giải 1ms. Rapid clicks có thể tạo duplicate IDs.

**Fix:**
```typescript
import { nanoid } from '@reduxjs/toolkit';

const id = nanoid();  // Cryptographically random, collision-resistant
```

---

## 5. VERIFICATION TOKEN IN REACT STATE ONLY

**File:** `web/src/components/CartModal.tsx`, line 44

```typescript
const [verificationToken, setVerificationToken] = useState<string | null>(null);
```

**Issue:** Token lost khi navigate away hoặc refresh. User phải verify OTP lại.

**Fix:**
```typescript
// Use sessionStorage for token persistence within session
const [verificationToken, setVerificationToken] = useState<string | null>(() => {
  return sessionStorage.getItem('otp_verification_token');
});

const handleOtpSuccess = (token: string) => {
  setVerificationToken(token);
  sessionStorage.setItem('otp_verification_token', token);
};

// Clear on successful order
const handleOrderSuccess = () => {
  sessionStorage.removeItem('otp_verification_token');
  // ...
};
```

---

## 6. SILENT FAILURE ON APP DATA LOAD

**File:** `web/src/features/appData/appDataSlice.ts`, lines 52-54

```typescript
.addCase(fetchAppData.rejected, state => {
  state.isLoading = false;
  // No error handling! App renders with empty data
});
```

**Fix:**
```typescript
interface AppDataState {
  // ... existing fields
  error: string | null;
}

// In slice
.addCase(fetchAppData.rejected, (state, action) => {
  state.isLoading = false;
  state.error = action.error.message || 'Failed to load data';
})

// In App.tsx - show error state
function App() {
  const { isLoading, error } = useAppSelector(state => state.appData);
  
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Không thể tải dữ liệu: {error}</p>
          <button onClick={() => dispatch(fetchAppData())}>
            Thử lại
          </button>
        </div>
      </div>
    );
  }
  
  // ... rest of app
}
```

---

## 7. ARTIFICIAL API LATENCY (REMOVE FOR PRODUCTION)

**File:** `web/src/services/sport-api/constants.ts`, line 1

```typescript
export const SIMULATED_LATENCY = 200;  // 200ms delay on EVERY API call!
```

**Files using it:** `web/src/services/sport-api/index.ts`, lines 24, 45, 69, 96

**Fix:**
```typescript
// constants.ts
export const SIMULATED_LATENCY = import.meta.env.DEV ? 200 : 0;

// Or remove entirely in production
```

---

## 8. NO INPUT VALIDATION ON CHECKOUT FORM

**File:** `web/src/components/CartModal.tsx`, lines 74-78

```typescript
// Form data sent directly without validation
const orderData = {
  customer_name: name,
  customer_phone: phone,  // No format validation
  shipping_address: address,
  // ...
};
```

**Fix - Add Zod validation:**
```typescript
import { z } from 'zod';

const checkoutSchema = z.object({
  name: z.string().min(2, 'Tên phải có ít nhất 2 ký tự'),
  phone: z.string().regex(/^(0[3-9])\d{8}$/, 'Số điện thoại không hợp lệ'),
  address: z.string().min(10, 'Địa chỉ phải có ít nhất 10 ký tự'),
  city: z.string().min(1, 'Vui lòng chọn tỉnh/thành'),
});

// Before submit
const result = checkoutSchema.safeParse({ name, phone, address, city });
if (!result.success) {
  setErrors(result.error.flatten().fieldErrors);
  return;
}
```

---

## Files Cần Modify

| File | Action |
|------|--------|
| `web/src/components/OtpModal.tsx` | Remove bypass button |
| `web/src/features/cart/cartSlice.ts` | Add persistence, quantity update |
| `web/src/features/appData/appDataSlice.ts` | Add error state |
| `web/src/components/CartModal.tsx` | Add validation, token persistence |
| `web/src/services/sport-api/constants.ts` | Remove/guard SIMULATED_LATENCY |
| `web/src/App.tsx` | Handle app data error state |

---

## Verification

```typescript
// Test cart persistence
1. Add items to cart
2. Refresh page
3. Cart should still have items

// Test OTP bypass removed
1. Go to checkout
2. Verify "Bỏ qua xác nhận" button is gone
3. OTP must be verified to complete order

// Test error handling
1. Block network requests
2. Load app
3. Error message should display with retry button
```
