import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ErrorSummary } from "@/components/products/ErrorSummary";

describe("ErrorSummary", () => {
  test("renders error messages correctly", () => {
    render(<ErrorSummary errors={["Lỗi 1", "Lỗi 2"]} totalCount={2} />);

    expect(screen.getByText("Có 2 lỗi cần sửa")).toBeInTheDocument();
    expect(screen.getByText("Lỗi 1")).toBeInTheDocument();
    expect(screen.getByText("Lỗi 2")).toBeInTheDocument();
  });

  test("shows 'and X other errors' when totalCount > errors.length", () => {
    render(<ErrorSummary errors={["Lỗi 1"]} totalCount={5} />);

    expect(screen.getByText("Có 5 lỗi cần sửa")).toBeInTheDocument();
    expect(screen.getByText("Lỗi 1")).toBeInTheDocument();
    expect(screen.getByText(/...và 4 lỗi khác/)).toBeInTheDocument();
  });

  test("renders nothing when errors array is empty", () => {
    const { container } = render(<ErrorSummary errors={[]} totalCount={0} />);

    expect(container.firstChild).toBeNull();
  });
});
