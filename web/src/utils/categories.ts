import { Category, Product } from '../types';

export function getTopLevelProductCategories(categories: Category[]): Category[] {
  const rootIds = new Set(categories.filter(category => category.parent_id === null).map(category => category.id));
  return categories.filter(category => category.parent_id !== null && rootIds.has(category.parent_id));
}

export function getProductCategoryCounts(products: Product[]): Record<string, number> {
  return products.reduce<Record<string, number>>((counts, product) => {
    counts[product.category] = (counts[product.category] || 0) + 1;
    return counts;
  }, {});
}