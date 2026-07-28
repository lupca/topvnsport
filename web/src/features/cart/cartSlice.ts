import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Product, StringOption } from '../../types';
import { CartItem } from '../../components/CartModal';

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  quickViewProduct: Product | null;
}

const CART_STORAGE_KEY = 'cart_items';

export function loadCartItemsFromStorage(): CartItem[] {
  try {
    const data = localStorage.getItem(CART_STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function saveCartItemsToStorage(items: CartItem[]): void {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    // Ignore errors in storage restricted environments
  }
}

const initialState: CartState = {
  items: loadCartItemsFromStorage(),
  isOpen: false,
  quickViewProduct: null
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addCartItem: (state, action: PayloadAction<CartItem>) => {
      const existingIndex = state.items.findIndex(item => item.id === action.payload.id);
      if (existingIndex > -1) {
        state.items[existingIndex].quantity += action.payload.quantity || 1;
      } else {
        state.items.push(action.payload);
      }
      saveCartItemsToStorage(state.items);
    },
    removeCartItem: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(item => item.id !== action.payload);
      saveCartItemsToStorage(state.items);
    },
    updateCartItemQuantity: (state, action: PayloadAction<{ id: string; quantity: number }>) => {
      const { id, quantity } = action.payload;
      if (quantity <= 0) {
        state.items = state.items.filter(item => item.id !== id);
      } else {
        const item = state.items.find(i => i.id === id);
        if (item) {
          item.quantity = quantity;
        }
      }
      saveCartItemsToStorage(state.items);
    },
    clearCart: state => {
      state.items = [];
      saveCartItemsToStorage(state.items);
    },
    openCart: state => {
      state.isOpen = true;
    },
    closeCart: state => {
      state.isOpen = false;
    },
    setQuickViewProduct: (state, action: PayloadAction<Product | null>) => {
      state.quickViewProduct = action.payload;
    }
  }
});

export const {
  addCartItem,
  removeCartItem,
  updateCartItemQuantity,
  clearCart,
  openCart,
  closeCart,
  setQuickViewProduct
} = cartSlice.actions;

export function resolveSkuCode(product: Product, color: string, weight: string): string {
  const colorSku = product.skuByColor?.[color];
  if (colorSku) return colorSku;

  const byVariant = product.skuByVariant?.[`${color}||${weight}`];
  if (byVariant) return byVariant;

  return product.defaultSku || `SKU-${product.id}-${weight.replace(/\//g, '-')}-${color.replace(/\//g, '-')}`;
}

export function buildDefaultCartItem(product: Product): CartItem {
  const selectedColor = product.colors && product.colors.length > 0 ? product.colors[0] : 'Tiêu chuẩn';
  const selectedWeight = product.category === 'Vợt' ? '4U/G5' : 'Tiêu chuẩn';

  return {
    id: `${product.id}-${selectedWeight}-${selectedColor}`,
    productId: product.id,
    skuCode: resolveSkuCode(product, selectedColor, selectedWeight),
    name: product.name,
    brand: product.brand,
    image: product.image,
    price: product.salePrice || product.price,
    selectedWeight,
    selectedColor,
    stringOption: null,
    tension: 10.5,
    quantity: 1
  };
}

export function buildConfiguredCartItem(
  product: Product,
  weight: string,
  color: string,
  stringChoice: StringOption | null,
  tension: number
): CartItem {
  return {
    id: `${product.id}-${weight}-${color}-${stringChoice?.id || 'none'}-${tension}`,
    productId: product.id,
    skuCode: resolveSkuCode(product, color, weight),
    name: product.name,
    brand: product.brand,
    image: product.image,
    price: product.salePrice || product.price,
    selectedWeight: weight,
    selectedColor: color,
    stringOption: stringChoice,
    tension,
    quantity: 1
  };
}

export default cartSlice.reducer;
