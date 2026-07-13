import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach } from "vitest";

import Sidebar from "@/components/layout/Sidebar";
import { popupService } from "@/components/ui/popupService";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/catalog",
}));

vi.mock("@/components/ui/popupService", () => ({
  popupService: {
    alert: vi.fn(),
  },
}));

describe("Sidebar Layout Component Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    if (typeof window !== "undefined") {
      localStorage.clear();
    }
  });

  test("1. Admin sees Lịch sử hoạt động when userRole prop is admin", () => {
    render(<Sidebar userRole="admin" />);
    expect(screen.getByText("Lịch sử hoạt động")).toBeInTheDocument();
  });

  test("2. Non-admin does not see Lịch sử hoạt động when userRole prop is staff", () => {
    render(<Sidebar userRole="staff" />);
    expect(screen.queryByText("Lịch sử hoạt động")).not.toBeInTheDocument();
  });

  test("3. Gating reads role from localStorage when userRole prop is not provided", () => {
    localStorage.setItem("user_role", "staff");
    const { unmount } = render(<Sidebar />);
    expect(screen.queryByText("Lịch sử hoạt động")).not.toBeInTheDocument();
    unmount();

    localStorage.setItem("user_role", "admin");
    render(<Sidebar />);
    expect(screen.getByText("Lịch sử hoạt động")).toBeInTheDocument();
  });

  test("4. Gating defaults to empty and hides Lịch sử hoạt động when userRole and localStorage are both empty", () => {
    render(<Sidebar />);
    expect(screen.queryByText("Lịch sử hoạt động")).not.toBeInTheDocument();
  });

  test("5. Clicking on under-development link alerts user", async () => {
    render(<Sidebar />);
    const currencyLink = screen.getByText("Tiền tệ (Currencies)");
    await userEvent.click(currencyLink);
    expect(popupService.alert).toHaveBeenCalledWith(expect.stringContaining('Tính năng "Tiền tệ (Currencies)"'));
  });
});
