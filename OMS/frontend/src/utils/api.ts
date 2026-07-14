import { APP_SETTINGS } from "@/config/settings";

const BASE_URL = APP_SETTINGS.api.baseUrl;

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  created_at: string;
}

export interface CustomerCreateInput {
  name: string;
  phone: string;
  email?: string;
  address?: string;
}

export interface Channel {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
}

export interface ChannelCreateInput {
  code: string;
  name: string;
  is_active?: boolean;
}

export interface OrderItem {
  id: number;
  sku_code: string;
  product_name: string;
  variant_name?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  image_url?: string;
}

export interface FulfillmentOrder {
  id: number;
  fulfillment_number: string;
  warehouse_code: string;
  status: string;
  tracking_number?: string;
  carrier_name?: string;
  shipped_at?: string;
  created_at: string;
}

export interface Order {
  id: number;
  order_number: string;
  customer_id: number;
  channel_id: number;
  status: 'DRAFT' | 'CONFIRMED' | 'PROCESSING' | 'PICKING' | 'PACKED' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED';
  total_amount: number;
  shipping_fee: number;
  shipping_address: string;
  note?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  fulfillment_orders?: FulfillmentOrder[];
  customer?: Customer;
  channel?: Channel;
}

export interface OrderItemInput {
  sku_code: string;
  quantity: number;
}

export interface OrderCreateInput {
  order_number?: string;
  customer_id: number;
  channel_id: number;
  shipping_fee: number;
  shipping_address: string;
  note?: string;
  created_by?: string;
  items: OrderItemInput[];
}

export interface OrderUpdateInput {
  customer_id?: number;
  channel_id?: number;
  shipping_fee?: number;
  shipping_address?: string;
  note?: string;
  items?: OrderItemInput[];
}

export interface ProductSearchResult {
  id: number;
  product_code: string;
  name: string;
  description?: string;
  variants: Array<{
    id: number;
    sku_code: string;
    price: number;
    stock: number;
    tier_1_option?: string;
    tier_2_option?: string;
  }>;
  media: Array<{
    image_url: string;
    is_cover: boolean;
  }>;
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 401) {
      if (typeof window !== "undefined") {
        const { removeAccessToken, redirectToLogin } = await import("@/utils/auth");
        removeAccessToken();
        redirectToLogin();
      }
      throw new Error("Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.");
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `API Request Failed with status ${response.status}`);
    }

    if (response.status === 204) {
      return null as T;
    }

    return response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out after 15 seconds');
    }
    throw error;
  }
}

export const api = {
  get: <T>(url: string) => request<T>(url, { method: "GET" }),
  post: <T>(url: string, body: any) => request<T>(url, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(url: string, body: any) => request<T>(url, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(url: string, body: any) => request<T>(url, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(url: string) => request<T>(url, { method: "DELETE" }),
};
