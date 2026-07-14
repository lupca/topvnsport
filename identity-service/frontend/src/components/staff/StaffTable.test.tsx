import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { expect, test, vi, beforeEach } from "vitest";
import StaffTable from "./StaffTable";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => "/staff",
}));

const mockRoles = [
  { id: 1, name: "Administrator", code: "admin" },
  { id: 2, name: "Manager", code: "manager" },
];

const mockStaffs = [
  {
    id: 1,
    username: "john_doe",
    email: "john@example.com",
    full_name: "John Doe",
    role_id: 1,
    role_code: "admin",
    role_name: "Administrator",
    is_active: true,
    created_at: new Date().toISOString(),
    last_login_at: null,
  },
  {
    id: 2,
    username: "jane_smith",
    email: "jane@example.com",
    full_name: "Jane Smith",
    role_id: 2,
    role_code: "manager",
    role_name: "Manager",
    is_active: false,
    created_at: new Date().toISOString(),
    last_login_at: null,
  },
];

beforeEach(() => {
  vi.restoreAllMocks();
});

test("renders StaffTable and filters by search text", async () => {
  const onToggle = vi.fn();
  const onDelete = vi.fn();
  const onReset = vi.fn();

  render(
    <StaffTable
      staffs={mockStaffs}
      roles={mockRoles}
      onToggleStatus={onToggle}
      onDelete={onDelete}
      onResetPassword={onReset}
    />
  );

  // Both staff should be present
  expect(screen.getByText("john_doe")).toBeInTheDocument();
  expect(screen.getByText("jane_smith")).toBeInTheDocument();

  // Search for John
  const searchInput = screen.getByPlaceholderText(/tìm kiếm theo tên đăng nhập/i);
  fireEvent.change(searchInput, { target: { value: "john" } });

  // Only John should be present
  expect(screen.getByText("john_doe")).toBeInTheDocument();
  expect(screen.queryByText("jane_smith")).toBeNull();
});

test("triggers onToggleStatus callback on clicking the toggle button", async () => {
  const onToggle = vi.fn().mockResolvedValue(undefined);
  const onDelete = vi.fn();
  const onReset = vi.fn();

  render(
    <StaffTable
      staffs={mockStaffs}
      roles={mockRoles}
      onToggleStatus={onToggle}
      onDelete={onDelete}
      onResetPassword={onReset}
    />
  );

  const johnRow = screen.getByText("john_doe").closest("tr");
  expect(johnRow).not.toBeNull();
  if (johnRow) {
    const toggleBtn = johnRow.querySelector("button[title='Khóa tài khoản']");
    expect(toggleBtn).not.toBeNull();
    if (toggleBtn) {
      await act(async () => {
        fireEvent.click(toggleBtn);
      });
      await act(async () => {
        await waitFor(() => {
          expect(toggleBtn).not.toBeDisabled();
        });
      });
      expect(onToggle).toHaveBeenCalledWith(1, true);
    }
  }
});

test("triggers onDelete callback on confirmation", async () => {
  const onToggle = vi.fn();
  const onDelete = vi.fn().mockResolvedValue(undefined);
  const onReset = vi.fn();

  vi.spyOn(window, "confirm").mockImplementation(() => true);

  render(
    <StaffTable
      staffs={mockStaffs}
      roles={mockRoles}
      onToggleStatus={onToggle}
      onDelete={onDelete}
      onResetPassword={onReset}
    />
  );

  const johnRow = screen.getByText("john_doe").closest("tr");
  expect(johnRow).not.toBeNull();
  if (johnRow) {
    const deleteBtn = johnRow.querySelector("button[title='Xóa nhân sự']");
    expect(deleteBtn).not.toBeNull();
    if (deleteBtn) {
      await act(async () => {
        fireEvent.click(deleteBtn);
      });
      await act(async () => {
        await waitFor(() => {
          expect(deleteBtn).not.toBeDisabled();
        });
      });
      expect(window.confirm).toHaveBeenCalled();
      expect(onDelete).toHaveBeenCalledWith(1);
    }
  }
});
