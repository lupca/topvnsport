import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import PermissionSelector from "./PermissionSelector";

test("renders PermissionSelector with correct category headers", () => {
  const handleChange = vi.fn();
  render(<PermissionSelector selectedPermissions={[]} onChange={handleChange} />);

  expect(screen.getByText("PMI (Product Information Management)")).toBeInTheDocument();
  expect(screen.getByText("OMS (Order Management System)")).toBeInTheDocument();
  expect(screen.getByText("WMS (Warehouse Management System)")).toBeInTheDocument();
  expect(screen.getByText("Identity (SSO Identity Service)")).toBeInTheDocument();
});

test("renders checked permissions correctly and triggers onChange", () => {
  const handleChange = vi.fn();
  render(
    <PermissionSelector
      selectedPermissions={["pmi:read", "oms:write"]}
      onChange={handleChange}
    />
  );

  const pmiReadCheckbox = screen.getAllByRole("checkbox").find(
    (cb) => (cb.closest("label")?.textContent || "").includes("pmi:read")
  );
  expect(pmiReadCheckbox).toBeChecked();

  const wmsReadCheckbox = screen.getAllByRole("checkbox").find(
    (cb) => (cb.closest("label")?.textContent || "").includes("wms:read")
  );
  expect(wmsReadCheckbox).not.toBeChecked();

  // Click wms:read checkbox
  if (wmsReadCheckbox) {
    fireEvent.click(wmsReadCheckbox);
    expect(handleChange).toHaveBeenCalledWith(["pmi:read", "oms:write", "wms:read"]);
  }
});
