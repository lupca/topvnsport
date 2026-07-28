import { api } from "@/utils/api";

export interface SepayConfig {
  sepay_merchant_id: string;
  sepay_secret_key: string;
  sepay_checkout_url: string;
  web_base_url: string;
}

export interface SepayTestResult {
  success: boolean;
  message: string;
}

export const getSepayConfig = async (): Promise<SepayConfig> => {
  return await api.get<SepayConfig>("/api/config/sepay");
};

export const updateSepayConfig = async (
  config: Partial<SepayConfig>,
): Promise<SepayConfig> => {
  return await api.put<SepayConfig>("/api/config/sepay", config);
};

export const testSepayConnection = async (): Promise<SepayTestResult> => {
  return await api.post<SepayTestResult>("/api/config/sepay/test", {});
};
