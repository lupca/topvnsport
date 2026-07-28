"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const ApiClient_1 = require("../ApiClient");
const ApiError_1 = require("../ApiError");
(0, vitest_1.describe)("ApiClient", () => {
    const originalFetch = globalThis.fetch;
    (0, vitest_1.afterEach)(() => {
        globalThis.fetch = originalFetch;
    });
    (0, vitest_1.test)("injects Bearer token and performs GET request", async () => {
        const mockFetch = vitest_1.vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Headers({ "content-type": "application/json" }),
            json: async () => ({ id: 1, name: "Item 1" }),
        });
        globalThis.fetch = mockFetch;
        const client = (0, ApiClient_1.createApiClient)({
            baseUrl: "https://api.example.com",
            getToken: () => "test-token-123",
        });
        const result = await client.get("/items/1");
        (0, vitest_1.expect)(result).toEqual({ id: 1, name: "Item 1" });
        (0, vitest_1.expect)(mockFetch).toHaveBeenCalledWith("https://api.example.com/items/1", vitest_1.expect.objectContaining({
            method: "GET",
            headers: vitest_1.expect.any(Headers),
        }));
        const callHeaders = mockFetch.mock.calls[0][1].headers;
        (0, vitest_1.expect)(callHeaders.get("Authorization")).toBe("Bearer test-token-123");
    });
    (0, vitest_1.test)("sends JSON body on POST, PUT, PATCH, DELETE requests", async () => {
        const mockFetch = vitest_1.vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Headers({ "content-type": "application/json" }),
            json: async () => ({ success: true }),
        });
        globalThis.fetch = mockFetch;
        const client = (0, ApiClient_1.createApiClient)({ baseUrl: "https://api.example.com" });
        await client.post("/items", { name: "New" });
        await client.put("/items/1", { name: "Updated" });
        await client.patch("/items/1", { name: "Patched" });
        await client.delete("/items/1");
        (0, vitest_1.expect)(mockFetch).toHaveBeenCalledTimes(4);
        (0, vitest_1.expect)(mockFetch.mock.calls[0][1].body).toBe(JSON.stringify({ name: "New" }));
    });
    (0, vitest_1.test)("parses FastAPI validation error array into readable message", async () => {
        const mockResponse = {
            ok: false,
            status: 422,
            headers: new Headers({ "content-type": "application/json" }),
            clone: () => mockResponse,
            json: async () => ({
                detail: [
                    { loc: ["body", "name"], msg: "field required" },
                    { loc: ["body", "price"], msg: "value is not a valid integer" },
                ],
            }),
        };
        globalThis.fetch = vitest_1.vi.fn().mockResolvedValue(mockResponse);
        const client = (0, ApiClient_1.createApiClient)();
        await (0, vitest_1.expect)(client.get("/error")).rejects.toThrowError(ApiError_1.ApiError);
        try {
            await client.get("/error");
        }
        catch (err) {
            (0, vitest_1.expect)(err.status).toBe(422);
            (0, vitest_1.expect)(err.message).toBe("body.name: field required, body.price: value is not a valid integer");
        }
    });
    (0, vitest_1.test)("returns null on 204 No Content status", async () => {
        globalThis.fetch = vitest_1.vi.fn().mockResolvedValue({
            ok: true,
            status: 204,
            headers: new Headers(),
        });
        const client = (0, ApiClient_1.createApiClient)();
        const res = await client.delete("/items/1");
        (0, vitest_1.expect)(res).toBeNull();
    });
    (0, vitest_1.test)("triggers onUnauthorized on 401 response", async () => {
        const onUnauthorized = vitest_1.vi.fn();
        globalThis.fetch = vitest_1.vi.fn().mockResolvedValue({
            ok: false,
            status: 401,
            headers: new Headers({ "content-type": "application/json" }),
            clone: () => ({
                json: async () => ({ detail: "Unauthorized" }),
            }),
        });
        const client = (0, ApiClient_1.createApiClient)({ onUnauthorized });
        await (0, vitest_1.expect)(client.get("/protected")).rejects.toThrow();
        (0, vitest_1.expect)(onUnauthorized).toHaveBeenCalled();
    });
});
