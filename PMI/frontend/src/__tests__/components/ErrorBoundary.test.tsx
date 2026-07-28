import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ErrorBoundary } from "@/components/ErrorBoundary";

describe("ErrorBoundary", () => {
  afterEach(() => vi.restoreAllMocks());

  test("renders children without an error", () => {
    render(
      <ErrorBoundary>
        <div>Normal content</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText("Normal content")).toBeInTheDocument();
  });

  test("logs errors and allows the failed section to be retried", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const onError = vi.fn();
    let shouldThrow = true;

    function FailingSection() {
      if (shouldThrow) {
        throw new Error("Test error");
      }
      return <div>Recovered content</div>;
    }

    render(
      <ErrorBoundary onError={onError}>
        <FailingSection />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Đã xảy ra lỗi")).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.any(Error), expect.any(Object));

    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));

    expect(screen.getByText("Recovered content")).toBeInTheDocument();
  });

  test("renders a custom fallback", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    function FailingSection() {
      throw new Error("Test error");
    }

    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <FailingSection />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Custom fallback")).toBeInTheDocument();
  });
});
