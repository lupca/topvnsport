"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import PermissionSelector from "./PermissionSelector";

const schema = z.object({
  code: z
    .string()
    .min(2, "Mã vai trò phải có ít nhất 2 ký tự")
    .max(50, "Mã vai trò không được quá 50 ký tự")
    .regex(/^[a-z_]+$/, "Mã vai trò chỉ được chứa chữ cái thường và dấu gạch dưới (_)"),
  name: z
    .string()
    .min(1, "Tên vai trò là bắt buộc")
    .max(100, "Tên vai trò không được quá 100 ký tự"),
  description: z.string().max(500).optional().or(z.literal("")),
});

interface RoleFormProps {
  initialValues?: {
    code?: string;
    name?: string;
    description?: string;
    permissions?: string[];
  };
  onSubmit: (data: any) => Promise<void>;
  isEdit?: boolean;
}

export default function RoleForm({
  initialValues,
  onSubmit,
  isEdit = false,
}: RoleFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  // Manage permissions selection state
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(
    initialValues?.permissions || []
  );

  const defaultValues = {
    code: initialValues?.code || "",
    name: initialValues?.name || "",
    description: initialValues?.description || "",
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const handleFormSubmit = async (data: any) => {
    setIsSubmitting(true);
    setErrorMsg("");
    try {
      const payload: any = {
        name: data.name,
        description: data.description || null,
        permissions: selectedPermissions,
      };

      if (!isEdit) {
        payload.code = data.code;
      }

      await onSubmit(payload);
    } catch (err: any) {
      setErrorMsg(err.message || "Đã xảy ra lỗi khi gửi biểu mẫu");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6" noValidate>
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl">
          {errorMsg}
        </div>
      )}

      {/* Role details card */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 text-left">
        <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider border-b border-gray-100 pb-2">
          Thông tin vai trò
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Code */}
          {!isEdit ? (
            <Input
              id="code"
              label="Mã vai trò"
              placeholder="Ví dụ: sales_manager"
              required
              helperText="Chỉ chứa chữ cái thường và dấu gạch dưới, không được thay đổi sau khi tạo."
              error={errors.code?.message as string}
              {...register("code")}
            />
          ) : (
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1.5">Mã vai trò</label>
              <div className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 text-gray-500 font-mono font-bold uppercase tracking-wider">
                {initialValues?.code}
              </div>
            </div>
          )}

          {/* Name */}
          <Input
            id="name"
            label="Tên vai trò (Hiển thị)"
            placeholder="Ví dụ: Quản lý kinh doanh"
            required
            error={errors.name?.message as string}
            {...register("name")}
          />

          {/* Description */}
          <div className="col-span-1 md:col-span-2">
            <label htmlFor="description" className="block text-xs font-bold text-gray-700 mb-1.5">
              Mô tả chi tiết
            </label>
            <textarea
              id="description"
              rows={3}
              placeholder="Nhập mô tả về trách nhiệm hoặc mục tiêu của vai trò này..."
              className={`w-full px-4 py-2.5 text-sm rounded-xl border bg-surface text-gray-900 transition-all focus:outline-none focus:ring-2 placeholder:text-gray-400
                ${
                  errors.description
                    ? "border-rose-300 focus:ring-rose-500 focus:border-rose-500"
                    : "border-gray-300 focus:ring-brand-primary focus:border-brand-primary"
                }
              `}
              {...register("description")}
            />
            {errors.description && (
              <p className="mt-1 text-xs text-rose-600 font-medium">
                {errors.description.message as string}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Permissions card */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <PermissionSelector
          selectedPermissions={selectedPermissions}
          onChange={setSelectedPermissions}
        />
      </div>

      {/* Submit Button */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <Button
          type="submit"
          variant="primary"
          isLoading={isSubmitting}
          className="px-6"
        >
          {isEdit ? "Cập nhật vai trò" : "Tạo mới vai trò"}
        </Button>
      </div>
    </form>
  );
}
