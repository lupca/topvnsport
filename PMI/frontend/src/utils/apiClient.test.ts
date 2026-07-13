import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { fetchWithAuth, apiClient, ApiError } from "./apiClient";

describe("apiClient", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.restoreAllMocks();
    
    // Mock window.location
    // @ts-ignore
    delete window.location;
    window.location = {
      ...originalLocation,
      href: "",
    } as any;

    // Clear localStorage mock
    localStorage.clear();
  });

  afterEach(() => {
    window.location = originalLocation;
    localStorage.clear();
  });

  test("GET prepends base URL and passes options", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ data: "success" }),
    };

    const fetchMock = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiClient.get("/test-endpoint");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/pmi-api/test-endpoint"),
      expect.objectContaining({
        method: "GET",
      })
    );
    expect(result).toEqual({ data: "success" });
  });

  test("GET uses absolute URL if path starts with http", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ data: "absolute" }),
    };

    const fetchMock = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiClient.get("https://external-api.com/data");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://external-api.com/data",
      expect.any(Object)
    );
    expect(result).toEqual({ data: "absolute" });
  });

  test("attaches access token header when token is in localStorage", async () => {
    localStorage.setItem("access_token", "dummy-jwt-token");

    const mockResponse = {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ auth: true }),
    };

    const fetchMock = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal("fetch", fetchMock);

    await apiClient.get("/test-auth");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.any(Headers),
      })
    );

    const calledHeaders = fetchMock.mock.calls[0][1].headers as Headers;
    expect(calledHeaders.get("Authorization")).toBe("Bearer dummy-jwt-token");
  });

  test("POST stringifies body and sets Content-Type for JSON payloads", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ created: true }),
    };

    const fetchMock = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal("fetch", fetchMock);

    const payload = { name: "Test Product", price: 100 };
    const result = await apiClient.post("/products", payload);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
    const calledHeaders = fetchMock.mock.calls[0][1].headers as Headers;
    expect(calledHeaders.get("Content-Type")).toBe("application/json");
    expect(result).toEqual({ created: true });
  });

  test("POST with FormData does not override Content-Type", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ uploaded: true }),
    };

    const fetchMock = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal("fetch", fetchMock);

    const formData = new FormData();
    formData.append("file", new Blob(["content"]), "test.jpg");

    await apiClient.post("/upload", formData);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "POST",
        body: formData,
      })
    );
    const calledHeaders = fetchMock.mock.calls[0][1].headers as Headers;
    expect(calledHeaders.get("Content-Type")).toBeNull();
  });

  test("handles 401 unauthorized: clears auth storage and redirects to /login", async () => {
    localStorage.setItem("access_token", "invalid-token");
    localStorage.setItem("user_role", "admin");
    localStorage.setItem("user_username", "john_doe");

    const mockResponse = {
      ok: false,
      status: 401,
    };

    const fetchMock = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiClient.get("/protected")).rejects.toThrow(ApiError);

    expect(localStorage.getItem("access_token")).toBeNull();
    expect(localStorage.getItem("user_role")).toBeNull();
    expect(localStorage.getItem("user_username")).toBeNull();
    expect(window.location.href).toBe("/login");
  });

  test("handles non-ok errors: parses error details from JSON response", async () => {
    const errorBody = { detail: "Tên sản phẩm đã tồn tại" };
    const mockResponse = {
      ok: false,
      status: 400,
      clone: function() { return this; },
      json: () => Promise.resolve(errorBody),
    };

    const fetchMock = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal("fetch", fetchMock);

    try {
      await apiClient.get("/duplicate");
      expect.fail("Should have thrown ApiError");
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(400);
      expect(err.message).toBe("Tên sản phẩm đã tồn tại");
      expect(err.info).toEqual(errorBody);
    }
  });

  test("handles non-ok errors: parses validation error array", async () => {
    const errorBody = {
      detail: [
        { loc: ["body", "price"], msg: "field required", type: "value_error.missing" }
      ]
    };
    const mockResponse = {
      ok: false,
      status: 422,
      clone: function() { return this; },
      json: () => Promise.resolve(errorBody),
    };

    const fetchMock = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal("fetch", fetchMock);

    try {
      await apiClient.get("/validation-fail");
      expect.fail("Should have thrown ApiError");
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.message).toBe("body.price: field required");
    }
  });

  test("handles 204 No Content response properly", async () => {
    const mockResponse = {
      ok: true,
      status: 204,
    };

    const fetchMock = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiClient.delete("/products/1");
    expect(result).toBe(mockResponse);
  });
});
