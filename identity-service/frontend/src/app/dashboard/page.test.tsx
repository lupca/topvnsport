import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi, beforeEach } from "vitest";
import DashboardPage from "./page";
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
  usePathname: () => "/dashboard",
}));

vi.mock("@/utils/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

test("fetches and renders dashboard stats correctly", async () => {
  vi.mocked(apiClient.get).mockImplementation((path: string) => {
    if (path === "/staff/") {
      return Promise.resolve([
        { id: 1, is_active: true },
        { id: 2, is_active: false },
        { id: 3, is_active: true },
      ]);
    }
    if (path === "/roles/") {
      return Promise.resolve([
        { id: 1 },
        { id: 2 },
        { id: 3 },
        { id: 4 },
      ]);
    }
    return Promise.reject(new Error("Not found"));
  });

  render(<DashboardPage />);

  await waitFor(() => {
    expect(screen.getByText("3")).toBeInTheDocument(); // total staff
    expect(screen.getByText("2")).toBeInTheDocument(); // active staff
    expect(screen.getByText("4")).toBeInTheDocument(); // total roles
  });


  expect(screen.getByText("Hệ thống PMI")).toBeInTheDocument();
  expect(screen.getByText("Hệ thống OMS")).toBeInTheDocument();
  expect(screen.getByText("Hệ thống WMS")).toBeInTheDocument();
});
