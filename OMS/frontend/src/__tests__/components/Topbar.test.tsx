import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import Topbar from "@/components/layout/Topbar";
import { logout } from "@/utils/auth";

vi.mock("@/utils/auth", () => ({
  logout: vi.fn(),
}));

describe("Topbar", () => {
  test("renders logout button and user info correctly", () => {
    render(<Topbar />);

    // Check user info
    expect(screen.getByText("Administrator")).toBeInTheDocument();
    expect(screen.getByText("OMS Owner")).toBeInTheDocument();

    // Check logout button
    const logoutBtn = screen.getByRole("button", { name: /đăng xuất/i });
    expect(logoutBtn).toBeInTheDocument();
  });

  test("calls logout() when logout button is clicked", () => {
    render(<Topbar />);

    const logoutBtn = screen.getByRole("button", { name: /đăng xuất/i });
    fireEvent.click(logoutBtn);

    expect(logout).toHaveBeenCalledTimes(1);
  });
});
