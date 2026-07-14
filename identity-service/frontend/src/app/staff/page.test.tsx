import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi, beforeEach } from "vitest";
import StaffPage from "./page";
import { apiClient } from "@/utils/apiClient";

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => "/staff",
}));

vi.mock("@/utils/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    post: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

test("fetches and renders staff list", async () => {
  vi.mocked(apiClient.get).mockImplementation((path: string) => {
    if (path === "/staff/") {
      return Promise.resolve([
        {
          id: 1,
          username: "alice",
          email: "alice@example.com",
          full_name: "Alice Green",
          role_id: 1,
          role_code: "admin",
          role_name: "Administrator",
          is_active: true,
          created_at: new Date().toISOString(),
          last_login_at: null,
        },
      ]);
    }
    if (path === "/roles/") {
      return Promise.resolve([
        { id: 1, name: "Administrator", code: "admin" },
      ]);
    }
    return Promise.reject(new Error("Not found"));
  });

  render(<StaffPage />);

  // Should show loading text initially
  expect(screen.getByText("Đang tải danh sách nhân sự...")).toBeInTheDocument();

  // Wait for loading to finish and show Alice
  await waitFor(() => {
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("Alice Green")).toBeInTheDocument();
  });
});
