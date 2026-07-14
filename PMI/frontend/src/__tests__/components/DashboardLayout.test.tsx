import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import DashboardLayout from "@/components/layout/DashboardLayout";

// Mock next/navigation
const mockUsePathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

// Mock layout subcomponents using path relative to test file location
vi.mock("../../components/layout/Sidebar", () => ({
  default: () => <div data-testid="sidebar">Sidebar Mock</div>,
}));
vi.mock("../../components/layout/Topbar", () => ({
  default: () => <div data-testid="topbar">Topbar Mock</div>,
}));
vi.mock("../../components/layout/MobileNav", () => ({
  default: () => <div data-testid="mobile-nav">MobileNav Mock</div>,
}));

describe("DashboardLayout", () => {
  test("renders desktop layout when path is not mobile", () => {
    mockUsePathname.mockReturnValue("/dashboard");

    render(
      <DashboardLayout>
        <div data-testid="content">Dashboard Content</div>
      </DashboardLayout>
    );

    // Should render sidebar and topbar
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("topbar")).toBeInTheDocument();
    expect(screen.queryByTestId("mobile-nav")).not.toBeInTheDocument();
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  test("renders mobile layout when path starts with /m", () => {
    mockUsePathname.mockReturnValue("/m/dashboard");

    render(
      <DashboardLayout>
        <div data-testid="content">Dashboard Content</div>
      </DashboardLayout>
    );

    // Should render mobile nav, but not sidebar or topbar
    expect(screen.getByTestId("mobile-nav")).toBeInTheDocument();
    expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("topbar")).not.toBeInTheDocument();
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  test("does not contain any auth check or redirect logic", () => {
    mockUsePathname.mockReturnValue("/dashboard");
    const { container } = render(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    );
    expect(container.innerHTML).not.toContain("redirect");
    expect(container.innerHTML).not.toContain("login");
  });
});
