import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach } from "vitest";

const {
  mockPush,
  mockGetPromotionById,
  mockActivatePromotion,
  mockPausePromotion,
  mockResumePromotion,
  mockEndPromotion,
  mockDeletePromotion,
  mockPreviewPromotion,
  mockAlert,
  mockConfirm,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockGetPromotionById: vi.fn(),
  mockActivatePromotion: vi.fn(),
  mockPausePromotion: vi.fn(),
  mockResumePromotion: vi.fn(),
  mockEndPromotion: vi.fn(),
  mockDeletePromotion: vi.fn(),
  mockPreviewPromotion: vi.fn(),
  mockAlert: vi.fn(),
  mockConfirm: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => "/promotions/p1",
}));

vi.mock("@/services/promotionApi", () => ({
  getPromotionById: mockGetPromotionById,
  activatePromotion: mockActivatePromotion,
  pausePromotion: mockPausePromotion,
  resumePromotion: mockResumePromotion,
  endPromotion: mockEndPromotion,
  deletePromotion: mockDeletePromotion,
  previewPromotion: mockPreviewPromotion,
}));

vi.mock("@/components/ui/popupService", () => ({
  popupService: {
    alert: mockAlert,
    confirm: mockConfirm,
  },
}));

import PromotionDetail from "@/components/promotions/PromotionDetail";
import { Promotion, PreviewResponse } from "@/types/promotion";

const sampleDetail: Promotion = {
  id: "p1",
  code: "SUMMER2026",
  name: "Khuyến mãi Chào Hè TopVNSport",
  description: "Giảm giá toàn bộ trang phục thể thao mùa hè",
  discount_type: "PERCENTAGE",
  discount_value: 20,
  max_discount: 100000,
  priority: 15,
  status: "DRAFT",
  starts_at: "2026-06-01T00:00:00Z",
  ends_at: "2026-08-31T23:59:59Z",
  intent: "Giảm 20% cho đồ thể thao nam",
  ai_reasoning: "Tối ưu doanh số mùa hè",
  affected_variants_count: 25,
  scopes: [
    { scope_type: "CATEGORY", target_id: "CAT-FOOTWEAR", is_exclusion: false },
    { scope_type: "PRODUCT", target_id: "PROD-OLD-1", is_exclusion: true },
  ],
};

const samplePreview: PreviewResponse = {
  affected_variants_count: 25,
  total_discount_amount: 1250000,
  sample_variants: [
    {
      variant_id: "v1",
      sku_code: "NIKE-PEGASUS-40",
      product_name: "Giày Chạy Bộ Nike Pegasus 40",
      original_price: 3000000,
      computed_price: 2400000,
      discount_amount: 600000,
      percentage_discount: 20,
    },
  ],
};

describe("PromotionDetail Component Empirical Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPromotionById.mockResolvedValue(sampleDetail);
    mockPreviewPromotion.mockResolvedValue(samplePreview);
    mockActivatePromotion.mockResolvedValue({ ...sampleDetail, status: "ACTIVE" });
    mockPausePromotion.mockResolvedValue({ ...sampleDetail, status: "PAUSED" });
    mockResumePromotion.mockResolvedValue({ ...sampleDetail, status: "ACTIVE" });
    mockEndPromotion.mockResolvedValue({ ...sampleDetail, status: "ENDED" });
    mockDeletePromotion.mockResolvedValue({ message: "Deleted" });
    mockConfirm.mockResolvedValue(true);
  });

  test("1. Renders promotion header, status badge, and summary stats", async () => {
    render(<PromotionDetail id="p1" />);

    await waitFor(() => {
      expect(screen.getByText("SUMMER2026")).toBeInTheDocument();
      expect(screen.getByText("Khuyến mãi Chào Hè TopVNSport")).toBeInTheDocument();
      expect(screen.getByText("Bản nháp")).toBeInTheDocument();
      expect(screen.getByText("25")).toBeInTheDocument(); // affected count
      expect(screen.getByText("15")).toBeInTheDocument(); // priority
    });
  });

  test("2. Displays Overview tab content correctly", async () => {
    render(<PromotionDetail id="p1" />);

    await waitFor(() => {
      expect(screen.getByText("Chi tiết thông số khuyến mãi")).toBeInTheDocument();
      expect(screen.getByText("PERCENTAGE")).toBeInTheDocument();
      expect(screen.getByText("-20%")).toBeInTheDocument();
      expect(screen.getByText("Giảm giá toàn bộ trang phục thể thao mùa hè")).toBeInTheDocument();
      expect(screen.getByText(/"Giảm 20% cho đồ thể thao nam"/)).toBeInTheDocument();
    });
  });

  test("3. Switches to Scopes & Exclusions tab and renders scope rules", async () => {
    render(<PromotionDetail id="p1" />);

    await waitFor(() => {
      expect(screen.getByText("SUMMER2026")).toBeInTheDocument();
    });

    const scopesTabBtn = screen.getByRole("button", { name: /Phạm vi & Loại trừ/i });
    await userEvent.click(scopesTabBtn);

    await waitFor(() => {
      expect(screen.getByText("CAT-FOOTWEAR")).toBeInTheDocument();
      expect(screen.getByText("PROD-OLD-1")).toBeInTheDocument();
      expect(screen.getByText("Bao gồm (Inclusion)")).toBeInTheDocument();
      expect(screen.getByText("Loại trừ (Exclusion)")).toBeInTheDocument();
    });
  });

  test("4. Switches to Affected Variants tab and renders calculated prices table", async () => {
    render(<PromotionDetail id="p1" />);

    await waitFor(() => {
      expect(screen.getByText("SUMMER2026")).toBeInTheDocument();
    });

    const variantsTabBtn = screen.getByRole("button", { name: /Biến thể áp dụng/i });
    await userEvent.click(variantsTabBtn);

    await waitFor(() => {
      expect(screen.getByText("NIKE-PEGASUS-40")).toBeInTheDocument();
      expect(screen.getByText("Giày Chạy Bộ Nike Pegasus 40")).toBeInTheDocument();
      expect(screen.getByText("3.000.000đ")).toBeInTheDocument();
      expect(screen.getByText("2.400.000đ")).toBeInTheDocument();
      expect(screen.getByText("-20%")).toBeInTheDocument();
    });
  });

  test("5. Triggers Activate lifecycle action", async () => {
    render(<PromotionDetail id="p1" />);

    await waitFor(() => {
      expect(screen.getByText("Kích hoạt")).toBeInTheDocument();
    });

    const activateBtn = screen.getByRole("button", { name: /Kích hoạt/i });
    await userEvent.click(activateBtn);

    await waitFor(() => {
      expect(mockActivatePromotion).toHaveBeenCalledWith("p1");
    });
  });

  test("6. Triggers Pause and Resume lifecycle actions for ACTIVE/PAUSED promotions", async () => {
    mockGetPromotionById.mockResolvedValue({ ...sampleDetail, status: "ACTIVE" });

    render(<PromotionDetail id="p1" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Tạm dừng/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /Tạm dừng/i }));
    expect(mockPausePromotion).toHaveBeenCalledWith("p1");

    // Test PAUSED state
    mockGetPromotionById.mockResolvedValue({ ...sampleDetail, status: "PAUSED" });
    
    // Render new component instance with PAUSED promotion
    render(<PromotionDetail id="p1" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Tiếp tục/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /Tiếp tục/i }));
    expect(mockResumePromotion).toHaveBeenCalledWith("p1");
  });

  test("7. Triggers End and Delete lifecycle actions with confirm prompt", async () => {
    mockGetPromotionById.mockResolvedValue({ ...sampleDetail, status: "ACTIVE" });

    render(<PromotionDetail id="p1" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Kết thúc/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /Kết thúc/i }));
    expect(mockConfirm).toHaveBeenCalled();
    expect(mockEndPromotion).toHaveBeenCalledWith("p1");

    const deleteBtn = screen.getByTitle("Xóa khuyến mãi");
    await userEvent.click(deleteBtn);
    expect(mockDeletePromotion).toHaveBeenCalledWith("p1");
    expect(mockPush).toHaveBeenCalledWith("/promotions");
  });

  test("8. Renders error message when promotion detail fails to load", async () => {
    mockGetPromotionById.mockRejectedValueOnce(new Error("Khuyến mãi không tồn tại"));

    render(<PromotionDetail id="non-existent" />);

    await waitFor(() => {
      expect(screen.getByText("Không thể tải thông tin")).toBeInTheDocument();
      expect(screen.getByText("Khuyến mãi không tồn tại")).toBeInTheDocument();
    });
  });
});
