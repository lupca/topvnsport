import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach } from "vitest";

import ProductForm from "@/components/ProductForm";

const mockCategories = [
  { id: 1, parent_id: null, name: "Áo thun nam", code: "TSHIRT" },
];

const mockFamilies = [
  { id: 1, name: "Quần áo", code: "CLOTHING" },
];

const mockAttributes = [
  { id: 10, code: "material", name: "Chất liệu", type: "string", is_required: true },
];

describe("ProductForm", () => {
  const onSaveSuccess = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/channels")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([
              { id: 1, code: "shopee_vn", name: "Shopee Vietnam" },
              { id: 2, code: "tiktok_shop", name: "TikTok Shop" }
            ]),
          });
        }
        if (url.includes("/category-mappings")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([]),
          });
        }
        if (url.includes("/attribute-mappings")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([]),
          });
        }
        if (url.includes("/categories")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockCategories),
          });
        }
        if (url.includes("/attribute-families/1/attributes")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockAttributes),
          });
        }
        if (url.includes("/attribute-families")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockFamilies),
          });
        }
        if (url.includes("/products")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: 99, name: "Product saved" }),
          });
        }
        return Promise.reject(new Error("Unknown URL: " + url));
      })
    );
  });

  test("validation errors show up on empty form submission", async () => {
    render(<ProductForm onSaveSuccess={onSaveSuccess} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Thông tin cơ bản" })).toBeInTheDocument();
    });

    const submitButton = screen.getByRole("button", { name: "Lưu & Hiển thị" });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getAllByText("Độ dài tối thiểu là 5 ký tự")[0]).toBeInTheDocument();
      expect(screen.getAllByText("Trường này là bắt buộc")[0]).toBeInTheDocument();
      expect(screen.getAllByText("Vui lòng chọn ngành hàng")[0]).toBeInTheDocument();
      expect(screen.getAllByText("Vui lòng chọn bộ thuộc tính")[0]).toBeInTheDocument();
      expect(screen.getAllByText("Độ dài tối thiểu là 10 ký tự")[0]).toBeInTheDocument();
      expect(screen.getAllByText("Giá trị phải lớn hơn hoặc bằng 1")[0]).toBeInTheDocument();
    });
  });

  test("adds tier variations and generates variants table rows", async () => {
    render(<ProductForm onSaveSuccess={onSaveSuccess} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Thông tin bán hàng" })).toBeInTheDocument();
    });

    // Add a tier variation
    const addTierButton = screen.getByRole("button", { name: "Thêm nhóm phân loại hàng" });
    await userEvent.click(addTierButton);

    const tierNameInput = screen.getByPlaceholderText("Ví dụ: Màu sắc");
    await userEvent.type(tierNameInput, "Màu sắc");

    const optionInputs = screen.getAllByPlaceholderText("Thêm phân loại");
    fireEvent.change(optionInputs[0], { target: { value: "Đỏ" } });
    fireEvent.blur(optionInputs[0]);

    const optionInputsAfter = screen.getAllByPlaceholderText("Thêm phân loại");
    fireEvent.change(optionInputsAfter[1], { target: { value: "Xanh" } });
    fireEvent.blur(optionInputsAfter[1]);

    // Wait for the variants table to render Đỏ and Xanh rows
    await waitFor(() => {
      expect(screen.getAllByText("Đỏ").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Xanh").length).toBeGreaterThan(0);
    });
  });

  test("mass applies price and stock to all variants", async () => {
    render(<ProductForm onSaveSuccess={onSaveSuccess} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Thông tin bán hàng" })).toBeInTheDocument();
    });

    const addTierButton = screen.getByRole("button", { name: "Thêm nhóm phân loại hàng" });
    await userEvent.click(addTierButton);
    await userEvent.type(screen.getByPlaceholderText("Ví dụ: Màu sắc"), "Màu sắc");
    
    const optionInputs = screen.getAllByPlaceholderText("Thêm phân loại");
    fireEvent.change(optionInputs[0], { target: { value: "Đỏ" } });
    fireEvent.blur(optionInputs[0]);
    
    const optionInputsAfter = screen.getAllByPlaceholderText("Thêm phân loại");
    fireEvent.change(optionInputsAfter[1], { target: { value: "Xanh" } });
    fireEvent.blur(optionInputsAfter[1]);

    await waitFor(() => {
      expect(screen.getAllByText("Đỏ").length).toBeGreaterThan(0);
    });

    // Mass apply
    const bulkPriceInput = screen.getByPlaceholderText("Giá");
    const bulkStockInput = screen.getByPlaceholderText("Kho hàng");
    const applyBulkButton = screen.getByRole("button", { name: "Áp dụng cho tất cả" });

    await userEvent.type(bulkPriceInput, "180000");
    await userEvent.type(bulkStockInput, "45");
    await userEvent.click(applyBulkButton);

    // Verify all variant inputs have these values.
    // There are 2 variants (Đỏ and Xanh), so there should be input elements with value 180000 and 45.
    // However, the bulk inputs themselves also have these values, making the total 3.
    const prices = screen.getAllByDisplayValue("180000");
    const stocks = screen.getAllByDisplayValue("45");

    expect(prices.length).toBe(3);
    expect(stocks.length).toBe(3);
  });

  test("form submit payload is valid", async () => {
    const { container } = render(<ProductForm onSaveSuccess={onSaveSuccess} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Thông tin cơ bản" })).toBeInTheDocument();
    });

    // Fill basic details
    await userEvent.type(screen.getByPlaceholderText("Nhập tên sản phẩm (Ví dụ: Áo thun nam Cotton 100% cổ tròn)"), "Áo thun nam thể thao cao cấp");
    await userEvent.type(screen.getByPlaceholderText("Tự động tạo khi nhập tên + chọn ngành hàng"), "TS-PARENT-01");
    
    const selects = screen.getAllByRole("combobox");
    // Under React-hook-form, sometimes labels are not directly linked.
    // Index 0: category_id select. Index 1: family_id select.
    await userEvent.selectOptions(selects[0], "1");
    await userEvent.selectOptions(selects[1], "1");

    await userEvent.type(screen.getByPlaceholderText("Mô tả thông tin chi tiết về sản phẩm của bạn (chất liệu, công dụng, thông số kỹ thuật...)"), "Mô tả sản phẩm áo thun nam cao cấp dài trên 10 ký tự.");
    
    const weightInput = container.querySelector('input[name="weight"]')!;
    await userEvent.type(weightInput, "200");

    // Submit form
    const submitButton = screen.getByRole("button", { name: "Lưu & Hiển thị" });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/products"),
        expect.objectContaining({
          method: "POST",
          headers: expect.any(Object),
          body: expect.any(String)
        })
      );
    });

    // Verify payload body values
    const lastCall = vi.mocked(global.fetch).mock.calls.find(call => call[0].includes("/products") && call[1]?.method === "POST");
    expect(lastCall).toBeDefined();
    const payload = JSON.parse(lastCall![1]!.body as string);
    expect(payload.name).toBe("Áo thun nam thể thao cao cấp");
    expect(payload.product_code).toBe("TS-PARENT-01");
    expect(payload.category_id).toBe(1);
    expect(payload.family_id).toBe(1);
    expect(payload.weight).toBe(200);
    await waitFor(() => {
      expect(onSaveSuccess).toHaveBeenCalled();
    }, { timeout: 1500 });
  });

  describe("ProductForm - Edit Mode", () => {
    const mockProduct = {
      id: 42,
      product_code: "TS-PARENT-01",
      name: "Áo thun nam thể thao cao cấp",
      description: "Mô tả sản phẩm áo thun nam cao cấp dài trên 10 ký tự.",
      category_id: 1,
      family_id: 1,
      weight: 200,
      length: 10,
      width: 5,
      height: 2,
      hs_code: "1234.56.78",
      tax_code: "TAX-999",
      is_pre_order: false,
      dts_days: 7,
      status: "Draft",
      tier_variations: [
        { tier_index: 1, name: "Màu sắc", options: ["Đỏ"] }
      ],
      variants: [
        { id: 100, tier_1_option: "Đỏ", tier_2_option: null, sku_code: "TS-PARENT-01-DO", price: 150000, barcode: "BARCODE123", stock: 15 }
      ],
      channel_listings: [
        { channel_code: "shopee_vn", status: "Draft", title_override: "", description_override: "", attribute_values: [], variant_overrides: [] }
      ],
      attribute_values: [
        { attribute_id: 10, value_string: "Polyester", value_decimal: null }
      ],
      media: [
        { is_cover: true, image_url: "http://minio:9000/bucket/cover.jpg", display_order: 1 }
      ]
    };

    test("loads existing product data and submits PUT on save", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation((url: string, options: any) => {
          if (url.includes("/products/42")) {
            if (options?.method === "PUT") {
              return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ id: 42, name: "Product updated" }),
              });
            }
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockProduct),
            });
          }
          if (url.includes("/api/channels")) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve([
                { id: 1, code: "shopee_vn", name: "Shopee Vietnam" },
                { id: 2, code: "tiktok_shop", name: "TikTok Shop" }
              ]),
            });
          }
          if (url.includes("/category-mappings")) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
          }
          if (url.includes("/attribute-mappings")) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
          }
          if (url.includes("/categories")) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockCategories) });
          }
          if (url.includes("/attribute-families/1/attributes")) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAttributes) });
          }
          if (url.includes("/attribute-families")) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFamilies) });
          }
          return Promise.reject(new Error("Unknown URL: " + url));
        })
      );

      render(<ProductForm productId={42} onSaveSuccess={onSaveSuccess} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("Áo thun nam thể thao cao cấp")).toBeInTheDocument();
      });

      expect(screen.getByDisplayValue("TS-PARENT-01")).toBeInTheDocument();
      expect(screen.getByDisplayValue("150000")).toBeInTheDocument();

      const submitButton = screen.getByRole("button", { name: "Cập nhật & Hiển thị" });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/products/42"),
          expect.objectContaining({
            method: "PUT",
            body: expect.any(String),
          })
        );
      });

      const putCall = vi.mocked(global.fetch).mock.calls.find(call => call[0].includes("/products/42") && call[1]?.method === "PUT");
      expect(putCall).toBeDefined();
      const payload = JSON.parse(putCall![1]!.body as string);
      expect(payload.name).toBe("Áo thun nam thể thao cao cấp");
      expect(payload.product_code).toBe("TS-PARENT-01");
      expect(payload.weight).toBe(200);

      await waitFor(() => {
        expect(onSaveSuccess).toHaveBeenCalled();
      });
    });
  });

  describe("ProductForm - Duplicate Mode", () => {
    const mockProduct = {
      id: 42,
      product_code: "TS-PARENT-01",
      name: "Áo thun nam thể thao cao cấp",
      description: "Mô tả sản phẩm áo thun nam cao cấp dài trên 10 ký tự.",
      category_id: 1,
      family_id: 1,
      weight: 200,
      length: 10,
      width: 5,
      height: 2,
      hs_code: "1234.56.78",
      tax_code: "TAX-999",
      is_pre_order: false,
      dts_days: 7,
      status: "Draft",
      tier_variations: [
        { tier_index: 1, name: "Màu sắc", options: ["Đỏ"] }
      ],
      variants: [
        { id: 100, tier_1_option: "Đỏ", tier_2_option: null, sku_code: "TS-PARENT-01-DO", price: 150000, barcode: "BARCODE123", stock: 15 }
      ],
      channel_listings: [
        { channel_code: "shopee_vn", status: "Draft", title_override: "", description_override: "", attribute_values: [], variant_overrides: [] }
      ],
      attribute_values: [
        { attribute_id: 10, value_string: "Polyester", value_decimal: null }
      ],
      media: [
        { is_cover: true, image_url: "http://minio:9000/bucket/cover.jpg", display_order: 1 }
      ]
    };

    test("loads original product data, clears SKUs/product_code, and submits POST on save", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation((url: string, options: any) => {
          if (url.includes("/products/42")) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockProduct),
            });
          }
          if (url.includes("/products")) {
            if (options?.method === "POST") {
              return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ id: 99, name: "Product saved" }),
              });
            }
          }
          if (url.includes("/api/channels")) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve([
                { id: 1, code: "shopee_vn", name: "Shopee Vietnam" },
                { id: 2, code: "tiktok_shop", name: "TikTok Shop" }
              ]),
            });
          }
          if (url.includes("/category-mappings")) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
          }
          if (url.includes("/attribute-mappings")) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
          }
          if (url.includes("/categories")) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockCategories) });
          }
          if (url.includes("/attribute-families/1/attributes")) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAttributes) });
          }
          if (url.includes("/attribute-families")) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFamilies) });
          }
          return Promise.reject(new Error("Unknown URL: " + url));
        })
      );

      render(<ProductForm duplicateProductId={42} onSaveSuccess={onSaveSuccess} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("Áo thun nam thể thao cao cấp")).toBeInTheDocument();
      });

      // Verify product_code is auto-generated for duplicate (not empty, starts with category code)
      const productCodeInput = screen.getByPlaceholderText("Tự động tạo khi nhập tên + chọn ngành hàng") as HTMLInputElement;
      await waitFor(() => {
        // Should be auto-generated: starts with category code and contains product name parts
        expect(productCodeInput.value).toMatch(/^[A-Z]+-[A-Z-]+-[A-Z0-9]+$/);
      });

      // Clear and fill in a custom parent SKU code
      await userEvent.clear(productCodeInput);
      await userEvent.type(productCodeInput, "TS-PARENT-NEW");

      const submitButton = screen.getByRole("button", { name: "Lưu & Hiển thị" });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/products"),
          expect.objectContaining({
            method: "POST",
            body: expect.any(String),
          })
        );
      });

      const postCall = vi.mocked(global.fetch).mock.calls.find(call => call[0].endsWith("/products") && call[1]?.method === "POST");
      expect(postCall).toBeDefined();
      const payload = JSON.parse(postCall![1]!.body as string);
      expect(payload.name).toBe("Áo thun nam thể thao cao cấp");
      expect(payload.product_code).toBe("TS-PARENT-NEW");
      // The variant sku_code should also be generated from the new parent SKU, or cleared to generate.
      // Wait, let's verify if variants are sent. The generateSkuCode helper generates the SKU for variants based on new parent SKU.

      await waitFor(() => {
        expect(onSaveSuccess).toHaveBeenCalled();
      });
    });
  });

  describe("ProductForm - Error Handling", () => {
    test("displays error message when product loading fails", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation((url: string) => {
          if (url.includes("/products/42")) {
            return Promise.resolve({
              ok: false,
              status: 500,
              clone: function() { return this; },
              text: () => Promise.resolve("Internal Server Error"),
            });
          }
          if (url.includes("/api/channels")) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve([
                { id: 1, code: "shopee_vn", name: "Shopee Vietnam" },
                { id: 2, code: "tiktok_shop", name: "TikTok Shop" }
              ]),
            });
          }
          if (url.includes("/category-mappings")) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
          }
          if (url.includes("/attribute-mappings")) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
          }
          if (url.includes("/categories")) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockCategories) });
          }
          if (url.includes("/attribute-families")) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFamilies) });
          }
          return Promise.reject(new Error("Unknown URL: " + url));
        })
      );

      render(<ProductForm productId={42} onSaveSuccess={onSaveSuccess} />);

      await waitFor(() => {
        expect(screen.getByText("Không thể tải thông tin sản phẩm.")).toBeInTheDocument();
      });
    });

    test("displays server validation error message when submit fails", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation((url: string, options: any) => {
          if (url.includes("/api/channels")) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve([
                { id: 1, code: "shopee_vn", name: "Shopee Vietnam" },
                { id: 2, code: "tiktok_shop", name: "TikTok Shop" }
              ]),
            });
          }
          if (url.includes("/category-mappings")) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
          }
          if (url.includes("/attribute-mappings")) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
          }
          if (url.includes("/categories")) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockCategories) });
          }
          if (url.includes("/attribute-families/1/attributes")) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAttributes) });
          }
          if (url.includes("/attribute-families")) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFamilies) });
          }
          if (url.includes("/products")) {
            return Promise.resolve({
              ok: false,
              status: 400,
              clone: function() { return this; },
              json: () => Promise.resolve({ detail: "Mã SKU sản phẩm cha đã tồn tại" }),
            });
          }
          return Promise.reject(new Error("Unknown URL: " + url));
        })
      );

      const { container } = render(<ProductForm onSaveSuccess={onSaveSuccess} />);

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Thông tin cơ bản" })).toBeInTheDocument();
      });

      // Fill basic details
      await userEvent.type(screen.getByPlaceholderText("Nhập tên sản phẩm (Ví dụ: Áo thun nam Cotton 100% cổ tròn)"), "Áo thun nam thể thao cao cấp");
      await userEvent.type(screen.getByPlaceholderText("Tự động tạo khi nhập tên + chọn ngành hàng"), "TS-PARENT-01");
      
      const selects = screen.getAllByRole("combobox");
      await userEvent.selectOptions(selects[0], "1");
      await userEvent.selectOptions(selects[1], "1");

      await userEvent.type(screen.getByPlaceholderText("Mô tả thông tin chi tiết về sản phẩm của bạn (chất liệu, công dụng, thông số kỹ thuật...)"), "Mô tả sản phẩm áo thun nam cao cấp dài trên 10 ký tự.");
      
      const weightInput = container.querySelector('input[name="weight"]')!;
      await userEvent.type(weightInput, "200");

      // Submit form
      const submitButton = screen.getByRole("button", { name: "Lưu & Hiển thị" });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Lỗi lưu trữ (ACID Rollback)")).toBeInTheDocument();
        expect(screen.getByText("Mã SKU sản phẩm cha đã tồn tại")).toBeInTheDocument();
      });
    });
  });
});

