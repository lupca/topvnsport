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

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

  const attributes: ProductAttribute[] = (pmiProduct.attribute_values || [])
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

  const attrByCode = attributes.reduce<Record<string, string>>((acc, attr) => {
    acc[attr.code] = attr.value;
    return acc;
  }, {});

  let brand: Product['brand'] = 'Other';
  if (nameLower.includes('yonex')) brand = 'Yonex';
  else if (nameLower.includes('lining') || nameLower.includes('li-ning')) brand = 'Lining';
  else if (nameLower.includes('victor')) brand = 'Victor';
  else if (nameLower.includes('kumpoo')) brand = 'Kumpoo';

  let category: string = 'Phụ kiện';
  const categoryMatch = categories.find(c => c.id === pmiProduct.category_id);
  if (categoryMatch) {
    category = categoryMatch.name;
  } else {
    if (nameLower.includes('vợt') || nameLower.includes('racket')) {
      category = 'Vợt';
    } else if (nameLower.includes('giày') || nameLower.includes('shoes')) {
      category = 'Giày';
    } else if (nameLower.includes('cước') || nameLower.includes('string')) {
      category = 'Cước';
    } else if (nameLower.includes('túi') || nameLower.includes('balo')) {
      category = 'Túi xách';
    } else if (nameLower.includes('cầu') || nameLower.includes('shuttlecock')) {
      category = 'Quả cầu';
    }

    if (attrByCode.thickness) {
      category = 'Cước';
    }
  }

  const parsedBalance = Number(attrByCode.balance);
  const parsedMaxTension = Number(attrByCode.maxTension);

  const resolvedPrice = minPrice > 0 ? minPrice : 100000;
  const defaultSku = variants.find(v => Boolean(v.sku_code))?.sku_code;
  const skuByColor = variants.reduce<Record<string, string>>((acc, v) => {
    if (v.sku_code && v.tier_1_option) {
      acc[v.tier_1_option] = v.sku_code;
    }
    return acc;
  }, {});
  const skuByVariant = variants.reduce<Record<string, string>>((acc, v) => {
    if (v.sku_code) {
      const t1 = v.tier_1_option || 'Tiêu chuẩn';
      const t2 = v.tier_2_option || 'Tiêu chuẩn';
      acc[`${t1}||${t2}`] = v.sku_code;
    }
    return acc;
  }, {});

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
      const pmiProducts = Array.isArray(data)
        ? data
        : (typeof data === 'object' && data !== null && Array.isArray((data as { items?: unknown[] }).items)
          ? (data as { items: unknown[] }).items
          : []);

      return pmiProducts.map(product => mapPmiProduct(product as PmiProduct, categories));
    } catch (e) {
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
    } catch (e) {
      console.error(e);
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
        return await res.json();
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
    } catch (e) {
      console.warn('Failed to fetch dynamic string options from API:', e);
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
    const normalizedPhone = normalizePhone(customer.phone);
    const searchRes = await fetch(
      `${OMS_API_URL}/customers?search=${encodeURIComponent(customer.phone)}&limit=100`
    );

    if (searchRes.ok) {
      const data = (await searchRes.json()) as OmsPaginatedCustomers;
      const existing = (data.items || []).find(
        c => normalizePhone(c.phone || '') === normalizedPhone
      );
      if (existing) {
        return existing.id;
      }
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

    // If another request already created this customer, fetch again and reuse it.
    const fallbackSearchRes = await fetch(
      `${OMS_API_URL}/customers?search=${encodeURIComponent(customer.phone)}&limit=100`
    );
    if (fallbackSearchRes.ok) {
      const data = (await fallbackSearchRes.json()) as OmsPaginatedCustomers;
      const existing = (data.items || []).find(
        c => normalizePhone(c.phone || '') === normalizedPhone
      );
      if (existing) {
        return existing.id;
      }
    }

    const errorText = await createRes.text();
    throw new Error(`Failed to create customer: ${errorText}`);
  },

  async getOrCreateManualChannelId(): Promise<number> {
    const searchRes = await fetch(
      `${OMS_API_URL}/channels?search=${encodeURIComponent('MANUAL')}&limit=100`
    );
    if (searchRes.ok) {
      const data = (await searchRes.json()) as OmsPaginatedChannels;
      const manual = findManualChannel(data.items || []);
      if (manual) {
        return manual.id;
      }
    }

    const listRes = await fetch(`${OMS_API_URL}/channels?limit=100`);
    if (listRes.ok) {
      const data = (await listRes.json()) as OmsPaginatedChannels;
      const manual = findManualChannel(data.items || []);
      if (manual) {
        return manual.id;
      }

      const activeChannel = (data.items || []).find(c => c.is_active);
      if (activeChannel) {
        return activeChannel.id;
      }
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
