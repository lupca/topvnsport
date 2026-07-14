import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { expect, test, vi, beforeEach } from "vitest";
import SettingsPage from "./page";
import { apiClient } from "@/utils/apiClient";

// Mock useRouter, usePathname, and useSearchParams
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => "/settings",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock toast
const mockToast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock apiClient
vi.mock("@/utils/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  // Clear cookies
  document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
});

test("falls back to local mock sessions when API call fails", async () => {
  // Mock API client calls
  vi.mocked(apiClient.get).mockImplementation((path: string) => {
    if (path === "/auth/me") {
      return Promise.resolve({
        id: 1,
        username: "testuser",
        email: "testuser@example.com",
        full_name: "Test User",
        role_code: "ADMIN",
        role_name: "Administrator",
      });
    }
    if (path === "/auth/sessions") {
      return Promise.reject(new Error("Failed to fetch sessions"));
    }
    return Promise.reject(new Error("Not found"));
  });

  render(<SettingsPage />);

  // Should load profile successfully
  await waitFor(() => {
    expect(screen.getByText("testuser")).toBeDefined();
    expect(screen.getByText("testuser@example.com")).toBeDefined();
  });

  // Should fall back to mock sessions silently (Chrome on Windows, Firefox on macOS)
  await waitFor(() => {
    expect(screen.getByText("Chrome")).toBeDefined();
    expect(screen.getByText("Firefox")).toBeDefined();
    expect(screen.getByText("Phiên hiện tại")).toBeDefined();
    expect(screen.getByText("Đang hiển thị danh sách phiên giả lập do không thể kết nối tới API máy chủ.")).toBeDefined();
  });

  expect(mockToast).not.toHaveBeenCalledWith("Failed to fetch sessions", "error");
});

test("revoking a mock session removes it locally", async () => {
  vi.mocked(apiClient.get).mockImplementation((path: string) => {
    if (path === "/auth/me") {
      return Promise.resolve({
        id: 1,
        username: "testuser",
        email: "testuser@example.com",
        full_name: "Test User",
        role_code: "ADMIN",
        role_name: "Administrator",
      });
    }
    if (path === "/auth/sessions") {
      return Promise.reject(new Error("Failed to fetch sessions"));
    }
    return Promise.reject(new Error("Not found"));
  });

  render(<SettingsPage />);

  // Wait for loading to finish
  await waitFor(() => {
    expect(screen.getByText("Chrome")).toBeDefined();
    expect(screen.getByText("Firefox")).toBeDefined();
  });

  // Find Firefox row and click its revoke button
  const firefoxRow = screen.getByText("Firefox").closest("tr");
  expect(firefoxRow).not.toBeNull();
  if (firefoxRow) {
    const revokeBtn = firefoxRow.querySelector("button");
    expect(revokeBtn).not.toBeNull();
    if (revokeBtn) {
      fireEvent.click(revokeBtn);
      
      // Should remove Firefox session from the DOM locally
      await waitFor(() => {
        expect(screen.queryByText("Firefox")).toBeNull();
      });
      
      expect(mockToast).toHaveBeenCalledWith("Đã thu hồi phiên đăng nhập thành công!", "success");
    }
  }
});
