import { render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi, beforeEach } from "vitest";
import RootPage from "./page";

// Mock useRouter
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

beforeEach(() => {
  mockReplace.mockClear();
  localStorage.clear();
});

test("redirects to /dashboard if access_token is present", async () => {
  localStorage.setItem("access_token", "test-token");
  render(<RootPage />);
  
  await waitFor(() => {
    expect(mockReplace).toHaveBeenCalledWith("/dashboard");
  });
});

test("redirects to /login if access_token is absent", async () => {
  render(<RootPage />);
  
  await waitFor(() => {
    expect(mockReplace).toHaveBeenCalledWith("/login");
  });
});
