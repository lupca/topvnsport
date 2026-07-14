import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { expect, test, vi, beforeEach, afterEach, describe } from "vitest";
import LoginPage from "./page";
import { apiClient } from "@/utils/apiClient";

// Mock router and searchParams
const mockPush = vi.fn();
const mockGet = vi.fn().mockReturnValue(null);
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => ({
    get: mockGet,
  }),
}));

// Mock apiClient
vi.mock("@/utils/apiClient", () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

describe("LoginPage and LoginContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Clear cookies
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    // Mock window.location
    vi.stubGlobal("location", { href: "" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("renders login form with username, password fields and submit button", () => {
    render(<LoginPage />);

    expect(screen.getByLabelText(/Tên đăng nhập/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Mật khẩu/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /đăng nhập/i })).toBeInTheDocument();
  });

  test("displays validation errors in Vietnamese when fields are empty", async () => {
    render(<LoginPage />);

    const form = screen.getByRole("button", { name: /đăng nhập/i }).closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText("Vui lòng nhập tên đăng nhập")).toBeInTheDocument();
      expect(screen.getByText("Vui lòng nhập mật khẩu")).toBeInTheDocument();
    });
  });

  test("successful login flow: stores tokens in localStorage and cookies, fetches profile, and routes to dashboard", async () => {
    // Mock API responses
    vi.mocked(apiClient.post).mockResolvedValue({
      access_token: "mock_access_token",
      refresh_token: "mock_refresh_token",
      expires_in: 3600,
    });
    vi.mocked(apiClient.get).mockResolvedValue({
      username: "testuser",
      role_code: "admin",
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/Tên đăng nhập/i), { target: { value: "testuser" } });
    fireEvent.change(screen.getByLabelText(/Mật khẩu/i), { target: { value: "password123" } });

    const form = screen.getByRole("button", { name: /đăng nhập/i }).closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith("/auth/login", {
        username: "testuser",
        password: "password123",
      });
      expect(apiClient.get).toHaveBeenCalledWith("/auth/me");
    });

    await waitFor(() => {
      expect(localStorage.getItem("access_token")).toBe("mock_access_token");
      expect(localStorage.getItem("refresh_token")).toBe("mock_refresh_token");
      expect(localStorage.getItem("user_username")).toBe("testuser");
      expect(localStorage.getItem("user_role")).toBe("admin");
      expect(document.cookie).toContain("access_token=mock_access_token");
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  test("successful login flow with redirect: sets window.location.href to safe URL", async () => {
    mockGet.mockReturnValue("/roles");
    vi.mocked(apiClient.post).mockResolvedValue({
      access_token: "mock_access_token",
      refresh_token: "mock_refresh_token",
      expires_in: 3600,
    });
    vi.mocked(apiClient.get).mockResolvedValue({
      username: "testuser",
      role_code: "admin",
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/Tên đăng nhập/i), { target: { value: "testuser" } });
    fireEvent.change(screen.getByLabelText(/Mật khẩu/i), { target: { value: "password123" } });

    const form = screen.getByRole("button", { name: /đăng nhập/i }).closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(window.location.href).toBe("/roles");
    });
  });

  test("displays error message on failed login", async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error("Tài khoản hoặc mật khẩu không chính xác"));

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/Tên đăng nhập/i), { target: { value: "wronguser" } });
    fireEvent.change(screen.getByLabelText(/Mật khẩu/i), { target: { value: "wrongpass" } });

    const form = screen.getByRole("button", { name: /đăng nhập/i }).closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText("Tài khoản hoặc mật khẩu không chính xác")).toBeInTheDocument();
    });
  });

  test("displays loading state (spinner and disabled button) while login is in progress", async () => {
    let resolveLogin: (value: any) => void = () => {};
    const loginPromise = new Promise((resolve) => {
      resolveLogin = resolve;
    });

    vi.mocked(apiClient.post).mockReturnValue(loginPromise);
    vi.mocked(apiClient.get).mockResolvedValue({
      username: "testuser",
      role_code: "admin",
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/Tên đăng nhập/i), { target: { value: "testuser" } });
    fireEvent.change(screen.getByLabelText(/Mật khẩu/i), { target: { value: "password123" } });

    const submitButton = screen.getByRole("button", { name: /đăng nhập/i });
    const form = submitButton.closest("form")!;
    fireEvent.submit(form);

    // Wait for the loading state (API call is pending) to be activated
    await waitFor(() => {
      expect(submitButton).toBeDisabled();
      expect(submitButton.querySelector(".animate-spin")).toBeInTheDocument();
    });

    // Resolve the API call to complete the login sequence
    await act(async () => {
      resolveLogin({
        access_token: "mock_access_token",
        refresh_token: "mock_refresh_token",
        expires_in: 3600,
      });
    });

    // Verify loading state is reset
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
      expect(submitButton.querySelector(".animate-spin")).not.toBeInTheDocument();
    });
  });
});
