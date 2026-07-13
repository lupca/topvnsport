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

export async function fetchWithAuth(path: string, options: RequestInit = {}): Promise<any> {
  const baseUrl = APP_SETTINGS.api.baseUrl;
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;

  const headers = new Headers(options.headers || {});
  
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  // Set default content type if body is present, is not FormData, and header is not already set
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_role");
      localStorage.removeItem("user_username");
      window.location.href = "/login";
    }
    throw new ApiError("Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.", 401);
  }

  if (!response.ok) {
    let errorInfo: any = null;
    try {
      errorInfo = await response.clone().json();
    } catch (e) {
      try {
        errorInfo = { detail: await response.clone().text() };
      } catch (err) {
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

  if (response.status === 204) {
    return response;
  }

  const contentType = response.headers?.get?.("content-type");
  if ((contentType && contentType.includes("application/json")) || (!contentType && typeof response.json === "function")) {
    return response.json();
  }
  
  return response;
}

export const apiClient = {
  get: (path: string, options?: Omit<RequestInit, "method">) => fetchWithAuth(path, { ...options, method: "GET" }),
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
  delete: (path: string, options?: Omit<RequestInit, "method">) => fetchWithAuth(path, { ...options, method: "DELETE" }),
};
