import { APP_SETTINGS } from "@/config/settings";
import { createApiClient, ApiError, fetchWithAuth as baseFetchWithAuth } from "@voma/api-client";

export { ApiError };

const pmiApiClient = createApiClient({
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

export async function fetchWithAuth(path: string, options: RequestInit = {}): Promise<any> {
  const response = await baseFetchWithAuth(path, options, {
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

  if (response.status === 401) {
    throw new ApiError("Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.", 401);
  }

  return pmiApiClient.handleResponse(response);
}

export const apiClient = {
  get: (path: string, options?: Omit<RequestInit, "method">) => pmiApiClient.get(path, options),
  post: (path: string, body?: any, options?: Omit<RequestInit, "method" | "body">) => pmiApiClient.post(path, body, options),
  put: (path: string, body?: any, options?: Omit<RequestInit, "method" | "body">) => pmiApiClient.put(path, body, options),
  delete: (path: string, options?: Omit<RequestInit, "method">) => pmiApiClient.delete(path, options),
};
