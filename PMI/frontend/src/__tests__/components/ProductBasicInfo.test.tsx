import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach } from "vitest";
import { useForm, FormProvider } from "react-hook-form";
import ProductBasicInfo from "@/components/products/ProductBasicInfo";
import { apiClient } from "@/utils/apiClient";

// Mock the apiClient post method
vi.mock("@/utils/apiClient", () => ({
  apiClient: {
    post: vi.fn(),
  },
  fetchWithAuth: vi.fn(),
}));

const mockCategories = [
  { id: 1, parent_id: null, name: "Áo thun nam", code: "TSHIRT" },
  { id: 2, parent_id: null, name: "Quần thể thao", code: "PANTS" },
];

const mockFamilies = [
  { id: 1, name: "Quần áo", code: "CLOTHING" },
  { id: 2, name: "Giày dép", code: "SHOES" },
];

function Wrapper({ children, defaultValues = {} }: { children: React.ReactNode; defaultValues?: any }) {
  const methods = useForm({
    defaultValues: {
      name: "",
      product_code: "",
      category_id: 0,
      family_id: 0,
      description: "",
      ...defaultValues,
    },
  });
  return <FormProvider {...methods}>{children}</FormProvider>;
}

describe("ProductBasicInfo", () => {
  const setCoverImage = vi.fn();
  const setProductImages = vi.fn();
  const setUploadingCover = vi.fn();
  const setUploadingGallery = vi.fn();
  const setProductCodeManuallyEdited = vi.fn();

  const defaultProps = {
    categories: [] as any[],
    families: [] as any[],
    coverImage: null as string | null,
    setCoverImage,
    productImages: [] as string[],
    setProductImages,
    uploadingCover: false,
    setUploadingCover,
    uploadingGallery: false,
    setUploadingGallery,
    productCodeManuallyEdited: false,
    setProductCodeManuallyEdited,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("renders all basic information input fields", () => {
    render(
      <Wrapper>
        <ProductBasicInfo {...defaultProps} categories={mockCategories} families={mockFamilies} />
      </Wrapper>
    );

    expect(screen.getByText("Thông tin cơ bản")).toBeInTheDocument();
    expect(screen.getByText("Tên sản phẩm *")).toBeInTheDocument();
    expect(screen.getByText("Mã SKU sản phẩm cha *")).toBeInTheDocument();
    expect(screen.getByText("Ngành hàng *")).toBeInTheDocument();
    expect(screen.getByText("Attribute Family *")).toBeInTheDocument();
    expect(screen.getByText("Mô tả sản phẩm *")).toBeInTheDocument();
  });

  test("displays categories and families correctly in selects", () => {
    render(
      <Wrapper>
        <ProductBasicInfo {...defaultProps} categories={mockCategories} families={mockFamilies} />
      </Wrapper>
    );

    const selects = screen.getAllByRole("combobox");
    const categorySelect = selects[0];
    expect(categorySelect).toBeInTheDocument();
    expect(screen.getByText("Áo thun nam (TSHIRT)")).toBeInTheDocument();
    expect(screen.getByText("Quần thể thao (PANTS)")).toBeInTheDocument();

    const familySelect = selects[1];
    expect(familySelect).toBeInTheDocument();
    expect(screen.getByText("Quần áo (CLOTHING)")).toBeInTheDocument();
    expect(screen.getByText("Giày dép (SHOES)")).toBeInTheDocument();
  });

  test("renders cover image and handles deletion click", async () => {
    render(
      <Wrapper>
        <ProductBasicInfo {...defaultProps} categories={mockCategories} families={mockFamilies} coverImage="http://localhost:19005/bucket/cover.jpg" />
      </Wrapper>
    );

    const coverImg = screen.getByRole("img", { name: /Cover/ });
    expect(coverImg).toBeInTheDocument();
    expect(coverImg).toHaveAttribute("src", "http://localhost:19005/bucket/cover.jpg");

    const deleteBtn = screen.getByRole("button", { name: /Thay đổi/ });
    await userEvent.click(deleteBtn);
    expect(setCoverImage).toHaveBeenCalledWith(null);
  });

  test("renders gallery images and handles deletion click", async () => {
    const images = ["http://localhost:19005/img1.jpg", "http://localhost:19005/img2.jpg"];
    render(
      <Wrapper>
        <ProductBasicInfo {...defaultProps} categories={mockCategories} families={mockFamilies} productImages={images} />
      </Wrapper>
    );

    expect(screen.getByRole("img", { name: /Gallery 1/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Gallery 2/ })).toBeInTheDocument();

    const deleteBtns = screen.getAllByRole("button", { name: /Xóa/ });
    expect(deleteBtns.length).toBe(2);

    await userEvent.click(deleteBtns[0]);
    // The state updater is called
    expect(setProductImages).toHaveBeenCalled();
  });

  test("triggers cover image upload", async () => {
    vi.spyOn(window, "location", "get").mockReturnValue({
      protocol: "http:",
      hostname: "localhost",
    } as Location);

    vi.mocked(apiClient.post).mockResolvedValue({ image_url: "http://minio:9000/bucket/cover.jpg" });

    render(
      <Wrapper>
        <ProductBasicInfo {...defaultProps} categories={mockCategories} families={mockFamilies} />
      </Wrapper>
    );

    const file = new File(["dummy content"], "cover.png", { type: "image/png" });
    const label = screen.getByText("Tải ảnh bìa").closest("label")!;
    const fileInput = label.querySelector('input[type="file"]')!;
    
    // Simulate file input change
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(setUploadingCover).toHaveBeenCalledWith(true);
      expect(apiClient.post).toHaveBeenCalledWith("/upload", expect.any(FormData));
      expect(setCoverImage).toHaveBeenCalledWith("http://localhost:19005/bucket/cover.jpg");
      expect(setUploadingCover).toHaveBeenCalledWith(false);
    });
  });
});
