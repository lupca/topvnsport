import { Category, Product, ProductAttribute, ProductVariant } from '../../types';
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

export function mapProductVariant(variant: PmiVariant, productId: number): ProductVariant {
  const price = Number(variant.price || 0);
  const originalPrice = variant.original_price !== undefined && variant.original_price !== null
    ? Number(variant.original_price)
    : price;
  const computedPrice = variant.computed_price !== undefined && variant.computed_price !== null
    ? Number(variant.computed_price)
    : originalPrice;
  const hasActivePromotion = Boolean(
    variant.has_active_promotion ||
    (variant.computed_price !== undefined && variant.original_price !== undefined && Number(variant.computed_price) < Number(variant.original_price))
  );
  const percentageDiscount = variant.percentage_discount !== undefined && variant.percentage_discount !== null
    ? Number(variant.percentage_discount)
    : (hasActivePromotion && originalPrice > 0 ? Math.round(((originalPrice - computedPrice) / originalPrice) * 100) : 0);

  return {
    id: variant.id,
    product_id: productId,
    tier_1_option: variant.tier_1_option || null,
    tier_2_option: variant.tier_2_option || null,
    sku_code: variant.sku_code || '',
    price,
    barcode: variant.barcode || null,
    stock: Number(variant.stock || 0),
    computedPrice,
    originalPrice,
    percentageDiscount,
    hasActivePromotion
  };
}

export function mapPmiProduct(pmiProduct: PmiProduct, categories: Category[]): Product {
  const variants = pmiProduct.variants || [];
  const mappedVariants = variants.map((v) => mapProductVariant(v, Number(pmiProduct.id)));

  const prices = variants.map((variant) => Number(variant.price ?? 0)).filter((price) => !isNaN(price) && price >= 0);
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
  const resolvedPrice = minPrice;

  const hasActivePromotion = Boolean(
    pmiProduct.has_active_promotion || mappedVariants.some((v) => v.hasActivePromotion)
  );

  const originalPrice = pmiProduct.original_price !== undefined && pmiProduct.original_price !== null
    ? Number(pmiProduct.original_price)
    : resolvedPrice;

  const activeComputedPrices = mappedVariants
    .filter((v) => v.hasActivePromotion && v.computedPrice !== undefined)
    .map((v) => v.computedPrice as number);

  const computedPrice = pmiProduct.computed_price !== undefined && pmiProduct.computed_price !== null
    ? Number(pmiProduct.computed_price)
    : (activeComputedPrices.length > 0 ? Math.min(...activeComputedPrices) : originalPrice);

  const percentageDiscount = pmiProduct.percentage_discount !== undefined && pmiProduct.percentage_discount !== null
    ? Number(pmiProduct.percentage_discount)
    : (hasActivePromotion && originalPrice > 0 ? Math.round(((originalPrice - computedPrice) / originalPrice) * 100) : 0);

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
    salePrice: hasActivePromotion ? computedPrice : (minPrice > 0 ? minPrice : undefined),
    computedPrice: hasActivePromotion ? computedPrice : undefined,
    originalPrice: hasActivePromotion ? originalPrice : undefined,
    percentageDiscount: hasActivePromotion ? percentageDiscount : undefined,
    hasActivePromotion,
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

export const mapPmiProductToStorefront = mapPmiProduct;
