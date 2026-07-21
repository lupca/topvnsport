import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach } from "vitest";
import { useForm, FormProvider } from "react-hook-form";
import ProductVariations from "@/components/products/ProductVariations";
import { apiClient } from "@/utils/apiClient";

vi.mock("@/utils/apiClient", () => ({
  apiClient: {
    post: vi.fn(),
  },
  fetchWithAuth: vi.fn(),
}));

function Wrapper({ children, defaultValues = {} }: { children: React.ReactNode; defaultValues?: any }) {
  const methods = useForm({
    defaultValues: {
      product_code: "PROD-PARENT",
      tier_variations: [],
      variants: [],
      ...defaultValues,
    },
  });
  return <FormProvider {...methods}>{children}</FormProvider>;
}

describe("ProductVariations", () => {
  const setTier1Images = vi.fn();
  const setUploadingTier1 = vi.fn();
  const setBulkPrice = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("renders sale information panel and show support message", () => {
    render(
      <Wrapper>
        <ProductVariations
          tier1Images={{}}
          setTier1Images={setTier1Images}
          uploadingTier1={{}}
          setUploadingTier1={setUploadingTier1}
          bulkPrice=""
          setBulkPrice={setBulkPrice}
        />
      </Wrapper>
    );

    expect(screen.getByText("Thông tin bán hàng")).toBeInTheDocument();
    expect(screen.getByText("Hỗ trợ tối đa 2 nhóm phân loại")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Thêm nhóm phân loại hàng/ })).toBeInTheDocument();
  });

  test("adds a tier variation group on click", async () => {
    render(
      <Wrapper>
        <ProductVariations
          tier1Images={{}}
          setTier1Images={setTier1Images}
          uploadingTier1={{}}
          setUploadingTier1={setUploadingTier1}
          bulkPrice=""
          setBulkPrice={setBulkPrice}
        />
      </Wrapper>
    );

    const addButton = screen.getByRole("button", { name: /Thêm nhóm phân loại hàng/ });
    await userEvent.click(addButton);

    expect(screen.getByText("Tên nhóm phân loại 1")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ví dụ: Màu sắc")).toBeInTheDocument();
  });

  test("renders variation table rows when variants are provided in defaultValues", () => {
    const defaultValues = {
      tier_variations: [
        { tier_index: 1, name: "Màu sắc", options: ["Đỏ", "Xanh"] }
      ],
      variants: [
        { tier_1_option: "Đỏ", tier_2_option: null, sku_code: "PROD-PARENT-DO", barcode: "123", price: 100000 },
        { tier_1_option: "Xanh", tier_2_option: null, sku_code: "PROD-PARENT-XANH", barcode: "456", price: 110000 }
      ]
    };

    render(
      <Wrapper defaultValues={defaultValues}>
        <ProductVariations
          tier1Images={{}}
          setTier1Images={setTier1Images}
          uploadingTier1={{}}
          setUploadingTier1={setUploadingTier1}
          bulkPrice=""
          setBulkPrice={setBulkPrice}
        />
      </Wrapper>
    );

    // Checks header
    expect(screen.getByText("Màu sắc")).toBeInTheDocument();
    expect(screen.getByText("Mã vạch (Barcode)")).toBeInTheDocument();
    
    // Checks options in cells
    expect(screen.getAllByText("Đỏ").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Xanh").length).toBeGreaterThan(0);

    // Check inputs are rendered with default values
    const priceInputs = screen.getAllByRole("spinbutton");
    expect(priceInputs.length).toBe(3);
  });

  test("triggers mass apply logic when bulk values are entered and clicked", async () => {
    // We will render with custom wrapper that exposes the react-hook-form state
    let formMethods: any;
    
    function HelperWrapper({ children }: { children: React.ReactNode }) {
      const methods = useForm({
        defaultValues: {
          product_code: "PROD-PARENT",
          tier_variations: [
            { tier_index: 1, name: "Màu sắc", options: ["Đỏ", "Xanh"] }
          ],
          variants: [
            { tier_1_option: "Đỏ", tier_2_option: null, sku_code: "PROD-PARENT-DO", barcode: "", price: 0 },
            { tier_1_option: "Xanh", tier_2_option: null, sku_code: "PROD-PARENT-XANH", barcode: "", price: 0 }
          ]
        }
      });
      formMethods = methods;
      return <FormProvider {...methods}>{children}</FormProvider>;
    }

    render(
      <HelperWrapper>
        <ProductVariations
          tier1Images={{}}
          setTier1Images={setTier1Images}
          uploadingTier1={{}}
          setUploadingTier1={setUploadingTier1}
          bulkPrice="150000"
          setBulkPrice={setBulkPrice}
        />
      </HelperWrapper>
    );

    const applyButton = screen.getByRole("button", { name: "Áp dụng cho tất cả" });
    await userEvent.click(applyButton);

    await waitFor(() => {
      const updatedVariants = formMethods.getValues("variants");
      expect(updatedVariants[0].price).toBe(150000);
      expect(updatedVariants[1].price).toBe(150000);
    });
  });

  test("triggers option image upload correctly for tier 1 option", async () => {
    vi.spyOn(window, "location", "get").mockReturnValue({
      protocol: "http:",
      hostname: "localhost",
    } as Location);

    vi.mocked(apiClient.post).mockResolvedValue({ image_url: "http://minio:9000/bucket/red.png" });

    const defaultValues = {
      tier_variations: [
        { tier_index: 1, name: "Màu sắc", options: ["Đỏ"] }
      ],
      variants: [
        { tier_1_option: "Đỏ", tier_2_option: null, sku_code: "PROD-PARENT-DO", barcode: "", price: 100 }
      ]
    };

    render(
      <Wrapper defaultValues={defaultValues}>
        <ProductVariations
          tier1Images={{}}
          setTier1Images={setTier1Images}
          uploadingTier1={{}}
          setUploadingTier1={setUploadingTier1}
          bulkPrice=""
          setBulkPrice={setBulkPrice}
        />
      </Wrapper>
    );

    expect(screen.getByText("Hình ảnh cho phân loại thứ 1")).toBeInTheDocument();
    
    // Find the file input inside the file upload label for the option "Đỏ"
    // Since "Đỏ" is present in both table row and image upload span, we query all elements and filter for the one inside .bg-surface
    const container = screen.getAllByText("Đỏ").find(el => el.closest('.bg-surface'))?.closest("div");
    const fileInput = container!.querySelector('input[type="file"]')!;

    const file = new File(["dummy png"], "red.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(setUploadingTier1).toHaveBeenCalled();
      expect(apiClient.post).toHaveBeenCalledWith("/upload", expect.any(FormData));
      expect(setTier1Images).toHaveBeenCalled();
    });
  });
});
