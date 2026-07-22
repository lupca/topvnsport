export type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT" | "FIXED_PRICE";

export type PromotionStatus = "DRAFT" | "SCHEDULED" | "ACTIVE" | "PAUSED" | "ENDED";

export type ScopeType = "ALL" | "CATEGORY" | "PRODUCT" | "VARIANT";

export interface PromotionScope {
  id?: string;
  promotion_id?: string;
  scope_type: ScopeType;
  target_id?: string | null;
  is_exclusion: boolean;
}

export interface Promotion {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  discount_type: DiscountType;
  discount_value: number;
  max_discount?: number | null;
  priority: number;
  status: PromotionStatus;
  starts_at?: string | null;
  ends_at?: string | null;
  intent?: string | null;
  ai_reasoning?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  scopes?: PromotionScope[];
  affected_variants_count?: number;
}

export interface PromotionComputedPrice {
  id: string;
  variant_id: string;
  promotion_id: string;
  original_price: number;
  computed_price: number;
  discount_amount: number;
  percentage_discount: number;
  updated_at?: string;
  variant_sku?: string;
  variant_name?: string;
  product_name?: string;
}

export interface ParseIntentRequest {
  prompt: string;
}

export interface ParseIntentResponse {
  code: string;
  name: string;
  description: string;
  discount_type: DiscountType;
  discount_value: number;
  max_discount: number | null;
  priority: number;
  scopes: PromotionScope[];
  starts_at: string | null;
  ends_at: string | null;
  ai_reasoning: string;
}

export interface PreviewRequest {
  discount_type: DiscountType;
  discount_value: number;
  max_discount?: number | null;
  scopes?: PromotionScope[];
  starts_at?: string | null;
  ends_at?: string | null;
}

export interface PreviewSampleVariant {
  variant_id: string;
  product_id?: string;
  product_name?: string;
  sku_code?: string;
  tier_1_option?: string;
  tier_2_option?: string;
  original_price: number;
  computed_price: number;
  discount_amount: number;
  percentage_discount: number;
}

export interface PreviewResponse {
  affected_variants_count: number;
  total_discount_amount: number;
  sample_variants: PreviewSampleVariant[];
}

export interface PromotionListParams {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PromotionListResponse {
  items: Promotion[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
