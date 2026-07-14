import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach } from "vitest";

import ChannelsPage from "@/app/settings/channels/page";
import ChannelDetailPage from "@/app/settings/channels/[code]/page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useParams: () => ({ code: "shopee_vn" }),
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@/components/ui/popupService", () => ({
  popupService: {
    alert: vi.fn(),
  },
  showConfirm: vi.fn().mockResolvedValue(true),
}));

const mockChannels = [
  { id: 1, code: "webstore", name: "Default Webstore" },
  { id: 2, code: "shopee_vn", name: "Shopee Vietnam" }
];

const mockConfig = {
  id: 10,
  channel_id: 2,
  app_key: "app_key_shopee",
  app_secret: "app_secret_shopee",
  access_token: "token_abc",
  refresh_token: "refresh_abc",
  is_active: true
};

const mockCategories = [
  { id: 1, parent_id: null, name: "Áo thun nam", code: "TSHIRT" }
];

const mockCategoryMappings = [
  { pim_category_id: 1, channel_category_code: "SH-TSHIRT", channel_category_name: "Áo nam Shopee" }
];

const mockPimAttributes = [
  { id: 10, name: "Chất liệu", code: "material" }
];

const mockAttributeMappings = [
  { id: 20, pim_attribute_id: 10, channel_category_code: null, channel_attribute_code: "ps_material", channel_attribute_name: "Chất liệu Shopee" }
];

describe("Channels settings UI", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/channels/2/config") || url.includes("/api/channels/1/config")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockConfig)
          });
        }
        if (url.includes("/api/channels/2/category-mappings")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockCategoryMappings)
          });
        }
        if (url.includes("/api/channels/2/attribute-mappings")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockAttributeMappings)
          });
        }
        if (url.includes("/api/channels/2")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({})
          });
        }
        if (url.includes("/api/channels")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockChannels)
          });
        }
        if (url.includes("/categories")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockCategories)
          });
        }
        if (url.includes("/attributes")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockPimAttributes)
          });
        }
        return Promise.reject(new Error("Unknown mock URL: " + url));
      })
    );
  });

  test("renders channels list page and lists channel cards", async () => {
    render(<ChannelsPage />);

    // Wait for channels to load and render - use findAllByText since text appears multiple times
    const webstoreElements = await screen.findAllByText(/Default Webstore/i);
    expect(webstoreElements.length).toBeGreaterThan(0);

    const shopeeElements = await screen.findAllByText(/Shopee Vietnam/i);
    expect(shopeeElements.length).toBeGreaterThan(0);
  });

  test("handles deleting a channel successfully", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");

    render(<ChannelsPage />);

    // Wait for channels to load
    const shopeeElements = await screen.findAllByText(/Shopee Vietnam/i);
    expect(shopeeElements.length).toBeGreaterThan(0);

    // Webstore should not have delete button, Shopee should have one
    const deleteButtons = screen.getAllByTitle(/Xóa kênh/i);
    expect(deleteButtons.length).toBe(1);

    await userEvent.click(deleteButtons[0]);

    // Should call DELETE method
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/api/channels/2"),
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  test("renders detail page and navigates tabs", async () => {
    render(<ChannelDetailPage />);

    // Renders header
    await waitFor(() => {
      expect(screen.getByText(/Cấu hình kênh.*Shopee Vietnam|Shopee Vietnam.*Config/i)).toBeInTheDocument();
    });

    // Default tab is General
    expect(await screen.findByText(/API Credentials|OAuth2/i)).toBeInTheDocument();

    // Click Category Mapping tab
    const catTabButton = screen.getByRole("button", { name: /Ánh xạ danh mục/i });
    await userEvent.click(catTabButton);

    await waitFor(() => {
      expect(screen.getByText(/Danh mục PIM|PIM.*Core/i)).toBeInTheDocument();
      expect(screen.getByText(/Áo thun nam/i)).toBeInTheDocument();
    });

    // Click Attribute Mapping tab
    const attrTabButton = screen.getByRole("button", { name: /Ánh xạ thuộc tính/i });
    await userEvent.click(attrTabButton);

    await waitFor(() => {
      expect(screen.getByText(/Cột sàn|Excel.*CSV/i)).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue(/ps_material/i)).toBeInTheDocument();
  });
});
