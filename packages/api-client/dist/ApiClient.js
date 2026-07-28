import { ApiError } from "./ApiError";
import { fetchWithAuth } from "./fetchWithAuth";
export class ApiClient {
    constructor(config) {
        this.config = config;
    }
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
    getConfig() {
        return this.config;
    }
    async handleResponse(response) {
        if (!response.ok) {
            let errorInfo = null;
            try {
                errorInfo = await response.clone().json();
            }
            catch {
                try {
                    errorInfo = { detail: await response.clone().text() };
                }
                catch {
                    errorInfo = { detail: "Unknown error" };
                }
            }
            let message = "API Error";
            if (typeof errorInfo?.detail === "string") {
                message = errorInfo.detail;
            }
            else if (Array.isArray(errorInfo?.detail)) {
                message = errorInfo.detail
                    .map((err) => `${Array.isArray(err.loc) ? err.loc.join(".") : err.loc || ""}: ${err.msg}`)
                    .join(", ");
            }
            else if (errorInfo?.detail) {
                message = JSON.stringify(errorInfo.detail);
            }
            else {
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
    async get(path, options) {
        const response = await fetchWithAuth(path, { ...options, method: "GET" }, this.config);
        return this.handleResponse(response);
    }
    async post(path, body, options) {
        const init = { ...options, method: "POST" };
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
    async put(path, body, options) {
        const init = { ...options, method: "PUT" };
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
    async patch(path, body, options) {
        const init = { ...options, method: "PATCH" };
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
    async delete(path, options) {
        const response = await fetchWithAuth(path, { ...options, method: "DELETE" }, this.config);
        return this.handleResponse(response);
    }
}
export function createApiClient(config) {
    return new ApiClient(config);
}
export const apiClient = new ApiClient();
