import { describe, expect, test } from 'vitest';
import { Product } from '../types';
import { buildProductSlugById, findProductBySlug, getProductPath, getProductSlug } from '../utils/productSlug';

const products: Product[] = [
  {
    id: '1001',
    name: 'Yonex Astrox 100ZZ Kurenai',
    brand: 'Yonex',
    image: '',
    category: 'Vợt',
    price: 100000,
    specs: { weight: '4U', stiffness: 'Stiff', balance: 300, maxTension: 28 },
    description: '',
    reviews: [],
    stock: 10
  },
  {
    id: '1002',
    name: 'Yonex Astrox 100ZZ Kurenai',
    brand: 'Yonex',
    image: '',
    category: 'Vợt',
    price: 100000,
    specs: { weight: '4U', stiffness: 'Stiff', balance: 300, maxTension: 28 },
    description: '',
    reviews: [],
    stock: 10
  }
];

describe('product slug utilities', () => {
  test('builds deterministic unique slugs', () => {
    const slugById = buildProductSlugById(products);

    expect(slugById['1001']).toBe('yonex-astrox-100zz-kurenai');
    expect(slugById['1002']).toBe('yonex-astrox-100zz-kurenai-2');
  });

  test('resolves product by slug and supports legacy id links', () => {
    expect(findProductBySlug(products, 'yonex-astrox-100zz-kurenai')?.id).toBe('1001');
    expect(findProductBySlug(products, '1002')?.id).toBe('1002');
  });

  test('builds product detail path with slug', () => {
    const slugById = buildProductSlugById(products);
    expect(getProductSlug(products[0], slugById)).toBe('yonex-astrox-100zz-kurenai');
    expect(getProductPath(products[0], slugById)).toBe('/product/yonex-astrox-100zz-kurenai');
  });
});
