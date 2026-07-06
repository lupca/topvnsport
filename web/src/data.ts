import { Product, Blog, Branch, StringOption } from './types';
import rawData from './data.json';

export const products = rawData.products as Product[];
export const blogs = rawData.blogs as Blog[];
export const branches = rawData.branches as Branch[];
export const stringOptions = rawData.stringOptions as StringOption[];
export const constants = rawData.constants;
