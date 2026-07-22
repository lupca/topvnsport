import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach } from "vitest";

const {
  mockPush,
  mockCreatePromotion,
  mockUpdatePromotion,
  mockParsePromotionIntent,
  mockPreviewPromotion,
  mockAlert,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockCreatePromotion: vi.fn(),
  mockUpdatePromotion: vi.fn(),
  mockParsePromotionIntent: vi.fn(),
  mockPreviewPromotion: vi.fn(),
  mockAlert: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/promotions/create",
}));

vi.mock("@/services/promotionApi", () => ({
  createPromotion: mockCreatePromotion,
  updatePromotion: mockUpdatePromotion,
  parsePromotionIntent: mockParsePromotionIntent,
  previewPromotion: mockPreviewPromotion,
}));

vi.mock("@/components/ui/popupService", () => ({
  popupService: { alert: mockAlert, confirm: vi.fn() },
}));

import PromotionForm from "@/components/promotions/PromotionForm";

describe("PromotionForm Empirical Stress & Edge Case Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("1. Validates Percentage discount <= 100%", async () => {
    render(<PromotionForm isEdit={false} />);

    // Step 1
    await userEvent.type(screen.getByPlaceholderText(/Ví dụ: Giảm giá Chào Hè/i), "Test Percentage 150%");
    await userEvent.type(screen.getByPlaceholderText(/Ví dụ: SUMMER2026/i), "OVER100");

    // Go to Step 2
    await userEvent.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    // Input discount value 150 (percentage)
    const inputs = screen.getAllByRole("spinbutton");
    await userEvent.clear(inputs[0]);
    await userEvent.type(inputs[0], "150");

    // Click Next
    await userEvent.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    // Form shows error and stays on Step 2
    await waitFor(() => {
      expect(screen.getByText("Phần trăm giảm giá không được vượt quá 100%")).toBeInTheDocument();
    });
    expect(screen.queryByText("Bước 3: Phạm vi áp dụng & Quy tắc loại trừ")).not.toBeInTheDocument();
  });

  test("2. Validates chronological date order (starts_at < ends_at)", async () => {
    const { container } = render(<PromotionForm isEdit={false} />);

    // Step 1
    await userEvent.type(screen.getByPlaceholderText(/Ví dụ: Giảm giá Chào Hè/i), "Test Bad Dates");
    await userEvent.type(screen.getByPlaceholderText(/Ví dụ: SUMMER2026/i), "BADDATE");

    // Jump to Step 4
    await userEvent.click(screen.getByText("Lịch & Xem trước"));

    const dateInputs = container.querySelectorAll('input[type="datetime-local"]');
    expect(dateInputs.length).toBe(2);

    // Set starts_at to Dec 31, 2026 and ends_at to Jan 01, 2026
    fireEvent.change(dateInputs[0], { target: { value: "2026-12-31T00:00" } });
    fireEvent.change(dateInputs[1], { target: { value: "2026-01-01T00:00" } });

    // Submit form
    const submitBtn = screen.getByRole("button", { name: /Lưu khuyến mãi/i });
    await userEvent.click(submitBtn);

    // Form shows date error and does not submit
    await waitFor(() => {
      expect(screen.getByText("Thời gian kết thúc phải lớn hơn thời gian bắt đầu")).toBeInTheDocument();
    });
    expect(mockCreatePromotion).not.toHaveBeenCalled();
  });

  test("3. Validates max_discount > 0 when discountType is PERCENTAGE", async () => {
    render(<PromotionForm isEdit={false} />);

    // Step 1
    await userEvent.type(screen.getByPlaceholderText(/Ví dụ: Giảm giá Chào Hè/i), "Test Negative Max Discount");
    await userEvent.type(screen.getByPlaceholderText(/Ví dụ: SUMMER2026/i), "NEGMAX");

    // Step 2
    await userEvent.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    const inputs = screen.getAllByRole("spinbutton");
    await userEvent.type(inputs[1], "-50000");

    // Click Next
    await userEvent.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    // Form shows error and stays on Step 2
    await waitFor(() => {
      expect(screen.getByText("Mức giảm tối đa phải là số > 0")).toBeInTheDocument();
    });
    expect(screen.queryByText("Bước 3: Phạm vi áp dụng & Quy tắc loại trừ")).not.toBeInTheDocument();
  });

  test("4. Scope exclusions in Step 3", async () => {
    const { container } = render(<PromotionForm isEdit={false} />);

    // Step 1
    await userEvent.type(screen.getByPlaceholderText(/Ví dụ: Giảm giá Chào Hè/i), "Test Scopes");
    await userEvent.type(screen.getByPlaceholderText(/Ví dụ: SUMMER2026/i), "SCOPES");

    // Jump to Step 3
    await userEvent.click(screen.getByText("Phạm vi & Loại trừ"));

    // Select Exclusion option
    const selects = container.querySelectorAll("select");
    fireEvent.change(selects[0], { target: { value: "CATEGORY" } });
    fireEvent.change(selects[1], { target: { value: "true" } }); // is_exclusion = true

    const targetInput = screen.getByPlaceholderText(/Ví dụ: CAT-01/i);
    await userEvent.type(targetInput, "EXCLUDE-CAT");

    const addBtn = screen.getByRole("button", { name: /Thêm quy tắc/i });
    await userEvent.click(addBtn);

    await waitFor(() => {
      expect(screen.getByText("EXCLUDE-CAT")).toBeInTheDocument();
      expect(screen.getByText("Loại trừ (Exclusion)")).toBeInTheDocument();
    });
  });

  test("5. Error handling when AI Intent Parser API fails", async () => {
    render(<PromotionForm isEdit={false} />);

    const intentInput = screen.getByPlaceholderText(/Ví dụ: Giảm 20% tối đa/i);
    await userEvent.type(intentInput, "Prompt error test");

    mockParsePromotionIntent.mockRejectedValueOnce(new Error("AI Service Timeout"));
    const parseBtn = screen.getByRole("button", { name: /Phân tích bằng AI/i });
    await userEvent.click(parseBtn);

    await waitFor(() => {
      expect(screen.getByText("Không thể phân tích prompt: AI Service Timeout")).toBeInTheDocument();
    });
  });

  test("6. Error handling when Live Preview API fails", async () => {
    render(<PromotionForm isEdit={false} />);

    // Fill Step 1
    await userEvent.type(screen.getByPlaceholderText(/Ví dụ: Giảm giá Chào Hè/i), "Test Preview Error");
    await userEvent.type(screen.getByPlaceholderText(/Ví dụ: SUMMER2026/i), "PREVERR");

    // Jump to Step 4
    await userEvent.click(screen.getByText("Lịch & Xem trước"));

    mockPreviewPromotion.mockRejectedValueOnce(new Error("Preview Calculation Error"));
    const previewBtn = screen.getByRole("button", { name: /Xem trước tác động/i });
    await userEvent.click(previewBtn);

    await waitFor(() => {
      expect(screen.getByText("Preview Calculation Error")).toBeInTheDocument();
    });
  });

  test("7. Step Navigation Back & Stepper clicks", async () => {
    render(<PromotionForm isEdit={false} />);

    // Step 1 inputs
    await userEvent.type(screen.getByPlaceholderText(/Ví dụ: Giảm giá Chào Hè/i), "Test Nav");
    await userEvent.type(screen.getByPlaceholderText(/Ví dụ: SUMMER2026/i), "NAV2026");

    // Go to Step 2
    await userEvent.click(screen.getByRole("button", { name: /Tiếp tục/i }));
    await waitFor(() => expect(screen.getByText("Bước 2: Cấu hình loại và mức giảm giá")).toBeInTheDocument());

    // Click Back button
    await userEvent.click(screen.getByRole("button", { name: /Quay lại/i }));
    await waitFor(() => expect(screen.getByText("Bước 1: Thông tin cơ bản & Ý tưởng AI")).toBeInTheDocument());
  });

  test("8. Submit API error handles alert popup", async () => {
    mockCreatePromotion.mockRejectedValueOnce(new Error("Database Connection Failure"));
    render(<PromotionForm isEdit={false} />);

    // Fill Step 1
    await userEvent.type(screen.getByPlaceholderText(/Ví dụ: Giảm giá Chào Hè/i), "Test Submit Error");
    await userEvent.type(screen.getByPlaceholderText(/Ví dụ: SUMMER2026/i), "SUBERR");

    // Jump to Step 4
    await userEvent.click(screen.getByText("Lịch & Xem trước"));

    const submitBtn = screen.getByRole("button", { name: /Lưu khuyến mãi/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith("Lỗi lưu khuyến mãi: Database Connection Failure");
    });
  });
});
