import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach } from "vitest";

const { mockFetchWithAuth, mockApiClient } = vi.hoisted(() => ({
  mockFetchWithAuth: vi.fn(),
  mockApiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/utils/apiClient", () => ({
  fetchWithAuth: mockFetchWithAuth,
  apiClient: mockApiClient,
}));

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

const mockChannels = [
  { id: 1, code: "shopee_vn", name: "Shopee Vietnam" },
  { id: 2, code: "tiktok_shop", name: "TikTok Shop" }
];

describe("ProductForm", () => {
  const onSaveSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockFetchWithAuth.mockImplementation((url: string, options?: any) => {
      if (/\/channels(?:\/|$|\?)/.test(url) && !/mappings/.test(url)) {
        return Promise.resolve(mockChannels);
      }
      if (/category-mappings/.test(url)) {
        return Promise.resolve([]);
      }
      if (/attribute-mappings/.test(url)) {
        return Promise.resolve([]);
      }
      if (/\/categories/.test(url)) {
        return Promise.resolve(mockCategories);
      }
      if (/attribute-families\/\d+\/attributes/.test(url)) {
        return Promise.resolve(mockAttributes);
      }
      if (/attribute-families/.test(url)) {
        return Promise.resolve(mockFamilies);
      }
      if (/\/products/.test(url) && options?.method === "POST") {
        return Promise.resolve({ id: 99, name: "Product saved" });
      }
      if (/\/products/.test(url)) {
        return Promise.resolve({ id: 99, name: "Product saved" });
      }
      return Promise.resolve([]);
    });

    mockApiClient.post.mockResolvedValue({ id: 99, name: "Product saved" });
    mockApiClient.put.mockResolvedValue({ id: 99, name: "Product updated" });
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
    });
  });

  test("adds tier variations and generates variants table rows", async () => {
    render(<ProductForm onSaveSuccess={onSaveSuccess} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Thông tin bán hàng" })).toBeInTheDocument();
    });

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

    await waitFor(() => {
      expect(screen.getAllByText("Đỏ").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Xanh").length).toBeGreaterThan(0);
    });
  });

  test("mass applies price to all variants", async () => {
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

    const bulkPriceInput = screen.getByPlaceholderText("Giá");
    const applyBulkButton = screen.getByRole("button", { name: "Áp dụng cho tất cả" });

    await userEvent.type(bulkPriceInput, "180000");
    await userEvent.click(applyBulkButton);

    const prices = screen.getAllByDisplayValue("180000");

    expect(prices.length).toBe(3);
  });

  test("form submit payload is valid", async () => {
    const { container } = render(<ProductForm onSaveSuccess={onSaveSuccess} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Thông tin cơ bản" })).toBeInTheDocument();
    });

    await userEvent.type(screen.getByPlaceholderText("Nhập tên sản phẩm (Ví dụ: Áo thun nam Cotton 100% cổ tròn)"), "Áo thun nam thể thao cao cấp");
    await userEvent.type(screen.getByPlaceholderText("Tự động tạo khi nhập tên + chọn ngành hàng"), "TS-PARENT-01");

    const selects = screen.getAllByRole("combobox");
    await userEvent.selectOptions(selects[0], "1");
    await userEvent.selectOptions(selects[1], "1");

    await userEvent.type(screen.getByPlaceholderText("Mô tả thông tin chi tiết về sản phẩm của bạn (chất liệu, công dụng, thông số kỹ thuật...)"), "Mô tả sản phẩm áo thun nam cao cấp dài trên 10 ký tự.");

    const weightInput = container.querySelector('input[name="weight"]')!;
    await userEvent.type(weightInput, "200");

    const submitButton = screen.getByRole("button", { name: "Lưu & Hiển thị" });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith(
        expect.stringContaining("/products"),
        expect.objectContaining({
          name: "Áo thun nam thể thao cao cấp",
          product_code: "TS-PARENT-01",
        })
      );
    });
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
        { id: 100, tier_1_option: "Đỏ", tier_2_option: null, sku_code: "TS-PARENT-01-DO", price: 150000, barcode: "BARCODE123" }
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
      mockFetchWithAuth.mockImplementation((url: string) => {
        if (/\/products\/42/.test(url)) {
          return Promise.resolve(mockProduct);
        }
        if (/\/channels(?:\/|$|\?)/.test(url) && !/mappings/.test(url)) {
          return Promise.resolve(mockChannels);
        }
        if (/category-mappings/.test(url)) {
          return Promise.resolve([]);
        }
        if (/attribute-mappings/.test(url)) {
          return Promise.resolve([]);
        }
        if (/\/categories/.test(url)) {
          return Promise.resolve(mockCategories);
        }
        if (/attribute-families\/\d+\/attributes/.test(url)) {
          return Promise.resolve(mockAttributes);
        }
        if (/attribute-families/.test(url)) {
          return Promise.resolve(mockFamilies);
        }
        return Promise.resolve([]);
      });

      render(<ProductForm productId={42} onSaveSuccess={onSaveSuccess} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("Áo thun nam thể thao cao cấp")).toBeInTheDocument();
      });

      expect(screen.getByDisplayValue("TS-PARENT-01")).toBeInTheDocument();
      expect(screen.getByDisplayValue("150000")).toBeInTheDocument();

      const submitButton = screen.getByRole("button", { name: "Cập nhật & Hiển thị" });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockApiClient.put).toHaveBeenCalledWith(
          expect.stringContaining("/products/42"),
          expect.objectContaining({
            name: "Áo thun nam thể thao cao cấp",
            product_code: "TS-PARENT-01",
          })
        );
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
        { id: 100, tier_1_option: "Đỏ", tier_2_option: null, sku_code: "TS-PARENT-01-DO", price: 150000, barcode: "BARCODE123" }
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
      mockFetchWithAuth.mockImplementation((url: string) => {
        if (/\/products\/42/.test(url)) {
          return Promise.resolve(mockProduct);
        }
        if (/\/channels(?:\/|$|\?)/.test(url) && !/mappings/.test(url)) {
          return Promise.resolve(mockChannels);
        }
        if (/category-mappings/.test(url)) {
          return Promise.resolve([]);
        }
        if (/attribute-mappings/.test(url)) {
          return Promise.resolve([]);
        }
        if (/\/categories/.test(url)) {
          return Promise.resolve(mockCategories);
        }
        if (/attribute-families\/\d+\/attributes/.test(url)) {
          return Promise.resolve(mockAttributes);
        }
        if (/attribute-families/.test(url)) {
          return Promise.resolve(mockFamilies);
        }
        return Promise.resolve([]);
      });

      render(<ProductForm duplicateProductId={42} onSaveSuccess={onSaveSuccess} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("Áo thun nam thể thao cao cấp")).toBeInTheDocument();
      });

      const productCodeInput = screen.getByPlaceholderText("Tự động tạo khi nhập tên + chọn ngành hàng") as HTMLInputElement;
      await waitFor(() => {
        expect(productCodeInput.value).toMatch(/^[A-Z]+-[A-Z-]+-[A-Z0-9]+$/);
      });

      await userEvent.clear(productCodeInput);
      await userEvent.type(productCodeInput, "TS-PARENT-NEW");

      const submitButton = screen.getByRole("button", { name: "Lưu & Hiển thị" });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalledWith(
          expect.stringContaining("/products"),
          expect.objectContaining({
            name: "Áo thun nam thể thao cao cấp",
            product_code: "TS-PARENT-NEW",
          })
        );
      });
    });
  });

  describe("ProductForm - Error Handling", () => {
    test("displays error message when product loading fails", async () => {
      mockFetchWithAuth.mockImplementation((url: string) => {
        if (/\/products\/42/.test(url)) {
          return Promise.reject(new Error("Internal Server Error"));
        }
        if (/\/channels(?:\/|$|\?)/.test(url) && !/mappings/.test(url)) {
          return Promise.resolve(mockChannels);
        }
        if (/category-mappings/.test(url)) {
          return Promise.resolve([]);
        }
        if (/attribute-mappings/.test(url)) {
          return Promise.resolve([]);
        }
        if (/\/categories/.test(url)) {
          return Promise.resolve(mockCategories);
        }
        if (/attribute-families/.test(url)) {
          return Promise.resolve(mockFamilies);
        }
        return Promise.resolve([]);
      });

      render(<ProductForm productId={42} onSaveSuccess={onSaveSuccess} />);

      await waitFor(() => {
        expect(screen.getByText("Không thể tải thông tin sản phẩm.")).toBeInTheDocument();
      });
    });

    test("displays server validation error message when submit fails", async () => {
      const errorMessage = "Mã SKU sản phẩm cha đã tồn tại";
      mockApiClient.post.mockRejectedValue(new Error(errorMessage));

      const { container } = render(<ProductForm onSaveSuccess={onSaveSuccess} />);

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Thông tin cơ bản" })).toBeInTheDocument();
      });

      await userEvent.type(screen.getByPlaceholderText("Nhập tên sản phẩm (Ví dụ: Áo thun nam Cotton 100% cổ tròn)"), "Áo thun nam thể thao cao cấp");
      await userEvent.type(screen.getByPlaceholderText("Tự động tạo khi nhập tên + chọn ngành hàng"), "TS-PARENT-01");

      const selects = screen.getAllByRole("combobox");
      await userEvent.selectOptions(selects[0], "1");
      await userEvent.selectOptions(selects[1], "1");

      await userEvent.type(screen.getByPlaceholderText("Mô tả thông tin chi tiết về sản phẩm của bạn (chất liệu, công dụng, thông số kỹ thuật...)"), "Mô tả sản phẩm áo thun nam cao cấp dài trên 10 ký tự.");

      const weightInput = container.querySelector('input[name="weight"]')!;
      await userEvent.type(weightInput, "200");

      const submitButton = screen.getByRole("button", { name: "Lưu & Hiển thị" });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText(/Lỗi lưu trữ/i)).toBeInTheDocument();
      });
    });
  });
});
