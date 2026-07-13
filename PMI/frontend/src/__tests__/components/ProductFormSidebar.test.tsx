import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { ProductFormSidebar } from "@/components/products/ProductFormSidebar";

describe("ProductFormSidebar", () => {
  const onSectionClick = vi.fn();
  const defaultProps = {
    activeSection: "basic",
    onSectionClick,
    completionPercent: 42,
    sectionErrors: {
      basic: 0,
      specs: 0,
      sales: 0,
      logistics: 0,
      other: 0,
      channels: 0,
    },
  };

  test("renders all navigation sections and progress bar", () => {
    render(<ProductFormSidebar {...defaultProps} />);

    expect(screen.getByText("Thông tin cơ bản")).toBeInTheDocument();
    expect(screen.getByText("Thuộc tính kỹ thuật")).toBeInTheDocument();
    expect(screen.getByText("Thông tin bán hàng")).toBeInTheDocument();
    expect(screen.getByText("Vận chuyển")).toBeInTheDocument();
    expect(screen.getByText("Thông tin khác")).toBeInTheDocument();
    expect(screen.getByText("Cấu hình đa kênh")).toBeInTheDocument();
    expect(screen.getByText("Hoàn thành")).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
  });

  test("highlights active section button", () => {
    render(<ProductFormSidebar {...defaultProps} activeSection="sales" />);

    const salesButton = screen.getByRole("button", { name: /Thông tin bán hàng/ });
    expect(salesButton).toHaveClass("border-brand-primary");
    expect(salesButton).toHaveClass("bg-blue-50");

    const basicButton = screen.getByRole("button", { name: /Thông tin cơ bản/ });
    expect(basicButton).toHaveClass("border-transparent");
  });

  test("shows error count badge on sections with errors and applies error styles", () => {
    const sectionErrors = {
      basic: 3,
      specs: 0,
      sales: 1,
      logistics: 0,
      other: 0,
      channels: 0,
    };
    render(<ProductFormSidebar {...defaultProps} sectionErrors={sectionErrors} />);

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();

    const basicButton = screen.getByRole("button", { name: /Thông tin cơ bản/ });
    expect(basicButton).toHaveClass("bg-rose-50");
    expect(basicButton).toHaveClass("border-rose-400");
  });

  test("triggers onSectionClick when a section button is clicked", async () => {
    render(<ProductFormSidebar {...defaultProps} />);

    const otherButton = screen.getByRole("button", { name: /Thông tin khác/ });
    await userEvent.click(otherButton);

    expect(onSectionClick).toHaveBeenCalledWith("other");
  });
});
