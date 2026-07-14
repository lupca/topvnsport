import { expect, test, vi, beforeEach, afterEach } from "vitest";
import { ApiError, fetchWithAuth } from "./apiClient";

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

test("ApiError class correctly sets message, status, and info", () => {
  const error = new ApiError("Error occurred", 400, { detail: "bad request" });
  expect(error.message).toBe("Error occurred");
  expect(error.status).toBe(400);
  expect(error.info).toEqual({ detail: "bad request" });
  expect(error.name).toBe("ApiError");
});

test("fetchWithAuth appends authorization header if token is present in localStorage", async () => {
  localStorage.setItem("access_token", "dummy-access-token");
  
  const mockFetch = vi.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({ success: true }),
  } as Response);

  const result = await fetchWithAuth("/users");

  expect(mockFetch).toHaveBeenCalledWith(
    expect.stringContaining("/users"),
    expect.objectContaining({
      headers: expect.any(Headers),
    })
  );

  const callArgs = mockFetch.mock.calls[0];
  const passedHeaders = callArgs[1]?.headers as Headers;
  expect(passedHeaders.get("Authorization")).toBe("Bearer dummy-access-token");
  expect(result).toEqual({ success: true });
});

test("fetchWithAuth automatically refreshes token on 401 and retries original request", async () => {
  localStorage.setItem("access_token", "expired-access-token");
  localStorage.setItem("refresh_token", "valid-refresh-token");

  // Mock fetch calls sequentially:
  // 1. First call fails with 401
  // 2. POST /auth/refresh succeeds with new tokens
  // 3. Retried call succeeds with 200
  const mockFetch = vi.spyOn(global, "fetch")
    .mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Headers(),
    } as Response)
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
      }),
    } as Response)
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ success: true }),
    } as Response);

  const result = await fetchWithAuth("/protected-route");

  expect(mockFetch).toHaveBeenCalledTimes(3);

  // Verify first call headers
  const firstCallArgs = mockFetch.mock.calls[0];
  expect(firstCallArgs[0]).toContain("/protected-route");
  const firstHeaders = firstCallArgs[1]?.headers as Headers;
  expect(firstHeaders.get("Authorization")).toBe("Bearer expired-access-token");

  // Verify refresh token call
  const refreshCallArgs = mockFetch.mock.calls[1];
  expect(refreshCallArgs[0]).toContain("/auth/refresh");
  expect(refreshCallArgs[1]?.method).toBe("POST");
  expect(JSON.parse(refreshCallArgs[1]?.body as string)).toEqual({
    refresh_token: "valid-refresh-token",
  });

  // Verify retried call headers
  const retryCallArgs = mockFetch.mock.calls[2];
  expect(retryCallArgs[0]).toContain("/protected-route");
  const retryHeaders = retryCallArgs[1]?.headers as Headers;
  expect(retryHeaders.get("Authorization")).toBe("Bearer new-access-token");

  // Verify token storage was updated
  expect(localStorage.getItem("access_token")).toBe("new-access-token");
  expect(localStorage.getItem("refresh_token")).toBe("new-refresh-token");
  expect(result).toEqual({ success: true });
});

test("fetchWithAuth clears tokens, redirects to login with query param, and throws ApiError when refresh fails", async () => {
  localStorage.setItem("access_token", "expired-access-token");
  localStorage.setItem("refresh_token", "expired-refresh-token");
  localStorage.setItem("user_username", "testuser");
  localStorage.setItem("user_role", "admin");

  // Mock window.location redirect check
  const originalLocation = window.location;
  delete (window as any).location;
  window.location = {
    ...originalLocation,
    pathname: "/dashboard",
    search: "?tab=staff",
    href: "",
  } as any;

  // Mock fetch calls:
  // 1. First call fails with 401
  // 2. POST /auth/refresh fails (e.g. 400 Bad Request)
  const mockFetch = vi.spyOn(global, "fetch")
    .mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Headers(),
    } as Response)
    .mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: new Headers(),
    } as Response);

  await expect(fetchWithAuth("/protected-route")).rejects.toThrow(ApiError);

  // Verify localStorage cleared
  expect(localStorage.getItem("access_token")).toBeNull();
  expect(localStorage.getItem("refresh_token")).toBeNull();
  expect(localStorage.getItem("user_username")).toBeNull();
  expect(localStorage.getItem("user_role")).toBeNull();

  // Verify redirect behavior with query-parameter redirect fallback
  const expectedRedirect = `/login?redirect=${encodeURIComponent("/dashboard?tab=staff")}`;
  expect(window.location.href).toBe(expectedRedirect);

  // Restore window.location
  window.location = originalLocation;
});

test("fetchWithAuth correctly formats FastAPI validation array and error formats", async () => {
  // Scenario 1: FastAPI array validation error
  vi.spyOn(global, "fetch").mockResolvedValueOnce({
    ok: false,
    status: 422,
    headers: new Headers({ "content-type": "application/json" }),
    clone: function() { return this; },
    json: async () => ({
      detail: [
        { loc: ["body", "username"], msg: "Field required" },
        { loc: ["body", "password"], msg: "Minimum length is 8" },
      ],
    }),
  } as unknown as Response);

  const expectedInfo = {
    detail: [
      { loc: ["body", "username"], msg: "Field required" },
      { loc: ["body", "password"], msg: "Minimum length is 8" },
    ],
  };
  await expect(fetchWithAuth("/invalid-data")).rejects.toThrow(
    new ApiError("body.username: Field required, body.password: Minimum length is 8", 422, expectedInfo)
  );

  // Scenario 2: Error with detail as string
  vi.spyOn(global, "fetch").mockResolvedValueOnce({
    ok: false,
    status: 400,
    headers: new Headers({ "content-type": "application/json" }),
    clone: function() { return this; },
    json: async () => ({
      detail: "Tên đăng nhập đã tồn tại",
    }),
  } as unknown as Response);

  await expect(fetchWithAuth("/signup")).rejects.toThrow(
    new ApiError("Tên đăng nhập đã tồn tại", 400)
  );

  // Scenario 3: Error with detail as object
  vi.spyOn(global, "fetch").mockResolvedValueOnce({
    ok: false,
    status: 500,
    headers: new Headers({ "content-type": "application/json" }),
    clone: function() { return this; },
    json: async () => ({
      detail: { error_code: "INTERNAL_SERVER_ERROR", message: "Database down" },
    }),
  } as unknown as Response);

  await expect(fetchWithAuth("/broken-endpoint")).rejects.toThrow(
    new ApiError(JSON.stringify({ error_code: "INTERNAL_SERVER_ERROR", message: "Database down" }), 500)
  );
});
