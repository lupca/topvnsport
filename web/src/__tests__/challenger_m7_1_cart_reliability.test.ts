// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import cartReducer, {
  addCartItem,
  removeCartItem,
  updateCartItemQuantity,
  clearCart,
  buildDefaultCartItem,
  buildConfiguredCartItem,
  loadCartItemsFromStorage,
  saveCartItemsToStorage
} from '../features/cart/cartSlice';
import { Product, StringOption } from '../types';

const mockRacket: Product = {
  id: 'PROD-RACKET-1',
  name: 'Vợt Cầu Lông Yonex Arcsaber 11 Pro',
  brand: 'Yonex',
  category: 'Vợt',
  price: 4600000,
  salePrice: 4300000,
  image: 'https://example.com/arcsaber11.jpg',
  colors: ['Đỏ/Đen', 'Xám'],
  skuByColor: { 'Đỏ/Đen': 'SKU-ARC11-RED', 'Xám': 'SKU-ARC11-GREY' },
  defaultSku: 'SKU-ARC11-DEF'
};

const mockAccessory: Product = {
  id: 'PROD-ACC-1',
  name: 'Quấn Cán Vợt Yonex AC102EX',
  brand: 'Yonex',
  category: 'Phụ kiện',
  price: 120000,
  image: 'https://example.com/grip.jpg',
  colors: ['Trắng', 'Đen'],
  defaultSku: 'SKU-GRIP-DEF'
};

describe('Milestone 7 Empirical Challenge - Cart State & Edge Cases', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. Quantity Updating Edge Cases', () => {
    it('removes item when updateCartItemQuantity is called with quantity 0', () => {
      const item = buildDefaultCartItem(mockRacket);
      const state1 = cartReducer({ items: [], isOpen: false, quickViewProduct: null }, addCartItem(item));
      expect(state1.items.length).toBe(1);

      const state2 = cartReducer(state1, updateCartItemQuantity({ id: item.id, quantity: 0 }));
      expect(state2.items.length).toBe(0);
      expect(loadCartItemsFromStorage().length).toBe(0);
    });

    it('removes item when updateCartItemQuantity is called with negative quantity', () => {
      const item = buildDefaultCartItem(mockRacket);
      const state1 = cartReducer({ items: [], isOpen: false, quickViewProduct: null }, addCartItem(item));
      
      const state2 = cartReducer(state1, updateCartItemQuantity({ id: item.id, quantity: -5 }));
      expect(state2.items.length).toBe(0);
    });

    it('EMPIRICAL BUG: updateCartItemQuantity with NaN corrupts item quantity instead of removing or failing safely', () => {
      const item = buildDefaultCartItem(mockRacket);
      const state1 = cartReducer({ items: [], isOpen: false, quickViewProduct: null }, addCartItem(item));
      
      const state2 = cartReducer(state1, updateCartItemQuantity({ id: item.id, quantity: NaN }));
      // NaN <= 0 is false, so it falls into else block and assigns item.quantity = NaN
      expect(Number.isNaN(state2.items[0].quantity)).toBe(true);
    });

    it('EMPIRICAL BUG: addCartItem with quantity 0 on existing item increments quantity by 1 due to `quantity || 1`', () => {
      const item = buildDefaultCartItem(mockRacket);
      const state1 = cartReducer({ items: [], isOpen: false, quickViewProduct: null }, addCartItem(item));
      expect(state1.items[0].quantity).toBe(1);

      // Attempting to add item with quantity 0
      const zeroQtyItem = { ...item, quantity: 0 };
      const state2 = cartReducer(state1, addCartItem(zeroQtyItem));
      
      // Because `0 || 1` evaluates to 1, quantity is incremented by 1!
      expect(state2.items[0].quantity).toBe(2);
    });

    it('EMPIRICAL BUG: addCartItem with negative quantity on existing item reduces quantity into negative without removing item', () => {
      const item = buildDefaultCartItem(mockRacket);
      const state1 = cartReducer({ items: [], isOpen: false, quickViewProduct: null }, addCartItem(item));
      expect(state1.items[0].quantity).toBe(1);

      // Adding item with quantity -3
      const negQtyItem = { ...item, quantity: -3 };
      const state2 = cartReducer(state1, addCartItem(negQtyItem));

      // 1 + (-3) = -2. Item remains in cart with negative quantity!
      expect(state2.items[0].quantity).toBe(-2);
      expect(state2.items.length).toBe(1);
    });

    it('EMPIRICAL BUG: addCartItem with negative or zero quantity on NEW item pushes item with invalid quantity into cart', () => {
      const itemWithZero = { ...buildDefaultCartItem(mockRacket), id: 'NEW-ZERO-ITEM', quantity: 0 };
      const itemWithNeg = { ...buildDefaultCartItem(mockRacket), id: 'NEW-NEG-ITEM', quantity: -5 };

      let state = cartReducer({ items: [], isOpen: false, quickViewProduct: null }, addCartItem(itemWithZero));
      expect(state.items[0].quantity).toBe(0);

      state = cartReducer(state, addCartItem(itemWithNeg));
      expect(state.items[1].quantity).toBe(-5);
    });
  });

  describe('2. Adding Items with Identical vs Different Attributes', () => {
    it('merges quantities when adding items with identical attributes via buildConfiguredCartItem', () => {
      const stringChoice: StringOption = { id: 'STR-BG66', name: 'BG66 Ultimax', price: 180000 };
      const item1 = buildConfiguredCartItem(mockRacket, '4U/G5', 'Đỏ/Đen', stringChoice, 11);
      const item2 = buildConfiguredCartItem(mockRacket, '4U/G5', 'Đỏ/Đen', stringChoice, 11);

      expect(item1.id).toBe(item2.id);

      const state1 = cartReducer({ items: [], isOpen: false, quickViewProduct: null }, addCartItem(item1));
      const state2 = cartReducer(state1, addCartItem(item2));

      expect(state2.items.length).toBe(1);
      expect(state2.items[0].quantity).toBe(2);
    });

    it('EMPIRICAL BUG: buildDefaultCartItem and equivalent buildConfiguredCartItem produce different IDs for identical item specs', () => {
      // Default racket selected weight = 4U/G5, selected color = Đỏ/Đen, string = null, tension = 10.5
      const defaultItem = buildDefaultCartItem(mockRacket);
      // Configured racket with exact same weight, color, string=null, tension=10.5
      const configuredItem = buildConfiguredCartItem(mockRacket, '4U/G5', 'Đỏ/Đen', null, 10.5);

      // Default ID format: `${product.id}-${selectedWeight}-${selectedColor}`
      // Configured ID format: `${product.id}-${weight}-${color}-${stringChoice?.id || 'none'}-${tension}`
      expect(defaultItem.id).toBe('PROD-RACKET-1-4U/G5-Đỏ/Đen');
      expect(configuredItem.id).toBe('PROD-RACKET-1-4U/G5-Đỏ/Đen-none-10.5');
      expect(defaultItem.id).not.toBe(configuredItem.id);

      // Adding both to cart results in 2 separate cart items despite identical physical specifications!
      let state = cartReducer({ items: [], isOpen: false, quickViewProduct: null }, addCartItem(defaultItem));
      state = cartReducer(state, addCartItem(configuredItem));

      expect(state.items.length).toBe(2);
    });

    it('creates separate cart items when adding items with different attributes', () => {
      const string1: StringOption = { id: 'STR-BG66', name: 'BG66 Ultimax', price: 180000 };
      const string2: StringOption = { id: 'STR-NBG95', name: 'Nanogy 95', price: 170000 };

      // Different weights
      const itemWeight1 = buildConfiguredCartItem(mockRacket, '3U/G5', 'Đỏ/Đen', string1, 11);
      const itemWeight2 = buildConfiguredCartItem(mockRacket, '4U/G5', 'Đỏ/Đen', string1, 11);
      expect(itemWeight1.id).not.toBe(itemWeight2.id);

      // Different colors
      const itemColor1 = buildConfiguredCartItem(mockRacket, '4U/G5', 'Đỏ/Đen', string1, 11);
      const itemColor2 = buildConfiguredCartItem(mockRacket, '4U/G5', 'Xám', string1, 11);
      expect(itemColor1.id).not.toBe(itemColor2.id);

      // Different strings
      const itemStr1 = buildConfiguredCartItem(mockRacket, '4U/G5', 'Đỏ/Đen', string1, 11);
      const itemStr2 = buildConfiguredCartItem(mockRacket, '4U/G5', 'Đỏ/Đen', string2, 11);
      expect(itemStr1.id).not.toBe(itemStr2.id);

      // Different tension
      const itemTension1 = buildConfiguredCartItem(mockRacket, '4U/G5', 'Đỏ/Đen', string1, 10.5);
      const itemTension2 = buildConfiguredCartItem(mockRacket, '4U/G5', 'Đỏ/Đen', string1, 12);
      expect(itemTension1.id).not.toBe(itemTension2.id);

      let state = cartReducer({ items: [], isOpen: false, quickViewProduct: null }, addCartItem(itemWeight1));
      state = cartReducer(state, addCartItem(itemWeight2));
      state = cartReducer(state, addCartItem(itemColor2));
      state = cartReducer(state, addCartItem(itemStr2));
      state = cartReducer(state, addCartItem(itemTension2));

      expect(state.items.length).toBe(5);
    });

    it('handles non-racket products correctly in buildDefaultCartItem', () => {
      const defaultAcc = buildDefaultCartItem(mockAccessory);
      expect(defaultAcc.selectedWeight).toBe('Tiêu chuẩn');
      expect(defaultAcc.selectedColor).toBe('Trắng');
      expect(defaultAcc.id).toBe('PROD-ACC-1-Tiêu chuẩn-Trắng');
    });
  });

  describe('3. LocalStorage Edge Cases & Robustness', () => {
    it('returns empty array when localStorage is empty or null', () => {
      expect(localStorage.getItem('cart_items')).toBeNull();
      expect(loadCartItemsFromStorage()).toEqual([]);
    });

    it('returns empty array when localStorage contains malformed / corrupted JSON', () => {
      localStorage.setItem('cart_items', '{invalid_json: true,');
      expect(loadCartItemsFromStorage()).toEqual([]);
    });

    it('returns empty array when localStorage contains JSON primitive or object (non-array)', () => {
      localStorage.setItem('cart_items', '"just a string"');
      expect(loadCartItemsFromStorage()).toEqual([]);

      localStorage.setItem('cart_items', '12345');
      expect(loadCartItemsFromStorage()).toEqual([]);

      localStorage.setItem('cart_items', '{"key": "value"}');
      expect(loadCartItemsFromStorage()).toEqual([]);
    });

    it('EMPIRICAL BUG: loadCartItemsFromStorage passes corrupted array elements without validation', () => {
      const corruptedData = [
        null,
        undefined,
        123,
        "string-element",
        { invalidSchema: true },
        { id: 'PROD-BAD', quantity: -99 }
      ];
      localStorage.setItem('cart_items', JSON.stringify(corruptedData));

      const loaded = loadCartItemsFromStorage();
      // Returns raw corrupted array without filtering out non-CartItem objects or invalid schemas
      expect(loaded.length).toBe(6);
      expect(loaded[0]).toBeNull();
      expect(loaded[4]).toEqual({ invalidSchema: true });
    });

    it('handles localStorage.setItem QuotaExceededError / SecurityError gracefully without crashing app', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError: DOM Exception 22');
      });

      const item = buildDefaultCartItem(mockRacket);
      // saveCartItemsToStorage should catch error silently without rethrowing
      expect(() => saveCartItemsToStorage([item])).not.toThrow();

      // addCartItem dispatch should also not throw when saving to restricted storage
      let state = { items: [], isOpen: false, quickViewProduct: null };
      expect(() => {
        state = cartReducer(state, addCartItem(item));
      }).not.toThrow();
      expect(state.items.length).toBe(1);

      consoleSpy.mockRestore();
    });
  });
});
