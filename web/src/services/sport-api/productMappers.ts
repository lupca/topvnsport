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

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function mapBrandValue(rawBrand: string | undefined): Product['brand'] | null {
  if (!rawBrand) {
    return null;
  }

  const normalized = normalizeText(rawBrand);
  if (normalized.includes('yonex')) return 'Yonex';
  if (normalized.includes('li-ning') || normalized.includes('lining')) return 'Lining';
  if (normalized.includes('victor')) return 'Victor';
  if (normalized.includes('kumpoo')) return 'Kumpoo';
  return 'Other';
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

  const variantById = variants.reduce<Record<number, PmiVariant>>((accumulator, variant) => {
    if (variant.id !== undefined && variant.id !== null) {
      accumulator[Number(variant.id)] = variant;
    }
    return accumulator;
  }, {});

  const mappedMedia = (pmiProduct.media || [])
    .filter((item) => Boolean(item.image_url))
    .sort((left, right) => {
      const leftOrder = left.display_order || 9999;
      const rightOrder = right.display_order || 9999;
      return leftOrder - rightOrder;
    })
    .map((item) => {
      const variant = item.variant_id ? variantById[Number(item.variant_id)] : undefined;
      return {
        imageUrl: item.image_url as string,
        variantId: item.variant_id ?? null,
        isCover: item.is_cover ?? false,
        displayOrder: item.display_order ?? 9999,
        tier1Option: variant?.tier_1_option || null,
        tier2Option: variant?.tier_2_option || null
      };
    });

  const gallery = mappedMedia.map((item) => item.imageUrl);
  const coverImage = mappedMedia.find((item) => item.isCover)?.imageUrl;
  const image = coverImage || gallery[0] || NO_IMAGE_URL;

  const name = (pmiProduct.name || 'Sản phẩm').trim();
  const attributes = mapPmiAttributes(pmiProduct.attribute_values || []);
  const attrByCode = buildAttrByCode(attributes);
  const brand = mapBrandValue(attrByCode.brand) || 'Other';
  const category = categories.find((item) => item.id === pmiProduct.category_id)?.name || 'Chua phan loai';

  const parsedBalance = Number(attrByCode.balance);
  const parsedMaxTension = Number(attrByCode.maxTension);
  const resolvedPrice = minPrice > 0 ? minPrice : 100000;

  const mappedVariants = variants.map((variant) => ({
    id: variant.id,
    product_id: Number(pmiProduct.id),
    tier_1_option: variant.tier_1_option || null,
    tier_2_option: variant.tier_2_option || null,
    sku_code: variant.sku_code || '',
    price: Number(variant.price || 0),
    barcode: variant.barcode || null,
    stock: Number(variant.stock || 0)
  }));

  return {
    id: String(pmiProduct.id),
    slug: slugifyProductName(name),
    name,
    brand,
    image,
    gallery,
    media: mappedMedia,
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
    stock: stock > 0 ? stock : 0,
    defaultSku: variants.find((variant) => Boolean(variant.sku_code))?.sku_code,
    skuByColor: mapSkuByColor(variants),
    skuByVariant: mapSkuByVariant(variants),
    colors: colors.length > 0 ? colors : ['Tiêu chuẩn'],
    tier_variations: pmiProduct.tier_variations || [],
    variants: mappedVariants
  };
}
