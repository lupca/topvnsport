import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { useForm, FormProvider } from "react-hook-form";
import ProductLogistics from "@/components/products/ProductLogistics";

function Wrapper({ children, defaultValues = {} }: { children: React.ReactNode; defaultValues?: any }) {
  const methods = useForm({
    defaultValues: {
      weight: 0,
      length: null,
      width: null,
      height: null,
      hs_code: "",
      tax_code: "",
      is_pre_order: false,
      dts_days: 7,
      status: "Draft",
      ...defaultValues,
    },
  });
  return <FormProvider {...methods}>{children}</FormProvider>;
}

describe("ProductLogistics", () => {
  test("renders all shipping and dimensions input fields", () => {
    render(
      <Wrapper>
        <ProductLogistics />
      </Wrapper>
    );

    expect(screen.getByText("Vận chuyển & Logistics")).toBeInTheDocument();
    expect(screen.getByText("Cân nặng *")).toBeInTheDocument();
    expect(screen.getByText("Chiều dài")).toBeInTheDocument();
    expect(screen.getByText("Chiều rộng")).toBeInTheDocument();
    expect(screen.getByText("Chiều cao")).toBeInTheDocument();
    expect(screen.getByText("Mã HS (Customs)")).toBeInTheDocument();
    expect(screen.getByText("Mã số thuế")).toBeInTheDocument();
  });

  test("does not display preparation time when not a pre-order", () => {
    render(
      <Wrapper defaultValues={{ is_pre_order: false }}>
        <ProductLogistics />
      </Wrapper>
    );

    expect(screen.queryByText(/Thời gian chuẩn bị hàng/)).not.toBeInTheDocument();
  });

  test("displays preparation time field when is_pre_order is true", async () => {
    const { container } = render(
      <Wrapper defaultValues={{ is_pre_order: true }}>
        <ProductLogistics />
      </Wrapper>
    );

    expect(screen.getByText(/Thời gian chuẩn bị hàng/)).toBeInTheDocument();
    const dtsInput = container.querySelector('input[name="dts_days"]')!;
    expect(dtsInput).toBeInTheDocument();
    expect(dtsInput).toHaveValue(7);
  });

  test("toggles pre-order display when checkbox is clicked", async () => {
    render(
      <Wrapper>
        <ProductLogistics />
      </Wrapper>
    );

    expect(screen.queryByText(/Thời gian chuẩn bị hàng/)).not.toBeInTheDocument();

    const preOrderCheckbox = screen.getByRole("checkbox");
    await userEvent.click(preOrderCheckbox);

    expect(screen.getByText(/Thời gian chuẩn bị hàng/)).toBeInTheDocument();
  });

  test("only renders logistics section when showLogisticsOnly is true", () => {
    render(
      <Wrapper>
        <ProductLogistics showLogisticsOnly />
      </Wrapper>
    );

    expect(screen.getByText("Vận chuyển & Logistics")).toBeInTheDocument();
    expect(screen.queryByText("Thông tin khác")).not.toBeInTheDocument();
  });

  test("only renders other section when showOtherOnly is true", () => {
    render(
      <Wrapper>
        <ProductLogistics showOtherOnly />
      </Wrapper>
    );

    expect(screen.queryByText("Vận chuyển & Logistics")).not.toBeInTheDocument();
    expect(screen.getByText("Thông tin khác")).toBeInTheDocument();
  });
});
