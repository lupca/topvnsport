import { ApiClientConfig, RequestOptions } from "./types";
export declare class ApiClient {
    private config?;
    constructor(config?: ApiClientConfig);
    updateConfig(config: Partial<ApiClientConfig>): void;
    getConfig(): ApiClientConfig | undefined;
    handleResponse(response: Response): Promise<any>;
    get<T = any>(path: string, options?: RequestOptions): Promise<T>;
    post<T = any>(path: string, body?: any, options?: RequestOptions): Promise<T>;
    put<T = any>(path: string, body?: any, options?: RequestOptions): Promise<T>;
    patch<T = any>(path: string, body?: any, options?: RequestOptions): Promise<T>;
    delete<T = any>(path: string, options?: RequestOptions): Promise<T>;
}
export declare function createApiClient(config?: ApiClientConfig): ApiClient;
export declare const apiClient: ApiClient;
