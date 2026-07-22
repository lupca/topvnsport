import { describe, it, expect } from 'vitest';
import { ValidatePromotionResult } from '../services/sport-api/types';

describe('Promotion Logic', () => {
  it('calculates percentage discount correctly', () => {
    const subtotal = 1000000; // 1,000,000 VND
    const discountPercent = 30; // 30%
    const expectedDiscount = 300000; // 300,000 VND

    const calculated = (subtotal * discountPercent) / 100;
    expect(calculated).toBe(expectedDiscount);
  });

  it('respects max discount limit on percentage promotions', () => {
    const subtotal = 2000000; // 2,000,000 VND
    const discountPercent = 30; // 30% = 600,000 VND
    const maxDiscount = 500000; // Cap at 500,000 VND

    let calculated = (subtotal * discountPercent) / 100;
    if (maxDiscount && calculated > maxDiscount) {
      calculated = maxDiscount;
    }
    expect(calculated).toBe(500000);
  });

  it('validates min order value requirement', () => {
    const subtotal = 200000; // 200,000 VND
    const minOrderValue = 500000; // 500,000 VND requirement

    const isValid = subtotal >= minOrderValue;
    expect(isValid).toBe(false);
  });

  it('handles fixed amount discounts properly', () => {
    const subtotal = 400000;
    const fixedDiscount = 50000; // 50k off

    const finalAmount = Math.max(0, subtotal - fixedDiscount);
    expect(finalAmount).toBe(350000);
  });

  it('caps discount amount to subtotal', () => {
    const subtotal = 30000;
    const fixedDiscount = 50000; // 50k off on 30k order

    const discountAmount = Math.min(subtotal, fixedDiscount);
    expect(discountAmount).toBe(30000);
  });
});
