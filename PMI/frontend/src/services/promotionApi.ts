import { apiClient } from "@/utils/apiClient";
import {
  Promotion,
  PromotionListParams,
  PromotionListResponse,
  ParseIntentRequest,
  ParseIntentResponse,
  PreviewRequest,
  PreviewResponse,
} from "@/types/promotion";

export async function getPromotions(params: PromotionListParams = {}): Promise<PromotionListResponse> {
  const query = new URLSearchParams();
  if (params.status && params.status !== "ALL" && params.status !== "Tất cả") {
    query.set("status", params.status);
  }
  if (params.search) {
    query.set("search", params.search);
  }
  if (params.page) {
    query.set("page", params.page.toString());
  }
  if (params.limit) {
    query.set("limit", params.limit.toString());
  }

  const queryString = query.toString();
  const path = `/api/promotions${queryString ? `?${queryString}` : ""}`;
  return apiClient.get(path);
}

export async function getPromotionById(id: string): Promise<Promotion> {
  return apiClient.get(`/api/promotions/${id}`);
}

export async function createPromotion(data: Partial<Promotion>): Promise<Promotion> {
  return apiClient.post("/api/promotions", data);
}

export async function updatePromotion(id: string, data: Partial<Promotion>): Promise<Promotion> {
  return apiClient.put(`/api/promotions/${id}`, data);
}

export async function deletePromotion(id: string): Promise<{ message?: string; detail?: string }> {
  return apiClient.delete(`/api/promotions/${id}`);
}

export async function activatePromotion(id: string): Promise<Promotion> {
  return apiClient.post(`/api/promotions/${id}/activate`);
}

export async function pausePromotion(id: string): Promise<Promotion> {
  return apiClient.post(`/api/promotions/${id}/pause`);
}

export async function resumePromotion(id: string): Promise<Promotion> {
  return apiClient.post(`/api/promotions/${id}/resume`);
}

export async function endPromotion(id: string): Promise<Promotion> {
  return apiClient.post(`/api/promotions/${id}/end`);
}

export async function parsePromotionIntent(data: ParseIntentRequest): Promise<ParseIntentResponse> {
  return apiClient.post("/api/promotions/parse-intent", data);
}

export async function previewPromotion(data: PreviewRequest): Promise<PreviewResponse> {
  return apiClient.post("/api/promotions/preview", data);
}

export const promotionApi = {
  getPromotions,
  getPromotionById,
  createPromotion,
  updatePromotion,
  deletePromotion,
  activatePromotion,
  pausePromotion,
  resumePromotion,
  endPromotion,
  parsePromotionIntent,
  previewPromotion,
};
