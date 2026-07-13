import { renderHook, act } from "@testing-library/react";
import { describe, expect, test, vi, afterEach } from "vitest";
import { useScrollNavigation } from "../useScrollNavigation";

describe("useScrollNavigation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("scrolls to section when scrollToSection is called", () => {
    const scrollIntoViewMock = vi.fn();
    const mockElement = { scrollIntoView: scrollIntoViewMock };
    
    vi.spyOn(document, "getElementById").mockImplementation((id) => {
      if (id === "section-sales") {
        return mockElement as any;
      }
      return null;
    });

    const { result } = renderHook(() => useScrollNavigation());

    act(() => {
      result.current.scrollToSection("sales");
    });

    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
    expect(result.current.activeSection).toBe("sales");
  });

  test("updates activeSection based on scroll position", () => {
    const mockElements: Record<string, any> = {
      "section-basic": { getBoundingClientRect: () => ({ top: 200, bottom: 500 }) },
      "section-specs": { getBoundingClientRect: () => ({ top: -100, bottom: 200 }) },
    };

    vi.spyOn(document, "getElementById").mockImplementation((id) => mockElements[id] || null);

    const { result } = renderHook(() => useScrollNavigation());

    // Initially basic
    expect(result.current.activeSection).toBe("basic");

    // Change bounding rects to make specs active (specs: top <= 150 && bottom > 150)
    mockElements["section-basic"].getBoundingClientRect = () => ({ top: 200, bottom: 500 });
    mockElements["section-specs"].getBoundingClientRect = () => ({ top: 100, bottom: 400 });

    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });

    expect(result.current.activeSection).toBe("specs");
  });
});
