import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import SepayConfigForm from "@/components/settings/SepayConfigForm";
import * as configApi from "@/services/configApi";

vi.mock("@/services/configApi", () => ({
  getSepayConfig: vi.fn(),
  updateSepayConfig: vi.fn(),
  testSepayConnection: vi.fn(),
}));

describe("SepayConfigForm", () => {
  const mockConfig: configApi.SepayConfig = {
    sepay_merchant_id: "MERCHANT_123",
    sepay_secret_key: "SEC_MASKED_12345",
    sepay_checkout_url: "https://pay.sepay.vn/v1/checkout/init",
    web_base_url: "https://topvnsport.vn",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(configApi.getSepayConfig).mockResolvedValue(mockConfig);
    vi.mocked(configApi.updateSepayConfig).mockResolvedValue(mockConfig);
    vi.mocked(configApi.testSepayConnection).mockResolvedValue({
      success: true,
      message: "Kết nối tới SePay thành công.",
    });
  });

  it("loads current config on mount", async () => {
    render(<SepayConfigForm />);

    await waitFor(() => {
      expect(configApi.getSepayConfig).toHaveBeenCalledTimes(1);
    });

    const merchantInput = screen.getByLabelText(
      /SePay Merchant ID/i
    ) as HTMLInputElement;
    expect(merchantInput.value).toBe("MERCHANT_123");
  });

  it("masks secret key in display", async () => {
    render(<SepayConfigForm />);

    await waitFor(() => {
      expect(screen.getByLabelText(/SePay Secret Key/i)).toBeInTheDocument();
    });

    const secretInput = screen.getByLabelText(
      /SePay Secret Key/i
    ) as HTMLInputElement;
    expect(secretInput.type).toBe("password");
  });

  it("shows full secret key when clicking reveal", async () => {
    render(<SepayConfigForm />);

    await waitFor(() => {
      expect(screen.getByLabelText(/SePay Secret Key/i)).toBeInTheDocument();
    });

    const secretInput = screen.getByLabelText(
      /SePay Secret Key/i
    ) as HTMLInputElement;
    expect(secretInput.type).toBe("password");

    const revealBtn = screen.getByRole("button", { name: /Hiện Secret Key/i });
    fireEvent.click(revealBtn);

    expect(secretInput.type).toBe("text");

    const hideBtn = screen.getByRole("button", { name: /Ẩn Secret Key/i });
    fireEvent.click(hideBtn);

    expect(secretInput.type).toBe("password");
  });

  it("validates required fields", async () => {
    render(<SepayConfigForm />);

    await waitFor(() => {
      expect(screen.getByLabelText(/SePay Merchant ID/i)).toBeInTheDocument();
    });

    const merchantInput = screen.getByLabelText(/SePay Merchant ID/i);
    fireEvent.change(merchantInput, { target: { value: "" } });

    const submitBtn = screen.getByRole("button", { name: /Lưu cấu hình/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Merchant ID không được để trống/i)).toBeInTheDocument();
    });
  });

  it("calls API on save", async () => {
    render(<SepayConfigForm />);

    await waitFor(() => {
      expect(screen.getByLabelText(/SePay Merchant ID/i)).toBeInTheDocument();
    });

    const merchantInput = screen.getByLabelText(/SePay Merchant ID/i);
    fireEvent.change(merchantInput, { target: { value: "NEW_MERCHANT_456" } });

    const submitBtn = screen.getByRole("button", { name: /Lưu cấu hình/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(configApi.updateSepayConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          sepay_merchant_id: "NEW_MERCHANT_456",
        })
      );
    });
  });

  it("shows success toast after save", async () => {
    render(<SepayConfigForm />);

    await waitFor(() => {
      expect(screen.getByLabelText(/SePay Merchant ID/i)).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole("button", { name: /Lưu cấu hình/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Cấu hình SePay đã được lưu thành công/i)
      ).toBeInTheDocument();
    });
  });

  it("shows error when test connection fails", async () => {
    vi.mocked(configApi.testSepayConnection).mockResolvedValueOnce({
      success: false,
      message: "Credentials SePay không hợp lệ",
    });

    render(<SepayConfigForm />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Test Connection/i })).toBeInTheDocument();
    });

    const testBtn = screen.getByRole("button", { name: /Test Connection/i });
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Credentials SePay không hợp lệ/i)
      ).toBeInTheDocument();
    });
  });
});
