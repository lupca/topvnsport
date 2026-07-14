"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";

const createSchema = z.object({
  username: z
    .string()
    .min(3, "Tên đăng nhập phải có ít nhất 3 ký tự")
    .max(100, "Tên đăng nhập không được quá 100 ký tự")
    .regex(/^[a-zA-Z0-9_-]+$/, "Tên đăng nhập chỉ chứa chữ cái, số, gạch ngang và gạch dưới"),
  email: z.string().min(1, "Email là bắt buộc").email("Email không hợp lệ").max(255),
  full_name: z.string().max(255).optional().or(z.literal("")),
  role_id: z.string().min(1, "Vui lòng chọn vai trò"),
  password: z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự").max(128),
});

const editSchema = z.object({
  email: z.string().min(1, "Email là bắt buộc").email("Email không hợp lệ").max(255),
  full_name: z.string().max(255).optional().or(z.literal("")),
  role_id: z.string().min(1, "Vui lòng chọn vai trò"),
  is_active: z.boolean(),
});

interface StaffFormProps {
  initialValues?: {
    username?: string;
    email?: string;
    full_name?: string;
    role_id?: number | string;
    is_active?: boolean;
  };
  roles: Array<{ id: number; name: string; code?: string }>;
  onSubmit: (data: any) => Promise<void>;
  isEdit?: boolean;
}

export default function StaffForm({
  initialValues,
  roles,
  onSubmit,
  isEdit = false,
}: StaffFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const schema = isEdit ? editSchema : createSchema;
  
  const defaultValues = {
    username: initialValues?.username || "",
    email: initialValues?.email || "",
    full_name: initialValues?.full_name || "",
    role_id: initialValues?.role_id ? String(initialValues.role_id) : "",
    is_active: initialValues?.is_active ?? true,
    password: "",
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
        email: data.email,
        full_name: data.full_name || null,
        role_id: parseInt(data.role_id, 10),
      };

      if (isEdit) {
        payload.is_active = data.is_active;
      } else {
        payload.username = data.username;
        payload.password = data.password;
      }

      await onSubmit(payload);
    } catch (err: any) {
      setErrorMsg(err.message || "Đã xảy ra lỗi khi gửi biểu mẫu");
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleOptions = roles.map((role) => ({
    label: role.name,
    value: String(role.id),
  }));

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6" noValidate>
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {/* Username field (Read-only or hidden password in Edit mode) */}
        {!isEdit ? (
          <Input
            id="username"
            label="Tên đăng nhập"
            placeholder="Ví dụ: nguyen_van_a"
            required
            error={errors.username?.message as string}
            {...register("username")}
          />
        ) : (
          <div className="text-left">
            <label className="block text-xs font-bold text-gray-400 mb-1.5">Tên đăng nhập</label>
            <div className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 text-gray-500 font-semibold">
              {initialValues?.username}
            </div>
          </div>
        )}

        <Input
          id="email"
          type="email"
          label="Địa chỉ Email"
          placeholder="Ví dụ: user@topvnsport.vn"
          required
          error={errors.email?.message as string}
          {...register("email")}
        />

        <Input
          id="full_name"
          label="Họ và tên"
          placeholder="Ví dụ: Nguyễn Văn A"
          error={errors.full_name?.message as string}
          {...register("full_name")}
        />

        <Select
          id="role_id"
          label="Vai trò hệ thống"
          placeholder="-- Chọn vai trò --"
          required
          options={roleOptions}
          error={errors.role_id?.message as string}
          {...register("role_id")}
        />

        {!isEdit && (
          <Input
            id="password"
            type="password"
            label="Mật khẩu khởi tạo"
            placeholder="Nhập mật khẩu ít nhất 8 ký tự"
            required
            error={errors.password?.message as string}
            {...register("password")}
          />
        )}

        {isEdit && (
          <div className="flex items-center gap-3 py-2 text-left">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                {...register("is_active")}
              />
              <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"></div>
              <span className="text-xs font-bold text-gray-700">Trạng thái hoạt động</span>
            </label>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <Button
          type="submit"
          variant="primary"
          isLoading={isSubmitting}
          className="px-6"
        >
          {isEdit ? "Cập nhật nhân viên" : "Tạo mới nhân viên"}
        </Button>
      </div>
    </form>
  );
}
