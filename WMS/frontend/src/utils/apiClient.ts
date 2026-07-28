import { APP_SETTINGS } from "@/config/settings";
import { createApiClient, ApiError, fetchWithAuth as baseFetchWithAuth } from "@topvnsport/api-client";

export { ApiError };

// Global fetch interceptor for WMS frontend to secure any legacy/third-party fetch calls
if (typeof window !== "undefined" && !(window as any).__fetch_intercepted__) {
  (window as any).__fetch_intercepted__ = true;
  const originalFetch = window.fetch;
  window.fetch = async function (input, init) {
    const urlStr = typeof input === "string" ? input : (input instanceof URL ? input.toString() : (input as Request).url);
    const baseUrl = APP_SETTINGS.api.baseUrl;
    
    if (urlStr.includes(baseUrl) || urlStr.includes("18102") || urlStr.includes("api-wms.")) {
      const token = localStorage.getItem("access_token");
      if (token) {
        init = init || {};
        const headers = new Headers(init.headers || {});
        if (!headers.has("Authorization")) {
          headers.set("Authorization", `Bearer ${token}`);
          init.headers = headers;
        }
      }
    }
    
    const response = await originalFetch(input, init);
    
    if (response.status === 401) {
      const { removeAccessToken, redirectToLogin } = await import("@/utils/auth");
      removeAccessToken();
      redirectToLogin();
    }
    
    return response;
  };
}

const wmsApiClient = createApiClient({
  baseUrl: APP_SETTINGS.api.baseUrl,
  getToken: () => (typeof window !== "undefined" ? localStorage.getItem("access_token") : null),
  onUnauthorized: async () => {
    if (typeof window !== "undefined") {
      const { removeAccessToken, redirectToLogin } = await import("@/utils/auth");
      removeAccessToken();
      redirectToLogin();
    }
  },
});

export async function fetchWithAuth(path: string, options: RequestInit = {}): Promise<Response> {
  return baseFetchWithAuth(path, options, {
    baseUrl: APP_SETTINGS.api.baseUrl,
    getToken: () => (typeof window !== "undefined" ? localStorage.getItem("access_token") : null),
    onUnauthorized: async () => {
      if (typeof window !== "undefined") {
        const { removeAccessToken, redirectToLogin } = await import("@/utils/auth");
        removeAccessToken();
        redirectToLogin();
      }
    },
  });
}

export const apiClient = {
  get: async <T = any>(path: string, options?: Omit<RequestInit, "method">): Promise<T> => wmsApiClient.get<T>(path, options),
  post: async <T = any>(path: string, body?: any, options?: Omit<RequestInit, "method" | "body">): Promise<T> => wmsApiClient.post<T>(path, body, options),
  put: async <T = any>(path: string, body?: any, options?: Omit<RequestInit, "method" | "body">): Promise<T> => wmsApiClient.put<T>(path, body, options),
  patch: async <T = any>(path: string, body?: any, options?: Omit<RequestInit, "method" | "body">): Promise<T> => wmsApiClient.patch<T>(path, body, options),
  delete: async <T = any>(path: string, options?: Omit<RequestInit, "method">): Promise<T> => wmsApiClient.delete<T>(path, options),
};
