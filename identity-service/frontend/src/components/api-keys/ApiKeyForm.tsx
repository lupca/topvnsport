"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";

export const API_KEY_SCOPES = [
  {
    value: "insights:read",
    label: "Đọc dữ liệu cho VOMA Insights",
    description: "Chỉ đọc: sản phẩm (PMI), đơn hàng (OMS), phiếu nhập kho (WMS).",
  },
  {
    value: "inbound:write",
    label: "Tạo phiếu nhập nháp",
    description: "Cho phép tạo phiếu nhập kho ở trạng thái nháp trong WMS.",
  },
] as const;

const SCOPE_VALUES = API_KEY_SCOPES.map((s) => s.value) as [string, ...string[]];

export const apiKeySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Tên API key là bắt buộc")
    .max(100, "Tên API key không được quá 100 ký tự"),
  seller_id: z.string().min(1, "Vui lòng chọn nhà bán hàng"),
  scopes: z
    .array(z.enum(SCOPE_VALUES))
    .min(1, "Vui lòng chọn ít nhất một quyền"),
  expires_at: z
    .string()
    .optional()
    .refine((v) => !v || new Date(`${v}T23:59:59`).getTime() > Date.now(), {
      message: "Ngày hết hạn phải ở tương lai",
    }),
});

export type ApiKeyFormValues = z.infer<typeof apiKeySchema>;

export interface ApiKeyCreatePayload {
  name: string;
  seller_id: string;
  scopes: string[];
  expires_at: string | null;
}

interface ApiKeyFormProps {
  sellers: Array<{ id: string; name: string; tax_code?: string; is_active?: boolean }>;
  onSubmit: (payload: ApiKeyCreatePayload) => Promise<void>;
  onCancel?: () => void;
}

export default function ApiKeyForm({ sellers, onSubmit, onCancel }: ApiKeyFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ApiKeyFormValues>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: {
      name: "VOMA Insights",
      seller_id: sellers.length === 1 ? sellers[0].id : "",
      scopes: ["insights:read"],
      expires_at: "",
    },
  });

  const handleFormSubmit = async (data: ApiKeyFormValues) => {
    setIsSubmitting(true);
    setErrorMsg("");
    try {
      await onSubmit({
        name: data.name.trim(),
        seller_id: data.seller_id,
        scopes: data.scopes,
        // <input type="date"> gives local YYYY-MM-DD: expire at the end of that day.
        expires_at: data.expires_at
          ? new Date(`${data.expires_at}T23:59:59`).toISOString()
          : null,
      });
    } catch (err: any) {
      setErrorMsg(err.message || "Không thể tạo API key");
    } finally {
      setIsSubmitting(false);
    }
  };

  const sellerOptions = sellers
    .filter((s) => s.is_active !== false)
    .map((s) => ({
      label: s.tax_code ? `${s.name} (MST ${s.tax_code})` : s.name,
      value: s.id,
    }));

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5" noValidate>
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl">
          {errorMsg}
        </div>
      )}

      <Input
        id="api-key-name"
        label="Tên gợi nhớ"
        placeholder="Ví dụ: VOMA Insights - cửa hàng chính"
        required
        error={errors.name?.message}
        {...register("name")}
      />

      <Select
        id="api-key-seller"
        label="Nhà bán hàng"
        placeholder="-- Chọn nhà bán hàng --"
        required
        options={sellerOptions}
        error={errors.seller_id?.message}
        helperText="API key chỉ truy cập được dữ liệu của nhà bán hàng này."
        {...register("seller_id")}
      />

      <fieldset className="text-left">
        <legend className="block text-xs font-bold text-gray-700 mb-1.5">
          Quyền truy cập<span className="text-rose-500 ml-1">*</span>
        </legend>
        <div className="space-y-2">
          {API_KEY_SCOPES.map((scope) => (
            <label
              key={scope.value}
              className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                value={scope.value}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                {...register("scopes")}
              />
              <span className="flex flex-col">
                <span className="text-xs font-bold text-gray-800">{scope.label}</span>
                <span className="text-[11px] text-gray-500">
                  {scope.description} <code className="text-[10px] text-gray-400">{scope.value}</code>
                </span>
              </span>
            </label>
          ))}
        </div>
        {errors.scopes && (
          <p className="mt-1 text-xs text-rose-600 font-medium">{errors.scopes.message as string}</p>
        )}
      </fieldset>

      <Input
        id="api-key-expires"
        type="date"
        label="Ngày hết hạn (tuỳ chọn)"
        helperText="Để trống nếu không muốn key tự hết hạn. Có thể thu hồi bất cứ lúc nào."
        error={errors.expires_at?.message}
        {...register("expires_at")}
      />

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Huỷ
          </Button>
        )}
        <Button type="submit" variant="primary" isLoading={isSubmitting} className="px-6">
          Tạo API key
        </Button>
      </div>
    </form>
  );
}
