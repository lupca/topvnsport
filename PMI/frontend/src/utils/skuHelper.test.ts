import { describe, expect, test } from "vitest";
import { cleanOptionForSku, generateSkuCode } from "./skuHelper";

describe("skuHelper", () => {
  describe("cleanOptionForSku", () => {
    test("returns empty string for empty input", () => {
      expect(cleanOptionForSku("")).toBe("");
      expect(cleanOptionForSku(null as any)).toBe("");
      expect(cleanOptionForSku(undefined as any)).toBe("");
    });

    test("replaces Vietnamese character d/D variants correctly", () => {
      expect(cleanOptionForSku("đ")).toBe("D");
      expect(cleanOptionForSku("Đ")).toBe("D");
      expect(cleanOptionForSku("Điện thoại")).toBe("DIEN-THOAI");
    });

    test("strips accents correctly", () => {
      expect(cleanOptionForSku("áo thun")).toBe("AO-THUN");
      expect(cleanOptionForSku("màu đỏ")).toBe("MAU-DO");
      expect(cleanOptionForSku("xanh lá")).toBe("XANH-LA");
    });

    test("replaces non-alphanumeric characters with hyphens", () => {
      expect(cleanOptionForSku("size xl/xxl")).toBe("SIZE-XL-XXL");
      expect(cleanOptionForSku("màu sắc & kiểu dáng")).toBe("MAU-SAC-KIEU-DANG");
    });

    test("strips leading and trailing hyphens", () => {
      expect(cleanOptionForSku("---đỏ---")).toBe("DO");
      expect(cleanOptionForSku("  đỏ  ")).toBe("DO");
    });
  });

  describe("generateSkuCode", () => {
    test("handles product code only and appends DEFAULT", () => {
      expect(generateSkuCode("TSHIRT")).toBe("TSHIRT-DEFAULT");
    });

    test("returns empty string when product code is empty", () => {
      expect(generateSkuCode("")).toBe("");
      expect(generateSkuCode("  ")).toBe("");
    });

    test("generates SKU with tier 1 option", () => {
      expect(generateSkuCode("TSHIRT", "Đỏ")).toBe("TSHIRT-DO");
    });

    test("generates SKU with tier 1 and tier 2 options", () => {
      expect(generateSkuCode("TSHIRT", "Đỏ", "XL")).toBe("TSHIRT-DO-XL");
    });

    test("ignores empty/null/undefined options", () => {
      expect(generateSkuCode("TSHIRT", null, "XL")).toBe("TSHIRT-XL");
      expect(generateSkuCode("TSHIRT", "", undefined)).toBe("TSHIRT-DEFAULT");
    });
  });
});
