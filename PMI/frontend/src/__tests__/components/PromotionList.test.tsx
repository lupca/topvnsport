import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach } from "vitest";

const { mockPush, mockGetPromotions, mockActivatePromotion, mockPausePromotion, mockResumePromotion, mockEndPromotion, mockDeletePromotion, mockAlert, mockConfirm } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockGetPromotions: vi.fn(),
  mockActivatePromotion: vi.fn(),
  mockPausePromotion: vi.fn(),
  mockResumePromotion: vi.fn(),
  mockEndPromotion: vi.fn(),
  mockDeletePromotion: vi.fn(),
  mockAlert: vi.fn(),
  mockConfirm: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => "/promotions",
}));

vi.mock("@/services/promotionApi", () => ({
  getPromotions: mockGetPromotions,
  activatePromotion: mockActivatePromotion,
  pausePromotion: mockPausePromotion,
  resumePromotion: mockResumePromotion,
  endPromotion: mockEndPromotion,
  deletePromotion: mockDeletePromotion,
}));

vi.mock("@/components/ui/popupService", () => ({
  popupService: {
    alert: mockAlert,
    confirm: mockConfirm,
  },
}));

import PromotionList from "@/components/promotions/PromotionList";
import { Promotion } from "@/types/promotion";

const samplePromotions: Promotion[] = [
  {
    id: "p1",
    code: "SUMMER2026",
    name: "Khuyến mãi Chào Hè",
    discount_type: "PERCENTAGE",
    discount_value: 20,
    max_discount: 100000,
    priority: 10,
    status: "ACTIVE",
    starts_at: "2026-06-01T00:00:00Z",
    ends_at: "2026-08-31T23:59:59Z",
    intent: "Giảm 20% cho đồ thể thao nam",
    scopes: [{ scope_type: "ALL", is_exclusion: false }],
  },
  {
    id: "p2",
    code: "DRAFT100",
    name: "Bản nháp Khuyến mãi Mùa Thu",
    discount_type: "FIXED_AMOUNT",
    discount_value: 50000,
    priority: 0,
    status: "DRAFT",
    scopes: [{ scope_type: "CATEGORY", target_id: "CAT-1", is_exclusion: false }],
  },
  {
    id: "p3",
    code: "PAUSED50",
    name: "Khuyến mãi Đã Tạm Dừng",
    discount_type: "FIXED_PRICE",
    discount_value: 200000,
    priority: 5,
    status: "PAUSED",
    scopes: [{ scope_type: "PRODUCT", target_id: "PROD-10", is_exclusion: false }],
  },
];

describe("PromotionList Component Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPromotions.mockResolvedValue({
      items: samplePromotions,
      total: samplePromotions.length,
      page: 1,
      limit: 10,
      pages: 1,
    });
    mockActivatePromotion.mockResolvedValue({ ...samplePromotions[1], status: "ACTIVE" });
    mockPausePromotion.mockResolvedValue({ ...samplePromotions[0], status: "PAUSED" });
    mockResumePromotion.mockResolvedValue({ ...samplePromotions[2], status: "ACTIVE" });
    mockEndPromotion.mockResolvedValue({ ...samplePromotions[0], status: "ENDED" });
    mockDeletePromotion.mockResolvedValue({ message: "Deleted" });
    mockConfirm.mockResolvedValue(true);
  });

  test("1. Renders promotion list table with data", async () => {
    render(<PromotionList />);

    expect(screen.getByText("Quản lý Khuyến mãi")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("SUMMER2026")).toBeInTheDocument();
      expect(screen.getByText("Khuyến mãi Chào Hè")).toBeInTheDocument();
      expect(screen.getByText("DRAFT100")).toBeInTheDocument();
      expect(screen.getByText("Bản nháp Khuyến mãi Mùa Thu")).toBeInTheDocument();
    });
  });

  test("2. Filters promotions by status tab", async () => {
    render(<PromotionList />);

    await waitFor(() => {
      expect(screen.getByText("SUMMER2026")).toBeInTheDocument();
    });

    const activeTabButton = screen.getByRole("button", { name: "Hoạt động" });
    await userEvent.click(activeTabButton);

    await waitFor(() => {
      expect(mockGetPromotions).toHaveBeenCalledWith(
        expect.objectContaining({ status: "ACTIVE" })
      );
    });
  });

  test("3. Filters promotions by search query input", async () => {
    render(<PromotionList />);

    await waitFor(() => {
      expect(screen.getByText("SUMMER2026")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Tìm theo mã hoặc tên/i);
    await userEvent.type(searchInput, "SUMMER");
    
    // Submit search form
    const searchForm = searchInput.closest("form")!;
    const event = new Event("submit", { bubbles: true, cancelable: true });
    searchForm.dispatchEvent(event);

    await waitFor(() => {
      expect(mockGetPromotions).toHaveBeenCalledWith(
        expect.objectContaining({ search: "SUMMER" })
      );
    });
  });

  test("4. Triggers Activate promotion lifecycle action", async () => {
    render(<PromotionList />);

    await waitFor(() => {
      expect(screen.getByText("DRAFT100")).toBeInTheDocument();
    });

    const activateButtons = screen.getAllByTitle("Kích hoạt");
    await userEvent.click(activateButtons[0]);

    await waitFor(() => {
      expect(mockActivatePromotion).toHaveBeenCalledWith("p2");
    });
  });

  test("5. Triggers Pause promotion lifecycle action", async () => {
    render(<PromotionList />);

    await waitFor(() => {
      expect(screen.getByText("SUMMER2026")).toBeInTheDocument();
    });

    const pauseButton = screen.getByTitle("Tạm dừng");
    await userEvent.click(pauseButton);

    await waitFor(() => {
      expect(mockPausePromotion).toHaveBeenCalledWith("p1");
    });
  });

  test("6. Triggers Resume promotion lifecycle action", async () => {
    render(<PromotionList />);

    await waitFor(() => {
      expect(screen.getByText("PAUSED50")).toBeInTheDocument();
    });

    const resumeButton = screen.getByTitle("Tiếp tục");
    await userEvent.click(resumeButton);

    await waitFor(() => {
      expect(mockResumePromotion).toHaveBeenCalledWith("p3");
    });
  });

  test("7. Triggers Delete promotion lifecycle action with confirm", async () => {
    render(<PromotionList />);

    await waitFor(() => {
      expect(screen.getByText("SUMMER2026")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle("Xóa");
    await userEvent.click(deleteButtons[0]);

    expect(mockConfirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(mockDeletePromotion).toHaveBeenCalledWith("p1");
    });
  });

  test("8. Renders empty list state when no promotions found", async () => {
    mockGetPromotions.mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
      pages: 1,
    });

    render(<PromotionList />);

    await waitFor(() => {
      expect(screen.getByText("Chưa có chương trình khuyến mãi nào.")).toBeInTheDocument();
    });
  });
});
