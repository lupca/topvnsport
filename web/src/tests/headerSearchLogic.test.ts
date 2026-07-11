import { describe, expect, test } from 'vitest';

import { products } from '../data';
import { buildSearchIndex, normalizeSearchText } from '../components/Header';

describe('Header search logic', () => {
  test('matches normalized category-style queries like Cước / Dây', () => {
    const tokens = normalizeSearchText('Cước / Dây').split(' ').filter(Boolean);
    const matches = products.filter(product => {
      const searchIndex = buildSearchIndex(product);
      return tokens.every(token => searchIndex.includes(token));
    });

    expect(tokens).toEqual(['cuoc', 'day']);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some(product => product.category === 'Cước')).toBe(true);
  });
});
