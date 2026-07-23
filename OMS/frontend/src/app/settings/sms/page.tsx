"use client";

import React, { useCallback, useEffect, useState } from "react";
import { api } from "@/utils/api";
import {
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Key,
  RefreshCw,
  Save,
  Settings,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { popupService } from "@/components/ui/popupService";

const zaloConfigSchema = z.object({
  zalo_app_id: z.string().min(1, "Zalo App ID không được để trống"),
  zalo_secret_key: z.string().min(1, "Zalo Secret Key không được để trống"),
  zalo_access_token: z.string().min(1, "Zalo Access Token không được để trống"),
  zalo_refresh_token: z.string().min(1, "Zalo Refresh Token không được để trống"),
  zalo_template_id: z.string().min(1, "Zalo Template ID không được để trống"),
});

type ZaloConfigFormValues = z.infer<typeof zaloConfigSchema>;
type ZaloConfigField = keyof ZaloConfigFormValues;

const EMPTY_ZALO_CONFIG: ZaloConfigFormValues = {
  zalo_app_id: "",
  zalo_secret_key: "",
  zalo_access_token: "",
  zalo_refresh_token: "",
  zalo_template_id: "",
};

const ZALO_CONFIG_FIELDS: Array<{
  name: ZaloConfigField;
  label: string;
  placeholder: string;
  sensitive: boolean;
}> = [
  {
    name: "zalo_app_id",
    label: "Zalo App ID",
    placeholder: "Nhập App ID...",
    sensitive: false,
  },
  {
    name: "zalo_secret_key",
    label: "Zalo Secret Key",
    placeholder: "Ghi đè để nhập secret key mới...",
    sensitive: true,
  },
  {
    name: "zalo_access_token",
    label: "Zalo Access Token",
    placeholder: "Ghi đè để nhập access token mới...",
    sensitive: true,
  },
  {
    name: "zalo_refresh_token",
    label: "Zalo Refresh Token",
    placeholder: "Ghi đè để nhập refresh token mới...",
    sensitive: true,
  },
  {
    name: "zalo_template_id",
    label: "Zalo Template ID",
    placeholder: "Nhập Template ID...",
    sensitive: false,
  },
];

export default function ZaloSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [originalConfig, setOriginalConfig] =
    useState<ZaloConfigFormValues>(EMPTY_ZALO_CONFIG);
  const [visibleFields, setVisibleFields] = useState<
    Partial<Record<ZaloConfigField, boolean>>
  >({});
  const [hasAccessToken, setHasAccessToken] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ZaloConfigFormValues>({
    resolver: zodResolver(zaloConfigSchema),
    defaultValues: EMPTY_ZALO_CONFIG,
  });

  const fetchZaloConfig = useCallback(async () => {
    try {
      setLoading(true);
      setSuccessMessage(null);
      setErrorMessage(null);

      const response =
        await api.get<ZaloConfigFormValues>("/api/configs/sms");
      const fetchedConfig: ZaloConfigFormValues = {
        zalo_app_id: response.zalo_app_id || "",
        zalo_secret_key: response.zalo_secret_key || "",
        zalo_access_token: response.zalo_access_token || "",
        zalo_refresh_token: response.zalo_refresh_token || "",
        zalo_template_id: response.zalo_template_id || "",
      };

      setOriginalConfig(fetchedConfig);
      setHasAccessToken(Boolean(fetchedConfig.zalo_access_token));
      reset(fetchedConfig);
    } catch (err: any) {
      console.error(err);
      setErrorMessage("Không thể tải cấu hình Zalo OTP từ hệ thống.");
    } finally {
      setLoading(false);
    }
  }, [reset]);

  useEffect(() => {
    fetchZaloConfig();
  }, [fetchZaloConfig]);

  const handleFormSubmit = async (data: ZaloConfigFormValues) => {
    setSuccessMessage(null);
    setErrorMessage(null);

    const changedFields = ZALO_CONFIG_FIELDS.filter(
      ({ name }) => data[name] !== originalConfig[name],
    );
    if (changedFields.length === 0) {
      void popupService.alert("Không có thay đổi nào cần lưu.");
      return;
    }

    const maskedField = changedFields.find(({ name }) =>
      data[name].includes("*"),
    );
    if (maskedField) {
      setErrorMessage(
        `${maskedField.label} mới không hợp lệ. Vui lòng ghi đè toàn bộ ký tự che khuất '*'.`,
      );
      return;
    }

    const payload = Object.fromEntries(
      changedFields.map(({ name }) => [name, data[name]]),
    ) as Partial<ZaloConfigFormValues>;

    try {
      setIsSubmitting(true);
      await api.put("/api/configs/sms", payload);
      await fetchZaloConfig();
      setSuccessMessage("Cấu hình Zalo OTP đã được lưu thành công.");
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Cập nhật cấu hình Zalo OTP thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleFieldVisibility = (fieldName: ZaloConfigField) => {
    setVisibleFields((current) => ({
      ...current,
      [fieldName]: !current[fieldName],
    }));
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 text-gray-800">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
          <Settings className="w-5 h-5 text-brand-primary" />
          <span>Cấu hình Zalo OTP</span>
        </h2>
        <p className="text-xs text-gray-500">
          Quản lý thông tin kết nối Zalo OA và ZBS Template Message để gửi OTP.
        </p>
      </div>

      <div className="pim-card bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div className="border-b border-gray-200 pb-4 mb-6">
          <h3 className="pim-card-header text-sm font-bold text-gray-950 flex items-center gap-2">
            <Key className="w-4 h-4 text-brand-primary" />
            <span>Thông tin kết nối Zalo OA</span>
          </h3>
        </div>

        {successMessage && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-brand-primary" />
            <span>Đang tải thông tin cấu hình...</span>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit(handleFormSubmit)}
            className="space-y-6"
          >
            {ZALO_CONFIG_FIELDS.map((field) => {
              const fieldError = errors[field.name];
              const isVisible = Boolean(visibleFields[field.name]);

              return (
                <div key={field.name} className="space-y-2">
                  <label
                    htmlFor={field.name}
                    className="pim-label text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1"
                  >
                    <span>{field.label}</span>
                    <span className="text-rose-600">*</span>
                  </label>

                  <div className="relative">
                    <input
                      id={field.name}
                      type={field.sensitive && !isVisible ? "password" : "text"}
                      placeholder={field.placeholder}
                      autoComplete={field.sensitive ? "new-password" : "off"}
                      className={`pim-input w-full font-mono ${
                        field.sensitive ? "pr-12" : ""
                      }`}
                      disabled={isSubmitting}
                      {...register(field.name)}
                    />

                    {field.sensitive && (
                      <button
                        type="button"
                        onClick={() => toggleFieldVisibility(field.name)}
                        disabled={isSubmitting}
                        aria-label={
                          isVisible
                            ? `Ẩn ${field.label}`
                            : `Hiện ${field.label}`
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
                      >
                        {isVisible ? (
                          <EyeOff className="w-4.5 h-4.5" />
                        ) : (
                          <Eye className="w-4.5 h-4.5" />
                        )}
                      </button>
                    )}
                  </div>

                  {fieldError && (
                    <p className="text-[10px] text-rose-600 font-bold mt-1">
                      {fieldError.message}
                    </p>
                  )}
                </div>
              );
            })}

            <p className="text-[11px] text-gray-400 leading-relaxed">
              Các giá trị hiện tại được máy chủ che khuất. Chỉ những trường bạn
              nhập lại bằng giá trị mới mới được cập nhật.
            </p>

            <div className="flex items-center justify-between pt-6 border-t border-gray-100">
              <div
                className={`text-[11px] font-semibold flex items-center gap-2 ${
                  hasAccessToken ? "text-emerald-700" : "text-gray-500"
                }`}
              >
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    hasAccessToken
                      ? "bg-emerald-500 animate-pulse"
                      : "bg-gray-300"
                  }`}
                />
                <span>
                  {hasAccessToken
                    ? "Token hợp lệ"
                    : "Chưa cấu hình Access Token"}
                </span>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={fetchZaloConfig}
                  disabled={isSubmitting}
                  className="btn-outline text-xs px-4 py-2.5 flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Tải lại
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !isDirty}
                  className="btn-primary text-xs px-5 py-2.5 flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  Lưu cấu hình
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
