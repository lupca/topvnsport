import { APP_SETTINGS } from "@/config/settings";
import { createApiClient, ApiError } from "@voma/api-client";

export { ApiError };

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
  status: 'DRAFT' | 'CONFIRMED' | 'PROCESSING' | 'PICKING' | 'PACKED' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED' | 'CANCELLATION_PENDING';
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

export const apiClientInstance = createApiClient({
  baseUrl: BASE_URL,
  getToken: () => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("access_token");
      if (token) return token;
    }
    return null;
  },
  onUnauthorized: async () => {
    if (typeof window !== "undefined") {
      const { removeAccessToken, redirectToLogin } = await import("@/utils/auth");
      removeAccessToken();
      redirectToLogin();
    }
  },
});

async function wrapWith401Error<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      throw new ApiError("Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.", 401);
    }
    throw error;
  }
}

export const api = {
  get: <T>(url: string) => wrapWith401Error(apiClientInstance.get<T>(url)),
  post: <T>(url: string, body: any) => wrapWith401Error(apiClientInstance.post<T>(url, body)),
  put: <T>(url: string, body: any) => wrapWith401Error(apiClientInstance.put<T>(url, body)),
  patch: <T>(url: string, body: any) => wrapWith401Error(apiClientInstance.patch<T>(url, body)),
  delete: <T>(url: string) => wrapWith401Error(apiClientInstance.delete<T>(url)),
};

