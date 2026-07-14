import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach } from "vitest";

import LoginPage from "@/app/login/page";

const mockPush = vi.fn();

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("LoginPage UI Component Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    mockPush.mockClear();
    
    // Clear localStorage
    if (typeof window !== "undefined") {
      localStorage.clear();
    }
  });

  test("1. Renders login page elements properly", () => {
    render(<LoginPage />);
    expect(screen.getByText("Đăng nhập hệ thống PIM")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Tên đăng nhập")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Mật khẩu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đăng nhập" })).toBeInTheDocument();
  });

  test("2. Successful login flow", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/auth/login")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ access_token: "test-token-123" }),
          });
        }
        if (url.includes("/api/auth/me")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                user: {
                  role: "admin",
                  username: "admin_test",
                },
              }),
          });
        }
        return Promise.reject(new Error("Unknown URL: " + url));
      })
    );

    render(<LoginPage />);

    const usernameInput = screen.getByPlaceholderText("Tên đăng nhập");
    const passwordInput = screen.getByPlaceholderText("Mật khẩu");
    const submitButton = screen.getByRole("button", { name: "Đăng nhập" });

    await userEvent.type(usernameInput, "admin");
    await userEvent.type(passwordInput, "password123");
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(localStorage.getItem("access_token")).toBe("test-token-123");
      expect(localStorage.getItem("user_role")).toBe("admin");
      expect(localStorage.getItem("user_username")).toBe("admin_test");
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  test("3. Failed login flow (bad credentials)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/auth/login")) {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ detail: "Sai tên đăng nhập hoặc mật khẩu" }),
          });
        }
        return Promise.reject(new Error("Unknown URL: " + url));
      })
    );

    render(<LoginPage />);

    const usernameInput = screen.getByPlaceholderText("Tên đăng nhập");
    const passwordInput = screen.getByPlaceholderText("Mật khẩu");
    const submitButton = screen.getByRole("button", { name: "Đăng nhập" });

    await userEvent.type(usernameInput, "wronguser");
    await userEvent.type(passwordInput, "wrongpass");
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Sai tên đăng nhập hoặc mật khẩu")).toBeInTheDocument();
      expect(localStorage.getItem("access_token")).toBeNull();
    });
  });

  test("4. Profile fetch failure flow after successful login token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/auth/login")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ access_token: "test-token-456" }),
          });
        }
        if (url.includes("/api/auth/me")) {
          return Promise.resolve({
            ok: false,
          });
        }
        return Promise.reject(new Error("Unknown URL: " + url));
      })
    );

    render(<LoginPage />);

    const usernameInput = screen.getByPlaceholderText("Tên đăng nhập");
    const passwordInput = screen.getByPlaceholderText("Mật khẩu");
    const submitButton = screen.getByRole("button", { name: "Đăng nhập" });

    await userEvent.type(usernameInput, "admin");
    await userEvent.type(passwordInput, "password123");
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Không thể tải thông tin cá nhân sau khi đăng nhập.")).toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  test("5. Fallback in user profile resolution (actor_type)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/auth/login")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ access_token: "test-token-789" }),
          });
        }
        if (url.includes("/api/auth/me")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                actor_type: "SERVICE",
                actor_username: "service_user",
              }),
          });
        }
        return Promise.reject(new Error("Unknown URL: " + url));
      })
    );

    render(<LoginPage />);

    const usernameInput = screen.getByPlaceholderText("Tên đăng nhập");
    const passwordInput = screen.getByPlaceholderText("Mật khẩu");
    const submitButton = screen.getByRole("button", { name: "Đăng nhập" });

    await userEvent.type(usernameInput, "service_client");
    await userEvent.type(passwordInput, "service_pass");
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(localStorage.getItem("access_token")).toBe("test-token-789");
      expect(localStorage.getItem("user_role")).toBe("SERVICE");
      expect(localStorage.getItem("user_username")).toBe("service_user");
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });
});
