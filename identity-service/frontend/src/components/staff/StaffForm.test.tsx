import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import StaffForm from "./StaffForm";

const mockRoles = [
  { id: 1, name: "Administrator", code: "admin" },
  { id: 2, name: "Manager", code: "manager" },
];

test("renders StaffForm in create mode with password input", () => {
  const handleSubmit = vi.fn();
  render(<StaffForm roles={mockRoles} onSubmit={handleSubmit} isEdit={false} />);

  expect(screen.getByLabelText(/Tên đăng nhập/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Địa chỉ Email/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Mật khẩu/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /tạo mới nhân viên/i })).toBeInTheDocument();
});

test("renders StaffForm in edit mode without password input, showing read-only username", () => {
  const handleSubmit = vi.fn();
  const initialValues = {
    username: "john_doe",
    email: "john@example.com",
    full_name: "John Doe",
    role_id: 2,
    is_active: true,
  };
  render(
    <StaffForm
      roles={mockRoles}
      onSubmit={handleSubmit}
      isEdit={true}
      initialValues={initialValues}
    />
  );

  expect(screen.queryByLabelText(/Tên đăng nhập/i)).toBeNull();
  expect(screen.getByText("john_doe")).toBeInTheDocument();
  expect(screen.getByLabelText(/Địa chỉ Email/i)).toHaveValue("john@example.com");
  expect(screen.getByLabelText("Họ và tên")).toHaveValue("John Doe");
  expect(screen.queryByLabelText(/Mật khẩu/i)).toBeNull();
  expect(screen.getByText("Trạng thái hoạt động")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /cập nhật nhân viên/i })).toBeInTheDocument();
});

test("validates required fields in create mode", async () => {
  const handleSubmit = vi.fn();
  render(<StaffForm roles={mockRoles} onSubmit={handleSubmit} isEdit={false} />);

  fireEvent.click(screen.getByRole("button", { name: /tạo mới nhân viên/i }));

  await waitFor(() => {
    expect(screen.getByText("Tên đăng nhập phải có ít nhất 3 ký tự")).toBeInTheDocument();
    expect(screen.getByText("Email là bắt buộc")).toBeInTheDocument();
    expect(screen.getByText("Vui lòng chọn vai trò")).toBeInTheDocument();
    expect(screen.getByText("Mật khẩu phải có ít nhất 8 ký tự")).toBeInTheDocument();
  });

  expect(handleSubmit).not.toHaveBeenCalled();
});

test("validates format rules and max lengths in create mode", async () => {
  const handleSubmit = vi.fn();
  render(<StaffForm roles={mockRoles} onSubmit={handleSubmit} isEdit={false} />);

  fireEvent.change(screen.getByLabelText(/Tên đăng nhập/i), { target: { value: "invalid username!" } });
  fireEvent.change(screen.getByLabelText(/Địa chỉ Email/i), { target: { value: "not-an-email" } });
  fireEvent.change(screen.getByLabelText("Họ và tên"), { target: { value: "a".repeat(256) } });
  fireEvent.change(screen.getByLabelText(/Mật khẩu/i), { target: { value: "b".repeat(129) } });

  fireEvent.click(screen.getByRole("button", { name: /tạo mới nhân viên/i }));

  await waitFor(() => {
    expect(screen.getByText("Tên đăng nhập chỉ chứa chữ cái, số, gạch ngang và gạch dưới")).toBeInTheDocument();
    expect(screen.getByText("Email không hợp lệ")).toBeInTheDocument();
    expect(screen.getByText("String must contain at most 255 character(s)")).toBeInTheDocument();
    expect(screen.getByText("String must contain at most 128 character(s)")).toBeInTheDocument();
  });

  expect(handleSubmit).not.toHaveBeenCalled();
});

