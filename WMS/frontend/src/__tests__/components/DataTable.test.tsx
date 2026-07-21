import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import DataTable from "@/components/ui/DataTable";

describe("DataTable", () => {
  test("renders rows and handles search input", async () => {
    const onSearchChange = vi.fn();

    render(
      React.createElement(DataTable, {
        title: "Danh sach",
        data: [{ id: 1, name: "Ao" }],
        columns: [{ key: "name", label: "Ten" }],
        searchQuery: "",
        onSearchChange,
      }),
    );

    expect(screen.getByText("Danh sach")).toBeInTheDocument();
    expect(screen.getByText("Ao")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Tìm kiếm..."), {
      target: { value: "ao" },
    });
    expect(onSearchChange).toHaveBeenCalledWith("ao");
  });

  test("calls add and row action callbacks", async () => {
    const onAddClick = vi.fn();
    const onEditClick = vi.fn();
    const onDeleteClick = vi.fn();
    const onCopyClick = vi.fn();

    render(
      React.createElement(DataTable, {
        title: "Danh sach",
        data: [{ id: 1, name: "Ao" }],
        columns: [{ key: "name", label: "Ten" }],
        onAddClick,
        addLabel: "Them",
        onEditClick,
        onDeleteClick,
        onCopyClick,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Them" }));
    fireEvent.click(screen.getByTitle("Sao chép"));
    fireEvent.click(screen.getByTitle("Chỉnh sửa"));
    fireEvent.click(screen.getByTitle("Xóa"));

    expect(onAddClick).toHaveBeenCalledTimes(1);
    expect(onCopyClick).toHaveBeenCalledTimes(1);
    expect(onEditClick).toHaveBeenCalledTimes(1);
    expect(onDeleteClick).toHaveBeenCalledTimes(1);
  });

  test("renders row number (STT) by default and computes it correctly", () => {
    render(
      React.createElement(DataTable, {
        title: "Danh sach",
        data: [
          { id: 1, name: "Ao" },
          { id: 2, name: "Quan" },
        ],
        columns: [{ key: "name", label: "Ten" }],
      }),
    );

    expect(screen.getByText("STT")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  test("does not render row number (STT) if showRowNumber is false", () => {
    render(
      React.createElement(DataTable, {
        title: "Danh sach",
        data: [{ id: 1, name: "Ao" }],
        columns: [{ key: "name", label: "Ten" }],
        showRowNumber: false,
      }),
    );

    expect(screen.queryByText("STT")).not.toBeInTheDocument();
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });

  test("computes row numbers correctly on page 2", () => {
    const pagination = {
      currentPage: 2,
      totalPages: 3,
      limit: 10,
      totalItems: 25,
      onPageChange: vi.fn(),
      onLimitChange: vi.fn(),
    };

    render(
      React.createElement(DataTable, {
        title: "Danh sach",
        data: [{ id: 1, name: "Ao" }],
        columns: [{ key: "name", label: "Ten" }],
        pagination,
      }),
    );

    // On page 2 with limit 10, index 0 gets row number 11
    expect(screen.getByText("11")).toBeInTheDocument();
  });

  test("handles page changes and limit changes correctly", async () => {
    const onPageChange = vi.fn();
    const onLimitChange = vi.fn();

    const pagination = {
      currentPage: 2,
      totalPages: 3,
      limit: 10,
      totalItems: 25,
      onPageChange,
      onLimitChange,
    };

    render(
      React.createElement(DataTable, {
        title: "Danh sach",
        data: [{ id: 1, name: "Ao" }],
        columns: [{ key: "name", label: "Ten" }],
        pagination,
      }),
    );

    expect(screen.getByText(/Trang/)).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();

    const select = screen.getByRole("combobox");
    expect(select).toHaveValue("10");
    fireEvent.change(select, { target: { value: "20" } });
    expect(onLimitChange).toHaveBeenCalledWith(20);

    const prevBtn = screen.getByRole("button", { name: "Trang trước" });
    fireEvent.click(prevBtn);
    expect(onPageChange).toHaveBeenCalledWith(1);

    const nextBtn = screen.getByRole("button", { name: "Trang sau" });
    fireEvent.click(nextBtn);
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
