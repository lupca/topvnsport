import { Category, Product, ProductAttribute } from '../../types';
import { slugifyProductName } from '../../utils/productSlug';
import { NO_IMAGE_URL } from './constants';
import { ApiListResponse, PmiAttributeValue, PmiProduct, PmiVariant } from './types';

export function extractItems<T>(data: unknown): T[] {
  if (Array.isArray(data)) {
    return data as T[];
  }

  if (typeof data === 'object' && data !== null && Array.isArray((data as ApiListResponse<T>).items)) {
    return (data as ApiListResponse<T>).items as T[];
  }

  return [];
}

function inferBrandFromName(nameLower: string): Product['brand'] {
  if (nameLower.includes('yonex')) return 'Yonex';
  if (nameLower.includes('lining') || nameLower.includes('li-ning')) return 'Lining';
  if (nameLower.includes('victor')) return 'Victor';
  if (nameLower.includes('kumpoo')) return 'Kumpoo';
  return 'Other';
}

function inferCategoryFromSignals(
  nameLower: string,
  mappedCategoryName: string | undefined,
  attrByCode: Record<string, string>
): string {
  if (mappedCategoryName) {
    return mappedCategoryName;
  }

  if (nameLower.includes('vợt') || nameLower.includes('racket')) {
    return 'Vợt';
  }

  if (nameLower.includes('giày') || nameLower.includes('shoes')) {
    return 'Giày';
  }

  if (nameLower.includes('cước') || nameLower.includes('string') || attrByCode.thickness) {
    return 'Cước';
  }

  if (nameLower.includes('túi') || nameLower.includes('balo')) {
    return 'Túi xách';
  }

  if (nameLower.includes('cầu') || nameLower.includes('shuttlecock')) {
    return 'Quả cầu';
  }

  return 'Phụ kiện';
}

function mapPmiAttributes(values: PmiAttributeValue[]): ProductAttribute[] {
  return values
    .map((item): ProductAttribute | null => {
      if (!item.attribute || !item.attribute.code || !item.attribute.name) {
        return null;
      }

      const rawValue = item.value_string ?? item.value_decimal;
      if (rawValue === null || rawValue === undefined) {
        return null;
      }

      return {
        id: String(item.id || `${item.attribute_id || item.attribute.code}`),
        code: item.attribute.code,
        name: item.attribute.name,
        value: String(rawValue)
      };
    })
    .filter((item): item is ProductAttribute => Boolean(item));
}

function buildAttrByCode(attributes: ProductAttribute[]): Record<string, string> {
  return attributes.reduce<Record<string, string>>((accumulator, attribute) => {
    accumulator[attribute.code] = attribute.value;
    return accumulator;
  }, {});
}

function mapSkuByColor(variants: PmiVariant[]): Record<string, string> {
  return variants.reduce<Record<string, string>>((accumulator, variant) => {
    if (variant.sku_code && variant.tier_1_option) {
      accumulator[variant.tier_1_option] = variant.sku_code;
    }
    return accumulator;
  }, {});
}

function mapSkuByVariant(variants: PmiVariant[]): Record<string, string> {
  return variants.reduce<Record<string, string>>((accumulator, variant) => {
    if (!variant.sku_code) {
      return accumulator;
    }

    const tier1 = variant.tier_1_option || 'Tiêu chuẩn';
    const tier2 = variant.tier_2_option || 'Tiêu chuẩn';
    accumulator[`${tier1}||${tier2}`] = variant.sku_code;
    return accumulator;
  }, {});
}

export function mapPmiProduct(pmiProduct: PmiProduct, categories: Category[]): Product {
  const variants = pmiProduct.variants || [];
  const prices = variants.map((variant) => Number(variant.price || 0)).filter((price) => price > 0);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const stock = variants.reduce((sum, variant) => sum + Number(variant.stock || 0), 0);
  const colors = [...new Set(variants.map((variant) => variant.tier_1_option || 'Tiêu chuẩn'))] as string[];

  const media = pmiProduct.media || [];
  const gallery = media.map((item) => item.image_url).filter((url): url is string => Boolean(url));
  const image = gallery.length > 0 ? gallery[0] : NO_IMAGE_URL;

  const name = (pmiProduct.name || 'Sản phẩm').trim();
  const nameLower = name.toLowerCase();

  const attributes = mapPmiAttributes(pmiProduct.attribute_values || []);
  const attrByCode = buildAttrByCode(attributes);
  const brand = inferBrandFromName(nameLower);
  const category = inferCategoryFromSignals(
    nameLower,
    categories.find((item) => item.id === pmiProduct.category_id)?.name,
    attrByCode
  );

  const parsedBalance = Number(attrByCode.balance);
  const parsedMaxTension = Number(attrByCode.maxTension);
  const resolvedPrice = minPrice > 0 ? minPrice : 100000;

  return {
    id: String(pmiProduct.id),
    slug: slugifyProductName(name),
    name,
    brand,
    image,
    gallery,
    category,
    price: resolvedPrice,
    salePrice: minPrice > 0 ? minPrice : undefined,
    specs: {
      weight: attrByCode.weightClass || (pmiProduct.weight ? String(pmiProduct.weight) : 'Tiêu chuẩn'),
      stiffness: attrByCode.stiffness || 'Tiêu chuẩn',
      balance: Number.isFinite(parsedBalance) ? parsedBalance : 0,
      maxTension: Number.isFinite(parsedMaxTension) ? parsedMaxTension : 0
    },
    description: pmiProduct.description || 'Sản phẩm chính hãng.',
    attributes,
    reviews: [],
    stock: stock > 0 ? stock : 100,
    defaultSku: variants.find((variant) => Boolean(variant.sku_code))?.sku_code,
    skuByColor: mapSkuByColor(variants),
    skuByVariant: mapSkuByVariant(variants),
    colors: colors.length > 0 ? colors : ['Tiêu chuẩn'],
    tier_variations: pmiProduct.tier_variations || [],
    variants: variants.map((variant) => ({
      id: variant.id,
      product_id: Number(pmiProduct.id),
      tier_1_option: variant.tier_1_option || null,
      tier_2_option: variant.tier_2_option || null,
      sku_code: variant.sku_code || '',
      price: Number(variant.price || 0),
      barcode: variant.barcode || null,
      stock: Number(variant.stock || 0)
    }))
  };
}
