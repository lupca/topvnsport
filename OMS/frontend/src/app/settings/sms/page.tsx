"use client";

import React, { useState, useEffect, useCallback } from "react";
import { api } from "@/utils/api";
import { Settings, Key, Eye, EyeOff, Save, RefreshCw, AlertCircle, CheckCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { popupService } from "@/components/ui/popupService";

// Validation schema
const smsConfigSchema = z.object({
  speed_sms_token: z.string().min(1, "Token SpeedSMS không được để trống"),
});

type SmsConfigFormValues = z.infer<typeof smsConfigSchema>;

export default function SmsSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [originalMaskedToken, setOriginalMaskedToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<SmsConfigFormValues>({
    resolver: zodResolver(smsConfigSchema),
    defaultValues: {
      speed_sms_token: "",
    },
  });

  const fetchSmsConfig = useCallback(async () => {
    try {
      setLoading(true);
      setSuccessMessage(null);
      setErrorMessage(null);
      
      const res = await api.get<{ config_key: string; config_value: string }>("/api/configs/sms");
      const fetchedToken = res.config_value || "";
      
      setOriginalMaskedToken(fetchedToken);
      reset({ speed_sms_token: fetchedToken });
    } catch (err: any) {
      console.error(err);
      setErrorMessage("Không thể tải cấu hình SMS từ hệ thống.");
    } finally {
      setLoading(false);
    }
  }, [reset]);

  useEffect(() => {
    fetchSmsConfig();
  }, [fetchSmsConfig]);

  const handleFormSubmit = async (data: SmsConfigFormValues) => {
    setSuccessMessage(null);
    setErrorMessage(null);

    // 1. Detect if no change was made
    if (data.speed_sms_token === originalMaskedToken) {
      void popupService.alert("Không có thay đổi nào cần lưu.");
      return;
    }

    // 2. Prevent submitting mask indicators
    if (data.speed_sms_token.includes("*")) {
      setErrorMessage("Token mới không hợp lệ. Vui lòng ghi đè toàn bộ ký tự che khuất '*'.");
      return;
    }

    try {
      setIsSubmitting(true);
      
      await api.put("/api/configs/sms", {
        config_value: data.speed_sms_token,
      });

      // Fetch settings again to display the newly updated token under server masking
      await fetchSmsConfig();

      setSuccessMessage("Cấu hình SMS đã được lưu thành công.");
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Cập nhật cấu hình SMS thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 text-gray-800">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
          <Settings className="w-5 h-5 text-brand-primary" />
          <span>Cấu hình SMS OTP (SpeedSMS)</span>
        </h2>
        <p className="text-xs text-gray-500">
          Quản lý mã xác thực Access Token kết nối dịch vụ gửi SMS OTP.
        </p>
      </div>

      {/* Main Configuration Card */}
      <div className="pim-card bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div className="border-b border-gray-200 pb-4 mb-6">
          <h3 className="pim-card-header text-sm font-bold text-gray-950 flex items-center gap-2">
            <Key className="w-4 h-4 text-brand-primary" />
            <span>SpeedSMS API Token</span>
          </h3>
        </div>

        {/* Global Notifications */}
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
          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
            <div className="space-y-2">
              <label className="pim-label text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <span>Access Token</span>
                <span className="text-rose-600">*</span>
              </label>
              
              <div className="relative">
                <input
                  type={showToken ? "text" : "password"}
                  placeholder="Ghi đè để nhập token mới..."
                  className="pim-input w-full pr-12 font-mono"
                  disabled={isSubmitting}
                  {...register("speed_sms_token")}
                />
                
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  disabled={isSubmitting}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
                >
                  {showToken ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>

              {errors.speed_sms_token && (
                <p className="text-[10px] text-rose-600 font-bold mt-1">
                  {errors.speed_sms_token.message}
                </p>
              )}

              <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                Để bảo mật, token được che khuất mặc định. Bạn chỉ cần điền token mới vào ô trên và lưu lại nếu cần cập nhật thay đổi.
              </p>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-100">
              <div className="text-[11px] text-gray-500 font-semibold flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <span>Hệ thống kết nối trực tiếp native</span>
              </div>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={fetchSmsConfig}
                  disabled={isSubmitting}
                  className="btn-outline text-xs px-4 py-2.5 flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
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
