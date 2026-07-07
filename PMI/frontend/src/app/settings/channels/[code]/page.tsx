"use client";

import React, { useState, useEffect } from "react";
import { ChevronLeft, Globe, Settings, Layers, AlertCircle, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { APP_SETTINGS } from "@/config/settings";

import GeneralTab from "./components/GeneralTab";
import CategoryMappingTab from "./components/CategoryMappingTab";
import AttributeMappingTab from "./components/AttributeMappingTab";

const API_BASE_URL = APP_SETTINGS.api.baseUrl;

interface Channel {
  id: number;
  code: string;
  name: string;
}

export default function ChannelDetailPage() {
  const params = useParams();
  const code = params.code as string;

  const [channel, setChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"general" | "category" | "attribute">("general");

  const fetchChannelData = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/channels`);
      if (!res.ok) throw new Error("Không thể tải thông tin kênh");
      const data: Channel[] = await res.json();
      const matched = data.find(c => c.code === code);
      if (!matched) {
        throw new Error(`Kênh bán hàng có mã '${code}' không tồn tại trên hệ thống.`);
      }
      setChannel(matched);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchChannelData();
  }, [code]);

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500 flex items-center justify-center gap-2 h-96">
        <span className="animate-spin inline-block w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full" />
        Đang tải thông tin kênh...
      </div>
    );
  }

  if (error || !channel) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-4">
        <Link 
          href="/settings/channels"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-brand-primary transition-colors mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Quay lại danh sách</span>
        </Link>
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 flex items-center gap-3">
          <AlertCircle className="h-6 w-6 text-rose-600 shrink-0" />
          <div>
            <h4 className="font-bold text-rose-900">Không tìm thấy kênh</h4>
            <p className="text-sm text-rose-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 select-none">
      {/* Breadcrumb Header */}
      <div className="space-y-4">
        <Link 
          href="/settings/channels"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-brand-primary transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Danh sách kênh</span>
        </Link>
        
        <div className="flex items-center justify-between border-b border-gray-200 pb-5">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-brand-light flex items-center justify-center font-black text-lg text-brand-primary">
              <ShoppingBag className="h-6 w-6 text-brand-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                Cấu hình kênh: {channel.name}
              </h1>
              <p className="text-xs text-gray-500 mt-1">Quản lý kết nối, đồng bộ, ánh xạ thuộc tính & danh mục sản phẩm</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs selectors */}
      <div className="pim-card space-y-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              type="button"
              onClick={() => setActiveTab("general")}
              className={`border-b-2 py-4 px-1 text-sm font-semibold transition-all flex items-center gap-2 ${
                activeTab === "general"
                  ? "border-brand-primary text-brand-primary font-bold"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              <Globe className="h-4 w-4" />
              Cấu hình chung & API
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("category")}
              className={`border-b-2 py-4 px-1 text-sm font-semibold transition-all flex items-center gap-2 ${
                activeTab === "category"
                  ? "border-brand-primary text-brand-primary font-bold"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              <Layers className="h-4 w-4" />
              Ánh xạ danh mục
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("attribute")}
              className={`border-b-2 py-4 px-1 text-sm font-semibold transition-all flex items-center gap-2 ${
                activeTab === "attribute"
                  ? "border-brand-primary text-brand-primary font-bold"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              <Settings className="h-4 w-4" />
              Ánh xạ thuộc tính
            </button>
          </nav>
        </div>

        {/* Tab contents */}
        <div className="py-4">
          {activeTab === "general" && (
            <GeneralTab channel={channel} onSaveSuccess={fetchChannelData} />
          )}
          {activeTab === "category" && (
            <CategoryMappingTab channel={channel} />
          )}
          {activeTab === "attribute" && (
            <AttributeMappingTab channel={channel} />
          )}
        </div>
      </div>
    </div>
  );
}
