import { renderHook } from "@testing-library/react";
import { describe, expect, test, vi, afterEach } from "vitest";
import { useFormValidationUX } from "../useFormValidationUX";

describe("useFormValidationUX", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("counts errors per section correctly", () => {
    const errors = {
      name: { message: "Required" },
      product_code: { message: "Required" },
      weight: { message: "Must be > 0" },
    };

    const { result } = renderHook(() => 
      useFormValidationUX({ errors: errors as any, isSubmitted: true })
    );

    const counts = result.current.getSectionErrorCounts();
    expect(counts.basic).toBe(2);
    expect(counts.logistics).toBe(1);
    expect(counts.sales).toBe(0);
  });

  test("scrolls to first error field by name attribute", () => {
    const mockElement = { scrollIntoView: vi.fn(), focus: vi.fn() };
    vi.spyOn(document, "querySelector").mockReturnValue(mockElement as any);

    const errors = { name: { message: "Required" } };
    const { result } = renderHook(() => 
      useFormValidationUX({ errors: errors as any, isSubmitted: true })
    );

    result.current.scrollToFirstError();

    expect(mockElement.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
    expect(mockElement.focus).toHaveBeenCalled();
  });

  test("returns max 5 errors in summary", () => {
    const errors = {
      name: { message: "Error 1" },
      product_code: { message: "Error 2" },
      category_id: { message: "Error 3" },
      family_id: { message: "Error 4" },
      description: { message: "Error 5" },
      weight: { message: "Error 6" },
    };

    const { result } = renderHook(() => 
      useFormValidationUX({ errors: errors as any, isSubmitted: true })
    );

    expect(result.current.getErrorSummary()).toHaveLength(5);
    expect(result.current.getErrorSummary()).toEqual([
      "Error 1",
      "Error 2",
      "Error 3",
      "Error 4",
      "Error 5",
    ]);
  });
});
