import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach } from "vitest";

const {
  mockPush,
  mockGetPromotions,
  mockActivatePromotion,
  mockPausePromotion,
  mockResumePromotion,
  mockEndPromotion,
  mockDeletePromotion,
  mockAlert,
  mockConfirm,
} = vi.hoisted(() => ({
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

let currentPathname = "/promotions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => currentPathname,
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
import Sidebar from "@/components/layout/Sidebar";
import { Promotion } from "@/types/promotion";

const edgePromotions: Promotion[] = [
  {
    id: "p-ex1",
    code: "EXCLUSION_ONLY",
    name: "Chỉ Có Quy Tắc Loại Trừ",
    discount_type: "PERCENTAGE",
    discount_value: 15,
    max_discount: null,
    priority: 5,
    status: "SCHEDULED",
    starts_at: "2026-09-01T00:00:00Z",
    ends_at: null,
    scopes: [
      { scope_type: "CATEGORY", target_id: "CAT-99", is_exclusion: true },
    ],
  },
  {
    id: "p-ended",
    code: "ENDED_PROMO",
    name: "Khuyến Mãi Đã Kết Thúc",
    discount_type: "FIXED_AMOUNT",
    discount_value: 100000,
    priority: 1,
    status: "ENDED",
    starts_at: "2026-01-01T00:00:00Z",
    ends_at: "2026-02-01T00:00:00Z",
    scopes: [],
  },
];

describe("PromotionList & Sidebar Empirical Stress Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPromotions.mockResolvedValue({
      items: edgePromotions,
      total: edgePromotions.length,
      page: 1,
      limit: 10,
      pages: 1,
    });
    mockConfirm.mockResolvedValue(true);
  });

  test("1. Verify formatScope handles exclusion-only scope list", async () => {
    render(<PromotionList />);

    await waitFor(() => {
      expect(screen.getByText("EXCLUSION_ONLY")).toBeInTheDocument();
    });

    // Verify formatScope displays exclusion indicator when all scopes are exclusions
    expect(screen.getByText("Ngoại trừ: danh mục")).toBeInTheDocument();
  });

  test("2. Verify API error handling on Activate action failure", async () => {
    mockActivatePromotion.mockRejectedValueOnce(new Error("Lỗi kết nối CSDL"));
    render(<PromotionList />);

    await waitFor(() => {
      expect(screen.getByText("EXCLUSION_ONLY")).toBeInTheDocument();
    });

    const activateBtn = screen.getByTitle("Kích hoạt");
    await userEvent.click(activateBtn);

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith("Lỗi kích hoạt: Lỗi kết nối CSDL");
    });
  });

  test("3. Verify API error handling on Pause action failure", async () => {
    const activeItem: Promotion = { ...edgePromotions[0], id: "p-active", status: "ACTIVE" };
    mockGetPromotions.mockResolvedValueOnce({
      items: [activeItem],
      total: 1,
      page: 1,
      limit: 10,
      pages: 1,
    });
    mockPausePromotion.mockRejectedValueOnce(new Error("Không thể tạm dừng"));

    render(<PromotionList />);

    await waitFor(() => {
      expect(screen.getByTitle("Tạm dừng")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTitle("Tạm dừng"));

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith("Lỗi tạm dừng: Không thể tạm dừng");
    });
  });

  test("4. Verify API error handling on Delete action when confirm cancelled vs when API errors", async () => {
    render(<PromotionList />);

    await waitFor(() => {
      expect(screen.getByText("EXCLUSION_ONLY")).toBeInTheDocument();
    });

    // Case A: Confirm returns false -> Delete API is not called
    mockConfirm.mockResolvedValueOnce(false);
    const deleteBtns = screen.getAllByTitle("Xóa");
    await userEvent.click(deleteBtns[0]);
    expect(mockDeletePromotion).not.toHaveBeenCalled();

    // Case B: Confirm returns true, but delete API fails
    mockConfirm.mockResolvedValueOnce(true);
    mockDeletePromotion.mockRejectedValueOnce(new Error("Ràng buộc khoá ngoại"));
    await userEvent.click(deleteBtns[0]);

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith("Lỗi xóa: Ràng buộc khoá ngoại");
    });
  });

  test("5. Sidebar navigation renders 'Khuyến mãi' item and highlights when active", () => {
    currentPathname = "/promotions";
    const { rerender } = render(<Sidebar userRole="admin" />);

    const promoLink = screen.getByRole("link", { name: /Khuyến mãi/i });
    expect(promoLink).toBeInTheDocument();
    expect(promoLink).toHaveAttribute("href", "/promotions");
    expect(promoLink.className).toContain("bg-brand-primary");

    // Test sub-route /promotions/create
    currentPathname = "/promotions/create";
    rerender(<Sidebar userRole="admin" />);
    expect(screen.getByRole("link", { name: /Khuyến mãi/i }).className).toContain("bg-brand-primary");
  });

  test("6. Verify End action button triggers handleEnd with confirm and handles error", async () => {
    const activeItem: Promotion = { ...edgePromotions[0], id: "p-active", status: "ACTIVE" };
    mockGetPromotions.mockResolvedValueOnce({
      items: [activeItem],
      total: 1,
      page: 1,
      limit: 10,
      pages: 1,
    });
    mockEndPromotion.mockRejectedValueOnce(new Error("Lỗi kết thúc chương trình"));

    render(<PromotionList />);

    await waitFor(() => {
      expect(screen.getByTitle("Kết thúc")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTitle("Kết thúc"));

    expect(mockConfirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith("Lỗi kết thúc: Lỗi kết thúc chương trình");
    });
  });

  test("7. Verify pagination controls change page", async () => {
    mockGetPromotions.mockResolvedValue({
      items: edgePromotions,
      total: 25,
      page: 1,
      limit: 10,
      pages: 3,
    });

    render(<PromotionList />);

    await waitFor(() => {
      expect(screen.getByText("Trang 1 / 3")).toBeInTheDocument();
    });

    const nextBtn = screen.getByRole("button", { name: "Sau" });
    await userEvent.click(nextBtn);

    await waitFor(() => {
      expect(mockGetPromotions).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 })
      );
    });

    const prevBtn = screen.getByRole("button", { name: "Trước" });
    await userEvent.click(prevBtn);

    await waitFor(() => {
      expect(mockGetPromotions).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 })
      );
    });
  });
});

