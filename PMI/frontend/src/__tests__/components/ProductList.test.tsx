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
    
    // Mock global fetch
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/categories")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockCategories),
          });
        }
        if (url.includes("/products/10")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockProductsData.items[0]),
          });
        }
        if (url.includes("/products")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockProductsData),
          });
        }
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
      expect(screen.getByText("Áo Polo thể thao nam thoáng khí")).toBeInTheDocument();
    });

    expect(screen.getByText("SKU parent: P-10-PARENT")).toBeInTheDocument();
    expect(screen.getByText("₫150.000 - ₫160.000")).toBeInTheDocument();
    expect(screen.getByText("37")).toBeInTheDocument(); // total stock = 25 + 12 = 37
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
      expect(screen.getByText("Áo Polo thể thao nam thoáng khí")).toBeInTheDocument();
    });

    const page2Button = screen.getByRole("button", { name: "2" });
    await userEvent.click(page2Button);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("page=2")
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
      expect(screen.getByText("Áo Polo thể thao nam thoáng khí")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Tìm Tên sản phẩm, SKU sản phẩm, SKU phân loại...");
    await userEvent.type(searchInput, "Polo");

    const applyButton = screen.getByRole("button", { name: "Áp dụng" });
    await userEvent.click(applyButton);

    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining("q=Polo")
    );

    const resetButton = screen.getByRole("button", { name: /đặt lại/i });
    await userEvent.click(resetButton);

    // Verify it fetches without query
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.not.stringContaining("q=Polo")
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
      expect(screen.getByText("Áo Polo thể thao nam thoáng khí")).toBeInTheDocument();
    });

    const previewButton = screen.getByRole("button", { name: "Xem trước" });
    await userEvent.click(previewButton);

    await waitFor(() => {
      expect(screen.getByText("Xem trước thông tin")).toBeInTheDocument();
    });

    expect(screen.getByText("Trắng - M")).toBeInTheDocument();
    expect(screen.getByText("Đen - L")).toBeInTheDocument();
    expect(screen.getByText("150 g")).toBeInTheDocument();
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
      expect(screen.getByText("Áo Polo thể thao nam thoáng khí")).toBeInTheDocument();
    });

    const editButton = screen.getByRole("button", { name: "Cập nhật" });
    await userEvent.click(editButton);
    expect(onEditProductClick).toHaveBeenCalledWith(10);

    const copyButton = screen.getByRole("button", { name: "Sao chép" });
    await userEvent.click(copyButton);
    expect(onCopyProductClick).toHaveBeenCalledWith(10);

    const addButton = screen.getByRole("button", { name: "Thêm 1 sản phẩm mới" });
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
      expect(screen.getByText("Áo Polo thể thao nam thoáng khí")).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole("button", { name: "Xóa" });
    await userEvent.click(deleteButton);

    expect(screen.getByText("Xác nhận xóa sản phẩm")).toBeInTheDocument();

    const confirmDeleteButton = screen.getByRole("button", { name: "Xóa sản phẩm" });
    await userEvent.click(confirmDeleteButton);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/products/10"),
      expect.objectContaining({ method: "DELETE" })
    );
  });

  test("toggles export dropdown and handles platform export download", async () => {
    const locationMock = { href: "" };
    const originalLocation = window.location;
    delete (window as any).location;
    window.location = locationMock as any;

    render(
      <ProductList
        onAddProductClick={onAddProductClick}
        onEditProductClick={onEditProductClick}
        onCopyProductClick={onCopyProductClick}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Áo Polo thể thao nam thoáng khí")).toBeInTheDocument();
    });

    const exportBtn = screen.getByRole("button", { name: /Xuất dữ liệu/i });
    await userEvent.click(exportBtn);

    expect(screen.getByText(/Xuất file Shopee/i)).toBeInTheDocument();
    expect(screen.getByText(/Xuất file TikTok/i)).toBeInTheDocument();

    const shopeeBtn = screen.getByText(/Xuất file Shopee/i);
    await userEvent.click(shopeeBtn);

    expect(locationMock.href).toContain("/api/export/shopee?status=Published");

    window.location = originalLocation;
  });

  test("detailed bulk selection checkbox integration and filtered export", async () => {
    const locationMock = { href: "" };
    const originalLocation = window.location;
    delete (window as any).location;
    window.location = locationMock as any;

    render(
      <ProductList
        onAddProductClick={onAddProductClick}
        onEditProductClick={onEditProductClick}
        onCopyProductClick={onCopyProductClick}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Áo Polo thể thao nam thoáng khí")).toBeInTheDocument();
    });

    expect(screen.queryByText(/Đã chọn/i)).not.toBeInTheDocument();

    const checkboxes = screen.getAllByRole("checkbox");
    await userEvent.click(checkboxes[1]);

    expect(screen.getByText(/Đã chọn 1 sản phẩm/i)).toBeInTheDocument();

    const exportBtn = screen.getByRole("button", { name: /Xuất dữ liệu/i });
    await userEvent.click(exportBtn);

    const shopeeBtn = screen.getByText(/Xuất file Shopee/i);
    await userEvent.click(shopeeBtn);

    expect(locationMock.href).toContain("/api/export/shopee?status=Published&product_ids=10");

    await userEvent.click(checkboxes[0]);
    expect(screen.queryByText(/Đã chọn/i)).not.toBeInTheDocument();

    window.location = originalLocation;
  });
});
