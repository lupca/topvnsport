import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach } from "vitest";

const {
  mockPush,
  mockCreatePromotion,
  mockUpdatePromotion,
  mockParsePromotionIntent,
  mockPreviewPromotion,
  mockAlert,
  mockConfirm,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockCreatePromotion: vi.fn(),
  mockUpdatePromotion: vi.fn(),
  mockParsePromotionIntent: vi.fn(),
  mockPreviewPromotion: vi.fn(),
  mockAlert: vi.fn(),
  mockConfirm: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => "/promotions/create",
}));

vi.mock("@/services/promotionApi", () => ({
  createPromotion: mockCreatePromotion,
  updatePromotion: mockUpdatePromotion,
  parsePromotionIntent: mockParsePromotionIntent,
  previewPromotion: mockPreviewPromotion,
}));

vi.mock("@/components/ui/popupService", () => ({
  popupService: {
    alert: mockAlert,
    confirm: mockConfirm,
  },
}));

import PromotionForm from "@/components/promotions/PromotionForm";
import { Promotion } from "@/types/promotion";

const initialEditData: Promotion = {
  id: "promo-123",
  code: "EDIT2026",
  name: "Chương trình chỉnh sửa",
  description: "Mô tả chỉnh sửa",
  discount_type: "PERCENTAGE",
  discount_value: 15,
  max_discount: 50000,
  priority: 5,
  status: "DRAFT",
  scopes: [{ scope_type: "CATEGORY", target_id: "CAT-99", is_exclusion: false }],
  starts_at: "2026-08-01T00:00:00.000Z",
  ends_at: "2026-08-31T23:59:59.000Z",
};

describe("PromotionForm Component Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockParsePromotionIntent.mockResolvedValue({
      name: "Khuyến mãi từ AI",
      code: "AIPROMO20",
      description: "Mô tả do AI tạo ra",
      discount_type: "PERCENTAGE",
      discount_value: 20,
      max_discount: 100000,
      priority: 10,
      scopes: [{ scope_type: "ALL", target_id: null, is_exclusion: false }],
      starts_at: "2026-08-01T00:00:00Z",
      ends_at: "2026-08-15T23:59:59Z",
      ai_reasoning: "Phân tích từ prompt giảm 20%",
    });

    mockPreviewPromotion.mockResolvedValue({
      affected_variants_count: 5,
      total_discount_amount: 150000,
      sample_variants: [
        {
          variant_id: "v1",
          product_name: "Áo Thể Thao Nam",
          sku_code: "AO-M-TRANG",
          original_price: 200000,
          computed_price: 160000,
          discount_amount: 40000,
          percentage_discount: 20,
        },
      ],
    });

    mockCreatePromotion.mockResolvedValue({ ...initialEditData, id: "new-promo-id" });
    mockUpdatePromotion.mockResolvedValue({ ...initialEditData });
  });

  test("1. Renders 4-step wizard form starting at Step 1", () => {
    render(<PromotionForm isEdit={false} />);

    expect(screen.getByText("Tạo chương trình Khuyến mãi mới")).toBeInTheDocument();
    expect(screen.getByText("Bước 1: Thông tin cơ bản & Ý tưởng AI")).toBeInTheDocument();
  });

  test("2. Validates Step 1 required fields when clicking Next", async () => {
    render(<PromotionForm isEdit={false} />);

    const nextButton = screen.getByRole("button", { name: /Tiếp tục/i });
    await userEvent.click(nextButton);

    expect(screen.getByText("Tên khuyến mãi không được để trống")).toBeInTheDocument();
    expect(screen.getByText("Mã khuyến mãi không được để trống")).toBeInTheDocument();
  });

  test("3. Triggers AI Intent parsing and populates form fields", async () => {
    render(<PromotionForm isEdit={false} />);

    const intentInput = screen.getByPlaceholderText(/Ví dụ: Giảm 20% tối đa/i);
    await userEvent.type(intentInput, "Giảm 20% cho áo thể thao");

    const parseBtn = screen.getByRole("button", { name: /Phân tích bằng AI/i });
    await userEvent.click(parseBtn);

    await waitFor(() => {
      expect(mockParsePromotionIntent).toHaveBeenCalledWith({ prompt: "Giảm 20% cho áo thể thao" });
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("Khuyến mãi từ AI")).toBeInTheDocument();
      expect(screen.getByDisplayValue("AIPROMO20")).toBeInTheDocument();
    });
  });

  test("4. Navigates step by step through 4 wizard steps", async () => {
    render(<PromotionForm isEdit={false} />);

    // Step 1 input
    const nameInput = screen.getByPlaceholderText(/Ví dụ: Giảm giá Chào Hè/i);
    const codeInput = screen.getByPlaceholderText(/Ví dụ: SUMMER2026/i);
    await userEvent.type(nameInput, "Chương trình Khuyến Mãi Test");
    await userEvent.type(codeInput, "TESTPROMO");

    // Go to Step 2
    const nextBtn = screen.getByRole("button", { name: /Tiếp tục/i });
    await userEvent.click(nextBtn);

    await waitFor(() => {
      expect(screen.getByText("Bước 2: Cấu hình loại và mức giảm giá")).toBeInTheDocument();
    });

    // Go to Step 3
    await userEvent.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    await waitFor(() => {
      expect(screen.getByText("Bước 3: Phạm vi áp dụng & Quy tắc loại trừ")).toBeInTheDocument();
    });

    // Go to Step 4
    await userEvent.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    await waitFor(() => {
      expect(screen.getByText("Bước 4: Thời gian hiệu lực & Xem trước tác động")).toBeInTheDocument();
    });
  });

  test("5. Manages scope additions in Step 3", async () => {
    render(<PromotionForm initialData={initialEditData} isEdit={true} />);

    // Jump to Step 3
    const step3Button = screen.getByText("Phạm vi & Loại trừ");
    await userEvent.click(step3Button);

    await waitFor(() => {
      expect(screen.getByText("Bước 3: Phạm vi áp dụng & Quy tắc loại trừ")).toBeInTheDocument();
    });

    const targetInput = screen.getByPlaceholderText(/Ví dụ: CAT-01/i);
    await userEvent.type(targetInput, "PROD-200");

    const addScopeBtn = screen.getByRole("button", { name: /Thêm quy tắc/i });
    await userEvent.click(addScopeBtn);

    await waitFor(() => {
      expect(screen.getByText("PROD-200")).toBeInTheDocument();
    });
  });

  test("6. Triggers live impact preview modal in Step 4", async () => {
    render(<PromotionForm initialData={initialEditData} isEdit={true} />);

    // Jump to Step 4
    const step4Button = screen.getByText("Lịch & Xem trước");
    await userEvent.click(step4Button);

    await waitFor(() => {
      expect(screen.getByText("Bước 4: Thời gian hiệu lực & Xem trước tác động")).toBeInTheDocument();
    });

    const previewBtn = screen.getByRole("button", { name: /Xem trước tác động/i });
    await userEvent.click(previewBtn);

    await waitFor(() => {
      expect(mockPreviewPromotion).toHaveBeenCalled();
      expect(screen.getByText("Xem trước tác động khuyến mãi")).toBeInTheDocument();
      expect(screen.getByText("Áo Thể Thao Nam")).toBeInTheDocument();
    });
  });

  test("7. Submits create promotion form successfully", async () => {
    render(<PromotionForm isEdit={false} />);

    // Fill Step 1
    await userEvent.type(screen.getByPlaceholderText(/Ví dụ: Giảm giá Chào Hè/i), "Khuyến mãi Mới 2026");
    await userEvent.type(screen.getByPlaceholderText(/Ví dụ: SUMMER2026/i), "NEWPROMO");

    // Navigate to Step 4
    const step4Button = screen.getByText("Lịch & Xem trước");
    await userEvent.click(step4Button);

    const submitBtn = screen.getByRole("button", { name: /Lưu khuyến mãi/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCreatePromotion).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Khuyến mãi Mới 2026",
          code: "NEWPROMO",
        })
      );
      expect(mockPush).toHaveBeenCalledWith("/promotions");
    });
  });

  test("8. Submits edit promotion form successfully", async () => {
    render(<PromotionForm initialData={initialEditData} isEdit={true} />);

    // Navigate to Step 4
    const step4Button = screen.getByText("Lịch & Xem trước");
    await userEvent.click(step4Button);

    const submitBtn = screen.getByRole("button", { name: /Cập nhật khuyến mãi/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockUpdatePromotion).toHaveBeenCalledWith(
        "promo-123",
        expect.objectContaining({
          name: "Chương trình chỉnh sửa",
          code: "EDIT2026",
        })
      );
      expect(mockPush).toHaveBeenCalledWith("/promotions");
    });
  });
});
