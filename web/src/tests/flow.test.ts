import { describe, test, expect } from 'vitest';
import { products, stringOptions } from '../data';
import { Product } from '../types';
import { getTopLevelProductCategories } from '../utils/categories';

// Helper matching logic extracted from RacketFinder.tsx for verification
function calculateRecommendations(answers: { skill: string; style: string; budget: string }): Product[] {
  let matches = products.filter(p => p.category === 'Vợt');

  // Filter by budget
  if (answers.budget === 'low') {
    matches = matches.filter(p => p.price <= 1500000);
  } else if (answers.budget === 'medium') {
    matches = matches.filter(p => p.price > 1000000 && p.price <= 3000000);
  } else if (answers.budget === 'high') {
    matches = matches.filter(p => p.price > 3000000);
  }

  // Filter by style
  if (answers.style === 'attack') {
    matches = matches.sort((a, b) => (b.specs.balance || 0) - (a.specs.balance || 0));
  } else if (answers.style === 'defense') {
    matches = matches.sort((a, b) => (a.specs.balance || 0) - (b.specs.balance || 0));
  }

  if (matches.length === 0) {
    matches = products.filter(p => p.category === 'Vợt').slice(0, 3);
  }

  return matches.slice(0, 3);
}

// Helper cart total calculator
interface TestCartItem {
  price: number;
  quantity: number;
  stringOption: { price: number } | null;
}

function calculateCartTotals(items: TestCartItem[], shippingMethod: 'standard' | 'fast' | 'store') {
  const itemsTotal = items.reduce((sum, item) => {
    const stringPrice = item.stringOption ? item.stringOption.price : 0;
    return sum + (item.price + stringPrice) * item.quantity;
  }, 0);

  let shippingCost = 30000;
  if (shippingMethod === 'fast') shippingCost = 50000;
  if (shippingMethod === 'store') shippingCost = 0;

  const orderTotal = itemsTotal + shippingCost;
  return { itemsTotal, shippingCost, orderTotal };
}

describe('Automated System Verification Tests', () => {
  test('Racket Finder Algorithm gives budget-appropriate rackets', () => {
    // Low Budget Finder Check
    const lowBudgetAnswers = { skill: 'beginner', style: 'allround', budget: 'low' };
    const lowBudgetMatches = calculateRecommendations(lowBudgetAnswers);
    
    expect(lowBudgetMatches.length).toBeGreaterThan(0);
    lowBudgetMatches.forEach(product => {
      expect(product.price).toBeLessThanOrEqual(1500000);
    });

    // High Budget Finder Check
    const highBudgetAnswers = { skill: 'pro', style: 'attack', budget: 'high' };
    const highBudgetMatches = calculateRecommendations(highBudgetAnswers);

    expect(highBudgetMatches.length).toBeGreaterThan(0);
    highBudgetMatches.forEach(product => {
      expect(product.price).toBeGreaterThan(3000000);
    });
  });

  test('Racket Finder Algorithm prioritizes high balance point for attack style', () => {
    const attackAnswers = { skill: 'intermediate', style: 'attack', budget: 'high' };
    const matches = calculateRecommendations(attackAnswers);

    expect(matches.length).toBeGreaterThan(0);
    if (matches.length >= 2) {
      expect(matches[0].specs.balance).toBeGreaterThanOrEqual(matches[1].specs.balance || 0);
    }
  });

  test('Cart pricing calculations sum product and stringing choices correctly', () => {
    const testItems: TestCartItem[] = [
      {
        price: 1000000,
        quantity: 1,
        stringOption: { price: 200000 } // Exbolt 68 or similar
      },
      {
        price: 2950000, // Shoes
        quantity: 2,
        stringOption: null
      }
    ];

    // Standard Shipping
    const standardTotals = calculateCartTotals(testItems, 'standard');
    expect(standardTotals.itemsTotal).toBe((1000000 + 200000) * 1 + (2950000 * 2)); // 1.2M + 5.9M = 7.1M
    expect(standardTotals.shippingCost).toBe(30000);
    expect(standardTotals.orderTotal).toBe(7100000 + 30000);

    // Fast Shipping
    const fastTotals = calculateCartTotals(testItems, 'fast');
    expect(fastTotals.shippingCost).toBe(50000);
    expect(fastTotals.orderTotal).toBe(7100000 + 50000);

    // Store pickup
    const storeTotals = calculateCartTotals(testItems, 'store');
    expect(storeTotals.shippingCost).toBe(0);
    expect(storeTotals.orderTotal).toBe(7100000);
  });

  test('Product catalog database has required fields', () => {
    products.forEach(product => {
      expect(product).toHaveProperty('id');
      expect(product).toHaveProperty('name');
      expect(product).toHaveProperty('brand');
      expect(product).toHaveProperty('category');
      expect(product).toHaveProperty('price');
      expect(product).toHaveProperty('specs');
    });
  });

  test('Top-level category helper keeps actual parent-child catalog categories only', () => {
    const categories = [
      { id: 1, name: 'Thiết bị cầu lông', code: 'badminton_equipment', parent_id: null, display_name: '[root] / Thiết bị cầu lông' },
      { id: 2, name: 'Phụ kiện cầu lông', code: 'badminton_accessories', parent_id: null, display_name: '[root] / Phụ kiện cầu lông' },
      { id: 3, name: 'Vợt', code: 'rackets', parent_id: 1, display_name: '[root] / Thiết bị cầu lông / Vợt' },
      { id: 4, name: 'Giày', code: 'shoes', parent_id: 1, display_name: '[root] / Thiết bị cầu lông / Giày' },
      { id: 5, name: 'Cước', code: 'strings', parent_id: 2, display_name: '[root] / Phụ kiện cầu lông / Cước' },
      { id: 6, name: 'Túi xách', code: 'bags', parent_id: 2, display_name: '[root] / Phụ kiện cầu lông / Túi xách' },
      { id: 7, name: 'Quả cầu', code: 'shuttlecocks', parent_id: 2, display_name: '[root] / Phụ kiện cầu lông / Quả cầu' }
    ];

    const result = getTopLevelProductCategories(categories as any);

    expect(result.map(category => category.code)).toEqual(['rackets', 'shoes', 'strings', 'bags', 'shuttlecocks']);
  });
});
