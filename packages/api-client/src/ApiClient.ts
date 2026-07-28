import { ApiClientConfig, RequestOptions } from "./types";
import { ApiError } from "./ApiError";
import { fetchWithAuth } from "./fetchWithAuth";

export class ApiClient {
  private config?: ApiClientConfig;

  constructor(config?: ApiClientConfig) {
    this.config = config;
  }

  public updateConfig(config: Partial<ApiClientConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): ApiClientConfig | undefined {
    return this.config;
  }

  public async handleResponse(response: Response): Promise<any> {
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
        message = errorInfo.detail
          .map((err: any) => `${Array.isArray(err.loc) ? err.loc.join(".") : err.loc || ""}: ${err.msg}`)
          .join(", ");
      } else if (errorInfo?.detail) {
        message = JSON.stringify(errorInfo.detail);
      } else {
        message = `API error: ${response.status} ${response.statusText}`;
      }

      throw new ApiError(message, response.status, errorInfo);
    }

    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers?.get?.("content-type") || "";
    if (contentType.includes("application/json")) {
      return response.json();
    }

    return response;
  }

  public async get<T = any>(path: string, options?: RequestOptions): Promise<T> {
    const response = await fetchWithAuth(path, { ...options, method: "GET" }, this.config);
    return this.handleResponse(response);
  }

  public async post<T = any>(path: string, body?: any, options?: RequestOptions): Promise<T> {
    const init: RequestInit = { ...options, method: "POST" };
    if (body !== undefined) {
      init.body = body instanceof FormData ? body : JSON.stringify(body);
      if (!(body instanceof FormData)) {
        const headers = new Headers(init.headers || {});
        if (!headers.has("Content-Type")) {
          headers.set("Content-Type", "application/json");
        }
        init.headers = headers;
      }
    }
    const response = await fetchWithAuth(path, init, this.config);
    return this.handleResponse(response);
  }

  public async put<T = any>(path: string, body?: any, options?: RequestOptions): Promise<T> {
    const init: RequestInit = { ...options, method: "PUT" };
    if (body !== undefined) {
      init.body = body instanceof FormData ? body : JSON.stringify(body);
      if (!(body instanceof FormData)) {
        const headers = new Headers(init.headers || {});
        if (!headers.has("Content-Type")) {
          headers.set("Content-Type", "application/json");
        }
        init.headers = headers;
      }
    }
    const response = await fetchWithAuth(path, init, this.config);
    return this.handleResponse(response);
  }

  public async patch<T = any>(path: string, body?: any, options?: RequestOptions): Promise<T> {
    const init: RequestInit = { ...options, method: "PATCH" };
    if (body !== undefined) {
      init.body = body instanceof FormData ? body : JSON.stringify(body);
      if (!(body instanceof FormData)) {
        const headers = new Headers(init.headers || {});
        if (!headers.has("Content-Type")) {
          headers.set("Content-Type", "application/json");
        }
        init.headers = headers;
      }
    }
    const response = await fetchWithAuth(path, init, this.config);
    return this.handleResponse(response);
  }

  public async delete<T = any>(path: string, options?: RequestOptions): Promise<T> {
    const response = await fetchWithAuth(path, { ...options, method: "DELETE" }, this.config);
    return this.handleResponse(response);
  }
}

export function createApiClient(config?: ApiClientConfig): ApiClient {
  return new ApiClient(config);
}

export const apiClient = new ApiClient();
