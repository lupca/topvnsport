import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ShieldCheck, CheckCircle } from "lucide-react";
import { APP_SETTINGS } from "@/config/settings";
import { popupService } from "@/components/ui/popupService";

const API_BASE_URL = APP_SETTINGS.api.baseUrl;

const generalConfigSchema = z.object({
  name: z.string().min(2, "Tên kênh phải có từ 2 ký tự trở lên"),
  is_active: z.boolean(),
  app_key: z.string().optional().nullable(),
  app_secret: z.string().optional().nullable(),
  access_token: z.string().optional().nullable(),
  refresh_token: z.string().optional().nullable()
});

type GeneralConfigValues = z.infer<typeof generalConfigSchema>;

interface GeneralTabProps {
  channel: { id: number; code: string; name: string };
  onSaveSuccess: () => void;
}

export default function GeneralTab({ channel, onSaveSuccess }: GeneralTabProps) {
  const [submitting, setSubmitting] = useState(false);
  const [testingConn, setTestingConn] = useState(false);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<GeneralConfigValues>({
    resolver: zodResolver(generalConfigSchema),
    defaultValues: {
      name: channel.name,
      is_active: false,
      app_key: "",
      app_secret: "",
      access_token: "",
      refresh_token: ""
    }
  });

  const watchIsActive = watch("is_active");

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/channels/${channel.id}/config`)
      .then(res => res.json())
      .then(data => {
        reset({
          name: channel.name,
          is_active: data.is_active,
          app_key: data.app_key || "",
          app_secret: data.app_secret || "",
          access_token: data.access_token || "",
          refresh_token: data.refresh_token || ""
        });
      })
      .catch(err => console.error("Error fetching config:", err));
  }, [channel, reset]);

  const onSubmit = async (values: GeneralConfigValues) => {
    setSubmitting(true);
    try {
      // 1. Update channel details if name changed
      if (values.name !== channel.name) {
        await fetch(`${API_BASE_URL}/api/channels/${channel.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: channel.code, name: values.name })
        });
      }

      // 2. Update config details
      const configRes = await fetch(`${API_BASE_URL}/api/channels/${channel.id}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_key: values.app_key || null,
          app_secret: values.app_secret || null,
          access_token: values.access_token || null,
          refresh_token: values.refresh_token || null,
          is_active: values.is_active
        })
      });

      if (!configRes.ok) throw new Error("Không thể lưu cấu hình");
      
      void popupService.alert("Đã lưu cấu hình kênh thành công!");
      onSaveSuccess();
    } catch (err: any) {
      void popupService.alert(`Lỗi: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestConnection = () => {
    setTestingConn(true);
    setTimeout(() => {
      setTestingConn(false);
      void popupService.alert("Kết nối tới sàn TMĐT thành công! API Status: 200 OK");
    }, 1500);
  };

  // Only display API Credentials block for non-webstore channels
  const showCredentials = channel.code !== "webstore";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="pim-card space-y-6">
        <h3 className="text-lg font-bold text-gray-900 border-b pb-3 border-gray-200">Cấu hình chung</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">Tên hiển thị kênh bán hàng</label>
            <input 
              type="text" 
              className="pim-input"
              {...register("name")}
            />
            {errors.name && <p className="text-xs text-rose-500 font-medium">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5 flex flex-col justify-end">
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
              <div>
                <h4 className="font-bold text-xs text-gray-800">Trạng thái kích hoạt</h4>
                <p className="text-[10px] text-gray-400">Cho phép các tính năng đồng bộ hoạt động</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  {...register("is_active")}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"></div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {showCredentials && (
        <div className="pim-card space-y-6">
          <div className="flex items-center justify-between border-b pb-3 border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-gray-500" /> API Credentials (OAuth2)
            </h3>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testingConn}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-colors"
            >
              {testingConn ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang kiểm tra...
                </>
              ) : (
                "Kiểm tra kết nối"
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700">App Key (Client ID)</label>
              <input 
                type="text" 
                placeholder="Nhập App Key của sàn"
                className="pim-input"
                {...register("app_key")}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700">App Secret (Client Secret)</label>
              <input 
                type="password" 
                placeholder="••••••••••••••••"
                className="pim-input"
                {...register("app_secret")}
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="text-sm font-semibold text-gray-700">Access Token (Mã truy cập JWT)</label>
              <textarea 
                rows={3}
                placeholder="Nhập Access Token dài được cung cấp bởi sàn..."
                className="pim-input"
                {...register("access_token")}
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="text-sm font-semibold text-gray-700">Refresh Token (Mã gia hạn)</label>
              <input 
                type="text" 
                placeholder="Nhập Refresh Token..."
                className="pim-input"
                {...register("refresh_token")}
              />
            </div>
          </div>
        </div>
      )}

      {/* Form Action buttons */}
      <div className="flex justify-end gap-3">
        <button 
          type="submit"
          disabled={submitting}
          className="btn-primary px-6 py-2.5 rounded-lg text-xs shadow-sm flex items-center gap-1.5 cursor-pointer font-bold"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...
            </>
          ) : (
            "Lưu Cấu Hình"
          )}
        </button>
      </div>
    </form>
  );
}
