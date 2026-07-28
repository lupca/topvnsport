export interface ApiClientConfig {
  baseUrl?: string;
  timeoutMs?: number;
  getToken?: () => string | null;
  onUnauthorized?: () => void;
}

export type RequestOptions = Omit<RequestInit, "method">;
