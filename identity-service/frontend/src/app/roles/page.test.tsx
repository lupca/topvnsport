import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi, beforeEach } from "vitest";
import RolesPage from "./page";
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
  usePathname: () => "/roles",
}));

vi.mock("@/utils/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

test("fetches and renders roles list", async () => {
  vi.mocked(apiClient.get).mockImplementation((path: string) => {
    if (path === "/roles/") {
      return Promise.resolve([
        {
          id: 1,
          code: "admin",
          name: "Administrator",
          description: "Full power",
          permissions: ["identity:*"],
          created_at: new Date().toISOString(),
        },
      ]);
    }
    if (path === "/staff/") {
      return Promise.resolve([
        { id: 1, role_id: 1 },
      ]);
    }
    return Promise.reject(new Error("Not found"));
  });

  render(<RolesPage />);

  // Should show loading text initially
  expect(screen.getByText("Đang tải danh sách vai trò...")).toBeInTheDocument();

  // Wait for loading to finish
  await waitFor(() => {
    expect(screen.getByText("Administrator")).toBeInTheDocument();
    expect(screen.getByText("Full power")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument(); // staff count
  });
});
