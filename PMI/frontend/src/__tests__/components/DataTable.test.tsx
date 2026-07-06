import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import DataTable from "@/components/ui/DataTable";

type Row = {
  id: number;
  name: string;
};

describe("DataTable", () => {
  test("renders rows and handles search input", async () => {
    const onSearchChange = vi.fn();

    render(
      <DataTable<Row>
        title="Danh sach"
        data={[{ id: 1, name: "Ao" }]}
        columns={[{ key: "name", label: "Ten" }]}
        searchQuery=""
        onSearchChange={onSearchChange}
      />,
    );

    expect(screen.getByText("Danh sach")).toBeInTheDocument();
    expect(screen.getByText("Ao")).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText("Tìm kiếm..."), "ao");
    expect(onSearchChange).toHaveBeenCalled();
  });

  test("calls add and row action callbacks", async () => {
    const onAddClick = vi.fn();
    const onEditClick = vi.fn();
    const onDeleteClick = vi.fn();
    const onCopyClick = vi.fn();

    render(
      <DataTable<Row>
        title="Danh sach"
        data={[{ id: 1, name: "Ao" }]}
        columns={[{ key: "name", label: "Ten" }]}
        onAddClick={onAddClick}
        addLabel="Them"
        onEditClick={onEditClick}
        onDeleteClick={onDeleteClick}
        onCopyClick={onCopyClick}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Them" }));
    await userEvent.click(screen.getByTitle("Sao chép"));
    await userEvent.click(screen.getByTitle("Chỉnh sửa"));
    await userEvent.click(screen.getByTitle("Xóa"));

    expect(onAddClick).toHaveBeenCalledTimes(1);
    expect(onCopyClick).toHaveBeenCalledTimes(1);
    expect(onEditClick).toHaveBeenCalledTimes(1);
    expect(onDeleteClick).toHaveBeenCalledTimes(1);
  });
});
