/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, Blog, Branch, StringOption, ProductAttribute, Category } from '../types';
import rawData from '../data.json';
import { slugifyProductName } from '../utils/productSlug';

// Simulated latency to mimic a real-world server roundtrip (e.g. 300ms)
const SIMULATED_LATENCY = 200;
const PMI_API_URL = (import.meta as any).env?.VITE_PMI_API_URL || 'http://localhost:18100';
const OMS_API_URL = (import.meta as any).env?.VITE_OMS_API_URL || 'http://localhost:18101';
const NO_IMAGE_URL = 'https://via.placeholder.com/300?text=No+Image';

type PmiVariant = {
  id?: number;
  product_id?: number;
  price?: number;
  stock?: number;
  tier_1_option?: string | null;
  tier_2_option?: string | null;
  sku_code?: string;
  barcode?: string | null;
};


type PmiMedia = {
  image_url?: string;
};

type PmiAttribute = {
  code?: string;
  name?: string;
  type?: string;
};

type PmiAttributeValue = {
  id?: number;
  attribute_id?: number;
  value_string?: string | null;
  value_decimal?: number | null;
  attribute?: PmiAttribute | null;
};

type PmiTierVariation = {
  id?: number;
  product_id?: number;
  tier_index: number;
  name: string;
  options: string[];
};

type PmiProduct = {
  id: string | number;
  name?: string;
  description?: string;
  weight?: string | number;
  category_id?: number;
  family_id?: number;
  attribute_values?: PmiAttributeValue[];
  variants?: PmiVariant[];
  media?: PmiMedia[];
  tier_variations?: PmiTierVariation[];
};


type CreateOrderItem = {
  sku_code: string;
  quantity: number;
};

type CreateOrderPayload = {
  customer_id: number;
  channel_id: number;
  shipping_fee: number;
  shipping_address: string;
  note?: string;
  items: CreateOrderItem[];
};

type OmsCustomer = {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
};

type OmsPaginatedCustomers = {
  items?: OmsCustomer[];
};

type OmsCustomerInput = {
  name: string;
  phone: string;
  address: string;
  email?: string;
};

type OmsChannel = {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
};

type OmsPaginatedChannels = {
  items?: OmsChannel[];
};

type ApiListResponse<T> = {
  items?: T[];
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function extractItems<T>(data: unknown): T[] {
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

function mapPmiProduct(pmiProduct: PmiProduct, categories: Category[]): Product {
  const variants = pmiProduct.variants || [];
  const prices = variants.map(v => Number(v.price || 0)).filter(price => price > 0);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const stock = variants.reduce((sum, v) => sum + Number(v.stock || 0), 0);
  const colors = [...new Set(variants.map(v => v.tier_1_option || 'Tiêu chuẩn'))] as string[];

  const media = pmiProduct.media || [];
  const gallery = media.map(m => m.image_url).filter((url): url is string => Boolean(url));
  const image = gallery.length > 0 ? gallery[0] : NO_IMAGE_URL;

  const name = (pmiProduct.name || 'Sản phẩm').trim();
  const nameLower = name.toLowerCase();

  const attributes = mapPmiAttributes(pmiProduct.attribute_values || []);
  const attrByCode = buildAttrByCode(attributes);
  const brand = inferBrandFromName(nameLower);
  const category = inferCategoryFromSignals(
    nameLower,
    categories.find(c => c.id === pmiProduct.category_id)?.name,
    attrByCode
  );

  const parsedBalance = Number(attrByCode.balance);
  const parsedMaxTension = Number(attrByCode.maxTension);

  const resolvedPrice = minPrice > 0 ? minPrice : 100000;
  const defaultSku = variants.find(v => Boolean(v.sku_code))?.sku_code;
  const skuByColor = mapSkuByColor(variants);
  const skuByVariant = mapSkuByVariant(variants);

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
    defaultSku,
    skuByColor,
    skuByVariant,
    colors: colors.length > 0 ? colors : ['Tiêu chuẩn'],
    tier_variations: pmiProduct.tier_variations || [],
    variants: (pmiProduct.variants || []).map(v => ({
      id: v.id,
      product_id: Number(pmiProduct.id),
      tier_1_option: v.tier_1_option || null,
      tier_2_option: v.tier_2_option || null,
      sku_code: v.sku_code || '',
      price: Number(v.price || 0),
      barcode: v.barcode || null,
      stock: Number(v.stock || 0)
    }))
  };
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, '');
}

async function findExistingCustomerIdByPhone(phone: string): Promise<number | null> {
  const normalizedPhone = normalizePhone(phone);
  const searchRes = await fetch(
    `${OMS_API_URL}/customers?search=${encodeURIComponent(phone)}&limit=100`
  );

  if (!searchRes.ok) {
    return null;
  }

  const data = (await searchRes.json()) as OmsPaginatedCustomers;
  const existing = (data.items || []).find(
    customer => normalizePhone(customer.phone || '') === normalizedPhone
  );

  return existing ? existing.id : null;
}

async function getChannels(search?: string): Promise<OmsChannel[]> {
  const query = search
    ? `?search=${encodeURIComponent(search)}&limit=100`
    : '?limit=100';
  const response = await fetch(`${OMS_API_URL}/channels${query}`);
  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as OmsPaginatedChannels;
  return data.items || [];
}

function findManualChannel(channels: OmsChannel[]): OmsChannel | undefined {
  return channels.find(c => c.is_active && c.code?.toUpperCase() === 'MANUAL');
}

/**
 * TopVNSport API Service Layer
 * Designed to easily switch to actual fetch/axios API calls by changing
 * the internal fetch logic without touching UI components.
 */
export const sportApi = {
  /**
   * Fetch all equipment products
   */
  async getProducts(): Promise<Product[]> {
    await delay(SIMULATED_LATENCY);
    try {
      const [res, categories] = await Promise.all([
        fetch(`${PMI_API_URL}/products?limit=100`),
        this.getCategories()
      ]);
      if (!res.ok) {
        throw new Error(`PMI getProducts failed with status ${res.status}`);
      }
      const data: unknown = await res.json();
      const pmiProducts = extractItems<PmiProduct>(data);

      return pmiProducts.map(product => mapPmiProduct(product as PmiProduct, categories));
    } catch (error) {
      console.warn('Failed to fetch products:', error);
      return [];
    }
  },

  /**
   * Fetch a single product by ID
   */
  async getProductById(id: string): Promise<Product | null> {
    await delay(SIMULATED_LATENCY);
    try {
      const [res, categories] = await Promise.all([
        fetch(`${PMI_API_URL}/products/${id}`),
        this.getCategories()
      ]);
      if (res.ok) {
        const pmiProduct = (await res.json()) as PmiProduct;
        return mapPmiProduct(pmiProduct, categories);
      }
      if (res.status !== 404) {
        throw new Error(`PMI getProductById failed with status ${res.status}`);
      }
    } catch (error) {
      console.error(error);
    }

    const products = await this.getProducts();
    return products.find(product => product.id === id) || null;
  },

  /**
   * Fetch knowledge base blogs and reviews
   */
  async getBlogs(): Promise<Blog[]> {
    await delay(SIMULATED_LATENCY);
    return JSON.parse(JSON.stringify(rawData.blogs)) as Blog[];
  },

  /**
   * Fetch categories from PMI
   */
  async getCategories(): Promise<Category[]> {
    try {
      const res = await fetch(`${PMI_API_URL}/categories`);
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      }
      return [];
    } catch (error) {
      console.warn('Failed to fetch categories:', error);
      return [];
    }
  },

  /**
   * Fetch a single blog by ID
   */
  async getBlogById(id: string): Promise<Blog | null> {
    const blog = rawData.blogs.find(b => b.id === id);
    return blog ? (JSON.parse(JSON.stringify(blog)) as Blog) : null;
  },

  /**
   * Fetch store branch locations for O2O stringing & test racket pickup
   */
  async getBranches(): Promise<Branch[]> {
    return JSON.parse(JSON.stringify(rawData.branches)) as Branch[];
  },

  /**
   * Fetch premium badminton string options & specs
   */
  async getStringOptions(): Promise<StringOption[]> {
    await delay(SIMULATED_LATENCY);
    try {
      const products = await this.getProducts();
      const stringProducts = products.filter(p => p.category === 'Cước');
      if (stringProducts.length > 0) {
        return stringProducts.map(p => {
          const thicknessAttr = p.attributes?.find(a => a.code === 'thickness')?.value || '0.65mm';
          let type: StringOption['type'] = 'Trợ lực / Âm thanh';
          const stiffnessLower = p.specs.stiffness?.toLowerCase() || '';
          if (stiffnessLower.includes('bền')) {
            type = 'Độ bền';
          } else if (stiffnessLower.includes('kiểm soát')) {
            type = 'Kiểm soát';
          }
          
          let brand: StringOption['brand'] = 'Yonex';
          if (p.brand === 'Lining') brand = 'Lining';
          else if (p.brand === 'Victor') brand = 'Victor';

          return {
            id: p.id,
            name: p.name,
            brand,
            type,
            thickness: thicknessAttr,
            price: p.price,
            colors: p.colors || []
          };
        });
      }
    } catch (error) {
      console.warn('Failed to fetch dynamic string options from API:', error);
    }
    return JSON.parse(JSON.stringify(rawData.stringOptions)) as StringOption[];
  },


  /**
   * Fetch global constants (shipping, default config, regions)
   */
  async getConstants() {
    return JSON.parse(JSON.stringify(rawData.constants));
  },

  async createOrder(orderData: CreateOrderPayload) {
    const res = await fetch(`${OMS_API_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to create order: ${text}`);
    }
    return res.json();
  },

  async findOrCreateCustomer(customer: OmsCustomerInput): Promise<number> {
    const existingCustomerId = await findExistingCustomerIdByPhone(customer.phone);
    if (existingCustomerId !== null) {
      return existingCustomerId;
    }

    const createRes = await fetch(`${OMS_API_URL}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customer)
    });

    if (createRes.ok) {
      const created = (await createRes.json()) as OmsCustomer;
      return created.id;
    }

    const fallbackCustomerId = await findExistingCustomerIdByPhone(customer.phone);
    if (fallbackCustomerId !== null) {
      return fallbackCustomerId;
    }

    const errorText = await createRes.text();
    throw new Error(`Failed to create customer: ${errorText}`);
  },

  async getOrCreateManualChannelId(): Promise<number> {
    const searchedChannels = await getChannels('MANUAL');
    const searchedManual = findManualChannel(searchedChannels);
    if (searchedManual) {
      return searchedManual.id;
    }

    const channels = await getChannels();
    const manual = findManualChannel(channels);
    if (manual) {
      return manual.id;
    }

    const activeChannel = channels.find(channel => channel.is_active);
    if (activeChannel) {
      return activeChannel.id;
    }

    const createRes = await fetch(`${OMS_API_URL}/channels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'MANUAL',
        name: 'Manual',
        is_active: true
      })
    });

    if (createRes.ok) {
      const created = (await createRes.json()) as OmsChannel;
      return created.id;
    }

    const errorText = await createRes.text();
    throw new Error(`Failed to resolve channel: ${errorText}`);
  }
};
