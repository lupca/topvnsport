import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import ApiKeysPage from "./page";
import { apiClient } from "@/utils/apiClient";

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/api-keys",
}));

vi.mock("@/utils/apiClient", () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}));

const SELLER = { id: "f02a9c68-f656-5597-9f9b-7c8e28e3705d", name: "Shop A", tax_code: "0101", is_active: true };
const KEY = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "VOMA Insights",
  prefix: "vk_live_AbCdEfGh",
  last4: "wxyz",
  seller_id: SELLER.id,
  seller_name: SELLER.name,
  scopes: ["insights:read"],
  created_by_username: "admin",
  created_at: "2026-11-09T10:00:00",
  last_used_at: null,
  revoked_at: null,
  expires_at: null,
  status: "active",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiClient.get).mockImplementation((path: string) => {
    if (path === "/api-keys/") return Promise.resolve([KEY]);
    if (path === "/sellers/") return Promise.resolve([SELLER]);
    return Promise.reject(new Error("Not found"));
  });
});

test("lists keys without secrets and with Vietnamese scope labels", async () => {
  render(<ApiKeysPage />);
  await waitFor(() => expect(screen.getByText("VOMA Insights")).toBeInTheDocument());
  expect(screen.getByText("vk_live_AbCdEfGh…wxyz")).toBeInTheDocument();
  expect(screen.getByText("Đọc dữ liệu cho VOMA Insights")).toBeInTheDocument();
  expect(screen.getByText("Đang hoạt động")).toBeInTheDocument();
});

test("creates a key and shows the full key once", async () => {
  const fullKey = "vk_live_" + "Z".repeat(43);
  vi.mocked(apiClient.post).mockResolvedValue({ ...KEY, id: "22222222-2222-4222-8222-222222222222", key: fullKey });
  render(<ApiKeysPage />);
  await waitFor(() => expect(screen.getByText("VOMA Insights")).toBeInTheDocument());

  fireEvent.click(screen.getAllByText("Tạo API key")[0]);
  expect(screen.getByText("Tạo phiếu nhập nháp")).toBeInTheDocument();
  const submit = screen.getAllByRole("button", { name: "Tạo API key" }).at(-1)!;
  fireEvent.click(submit);

  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/api-keys/", {
    name: "VOMA Insights",
    seller_id: SELLER.id,
    scopes: ["insights:read"],
    expires_at: null,
  }));
  expect(await screen.findByDisplayValue(fullKey)).toBeInTheDocument();
  expect(screen.getByText(/lần DUY NHẤT/)).toBeInTheDocument();
});

test("revokes a key after confirmation", async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ ...KEY, status: "revoked", revoked_at: "2026-11-09T11:00:00" });
  render(<ApiKeysPage />);
  await waitFor(() => expect(screen.getByText("VOMA Insights")).toBeInTheDocument());

  fireEvent.click(screen.getByRole("button", { name: "Thu hồi" }));
  expect(screen.getByText(/không thể hoàn tác/)).toBeInTheDocument();
  const confirmButtons = screen.getAllByRole("button", { name: "Thu hồi" });
  fireEvent.click(confirmButtons[confirmButtons.length - 1]);

  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith(`/api-keys/${KEY.id}/revoke`));
  expect(await screen.findByText("Đã thu hồi")).toBeInTheDocument();
});
