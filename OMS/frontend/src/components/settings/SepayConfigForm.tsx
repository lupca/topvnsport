"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  getSepayConfig,
  updateSepayConfig,
  testSepayConnection,
  SepayConfig,
} from "@/services/configApi";
import {
  AlertCircle,
  CheckCircle,
  CreditCard,
  Eye,
  EyeOff,
  Globe,
  Key,
  Link,
  RefreshCw,
  Save,
  Send,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const sepayConfigSchema = z.object({
  sepay_merchant_id: z.string().min(1, "Merchant ID không được để trống"),
  sepay_secret_key: z.string().min(1, "Secret Key không được để trống"),
  sepay_checkout_url: z
    .string()
    .min(1, "Checkout URL không được để trống")
    .url("Checkout URL không hợp lệ"),
  web_base_url: z
    .string()
    .min(1, "Web Base URL không được để trống")
    .url("Web Base URL không hợp lệ"),
});

export type SepayConfigFormValues = z.infer<typeof sepayConfigSchema>;

const DEFAULT_SEPAY_CONFIG: SepayConfigFormValues = {
  sepay_merchant_id: "",
  sepay_secret_key: "",
  sepay_checkout_url: "https://pay.sepay.vn/v1/checkout/init",
  web_base_url: "https://topvnsport.vn",
};

export default function SepayConfigForm() {
  const [loading, setLoading] = useState(true);
  const [originalConfig, setOriginalConfig] =
    useState<SepayConfigFormValues>(DEFAULT_SEPAY_CONFIG);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SepayConfigFormValues>({
    resolver: zodResolver(sepayConfigSchema),
    defaultValues: DEFAULT_SEPAY_CONFIG,
  });

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      setSuccessMessage(null);
      setErrorMessage(null);
      setTestResult(null);

      const response = await getSepayConfig();
      const fetchedConfig: SepayConfigFormValues = {
        sepay_merchant_id: response.sepay_merchant_id || "",
        sepay_secret_key: response.sepay_secret_key || "",
        sepay_checkout_url:
          response.sepay_checkout_url || "https://pay.sepay.vn/v1/checkout/init",
        web_base_url: response.web_base_url || "https://topvnsport.vn",
      };

      setOriginalConfig(fetchedConfig);
      reset(fetchedConfig);
    } catch (err: any) {
      console.error(err);
      setErrorMessage("Không thể tải cấu hình SePay từ hệ thống.");
    } finally {
      setLoading(false);
    }
  }, [reset]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleFormSubmit = async (data: SepayConfigFormValues) => {
    setSuccessMessage(null);
    setErrorMessage(null);
    setTestResult(null);

    const payload: Partial<SepayConfigFormValues> = {};
    if (data.sepay_merchant_id !== originalConfig.sepay_merchant_id) {
      payload.sepay_merchant_id = data.sepay_merchant_id;
    }
    if (
      data.sepay_secret_key !== originalConfig.sepay_secret_key &&
      !data.sepay_secret_key.includes("*")
    ) {
      payload.sepay_secret_key = data.sepay_secret_key;
    } else if (!data.sepay_secret_key.includes("*")) {
      payload.sepay_secret_key = data.sepay_secret_key;
    }
    if (data.sepay_checkout_url !== originalConfig.sepay_checkout_url) {
      payload.sepay_checkout_url = data.sepay_checkout_url;
    }
    if (data.web_base_url !== originalConfig.web_base_url) {
      payload.web_base_url = data.web_base_url;
    }

    try {
      setIsSubmitting(true);
      const updated = await updateSepayConfig(data);
      setOriginalConfig({
        sepay_merchant_id: updated.sepay_merchant_id || data.sepay_merchant_id,
        sepay_secret_key: updated.sepay_secret_key || data.sepay_secret_key,
        sepay_checkout_url: updated.sepay_checkout_url || data.sepay_checkout_url,
        web_base_url: updated.web_base_url || data.web_base_url,
      });
      reset({
        sepay_merchant_id: updated.sepay_merchant_id || data.sepay_merchant_id,
        sepay_secret_key: updated.sepay_secret_key || data.sepay_secret_key,
        sepay_checkout_url: updated.sepay_checkout_url || data.sepay_checkout_url,
        web_base_url: updated.web_base_url || data.web_base_url,
      });
      setSuccessMessage("Cấu hình SePay đã được lưu thành công.");
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Cập nhật cấu hình SePay thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestConnection = async () => {
    setSuccessMessage(null);
    setErrorMessage(null);
    setTestResult(null);

    try {
      setIsTesting(true);
      const result = await testSepayConnection();
      setTestResult(result);
    } catch (err: any) {
      console.error(err);
      setTestResult({
        success: false,
        message: err.message || "Kiểm tra kết nối SePay thất bại.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-brand-primary" />
        <span>Đang tải thông tin cấu hình SePay...</span>
      </div>
    );
  }

  return (
    <div className="pim-card bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
      <div className="border-b border-gray-200 pb-4 flex items-center justify-between">
        <h3 className="pim-card-header text-sm font-bold text-gray-950 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-brand-primary" />
          <span>Thông tin cấu hình Cổng thanh toán SePay</span>
        </h3>
      </div>

      {successMessage && (
        <div
          role="status"
          className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2"
        >
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {testResult && (
        <div
          role="region"
          aria-label="kết quả kiểm tra kết nối"
          className={`p-4 rounded-xl text-xs flex items-center gap-2 ${
            testResult.success
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : "bg-rose-50 border border-rose-200 text-rose-800"
          }`}
        >
          {testResult.success ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{testResult.message}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
        {/* Merchant ID */}
        <div className="space-y-1.5">
          <label
            htmlFor="sepay_merchant_id"
            className="pim-label text-[11px] font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1"
          >
            <span>SePay Merchant ID</span>
            <span className="text-rose-600">*</span>
          </label>
          <input
            id="sepay_merchant_id"
            type="text"
            placeholder="Nhập SePay Merchant ID..."
            className="pim-input w-full font-mono text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
            disabled={isSubmitting || isTesting}
            {...register("sepay_merchant_id")}
          />
          {errors.sepay_merchant_id && (
            <p className="text-[11px] text-rose-600 font-bold mt-1">
              {errors.sepay_merchant_id.message}
            </p>
          )}
        </div>

        {/* Secret Key */}
        <div className="space-y-1.5">
          <label
            htmlFor="sepay_secret_key"
            className="pim-label text-[11px] font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1"
          >
            <span>SePay Secret Key</span>
            <span className="text-rose-600">*</span>
          </label>
          <div className="relative">
            <input
              id="sepay_secret_key"
              type={showSecretKey ? "text" : "password"}
              placeholder="Nhập SePay Secret Key..."
              autoComplete="new-password"
              className="pim-input w-full font-mono text-sm pr-12 px-3.5 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
              disabled={isSubmitting || isTesting}
              {...register("sepay_secret_key")}
            />
            <button
              type="button"
              onClick={() => setShowSecretKey((prev) => !prev)}
              disabled={isSubmitting || isTesting}
              aria-label={showSecretKey ? "Ẩn Secret Key" : "Hiện Secret Key"}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
            >
              {showSecretKey ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {errors.sepay_secret_key && (
            <p className="text-[11px] text-rose-600 font-bold mt-1">
              {errors.sepay_secret_key.message}
            </p>
          )}
        </div>

        {/* Checkout URL */}
        <div className="space-y-1.5">
          <label
            htmlFor="sepay_checkout_url"
            className="pim-label text-[11px] font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1"
          >
            <span>SePay Checkout URL</span>
            <span className="text-rose-600">*</span>
          </label>
          <input
            id="sepay_checkout_url"
            type="text"
            placeholder="https://pay.sepay.vn/v1/checkout/init"
            className="pim-input w-full font-mono text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
            disabled={isSubmitting || isTesting}
            {...register("sepay_checkout_url")}
          />
          {errors.sepay_checkout_url && (
            <p className="text-[11px] text-rose-600 font-bold mt-1">
              {errors.sepay_checkout_url.message}
            </p>
          )}
        </div>

        {/* Web Base URL */}
        <div className="space-y-1.5">
          <label
            htmlFor="web_base_url"
            className="pim-label text-[11px] font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1"
          >
            <span>Web Base URL</span>
            <span className="text-rose-600">*</span>
          </label>
          <input
            id="web_base_url"
            type="text"
            placeholder="https://topvnsport.vn"
            className="pim-input w-full font-mono text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
            disabled={isSubmitting || isTesting}
            {...register("web_base_url")}
          />
          {errors.web_base_url && (
            <p className="text-[11px] text-rose-600 font-bold mt-1">
              {errors.web_base_url.message}
            </p>
          )}
        </div>

        <p className="text-[11px] text-gray-400 leading-relaxed pt-2">
          Secret key sẽ được mã hóa an toàn ở mức Database (Fernet encryption) và được che giấu trên giao diện quản trị.
        </p>

        {/* Actions */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-100">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isSubmitting || isTesting}
            className="px-4 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {isTesting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-primary" />
            ) : (
              <Send className="w-3.5 h-3.5 text-gray-500" />
            )}
            <span>{isTesting ? "Đang kiểm tra..." : "Test Connection"}</span>
          </button>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={fetchConfig}
              disabled={isSubmitting || isTesting}
              className="px-4 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tải lại</span>
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isTesting}
              className="px-5 py-2.5 rounded-xl bg-brand-primary text-white hover:bg-brand-primary/90 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-sm"
            >
              {isSubmitting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Lưu cấu hình</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
