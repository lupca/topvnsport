/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, Player, Blog, Branch, StringOption } from '../types';
import rawData from '../data.json';

// Simulated latency to mimic a real-world server roundtrip (e.g. 300ms)
const SIMULATED_LATENCY = 200;
const PMI_API_URL = import.meta.env.VITE_PMI_API_URL || 'http://localhost:18100';
const OMS_API_URL = import.meta.env.VITE_OMS_API_URL || 'http://localhost:18101';
const NO_IMAGE_URL = 'https://via.placeholder.com/300?text=No+Image';

type PmiVariant = {
  price?: number;
  stock?: number;
  tier_1_option?: string | null;
  tier_2_option?: string | null;
  sku_code?: string;
};

type PmiMedia = {
  image_url?: string;
};

type PmiProduct = {
  id: string | number;
  name?: string;
  description?: string;
  weight?: string | number;
  category_id?: number;
  variants?: PmiVariant[];
  media?: PmiMedia[];
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

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function mapPmiProduct(pmiProduct: PmiProduct): Product {
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

  let brand: Product['brand'] = 'Other';
  if (nameLower.includes('yonex')) brand = 'Yonex';
  else if (nameLower.includes('lining') || nameLower.includes('li-ning')) brand = 'Lining';
  else if (nameLower.includes('victor')) brand = 'Victor';
  else if (nameLower.includes('kumpoo')) brand = 'Kumpoo';

  let category: Product['category'] = 'Phụ kiện';
  if (nameLower.includes('vợt') || nameLower.includes('racket') || pmiProduct.category_id === 1) {
    category = 'Vợt';
  } else if (nameLower.includes('giày') || nameLower.includes('shoes')) {
    category = 'Giày';
  }

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
    name,
    brand,
    image,
    gallery,
    category,
    price: resolvedPrice,
    salePrice: minPrice > 0 ? minPrice : undefined,
    specs: {
      weight: pmiProduct.weight ? String(pmiProduct.weight) : '4U/83g',
      stiffness: 'Medium',
      balance: 295,
      maxTension: 28
    },
    description: pmiProduct.description || 'Sản phẩm chính hãng.',
    reviews: [],
    stock: stock > 0 ? stock : 100,
    defaultSku,
    skuByColor,
    skuByVariant,
    colors: colors.length > 0 ? colors : ['Tiêu chuẩn']
  };
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
      const res = await fetch(`${PMI_API_URL}/products`);
      if (!res.ok) {
        throw new Error(`PMI getProducts failed with status ${res.status}`);
      }
      const data: unknown = await res.json();
      const pmiProducts = Array.isArray(data)
        ? data
        : (typeof data === 'object' && data !== null && Array.isArray((data as { items?: unknown[] }).items)
          ? (data as { items: unknown[] }).items
          : []);

      return pmiProducts.map(product => mapPmiProduct(product as PmiProduct));
    } catch (error) {
      console.warn('Falling back to local mock products due to PMI error:', error);
      return JSON.parse(JSON.stringify(rawData.products)) as Product[];
    }
  },

  /**
   * Fetch a single product by ID
   */
  async getProductById(id: string): Promise<Product | null> {
    await delay(SIMULATED_LATENCY);
    try {
      const res = await fetch(`${PMI_API_URL}/products/${id}`);
      if (res.ok) {
        const pmiProduct = (await res.json()) as PmiProduct;
        return mapPmiProduct(pmiProduct);
      }
      if (res.status !== 404) {
        throw new Error(`PMI getProductById failed with status ${res.status}`);
      }

      const products = await this.getProducts();
      return products.find(product => product.id === id) || null;
    } catch (error) {
      console.warn(`Falling back to local mock product for id ${id}:`, error);
      const product = rawData.products.find(p => p.id === id);
      return product ? (JSON.parse(JSON.stringify(product)) as Product) : null;
    }
  },

  /**
   * Fetch superstar player recommendations & combopacks
   */
  async getPlayers(): Promise<Player[]> {
    await delay(SIMULATED_LATENCY);
    return JSON.parse(JSON.stringify(rawData.players)) as Player[];
  },

  /**
   * Fetch knowledge base blogs and reviews
   */
  async getBlogs(): Promise<Blog[]> {
    await delay(SIMULATED_LATENCY);
    return JSON.parse(JSON.stringify(rawData.blogs)) as Blog[];
  },

  /**
   * Fetch a single blog by ID
   */
  async getBlogById(id: string): Promise<Blog | null> {
    await delay(SIMULATED_LATENCY);
    const blog = rawData.blogs.find(b => b.id === id);
    return blog ? (JSON.parse(JSON.stringify(blog)) as Blog) : null;
  },

  /**
   * Fetch store branch locations for O2O stringing & test racket pickup
   */
  async getBranches(): Promise<Branch[]> {
    await delay(SIMULATED_LATENCY);
    return JSON.parse(JSON.stringify(rawData.branches)) as Branch[];
  },

  /**
   * Fetch premium badminton string options & specs
   */
  async getStringOptions(): Promise<StringOption[]> {
    await delay(SIMULATED_LATENCY);
    return JSON.parse(JSON.stringify(rawData.stringOptions)) as StringOption[];
  },

  /**
   * Fetch global constants (shipping, default config, regions)
   */
  async getConstants() {
    await delay(SIMULATED_LATENCY);
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
  }
};
