import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { normalizeImageUrl } from "./imageUrl";

describe("normalizeImageUrl", () => {
  const originalWindow = global.window;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.window = originalWindow;
  });

  test("returns undefined if imageUrl is falsy", () => {
    expect(normalizeImageUrl()).toBeUndefined();
    expect(normalizeImageUrl(null)).toBeUndefined();
    expect(normalizeImageUrl("")).toBeUndefined();
  });

  test("returns original URL when window is undefined", () => {
    // Temporarily mock window as undefined
    // @ts-ignore
    delete global.window;
    
    expect(normalizeImageUrl("http://pim-minio:9000/bucket/image.png")).toBe("http://pim-minio:9000/bucket/image.png");
    
    // Restore window
    global.window = originalWindow;
  });

  test("rewrites internal Docker media host URLs correctly", () => {
    // Setup window location mock
    vi.spyOn(window, "location", "get").mockReturnValue({
      protocol: "http:",
      hostname: "localhost",
    } as Location);

    const testCases = [
      { input: "http://pim-minio:9000/bucket/img.jpg", expected: "http://localhost:19005/bucket/img.jpg" },
      { input: "http://minio:9000/test/a.png?q=1#hash", expected: "http://localhost:19005/test/a.png?q=1#hash" },
      { input: "http://api:9000/bucket/img.jpg", expected: "http://localhost:19005/bucket/img.jpg" },
      { input: "http://db:9000/bucket/img.jpg", expected: "http://localhost:19005/bucket/img.jpg" }
    ];

    for (const tc of testCases) {
      expect(normalizeImageUrl(tc.input)).toBe(tc.expected);
    }
  });

  test("does not rewrite URLs with non-internal hostnames", () => {
    expect(normalizeImageUrl("http://example.com:9000/bucket/img.jpg")).toBe("http://example.com:9000/bucket/img.jpg");
    expect(normalizeImageUrl("https://images.unsplash.com/photo-123")).toBe("https://images.unsplash.com/photo-123");
  });

  test("does not rewrite internal hostnames if port is not 9000", () => {
    expect(normalizeImageUrl("http://pim-minio:8080/bucket/img.jpg")).toBe("http://pim-minio:8080/bucket/img.jpg");
  });

  test("returns original string if URL parsing throws an error", () => {
    expect(normalizeImageUrl("/relative/path/image.png")).toBe("/relative/path/image.png");
    expect(normalizeImageUrl("not-a-url")).toBe("not-a-url");
  });
});
