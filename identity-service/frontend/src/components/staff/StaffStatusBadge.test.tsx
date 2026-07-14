import React from "react";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import StaffStatusBadge from "./StaffStatusBadge";

test("renders active status correctly", () => {
  render(<StaffStatusBadge isActive={true} />);
  expect(screen.getByText("Hoạt động")).toBeInTheDocument();
  expect(screen.getByText("Hoạt động")).toHaveClass("bg-green-100");
});

test("renders inactive status correctly", () => {
  render(<StaffStatusBadge isActive={false} />);
  expect(screen.getByText("Tạm khóa")).toBeInTheDocument();
  expect(screen.getByText("Tạm khóa")).toHaveClass("bg-red-100");
});
