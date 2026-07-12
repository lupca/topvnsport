import { Category } from '../../types';

export type PmiVariant = {
  id?: number;
  product_id?: number;
  price?: number;
  stock?: number;
  tier_1_option?: string | null;
  tier_2_option?: string | null;
  sku_code?: string;
  barcode?: string | null;
};

export type PmiMedia = {
  image_url?: string;
};

export type PmiAttribute = {
  code?: string;
  name?: string;
  type?: string;
};

export type PmiAttributeValue = {
  id?: number;
  attribute_id?: number;
  value_string?: string | null;
  value_decimal?: number | null;
  attribute?: PmiAttribute | null;
};

export type PmiTierVariation = {
  id?: number;
  product_id?: number;
  tier_index: number;
  name: string;
  options: string[];
};

export type PmiProduct = {
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

export type CreateOrderItem = {
  sku_code: string;
  quantity: number;
};

export type CreateOrderPayload = {
  customer_id: number;
  channel_id: number;
  shipping_fee: number;
  shipping_address: string;
  note?: string;
  items: CreateOrderItem[];
  verification_token?: string;
};

export type SendOtpResponse = {
  success: boolean;
  message?: string;
};

export type VerifyOtpResponse = {
  success: boolean;
  verification_token: string;
};


export type OmsCustomer = {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
};

export type OmsPaginatedCustomers = {
  items?: OmsCustomer[];
};

export type OmsCustomerInput = {
  name: string;
  phone: string;
  address: string;
  email?: string;
};

export type OmsChannel = {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
};

export type OmsPaginatedChannels = {
  items?: OmsChannel[];
};

export type ApiListResponse<T> = {
  items?: T[];
};

export type PmiProductMapper = (product: PmiProduct, categories: Category[]) => any;
