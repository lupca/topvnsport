import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach } from "vitest";

import ProductList from "@/components/ProductList";

const mockCategories = [
  { id: 1, name: "Thời trang nam", code: "MEN_CLOTHING" },
  { id: 2, name: "Giày dép thể thao", code: "SPORT_SHOES" }
];

const mockProductsData = {
  items: [
    {
      id: 10,
      product_code: "P-10-PARENT",
      name: "Áo Polo thể thao nam thoáng khí",
      description: "Mô tả áo polo thể thao nam thoáng khí chất liệu tốt",
      category_id: 1,
      weight: 150,
      length: 20,
      width: 15,
      height: 5,
      is_pre_order: false,
      dts_days: 7,
      status: "Published",
      variants: [
        {
          id: 101,
          tier_1_option: "Trắng",
          tier_2_option: "M",
          sku_code: "P-10-PARENT-Trang-M",
          price: 150000,
          stock: 25
        },
        {
          id: 102,
          tier_1_option: "Đen",
          tier_2_option: "L",
          sku_code: "P-10-PARENT-Den-L",
          price: 160000,
          stock: 12
        }
      ],
      tier_variations: [
        { name: "Màu sắc", options: ["Trắng", "Đen"], tier_index: 1 },
        { name: "Kích thước", options: ["M", "L"], tier_index: 2 }
      ],
      media: [
        { id: 1, image_url: "http://example.com/cover.png", is_cover: true, variant_tier_1_option: null }
      ]
    }
  ],
  total: 1,
  pages: 1
};

describe("ProductList", () => {
  const onAddProductClick = vi.fn();
  const onEditProductClick = vi.fn();
  const onCopyProductClick = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();

    // Mock global fetch - use regex to match URLs with any prefix (/pmi-api, /api, etc.)
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        // Match /categories
        if (/\/categories/.test(url)) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockCategories),
          });
        }
        // Match /products/10 (single product)
        if (/\/products\/10\b/.test(url)) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockProductsData.items[0]),
          });
        }
        // Match /products (list) - but not /products/X
        if (/\/products(?:\?|$)/.test(url)) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockProductsData),
          });
        }
        // Match export endpoints
        if (/\/export\//.test(url)) {
          return Promise.resolve({
            ok: true,
            blob: () => Promise.resolve(new Blob(["test"], { type: "text/csv" })),
            headers: new Headers({ "content-type": "text/csv" })
          });
        }
        console.log("Unmatched URL:", url);
        return Promise.reject(new Error("Unknown URL: " + url));
      })
    );
  });

  test("renders loading state initially", async () => {
    // Create a fetch mock that returns a pending promise for products to inspect loading
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/categories")) {
          return new Promise(() => {}); // never resolves
        }
        return new Promise(() => {}); // never resolves
      })
    );

    render(
      <ProductList
        onAddProductClick={onAddProductClick}
        onEditProductClick={onEditProductClick}
        onCopyProductClick={onCopyProductClick}
      />
    );

    expect(screen.getByText("Đang tải danh sách sản phẩm...")).toBeInTheDocument();
  });

  test("renders product list successfully", async () => {
    render(
      <ProductList
        onAddProductClick={onAddProductClick}
        onEditProductClick={onEditProductClick}
        onCopyProductClick={onCopyProductClick}
      />
    );

    // Wait for the product list to be loaded
    await waitFor(() => {
      const elements = screen.queryAllByText((_, el) =>
        el?.textContent?.toLowerCase().includes("áo polo") ?? false
      );
      expect(elements.length).toBeGreaterThan(0);
    });

    // Check for SKU
    await waitFor(() => {
      const skuElements = screen.queryAllByText((_, el) =>
        el?.textContent?.includes("P-10-PARENT") ?? false
      );
      expect(skuElements.length).toBeGreaterThan(0);
    });
  });

  test("calls pagination when page is clicked", async () => {
    const mockMultiPageData = {
      ...mockProductsData,
      total: 15,
      pages: 2
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/categories")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockCategories),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockMultiPageData),
        });
      })
    );

    render(
      <ProductList
        onAddProductClick={onAddProductClick}
        onEditProductClick={onEditProductClick}
        onCopyProductClick={onCopyProductClick}
      />
    );

    await waitFor(() => {
      const elements = screen.queryAllByText((_, el) =>
        el?.textContent?.toLowerCase().includes("áo polo") ?? false
      );
      expect(elements.length).toBeGreaterThan(0);
    });

    const page2Button = screen.getByRole("button", { name: "2" });
    await userEvent.click(page2Button);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("page=2"),
      expect.any(Object)
    );
  });

  test("applies search and reset filters", async () => {
    render(
      <ProductList
        onAddProductClick={onAddProductClick}
        onEditProductClick={onEditProductClick}
        onCopyProductClick={onCopyProductClick}
      />
    );

    await waitFor(() => {
      const elements = screen.queryAllByText((_, el) =>
        el?.textContent?.toLowerCase().includes("áo polo") ?? false
      );
      expect(elements.length).toBeGreaterThan(0);
    });

    const searchInput = screen.getByPlaceholderText(/Tìm.*sản phẩm/i);
    await userEvent.type(searchInput, "Polo");

    const applyButton = screen.getByRole("button", { name: "Áp dụng" });
    await userEvent.click(applyButton);

    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining("q=Polo"),
      expect.any(Object)
    );

    const resetButton = screen.getByRole("button", { name: /đặt lại/i });
    await userEvent.click(resetButton);

    // Verify it fetches without query
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.not.stringContaining("q=Polo"),
      expect.any(Object)
    );
  });

  test("applies search and category changes immediately", async () => {
    render(
      <ProductList
        onAddProductClick={onAddProductClick}
        onEditProductClick={onEditProductClick}
        onCopyProductClick={onCopyProductClick}
      />
    );

    await waitFor(() => {
      const elements = screen.queryAllByText((_, el) =>
        el?.textContent?.toLowerCase().includes("áo polo") ?? false
      );
      expect(elements.length).toBeGreaterThan(0);
    });

    const categorySelect = screen.getAllByRole("combobox")[0];
    await userEvent.selectOptions(categorySelect, "2");

    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining("category_id=2"),
        expect.any(Object)
      );
    });

    const searchInput = screen.getByPlaceholderText(/Tìm.*sản phẩm/i);
    await userEvent.clear(searchInput);
    await userEvent.type(searchInput, "Polo");

    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining("q=Polo"),
        expect.any(Object)
      );
    });

    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining("category_id=2"),
      expect.any(Object)
    );
  });

  test("opens preview modal when clicked and shows details", async () => {
    render(
      <ProductList
        onAddProductClick={onAddProductClick}
        onEditProductClick={onEditProductClick}
        onCopyProductClick={onCopyProductClick}
      />
    );

    await waitFor(() => {
      const elements = screen.queryAllByText((_, el) =>
        el?.textContent?.toLowerCase().includes("áo polo") ?? false
      );
      expect(elements.length).toBeGreaterThan(0);
    });

    const previewButton = screen.getByRole("button", { name: /Xem trước/i });
    await userEvent.click(previewButton);

    await waitFor(() => {
      const modalElements = screen.queryAllByText(/Xem trước/i);
      expect(modalElements.length).toBeGreaterThan(0);
    });

    // Variant options - check they exist somewhere in the document
    await waitFor(() => {
      const trangElements = screen.queryAllByText((_, el) => el?.textContent?.includes("Trắng") ?? false);
      expect(trangElements.length).toBeGreaterThan(0);
    });
  });

  test("calls callbacks for editing, copying and adding new product", async () => {
    render(
      <ProductList
        onAddProductClick={onAddProductClick}
        onEditProductClick={onEditProductClick}
        onCopyProductClick={onCopyProductClick}
      />
    );

    await waitFor(() => {
      const elements = screen.queryAllByText((_, el) =>
        el?.textContent?.toLowerCase().includes("áo polo") ?? false
      );
      expect(elements.length).toBeGreaterThan(0);
    });

    const editButton = screen.getByRole("button", { name: /Cập nhật/i });
    await userEvent.click(editButton);
    expect(onEditProductClick).toHaveBeenCalledWith(10);

    const copyButton = screen.getByRole("button", { name: /Sao chép/i });
    await userEvent.click(copyButton);
    expect(onCopyProductClick).toHaveBeenCalledWith(10);

    const addButton = screen.getByRole("button", { name: /Thêm.*sản phẩm/i });
    await userEvent.click(addButton);
    expect(onAddProductClick).toHaveBeenCalled();
  });

  test("shows delete confirm modal and executes delete call", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, options?: any) => {
        if (url.includes("/categories")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockCategories),
          });
        }
        if (url.includes("/products/10") && options?.method === "DELETE") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ detail: "Sản phẩm đã được xóa." }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockProductsData),
        });
      })
    );

    render(
      <ProductList
        onAddProductClick={onAddProductClick}
        onEditProductClick={onEditProductClick}
        onCopyProductClick={onCopyProductClick}
      />
    );

    await waitFor(() => {
      const elements = screen.queryAllByText((_, el) =>
        el?.textContent?.toLowerCase().includes("áo polo") ?? false
      );
      expect(elements.length).toBeGreaterThan(0);
    });

    const deleteButton = screen.getByRole("button", { name: /^Xóa$/i });
    await userEvent.click(deleteButton);

    expect(screen.getByText(/Xác nhận xóa/i)).toBeInTheDocument();

    const confirmDeleteButton = screen.getByRole("button", { name: /Xóa sản phẩm/i });
    await userEvent.click(confirmDeleteButton);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/products/10"),
      expect.objectContaining({ method: "DELETE" })
    );
  });

  test("toggles export dropdown and handles platform export download", async () => {
    const mockBlob = new Blob(["test"], { type: "text/csv" });
    const createObjectURLMock = vi.fn().mockReturnValue("blob:mock-url");
    const revokeObjectURLMock = vi.fn();
    global.URL.createObjectURL = createObjectURLMock;
    global.URL.revokeObjectURL = revokeObjectURLMock;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/categories")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockCategories),
          });
        }
        if (url.includes("/export/")) {
          return Promise.resolve({
            ok: true,
            blob: () => Promise.resolve(mockBlob),
            headers: new Headers({ "content-type": "text/csv" })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockProductsData),
        });
      })
    );

    render(
      <ProductList
        onAddProductClick={onAddProductClick}
        onEditProductClick={onEditProductClick}
        onCopyProductClick={onCopyProductClick}
      />
    );

    await waitFor(() => {
      const elements = screen.queryAllByText((_, el) =>
        el?.textContent?.toLowerCase().includes("áo polo") ?? false
      );
      expect(elements.length).toBeGreaterThan(0);
    });

    const exportBtn = screen.getByRole("button", { name: /Xuất dữ liệu/i });
    await userEvent.click(exportBtn);

    expect(screen.getByText(/Xuất.*Shopee/i)).toBeInTheDocument();
    expect(screen.getByText(/Xuất.*TikTok/i)).toBeInTheDocument();

    const shopeeBtn = screen.getByText(/Xuất.*Shopee/i);
    await userEvent.click(shopeeBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/export/shopee"),
        expect.any(Object)
      );
      const calledUrl = vi.mocked(global.fetch).mock.calls.find(c => c[0].includes("/export/shopee"))?.[0] as string;
      expect(calledUrl).not.toContain("status=");
      expect(calledUrl).not.toContain("product_ids=");
    });
  });

  test("detailed bulk selection checkbox integration and filtered export", async () => {
    const mockBlob = new Blob(["test"], { type: "text/csv" });
    const createObjectURLMock = vi.fn().mockReturnValue("blob:mock-url");
    const revokeObjectURLMock = vi.fn();
    global.URL.createObjectURL = createObjectURLMock;
    global.URL.revokeObjectURL = revokeObjectURLMock;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/categories")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockCategories),
          });
        }
        if (url.includes("/export/")) {
          return Promise.resolve({
            ok: true,
            blob: () => Promise.resolve(mockBlob),
            headers: new Headers({ "content-type": "text/csv" })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockProductsData),
        });
      })
    );

    render(
      <ProductList
        onAddProductClick={onAddProductClick}
        onEditProductClick={onEditProductClick}
        onCopyProductClick={onCopyProductClick}
      />
    );

    await waitFor(() => {
      const elements = screen.queryAllByText((_, el) =>
        el?.textContent?.toLowerCase().includes("áo polo") ?? false
      );
      expect(elements.length).toBeGreaterThan(0);
    });

    expect(screen.queryByText(/Đã chọn/i)).not.toBeInTheDocument();

    const checkboxes = screen.getAllByRole("checkbox");
    await userEvent.click(checkboxes[1]);

    expect(screen.getByText(/Đã chọn 1 sản phẩm/i)).toBeInTheDocument();

    const exportBtn = screen.getByRole("button", { name: /Xuất dữ liệu/i });
    await userEvent.click(exportBtn);

    const shopeeBtn = screen.getByText(/Xuất.*Shopee/i);
    await userEvent.click(shopeeBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/export/shopee?product_ids=10"),
        expect.any(Object)
      );
      const calledUrl = vi.mocked(global.fetch).mock.calls.find(c => c[0].includes("/export/shopee"))?.[0] as string;
      expect(calledUrl).not.toContain("status=");
    });

    await userEvent.click(checkboxes[0]);
    expect(screen.queryByText(/Đã chọn/i)).not.toBeInTheDocument();
  });

  test("exports with correct status parameter when activeTab is not all", async () => {
    const mockBlob = new Blob(["test"], { type: "text/csv" });
    const createObjectURLMock = vi.fn().mockReturnValue("blob:mock-url");
    const revokeObjectURLMock = vi.fn();
    global.URL.createObjectURL = createObjectURLMock;
    global.URL.revokeObjectURL = revokeObjectURLMock;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/categories")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockCategories),
          });
        }
        if (url.includes("/export/")) {
          return Promise.resolve({
            ok: true,
            blob: () => Promise.resolve(mockBlob),
            headers: new Headers({ "content-type": "text/csv" })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockProductsData),
        });
      })
    );

    render(
      <ProductList
        onAddProductClick={onAddProductClick}
        onEditProductClick={onEditProductClick}
        onCopyProductClick={onCopyProductClick}
      />
    );

    await waitFor(() => {
      const elements = screen.queryAllByText((_, el) =>
        el?.textContent?.toLowerCase().includes("áo polo") ?? false
      );
      expect(elements.length).toBeGreaterThan(0);
    });

    const activeTabBtn = screen.getByRole("button", { name: /Đang hoạt động/i });
    await userEvent.click(activeTabBtn);

    const exportBtn = screen.getByRole("button", { name: /Xuất dữ liệu/i });
    await userEvent.click(exportBtn);

    const shopeeBtn = screen.getByText(/Xuất.*Shopee/i);
    await userEvent.click(shopeeBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/export/shopee?status=Published"),
        expect.any(Object)
      );
    });
  });
});
