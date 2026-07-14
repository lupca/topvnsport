import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import RoleTable from "./RoleTable";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => "/roles",
}));

const mockRoles = [
  {
    id: 1,
    code: "admin",
    name: "Administrator",
    description: "System admin with full permissions",
    permissions: ["identity:*", "pmi:*"],
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    code: "sales",
    name: "Sales Agent",
    description: "Handle daily orders",
    permissions: ["oms:read", "oms:write"],
    created_at: new Date().toISOString(),
  },
];

const mockStaffs = [
  { id: 1, role_id: 1 },
  { id: 2, role_id: 1 },
  { id: 3, role_id: 2 },
];

test("renders RoleTable and displays staff count correctly", () => {
  const handleDelete = vi.fn();
  render(<RoleTable roles={mockRoles} staffs={mockStaffs} onDelete={handleDelete} />);

  expect(screen.getByText("Administrator")).toBeInTheDocument();
  expect(screen.getByText("Sales Agent")).toBeInTheDocument();

  // Admin staff count is 2, Sales agent is 1
  // We can query by the cell or check the text in document
  expect(screen.getByText("2")).toBeInTheDocument();
  expect(screen.getByText("1")).toBeInTheDocument();
});

test("triggers onDelete callback when clicking delete role and confirm", async () => {
  const handleDelete = vi.fn().mockResolvedValue(undefined);
  vi.spyOn(window, "confirm").mockImplementation(() => true);

  // Render with no staff in sales role (id: 2) so delete is allowed
  render(<RoleTable roles={mockRoles} staffs={[]} onDelete={handleDelete} />);

  const salesRow = screen.getByText("Sales Agent").closest("tr");
  expect(salesRow).not.toBeNull();
  if (salesRow) {
    const deleteBtn = salesRow.querySelector("button[title='Xóa vai trò']");
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
    }
  }

  expect(window.confirm).toHaveBeenCalled();
  expect(handleDelete).toHaveBeenCalledWith(2);
});
