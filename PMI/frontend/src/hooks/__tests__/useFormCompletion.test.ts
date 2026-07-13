import { describe, expect, test, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFormCompletion } from "../useFormCompletion";

describe("useFormCompletion", () => {
  test("returns 0 for empty form", () => {
    const watch = vi.fn().mockImplementation((field: string) => {
      const mockValues: any = {
        name: "",
        product_code: "",
        category_id: 0,
        family_id: 0,
        description: "",
        weight: 0,
        variants: [],
      };
      return mockValues[field];
    });

    const { result } = renderHook(() =>
      useFormCompletion({
        watch,
        coverImage: null,
        productImages: [],
      })
    );

    expect(result.current).toBe(0);
  });

  test("calculates partial completion percentage", () => {
    const watch = vi.fn().mockImplementation((field: string) => {
      const mockValues: any = {
        name: "Áo thun nam", // valid (10%)
        product_code: "TS-01", // valid (10%)
        category_id: 1, // valid (10%)
        family_id: 0,
        description: "",
        weight: 0,
        variants: [],
      };
      return mockValues[field];
    });

    const { result } = renderHook(() =>
      useFormCompletion({
        watch,
        coverImage: "http://image.jpg", // valid (10%)
        productImages: [],
      })
    );

    // 4 checks pass out of 10 checks: 40%
    expect(result.current).toBe(40);
  });

  test("returns 100 for completely filled form", () => {
    const watch = vi.fn().mockImplementation((field: string) => {
      const mockValues: any = {
        name: "Áo thun nam thể thao",
        product_code: "TS-01",
        category_id: 1,
        family_id: 2,
        description: "Mô tả sản phẩm áo thun nam thể thao cao cấp.",
        weight: 200,
        variants: [
          { price: 150000, stock: 10 },
          { price: 160000, stock: 12 },
        ],
      };
      return mockValues[field];
    });

    const { result } = renderHook(() =>
      useFormCompletion({
        watch,
        coverImage: "http://image.jpg",
        productImages: ["http://image2.jpg"],
      })
    );

    expect(result.current).toBe(100);
  });
});
