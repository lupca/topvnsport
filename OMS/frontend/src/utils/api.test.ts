import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { api } from "./api";
import { removeAccessToken, redirectToLogin } from "@/utils/auth";

vi.mock("@/utils/auth", () => ({
  removeAccessToken: vi.fn(),
  redirectToLogin: vi.fn(),
  getAccessToken: vi.fn(),
}));

describe("OMS API client", () => {
  const originalLocation = typeof window !== "undefined" ? window.location : null;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    
    if (typeof window !== "undefined") {
      // @ts-ignore
      delete window.location;
      window.location = {
        ...originalLocation,
        href: "",
      } as any;
    }
  });

  afterEach(() => {
    if (typeof window !== "undefined" && originalLocation) {
      window.location = originalLocation;
    }
  });

  test("redirects to login and clears token when API returns 401", async () => {
    const mockResponse = {
      ok: false,
      status: 401,
    };

    const fetchMock = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.get("/protected")).rejects.toThrow("Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.");

    expect(removeAccessToken).toHaveBeenCalled();
    expect(redirectToLogin).toHaveBeenCalled();
  });

  test("removeAccessToken is called before redirectToLogin when API returns 401", async () => {
    const orderOfCalls: string[] = [];
    vi.mocked(removeAccessToken).mockImplementation(() => {
      orderOfCalls.push("removeAccessToken");
    });
    vi.mocked(redirectToLogin).mockImplementation(() => {
      orderOfCalls.push("redirectToLogin");
    });

    const mockResponse = {
      ok: false,
      status: 401,
    };

    const fetchMock = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.get("/protected-order")).rejects.toThrow("Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.");

    expect(removeAccessToken).toHaveBeenCalled();
    expect(redirectToLogin).toHaveBeenCalled();
    expect(orderOfCalls).toEqual(["removeAccessToken", "redirectToLogin"]);
  });

  test("does not redirect when running on server (typeof window === 'undefined')", async () => {
    const originalWindow = global.window;
    try {
      // @ts-ignore
      delete global.window;

      const mockResponse = {
        ok: false,
        status: 401,
      };

      const fetchMock = vi.fn().mockResolvedValue(mockResponse);
      vi.stubGlobal("fetch", fetchMock);

      await expect(api.get("/protected-server")).rejects.toThrow("Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.");

      expect(removeAccessToken).not.toHaveBeenCalled();
      expect(redirectToLogin).not.toHaveBeenCalled();
    } finally {
      global.window = originalWindow;
    }
  });
});
