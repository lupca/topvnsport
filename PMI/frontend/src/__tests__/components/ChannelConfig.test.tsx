import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach } from "vitest";
import { useForm, FormProvider } from "react-hook-form";
import ChannelConfig from "@/components/products/ChannelConfig";
import { fetchWithAuth } from "@/utils/apiClient";

// Mock fetchWithAuth
vi.mock("@/utils/apiClient", () => ({
  fetchWithAuth: vi.fn(),
  apiClient: {},
}));

const mockChannels = [
  { id: 1, code: "shopee_vn", name: "Shopee Vietnam" },
  { id: 2, code: "tiktok_shop", name: "TikTok Shop" }
];

const mockCategoryMappings = [
  { pim_category_id: 5, channel_category_code: "shopee_shirts_cat", channel_category_name: "Áo nam Shopee" }
];

const mockAttributeMappings = [
  { id: 101, channel_category_code: "shopee_shirts_cat", channel_attribute_name: "Thương hiệu sàn", channel_attribute_code: "brand_id" }
];

function Wrapper({ children, defaultValues = {} }: { children: React.ReactNode; defaultValues?: any }) {
  const methods = useForm({
    defaultValues: {
      category_id: 5,
      variants: [
        { tier_1_option: "Đỏ", tier_2_option: null, sku_code: "PA-01-DO", price: 100000, stock: 10 }
      ],
      channel_listings: [
        {
          channel_code: "shopee_vn",
          status: "Draft",
          title_override: "",
          description_override: "",
          attribute_values: [],
          variant_overrides: []
        }
      ],
      ...defaultValues,
    },
  });
  return <FormProvider {...methods}>{children}</FormProvider>;
}

describe("ChannelConfig", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.mocked(fetchWithAuth).mockImplementation((url: string) => {
      if (url.includes("/api/channels") && !url.includes("mappings")) {
        return Promise.resolve(mockChannels);
      }
      if (url.includes("/category-mappings")) {
        return Promise.resolve(mockCategoryMappings);
      }
      if (url.includes("/attribute-mappings")) {
        return Promise.resolve(mockAttributeMappings);
      }
      return Promise.reject(new Error("Unknown Mock API call " + url));
    });
  });

  test("shows loading state initially and renders channel name", async () => {
    render(
      <Wrapper>
        <ChannelConfig channelCode="shopee_vn" channelName="Shopee" />
      </Wrapper>
    );

    expect(screen.getByText("Đang tải cấu hình kênh Shopee...")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("Đang tải cấu hình kênh Shopee...")).not.toBeInTheDocument();
    });
  });

  test("renders active switch and fields when status is Published", async () => {
    render(
      <Wrapper defaultValues={{
        channel_listings: [
          {
            channel_code: "shopee_vn",
            status: "Published",
            title_override: "Áo thun Shopee cực đẹp",
            description_override: "Mô tả Shopee riêng",
            channel_product_id: "shopee_item_11",
            attribute_values: [],
            variant_overrides: []
          }
        ]
      }}>
        <ChannelConfig channelCode="shopee_vn" channelName="Shopee" />
      </Wrapper>
    );

    // Wait for fetching to finish
    await waitFor(() => {
      expect(screen.queryByText("Đang tải cấu hình kênh Shopee...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Niêm yết trên Shopee")).toBeInTheDocument();
    
    // Check overrides inputs
    expect(screen.getByDisplayValue("Áo thun Shopee cực đẹp")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Mô tả Shopee riêng")).toBeInTheDocument();
    expect(screen.getByDisplayValue("shopee_item_11")).toBeInTheDocument();

    // Check Category mapping status (resolved successfully)
    expect(screen.getByText(/Đã tự động khớp danh mục:/)).toBeInTheDocument();
    expect(screen.getByText("Áo nam Shopee")).toBeInTheDocument();

    // Check Attributes section and input (need waitFor for attribute sync effect)
    await waitFor(() => {
      expect(screen.getByText("Thuộc tính đặc thù sàn")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Nhập Thương hiệu sàn")).toBeInTheDocument();
    });
  });

  test("shows warning if category mapping is not found", async () => {
    // category_id is 99 (not mapped)
    render(
      <Wrapper defaultValues={{
        category_id: 99,
        channel_listings: [
          {
            channel_code: "shopee_vn",
            status: "Published",
            title_override: "",
            description_override: "",
            attribute_values: [],
            variant_overrides: []
          }
        ]
      }}>
        <ChannelConfig channelCode="shopee_vn" channelName="Shopee" />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.queryByText("Đang tải cấu hình kênh Shopee...")).not.toBeInTheDocument();
    });

    expect(screen.getByText(/Ngành hàng gốc của sản phẩm chưa được cấu hình ánh xạ sang Shopee/)).toBeInTheDocument();
  });

  test("allows switching status toggle", async () => {
    let formMethods: any;
    function HelperWrapper({ children }: { children: React.ReactNode }) {
      const methods = useForm({
        defaultValues: {
          category_id: 5,
          variants: [],
          channel_listings: [
            { channel_code: "shopee_vn", status: "Draft", title_override: "", description_override: "", attribute_values: [], variant_overrides: [] }
          ]
        }
      });
      formMethods = methods;
      return <FormProvider {...methods}>{children}</FormProvider>;
    }

    render(
      <HelperWrapper>
        <ChannelConfig channelCode="shopee_vn" channelName="Shopee" />
      </HelperWrapper>
    );

    await waitFor(() => {
      expect(screen.queryByText("Đang tải cấu hình kênh Shopee...")).not.toBeInTheDocument();
    });

    const activeToggle = screen.getByRole("checkbox");
    expect(activeToggle).not.toBeChecked();

    await userEvent.click(activeToggle);
    expect(formMethods.getValues("channel_listings.0.status")).toBe("Published");
  });
});
