import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Product, StringOption } from '../../types';
import { CartItem } from '../../components/CartModal';

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  quickViewProduct: Product | null;
}

const initialState: CartState = {
  items: [],
  isOpen: false,
  quickViewProduct: null
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addCartItem: (state, action: PayloadAction<CartItem>) => {
      state.items.push(action.payload);
    },
    removeCartItem: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(item => item.id !== action.payload);
    },
    clearCart: state => {
      state.items = [];
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
    id: `${product.id}-${Date.now()}`,
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
    id: `${product.id}-${weight}-${color}-${stringChoice?.id || 'none'}-${Date.now()}`,
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
