// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
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
import OtpModal, {
  getStoredCooldown,
  setStoredCooldownExpiry,
  getStoredOtpCode,
  setStoredOtpCode
} from '../components/OtpModal';
import { Product } from '../types';

const mockProduct: Product = {
  id: 'PROD-100',
  name: 'Vợt cầu lông Yonex Astrox 88D Pro',
  brand: 'Yonex',
  category: 'Vợt',
  price: 4500000,
  salePrice: 4200000,
  image: 'https://example.com/astrox88d.jpg',
  colors: ['Đỏ/Đen'],
  skuByColor: { 'Đỏ/Đen': 'SKU-ASTROX-RED' },
  defaultSku: 'SKU-ASTROX-DEF'
};

describe('Milestone 7 - Cart Persistence & Reducer Logic', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('generates deterministic IDs for default and configured cart items', () => {
    const defaultItem1 = buildDefaultCartItem(mockProduct);
    const defaultItem2 = buildDefaultCartItem(mockProduct);

    expect(defaultItem1.id).toBe('PROD-100-4U/G5-Đỏ/Đen');
    expect(defaultItem2.id).toBe(defaultItem1.id);
    expect(defaultItem1.id).not.toContain('Date.now');

    const configuredItem1 = buildConfiguredCartItem(mockProduct, '3U/G5', 'Đỏ/Đen', { id: 'STR-66', name: 'BG66 Ultimax', price: 180000 }, 11);
    const configuredItem2 = buildConfiguredCartItem(mockProduct, '3U/G5', 'Đỏ/Đen', { id: 'STR-66', name: 'BG66 Ultimax', price: 180000 }, 11);

    expect(configuredItem1.id).toBe('PROD-100-3U/G5-Đỏ/Đen-STR-66-11');
    expect(configuredItem2.id).toBe(configuredItem1.id);
  });

  it('persists cart items to localStorage on add, remove, update quantity, and clear', () => {
    const initialState = { items: [], isOpen: false, quickViewProduct: null };
    const item = buildDefaultCartItem(mockProduct);

    // Add item
    const stateAfterAdd = cartReducer(initialState, addCartItem(item));
    expect(stateAfterAdd.items.length).toBe(1);
    expect(loadCartItemsFromStorage().length).toBe(1);
    expect(loadCartItemsFromStorage()[0].id).toBe(item.id);

    // Update quantity
    const stateAfterQty = cartReducer(stateAfterAdd, updateCartItemQuantity({ id: item.id, quantity: 3 }));
    expect(stateAfterQty.items[0].quantity).toBe(3);
    expect(loadCartItemsFromStorage()[0].quantity).toBe(3);

    // Remove item when quantity <= 0
    const stateAfterZeroQty = cartReducer(stateAfterQty, updateCartItemQuantity({ id: item.id, quantity: 0 }));
    expect(stateAfterZeroQty.items.length).toBe(0);
    expect(loadCartItemsFromStorage().length).toBe(0);

    // Add again and test removeCartItem
    const stateAdd2 = cartReducer(initialState, addCartItem(item));
    const stateRemove = cartReducer(stateAdd2, removeCartItem(item.id));
    expect(stateRemove.items.length).toBe(0);
    expect(loadCartItemsFromStorage().length).toBe(0);

    // Add again and test clearCart
    const stateAdd3 = cartReducer(initialState, addCartItem(item));
    const stateClear = cartReducer(stateAdd3, clearCart());
    expect(stateClear.items.length).toBe(0);
    expect(loadCartItemsFromStorage().length).toBe(0);
  });

  it('loads valid cart items from localStorage on loadCartItemsFromStorage and handles corrupted JSON', () => {
    const item = buildDefaultCartItem(mockProduct);
    saveCartItemsToStorage([item]);
    expect(loadCartItemsFromStorage().length).toBe(1);

    // Corrupted JSON fallback to []
    localStorage.setItem('cart_items', 'INVALID_JSON{{{');
    expect(loadCartItemsFromStorage()).toEqual([]);
  });

  it('increments quantity when adding an item with an existing ID', () => {
    const initialState = { items: [], isOpen: false, quickViewProduct: null };
    const item = buildDefaultCartItem(mockProduct);

    const state1 = cartReducer(initialState, addCartItem(item));
    expect(state1.items.length).toBe(1);
    expect(state1.items[0].quantity).toBe(1);

    const state2 = cartReducer(state1, addCartItem(item));
    expect(state2.items.length).toBe(1);
    expect(state2.items[0].quantity).toBe(2);
    expect(loadCartItemsFromStorage()[0].quantity).toBe(2);
  });
});

describe('Milestone 7 - OTP State Retention (sessionStorage)', () => {
  const phone = '0987654321';

  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('stores and retrieves OTP code correctly from sessionStorage', () => {
    expect(getStoredOtpCode(phone)).toBe('');

    setStoredOtpCode(phone, '654321');
    expect(getStoredOtpCode(phone)).toBe('654321');

    setStoredOtpCode(phone, '');
    expect(getStoredOtpCode(phone)).toBe('');
  });

  it('stores and calculates remaining cooldown expiry from sessionStorage', () => {
    expect(getStoredCooldown(phone)).toBe(0);

    setStoredCooldownExpiry(phone, 60);
    const remaining = getStoredCooldown(phone);
    expect(remaining).toBeGreaterThanOrEqual(59);
    expect(remaining).toBeLessThanOrEqual(60);

    setStoredCooldownExpiry(phone, 0);
    expect(getStoredCooldown(phone)).toBe(0);
  });

  it('preserves entered OTP input and cooldown across OtpModal unmount and re-render', () => {
    const { unmount } = render(
      <OtpModal
        isOpen={true}
        phoneNumber={phone}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText('Nhập 6 số OTP') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '123456' } });
    expect(input.value).toBe('123456');

    // Unmount modal
    unmount();

    // Verify value saved in sessionStorage
    expect(sessionStorage.getItem(`otp_code_${phone}`)).toBe('123456');

    // Re-mount modal
    render(
      <OtpModal
        isOpen={true}
        phoneNumber={phone}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const remountedInput = screen.getByPlaceholderText('Nhập 6 số OTP') as HTMLInputElement;
    expect(remountedInput.value).toBe('123456');
  });
});
