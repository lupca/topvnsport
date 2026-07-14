import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import RoleForm from "./RoleForm";

test("renders RoleForm in create mode with editable code", () => {
  const handleSubmit = vi.fn();
  render(<RoleForm onSubmit={handleSubmit} isEdit={false} />);

  expect(screen.getByLabelText(/Mã vai trò/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Tên vai trò/i)).toBeInTheDocument();
  expect(screen.getByLabelText("Mô tả chi tiết")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /tạo mới vai trò/i })).toBeInTheDocument();
});

test("renders RoleForm in edit mode with read-only code", () => {
  const handleSubmit = vi.fn();
  const initialValues = {
    code: "editor",
    name: "Editor",
    description: "Edit permission",
    permissions: ["pmi:write"],
  };
  render(
    <RoleForm
      onSubmit={handleSubmit}
      isEdit={true}
      initialValues={initialValues}
    />
  );

  expect(screen.queryByLabelText(/Mã vai trò/i)).toBeNull();
  expect(screen.getByText("editor")).toBeInTheDocument();
  expect(screen.getByLabelText(/Tên vai trò/i)).toHaveValue("Editor");
  expect(screen.getByLabelText("Mô tả chi tiết")).toHaveValue("Edit permission");
  expect(screen.getByRole("button", { name: /cập nhật vai trò/i })).toBeInTheDocument();
});

test("validates required fields on submit", async () => {
  const handleSubmit = vi.fn();
  render(<RoleForm onSubmit={handleSubmit} isEdit={false} />);

  fireEvent.click(screen.getByRole("button", { name: /tạo mới vai trò/i }));

  await waitFor(() => {
    expect(screen.getByText("Mã vai trò phải có ít nhất 2 ký tự")).toBeInTheDocument();
    expect(screen.getByText("Tên vai trò là bắt buộc")).toBeInTheDocument();
  });

  expect(handleSubmit).not.toHaveBeenCalled();
});

test("validates format rules and max lengths", async () => {
  const handleSubmit = vi.fn();
  render(<RoleForm onSubmit={handleSubmit} isEdit={false} />);

  fireEvent.change(screen.getByLabelText(/Mã vai trò/i), { target: { value: "INVALID CODE" } });
  fireEvent.change(screen.getByLabelText(/Tên vai trò/i), { target: { value: "a".repeat(101) } });
  fireEvent.change(screen.getByLabelText("Mô tả chi tiết"), { target: { value: "b".repeat(501) } });

  fireEvent.click(screen.getByRole("button", { name: /tạo mới vai trò/i }));

  await waitFor(() => {
    expect(screen.getByText("Mã vai trò chỉ được chứa chữ cái thường và dấu gạch dưới (_)")).toBeInTheDocument();
    expect(screen.getByText("Tên vai trò không được quá 100 ký tự")).toBeInTheDocument();
    expect(screen.getByText("String must contain at most 500 character(s)")).toBeInTheDocument();
  });

  expect(handleSubmit).not.toHaveBeenCalled();
});

