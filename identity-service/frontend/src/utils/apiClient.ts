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

export async function refreshToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  
  const refresh = localStorage.getItem("refresh_token");
  if (!refresh) return null;

  try {
    const response = await fetch(`${APP_SETTINGS.api.baseUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    return data.access_token;
  } catch {
    return null;
  }
}

export async function fetchWithAuth(path: string, options: RequestInit = {}): Promise<any> {
  const baseUrl = APP_SETTINGS.api.baseUrl;
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;

  const headers = new Headers(options.headers || {});
  
  let token: string | null = null;
  if (typeof window !== "undefined") {
    token = localStorage.getItem("access_token");
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response = await fetch(url, { ...options, headers });

  // Try refresh on 401
  if (response.status === 401 && token) {
    const newToken = await refreshToken();
    if (newToken) {
      const retryHeaders = new Headers(headers);
      retryHeaders.set("Authorization", `Bearer ${newToken}`);
      response = await fetch(url, { ...options, headers: retryHeaders });
    }
  }

  if (response.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user_role");
      localStorage.removeItem("user_username");
      
      // Support query parameters for redirecting back
      const currentUrl = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login?redirect=${currentUrl}`;
    }
    throw new ApiError("Phiên làm việc đã hết hạn", 401);
  }

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
    } else if (errorInfo?.detail) {
      message = JSON.stringify(errorInfo.detail);
    } else {
      message = `API error: ${response.status} ${response.statusText}`;
    }
    
    throw new ApiError(message, response.status, errorInfo);
  }

  if (response.status === 204) return null;

  const contentType = response.headers?.get?.("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response;
}

export const apiClient = {
  get: (path: string, options?: Omit<RequestInit, "method">) => 
    fetchWithAuth(path, { ...options, method: "GET" }),
  post: (path: string, body?: any, options?: Omit<RequestInit, "method" | "body">) => 
    fetchWithAuth(path, { 
      ...options, 
      method: "POST", 
      body: body instanceof FormData ? body : JSON.stringify(body) 
    }),
  put: (path: string, body?: any, options?: Omit<RequestInit, "method" | "body">) => 
    fetchWithAuth(path, { 
      ...options, 
      method: "PUT", 
      body: body instanceof FormData ? body : JSON.stringify(body) 
    }),
  delete: (path: string, options?: Omit<RequestInit, "method">) => 
    fetchWithAuth(path, { ...options, method: "DELETE" }),
};
