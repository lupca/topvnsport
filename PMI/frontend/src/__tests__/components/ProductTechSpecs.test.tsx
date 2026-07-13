import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import ProductTechSpecs, { Attribute } from "@/components/products/ProductTechSpecs";

describe("ProductTechSpecs", () => {
  const setAttributeValues = vi.fn();

  test("displays prompt message when watchFamilyId is not selected or 0", () => {
    render(
      <ProductTechSpecs
        watchFamilyId={0}
        familyAttributes={[]}
        attributeValues={{}}
        setAttributeValues={setAttributeValues}
      />
    );
    expect(screen.getByText("Chọn Attribute Family để tải danh sách thông số kỹ thuật phù hợp.")).toBeInTheDocument();
  });

  test("displays message when watchFamilyId is selected but attributes list is empty", () => {
    render(
      <ProductTechSpecs
        watchFamilyId={1}
        familyAttributes={[]}
        attributeValues={{}}
        setAttributeValues={setAttributeValues}
      />
    );
    expect(screen.getByText("Family hiện tại chưa có thuộc tính nào được gán.")).toBeInTheDocument();
  });

  test("renders input fields for family attributes and shows asterisk for required attributes", () => {
    const mockAttributes: Attribute[] = [
      { id: 10, code: "material", name: "Chất liệu", type: "string", is_required: true },
      { id: 11, code: "voltage", name: "Điện áp", type: "number", is_required: false },
      { id: 12, code: "capacity", name: "Dung tích", type: "decimal", is_required: false }
    ];

    render(
      <ProductTechSpecs
        watchFamilyId={1}
        familyAttributes={mockAttributes}
        attributeValues={{ 10: "Cotton" }}
        setAttributeValues={setAttributeValues}
      />
    );

    // Header check
    expect(screen.getByText("Thuộc tính kỹ thuật")).toBeInTheDocument();

    // Check Material Input (type: text, value populated, required *)
    expect(screen.getByText("Chất liệu *")).toBeInTheDocument();
    const materialInput = screen.getByPlaceholderText("Nhập chất liệu");
    expect(materialInput).toBeInTheDocument();
    expect(materialInput).toHaveValue("Cotton");
    expect(materialInput).toHaveAttribute("type", "text");

    // Check Voltage Input (type: number)
    expect(screen.getByText("Điện áp")).toBeInTheDocument();
    const voltageInput = screen.getByPlaceholderText("Nhập điện áp");
    expect(voltageInput).toHaveAttribute("type", "number");

    // Check Capacity Input (type: number, step: any)
    expect(screen.getByText("Dung tích")).toBeInTheDocument();
    const capacityInput = screen.getByPlaceholderText("Nhập dung tích");
    expect(capacityInput).toHaveAttribute("type", "number");
    expect(capacityInput).toHaveAttribute("step", "any");
  });

  test("calls setAttributeValues callback on input change", () => {
    const mockAttributes: Attribute[] = [
      { id: 10, code: "material", name: "Chất liệu", type: "string", is_required: true },
    ];

    render(
      <ProductTechSpecs
        watchFamilyId={1}
        familyAttributes={mockAttributes}
        attributeValues={{}}
        setAttributeValues={setAttributeValues}
      />
    );

    const input = screen.getByPlaceholderText("Nhập chất liệu");
    fireEvent.change(input, { target: { value: "Polyester" } });

    expect(setAttributeValues).toHaveBeenCalled();
    // Verify how it's called
    const updater = setAttributeValues.mock.calls[0][0];
    const prev = {};
    expect(updater(prev)).toEqual({ 10: "Polyester" });
  });
});
