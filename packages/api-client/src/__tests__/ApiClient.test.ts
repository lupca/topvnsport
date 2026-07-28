import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { ApiClient, createApiClient } from "../ApiClient";
import { ApiError } from "../ApiError";

describe("ApiClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("injects Bearer token and performs GET request", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ id: 1, name: "Item 1" }),
    });
    globalThis.fetch = mockFetch;

    const client = createApiClient({
      baseUrl: "https://api.example.com",
      getToken: () => "test-token-123",
    });

    const result = await client.get("/items/1");

    expect(result).toEqual({ id: 1, name: "Item 1" });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/items/1",
      expect.objectContaining({
        method: "GET",
        headers: expect.any(Headers),
      })
    );

    const callHeaders: Headers = mockFetch.mock.calls[0][1].headers;
    expect(callHeaders.get("Authorization")).toBe("Bearer test-token-123");
  });

  test("sends JSON body on POST, PUT, PATCH, DELETE requests", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ success: true }),
    });
    globalThis.fetch = mockFetch;

    const client = createApiClient({ baseUrl: "https://api.example.com" });

    await client.post("/items", { name: "New" });
    await client.put("/items/1", { name: "Updated" });
    await client.patch("/items/1", { name: "Patched" });
    await client.delete("/items/1");

    expect(mockFetch).toHaveBeenCalledTimes(4);
    expect(mockFetch.mock.calls[0][1].body).toBe(JSON.stringify({ name: "New" }));
  });

  test("parses FastAPI validation error array into readable message", async () => {
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
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    const client = createApiClient();

    await expect(client.get("/error")).rejects.toThrowError(ApiError);
    try {
      await client.get("/error");
    } catch (err: any) {
      expect(err.status).toBe(422);
      expect(err.message).toBe("body.name: field required, body.price: value is not a valid integer");
    }
  });

  test("returns null on 204 No Content status", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      headers: new Headers(),
    });

    const client = createApiClient();
    const res = await client.delete("/items/1");
    expect(res).toBeNull();
  });

  test("triggers onUnauthorized on 401 response", async () => {
    const onUnauthorized = vi.fn();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers({ "content-type": "application/json" }),
      clone: () => ({
        json: async () => ({ detail: "Unauthorized" }),
      }),
    });

    const client = createApiClient({ onUnauthorized });

    await expect(client.get("/protected")).rejects.toThrow();
    expect(onUnauthorized).toHaveBeenCalled();
  });
});
