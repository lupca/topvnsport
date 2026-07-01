/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, Player, Blog, Branch, StringOption } from '../types';
import rawData from '../data.json';

// Simulated latency to mimic a real-world server roundtrip (e.g. 300ms)
const SIMULATED_LATENCY = 200;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
    // Mimic deep clone to prevent direct state mutation issues
    return JSON.parse(JSON.stringify(rawData.products)) as Product[];
  },

  /**
   * Fetch a single product by ID
   */
  async getProductById(id: string): Promise<Product | null> {
    await delay(SIMULATED_LATENCY);
    const product = rawData.products.find(p => p.id === id);
    return product ? (JSON.parse(JSON.stringify(product)) as Product) : null;
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
  }
};
