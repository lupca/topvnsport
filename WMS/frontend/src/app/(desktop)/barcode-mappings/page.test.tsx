import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, test, vi, beforeEach } from "vitest";
import BarcodeMappingsPage from "./page";

// Mock APP_SETTINGS
vi.mock("@/config/settings", () => ({
  APP_SETTINGS: {
    api: {
      baseUrl: "http://localhost:18102"
    }
  }
}));

// Mock MobileScanner (which is dynamically imported)
vi.mock("@/components/MobileScanner", () => {
  return {
    default: () => <div data-testid="mobile-scanner">Scanner Mock</div>
  };
});

// Mock popupService
vi.mock("@/components/ui/popupService", () => ({
  popupService: {
    alert: vi.fn(),
  },
  showConfirm: vi.fn(() => Promise.resolve(true))
}));

describe("BarcodeMappingsPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  test("renders cost and tax columns in the table", async () => {
    const mockMappings = [
      {
        id: 1,
        barcode: "8934567890123",
        barcode_type: "EAN-13",
        sku_code: "TEST-SKU",
        product_name: "Test Product",
        variant_name: "Red / M",
        image_url: null,
        created_at: "2026-07-14T22:00:00Z",
        cost_price: 50000,
        tax_rate: 10
      }
    ];

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockMappings)
    });

    render(<BarcodeMappingsPage />);

    // Wait for the mappings to load
    await waitFor(() => {
      expect(screen.getByText("TEST-SKU")).toBeInTheDocument();
    });

    // Check headers are present
    expect(screen.getByText("Giá Vốn (VND)")).toBeInTheDocument();
    expect(screen.getByText("Thuế (%)")).toBeInTheDocument();

    // Check mapping details are rendered
    expect(screen.getByText("50.000 đ")).toBeInTheDocument();
    expect(screen.getByText("10%")).toBeInTheDocument();
  });

  test("clicking sync button calls the products sync endpoint", async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([])
      }) // initial load
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: "success", message: "Đồng bộ thành công!" })
      }) // sync POST
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([])
      }); // reload after sync

    render(<BarcodeMappingsPage />);

    // Find and click the sync button
    const syncButton = screen.getByRole("button", { name: /đồng bộ từ pmi/i });
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:18102/products/sync",
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});
