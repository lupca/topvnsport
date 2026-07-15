import { APP_SETTINGS } from "@/config/settings";

export class ApiError extends Error {
  status: number;
  info?: any;

  constructor(message: string, status: number, info?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.info = info;
  }
}

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

// fetchWithAuth: acts like native fetch but automatically appends Authorization header and handles 401 redirection.
// It returns the raw Response object so it can be a drop-in replacement for window.fetch in legacy pages.
export async function fetchWithAuth(path: string, options: RequestInit = {}): Promise<Response> {
  const baseUrl = APP_SETTINGS.api.baseUrl;
  let url = path;
  if (!path.startsWith("http")) {
    if (path.startsWith(baseUrl) || path.startsWith("/wms-api")) {
      url = path;
    } else if (path.startsWith("/")) {
      url = `${baseUrl}${path}`;
    } else {
      url = `${baseUrl}/${path}`;
    }
  }

  const headers = new Headers(options.headers || {});
  
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 401) {
      if (typeof window !== "undefined") {
        const { removeAccessToken, redirectToLogin } = await import("@/utils/auth");
        removeAccessToken();
        redirectToLogin();
      }
    }

    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error("API request timed out after 15 seconds");
    }
    throw error;
  }
}

// Helper to handle response errors in modern apiClient usage
async function handleResponse(response: Response): Promise<any> {
  if (!response.ok) {
    let errorInfo: any = null;
    try {
      errorInfo = await response.clone().json();
    } catch {
      try {
        errorInfo = { detail: await response.clone().text() };
      } catch {
        errorInfo = { detail: "Unknown error" };
      }
    }
    
    let message = "API Error";
    if (typeof errorInfo?.detail === "string") {
      message = errorInfo.detail;
    } else if (Array.isArray(errorInfo?.detail)) {
      message = errorInfo.detail.map((err: any) => `${err.loc?.join(".") || ""}: ${err.msg}`).join(", ");
    }
    
    throw new ApiError(message, response.status, errorInfo);
  }

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  
  return response;
}

export const apiClient = {
  get: async <T = any>(path: string, options?: Omit<RequestInit, "method">): Promise<T> => {
    const response = await fetchWithAuth(path, { ...options, method: "GET" });
    return handleResponse(response);
  },
  
  post: async <T = any>(path: string, body?: any, options?: Omit<RequestInit, "method" | "body">): Promise<T> => {
    const init: RequestInit = { ...options, method: "POST" };
    if (body !== undefined) {
      init.body = body instanceof FormData ? body : JSON.stringify(body);
      if (!(body instanceof FormData)) {
        const headers = new Headers(init.headers || {});
        headers.set("Content-Type", "application/json");
        init.headers = headers;
      }
    }
    const response = await fetchWithAuth(path, init);
    return handleResponse(response);
  },
  
  put: async <T = any>(path: string, body?: any, options?: Omit<RequestInit, "method" | "body">): Promise<T> => {
    const init: RequestInit = { ...options, method: "PUT" };
    if (body !== undefined) {
      init.body = body instanceof FormData ? body : JSON.stringify(body);
      if (!(body instanceof FormData)) {
        const headers = new Headers(init.headers || {});
        headers.set("Content-Type", "application/json");
        init.headers = headers;
      }
    }
    const response = await fetchWithAuth(path, init);
    return handleResponse(response);
  },
  
  patch: async <T = any>(path: string, body?: any, options?: Omit<RequestInit, "method" | "body">): Promise<T> => {
    const init: RequestInit = { ...options, method: "PATCH" };
    if (body !== undefined) {
      init.body = body instanceof FormData ? body : JSON.stringify(body);
      if (!(body instanceof FormData)) {
        const headers = new Headers(init.headers || {});
        headers.set("Content-Type", "application/json");
        init.headers = headers;
      }
    }
    const response = await fetchWithAuth(path, init);
    return handleResponse(response);
  },
  
  delete: async <T = any>(path: string, options?: Omit<RequestInit, "method">): Promise<T> => {
    const response = await fetchWithAuth(path, { ...options, method: "DELETE" });
    return handleResponse(response);
  },
};
