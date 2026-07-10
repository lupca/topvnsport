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
      expect(screen.getByText("Thông tin cơ bản")).toBeInTheDocument();
    });

    const submitButton = screen.getByRole("button", { name: "Lưu & Hiển thị" });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Tên sản phẩm phải từ 5 ký tự trở lên")).toBeInTheDocument();
      expect(screen.getByText("Mã sản phẩm cha là bắt buộc")).toBeInTheDocument();
      expect(screen.getByText("Vui lòng chọn ngành hàng")).toBeInTheDocument();
      expect(screen.getByText("Vui lòng chọn bộ thuộc tính")).toBeInTheDocument();
      expect(screen.getByText("Mô tả sản phẩm phải từ 10 ký tự trở lên")).toBeInTheDocument();
      expect(screen.getByText("Cân nặng phải > 0")).toBeInTheDocument();
    });
  });

  test("adds tier variations and generates variants table rows", async () => {
    render(<ProductForm onSaveSuccess={onSaveSuccess} />);

    await waitFor(() => {
      expect(screen.getByText("Thông tin bán hàng")).toBeInTheDocument();
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
      expect(screen.getByText("Thông tin bán hàng")).toBeInTheDocument();
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
      expect(screen.getByText("Thông tin cơ bản")).toBeInTheDocument();
    });

    // Fill basic details
    await userEvent.type(screen.getByPlaceholderText("Nhập tên sản phẩm (Ví dụ: Áo thun nam Cotton 100% cổ tròn)"), "Áo thun nam thể thao cao cấp");
    await userEvent.type(screen.getByPlaceholderText("Ví dụ: TSHIRT-PARENT"), "TS-PARENT-01");
    
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
          headers: { "Content-Type": "application/json" },
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
});
