// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../features/home/HomePage';
import cartReducer from '../features/cart/cartSlice';
import catalogReducer from '../features/catalog/catalogSlice';

function createMockStore(appDataState: any) {
  return configureStore({
    reducer: {
      appData: (state = appDataState) => state,
      cart: cartReducer,
      catalog: catalogReducer,
    },
    preloadedState: {
      cart: { items: [], isOpen: false, quickViewProduct: null },
      catalog: { selectedCategory: null, searchKeyword: '', priceRange: [0, 10000000], sortBy: 'featured' },
    },
  });
}

describe('Challenger M2-2: HomePage Redux Selector Fallbacks Empirical Stress Tests', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('1. Renders HomePage cleanly when products, blogs, and categories are all undefined', () => {
    const store = createMockStore({
      products: undefined,
      blogs: undefined,
      categories: undefined,
      branches: [],
      stringOptions: [],
      isLoading: false,
    });

    expect(() => {
      render(
        <Provider store={store}>
          <MemoryRouter>
            <HomePage />
          </MemoryRouter>
        </Provider>
      );
    }).not.toThrow();

    expect(screen.getByText(/Trình cố vấn ảo chọn vợt thông minh/i)).toBeTruthy();
    expect(screen.getByText(/GIỜ VÀNG SĂN DEAL CHẤT/i)).toBeTruthy();
  });

  it('2. Renders HomePage cleanly when products, blogs, and categories are all null', () => {
    const store = createMockStore({
      products: null,
      blogs: null,
      categories: null,
      branches: null,
      stringOptions: null,
      isLoading: false,
    });

    expect(() => {
      render(
        <Provider store={store}>
          <MemoryRouter>
            <HomePage />
          </MemoryRouter>
        </Provider>
      );
    }).not.toThrow();

    expect(screen.getByText(/Trình cố vấn ảo chọn vợt thông minh/i)).toBeTruthy();
  });

  it('3. Renders HomePage cleanly when appData slice is empty object {}', () => {
    const store = createMockStore({});

    expect(() => {
      render(
        <Provider store={store}>
          <MemoryRouter>
            <HomePage />
          </MemoryRouter>
        </Provider>
      );
    }).not.toThrow();

    expect(screen.getByText(/Trình cố vấn ảo chọn vợt thông minh/i)).toBeTruthy();
  });

  it('4. Renders HomePage cleanly when slices have mixed undefined and null values', () => {
    const store = createMockStore({
      products: undefined,
      blogs: null,
      categories: [],
    });

    expect(() => {
      render(
        <Provider store={store}>
          <MemoryRouter>
            <HomePage />
          </MemoryRouter>
        </Provider>
      );
    }).not.toThrow();

    expect(screen.getByText(/GIỜ VÀNG SĂN DEAL CHẤT/i)).toBeTruthy();
  });

  it('5. Renders HomePage with empty arrays [] without error', () => {
    const store = createMockStore({
      products: [],
      blogs: [],
      categories: [],
    });

    expect(() => {
      render(
        <Provider store={store}>
          <MemoryRouter>
            <HomePage />
          </MemoryRouter>
        </Provider>
      );
    }).not.toThrow();
  });

  it('6. Tests vulnerability when state slices contain non-array types (object, string, number)', () => {
    const store = createMockStore({
      products: {} as any, // Non-array object
      blogs: 'invalid' as any,
      categories: 123 as any,
    });

    let threw = false;
    let errorMessage = '';
    try {
      render(
        <Provider store={store}>
          <MemoryRouter>
            <HomePage />
          </MemoryRouter>
        </Provider>
      );
    } catch (err: any) {
      threw = true;
      errorMessage = err.message;
    }

    console.log('Non-array slice type test result - threw:', threw, 'message:', errorMessage);
    // Document whether non-array types crash the component because ?? only catches null/undefined
    expect(threw).toBe(true);
  });
});
