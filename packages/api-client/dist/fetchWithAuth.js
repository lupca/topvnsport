import { ApiError } from "./ApiError";
export async function fetchWithAuth(path, options = {}, config) {
    const baseUrl = config?.baseUrl || "";
    let url = path;
    if (!path.startsWith("http")) {
        if (baseUrl) {
            if (path.startsWith(baseUrl)) {
                url = path;
            }
            else if (path.startsWith("/")) {
                url = `${baseUrl}${path}`;
            }
            else {
                url = `${baseUrl}/${path}`;
            }
        }
    }
    const headers = new Headers(options.headers || {});
    let token = null;
    if (config?.getToken) {
        token = config.getToken();
    }
    else if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
        token = localStorage.getItem("access_token");
    }
    if (token && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
    }
    const timeoutMs = config?.timeoutMs ?? 15000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            ...options,
            headers,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (response.status === 401 && config?.onUnauthorized) {
            await config.onUnauthorized();
        }
        return response;
    }
    catch (error) {
        clearTimeout(timeoutId);
        if (error.name === "AbortError") {
            throw new ApiError(`API request timed out after ${timeoutMs / 1000} seconds`, 408);
        }
        throw error;
    }
}
