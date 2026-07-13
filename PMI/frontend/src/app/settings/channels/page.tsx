"use client";

import React, { useState, useEffect } from "react";
import { Plus, Globe, Settings, AlertCircle, ShoppingBag, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { APP_SETTINGS } from "@/config/settings";
import { popupService, showConfirm } from "@/components/ui/popupService";
import { fetchWithAuth, apiClient } from "@/utils/apiClient";

const API_BASE_URL = APP_SETTINGS.api.baseUrl;

interface Channel {
  id: number;
  code: string;
  name: string;
}

interface ChannelConfig {
  id: number;
  channel_id: number;
  is_active: boolean;
}

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [configs, setConfigs] = useState<Record<number, ChannelConfig>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const chanData: Channel[] = await fetchWithAuth("/api/channels");
        setChannels(chanData);

        const configPromises = chanData.map(c =>
          fetchWithAuth(`/api/channels/${c.id}/config`)
            .catch(() => null)
        );
        const configData = await Promise.all(configPromises);
        const configMap: Record<number, ChannelConfig> = {};
        configData.forEach(conf => {
          if (conf) {
            configMap[conf.channel_id] = conf;
          }
        });
        setConfigs(configMap);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, []);

  const handleAddChannel = () => {
    void popupService.alert("Tính năng đăng ký kênh bán hàng mới đang được phát triển.");
  };

  const handleDeleteChannel = async (chan: Channel) => {
    if (chan.code === "webstore") {
      void popupService.alert("Không thể xóa kênh bán hàng cốt lõi (Default Webstore).");
      return;
    }

    const confirmed = await showConfirm(`Bạn có chắc chắn muốn xóa kênh bán hàng "${chan.name}"? Tất cả cấu hình và ánh xạ liên quan sẽ bị xóa vĩnh viễn.`);
    if (!confirmed) return;

    try {
      await apiClient.delete(`/api/channels/${chan.id}`);
      setChannels(prev => prev.filter(c => c.id !== chan.id));
      void popupService.alert("Đã xóa kênh bán hàng thành công!");
    } catch (err: any) {
      void popupService.alert(`Lỗi khi xóa: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500 flex items-center justify-center gap-2 h-96">
        <span className="animate-spin inline-block w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full" />
        Đang tải danh sách kênh bán hàng...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 flex items-center gap-3">
          <AlertCircle className="h-6 w-6 text-rose-600 shrink-0" />
          <div>
            <h4 className="font-bold text-rose-900">Lỗi kết nối API</h4>
            <p className="text-sm text-rose-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-brand-primary" />
            Kênh Bán Hàng (Sales Channels)
          </h1>
          <p className="text-xs text-gray-500 mt-1">Cấu hình đồng bộ sản phẩm, ánh xạ ngành hàng và thuộc tính với các sàn TMĐT</p>
        </div>
        <button
          onClick={handleAddChannel}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 btn-primary text-gray-900 text-xs font-bold rounded-lg shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm Kênh Mới</span>
        </button>
      </div>

      {/* Grid of channels */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {channels.map(chan => {
          const config = configs[chan.id];
          const isActive = config?.is_active ?? false;
          
          // Style config for card depending on channel code
          let cardBg = "from-blue-50/50 to-indigo-50/20";
          let iconColor = "text-blue-600";
          let logoText = chan.name.substring(0, 2).toUpperCase();

          if (chan.code.includes("shopee")) {
            cardBg = "from-orange-50/50 to-amber-50/20";
            iconColor = "text-orange-500";
          } else if (chan.code.includes("tiktok")) {
            cardBg = "from-gray-50 to-gray-100/50";
            iconColor = "text-gray-900";
          } else if (chan.code.includes("lazada")) {
            cardBg = "from-indigo-50/50 to-blue-50/20";
            iconColor = "text-indigo-600";
          }

          return (
            <div 
              key={chan.id}
              className="bg-surface border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md hover:border-gray-300 transition-all group duration-200"
            >
              <div className={`p-6 bg-gradient-to-br ${cardBg} border-b border-gray-200/50 flex items-start justify-between`}>
                <div className="flex gap-4 items-center">
                  <div className="h-12 w-12 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center font-black text-lg text-gray-800">
                    <span className={iconColor}>{logoText}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm group-hover:text-brand-primary transition-colors">{chan.name}</h3>
                    <code className="text-[10px] text-gray-400 font-mono mt-0.5 block">{chan.code}</code>
                  </div>
                </div>
                
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isActive 
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-250/20"
                    : "bg-gray-100 text-gray-400 border border-gray-200"
                }`}>
                  <span className={`w-1 h-1 rounded-full ${isActive ? "bg-emerald-500" : "bg-gray-300"}`} />
                  {isActive ? "Đang hoạt động" : "Tạm tắt"}
                </span>
              </div>

              <div className="p-6 bg-white space-y-4 flex-1 flex flex-col justify-between">
                <p className="text-xs text-gray-500 leading-relaxed">
                  Đồng bộ tự động danh sách sản phẩm, quản lý tồn kho, giá bán và cấu hình vận chuyển chi tiết trên {chan.name}.
                </p>

                <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[11px] text-gray-400">
                    <ShieldCheck className="h-3.5 w-3.5 text-gray-400" />
                    <span>OAuth2 Connection</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link 
                      href={`/settings/channels/${chan.code}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg hover:border-brand-primary hover:bg-blue-50 text-xs font-semibold text-gray-600 hover:text-brand-primary transition-all duration-150 cursor-pointer"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      Cấu hình
                    </Link>
                    {chan.code !== "webstore" && (
                      <button
                        onClick={() => void handleDeleteChannel(chan)}
                        className="inline-flex items-center gap-1 px-2 py-1.5 border border-gray-300 rounded-lg hover:border-rose-600 hover:bg-rose-50 text-xs font-semibold text-gray-500 hover:text-rose-600 transition-all duration-150 cursor-pointer"
                        title="Xóa kênh bán hàng"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
