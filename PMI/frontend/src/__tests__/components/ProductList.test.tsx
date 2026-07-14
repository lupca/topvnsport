import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
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
    vi.clearAllMocks();

    mockFetchWithAuth.mockImplementation((url: string) => {
      if (/\/categories/.test(url)) {
        return Promise.resolve(mockCategories);
      }
      if (/\/products\/10\b/.test(url)) {
        return Promise.resolve(mockProductsData.items[0]);
      }
      if (/\/products/.test(url)) {
        return Promise.resolve(mockProductsData);
      }
      return Promise.resolve([]);
    });

    mockApiClient.delete.mockResolvedValue({ detail: "Deleted" });
    mockApiClient.post.mockResolvedValue({ success: true });
  });

  test("renders loading state initially", async () => {
    mockFetchWithAuth.mockImplementation(() => new Promise(() => {}));

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

    await waitFor(() => {
      expect(screen.getByText(/Áo Polo thể thao nam thoáng khí/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/P-10-PARENT/)).toBeInTheDocument();
  });

  test("calls pagination when page is clicked", async () => {
    const mockMultiPageData = {
      ...mockProductsData,
      total: 15,
      pages: 2
    };

    mockFetchWithAuth.mockImplementation((url: string) => {
      if (/\/categories/.test(url)) {
        return Promise.resolve(mockCategories);
      }
      return Promise.resolve(mockMultiPageData);
    });

    render(
      <ProductList
        onAddProductClick={onAddProductClick}
        onEditProductClick={onEditProductClick}
        onCopyProductClick={onCopyProductClick}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Áo Polo thể thao nam thoáng khí/i)).toBeInTheDocument();
    });

    const page2Button = screen.getByRole("button", { name: "2" });
    await userEvent.click(page2Button);

    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining("page=2")
      );
    });
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
      expect(screen.getByText(/Áo Polo thể thao nam thoáng khí/i)).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Tìm.*sản phẩm/i);
    await userEvent.type(searchInput, "Polo");

    const applyButton = screen.getByRole("button", { name: "Áp dụng" });
    await userEvent.click(applyButton);

    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining("q=Polo")
      );
    });

    const resetButton = screen.getByRole("button", { name: /đặt lại/i });
    await userEvent.click(resetButton);

    await waitFor(() => {
      const lastCall = mockFetchWithAuth.mock.calls[mockFetchWithAuth.mock.calls.length - 1][0];
      expect(lastCall).not.toContain("q=Polo");
    });
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
      expect(screen.getByText(/Áo Polo thể thao nam thoáng khí/i)).toBeInTheDocument();
    });

    const categorySelect = screen.getAllByRole("combobox")[0];
    await userEvent.selectOptions(categorySelect, "2");

    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining("category_id=2")
      );
    });
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
      expect(screen.getByText(/Áo Polo thể thao nam thoáng khí/i)).toBeInTheDocument();
    });

    const previewButton = screen.getByRole("button", { name: /Xem trước/i });
    await userEvent.click(previewButton);

    await waitFor(() => {
      expect(screen.getByText(/Trắng/)).toBeInTheDocument();
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
      expect(screen.getByText(/Áo Polo thể thao nam thoáng khí/i)).toBeInTheDocument();
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
    render(
      <ProductList
        onAddProductClick={onAddProductClick}
        onEditProductClick={onEditProductClick}
        onCopyProductClick={onCopyProductClick}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Áo Polo thể thao nam thoáng khí/i)).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole("button", { name: /^Xóa$/i });
    await userEvent.click(deleteButton);

    expect(screen.getByText(/Xác nhận xóa/i)).toBeInTheDocument();

    const confirmDeleteButton = screen.getByRole("button", { name: /Xóa sản phẩm/i });
    await userEvent.click(confirmDeleteButton);

    expect(mockApiClient.delete).toHaveBeenCalledWith(
      expect.stringContaining("/products/10")
    );
  });

  test("toggles export dropdown and handles platform export download", async () => {
    const mockBlob = new Blob(["test"], { type: "text/csv" });
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (/\/categories/.test(url)) {
        return Promise.resolve(mockCategories);
      }
      if (/\/products/.test(url)) {
        return Promise.resolve(mockProductsData);
      }
      if (/\/export\//.test(url)) {
        return Promise.resolve({
          blob: () => Promise.resolve(mockBlob),
          headers: new Headers({ "content-type": "text/csv" })
        });
      }
      return Promise.resolve([]);
    });

    render(
      <ProductList
        onAddProductClick={onAddProductClick}
        onEditProductClick={onEditProductClick}
        onCopyProductClick={onCopyProductClick}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Áo Polo thể thao nam thoáng khí/i)).toBeInTheDocument();
    });

    const exportBtn = screen.getByRole("button", { name: /Xuất dữ liệu/i });
    await userEvent.click(exportBtn);

    expect(screen.getByText(/Xuất.*Shopee/i)).toBeInTheDocument();
    expect(screen.getByText(/Xuất.*TikTok/i)).toBeInTheDocument();
  });

  test("detailed bulk selection checkbox integration and filtered export", async () => {
    render(
      <ProductList
        onAddProductClick={onAddProductClick}
        onEditProductClick={onEditProductClick}
        onCopyProductClick={onCopyProductClick}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Áo Polo thể thao nam thoáng khí/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/Đã chọn/i)).not.toBeInTheDocument();

    const checkboxes = screen.getAllByRole("checkbox");
    await userEvent.click(checkboxes[1]);

    expect(screen.getByText(/Đã chọn 1 sản phẩm/i)).toBeInTheDocument();
  });

  test("exports with correct status parameter when activeTab is not all", async () => {
    render(
      <ProductList
        onAddProductClick={onAddProductClick}
        onEditProductClick={onEditProductClick}
        onCopyProductClick={onCopyProductClick}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Áo Polo thể thao nam thoáng khí/i)).toBeInTheDocument();
    });

    const activeTabBtn = screen.getByRole("button", { name: /Đang hoạt động/i });
    await userEvent.click(activeTabBtn);

    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining("status=Published")
      );
    });
  });
});
