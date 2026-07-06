"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { APP_SETTINGS } from "@/config/settings";
import {
  Package,
  FolderTree,
  Sliders,
  Layers,
  Globe,
  Languages,
  DollarSign,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  Sparkles,
  PieChart as PieIcon
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";

interface ActivityItem {
  date: string;
  count: number;
}

interface StatsData {
  total_products: number;
  active_products: number;
  inactive_products: number;
  total_categories: number;
  total_attributes: number;
  total_groups: number;
  total_families: number;
  total_locales: number;
  total_currencies: number;
  total_channels: number;
  completeness_rate: number;
  activity_data: ActivityItem[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const apiUrl = APP_SETTINGS.api.baseUrl;
      const res = await fetch(`${apiUrl}/dashboard/stats`);
      if (!res.ok) {
        throw new Error("Không thể tải thông tin thống kê từ máy chủ.");
      }
      const data: StatsData = await res.json();
      setStats(data);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Đã xảy ra lỗi khi kết nối API.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-8 animate-pulse max-w-7xl mx-auto">
        {/* Header Skeleton */}
        <div className="h-8 bg-slate-200 rounded-lg w-1/4"></div>

        {/* Overview Row Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-32 bg-slate-200 rounded-2xl"></div>
          ))}
        </div>

        {/* Structure & Chart Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 h-96 bg-slate-200 rounded-2xl"></div>
          <div className="h-96 bg-slate-200 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-8 max-w-xl mx-auto mt-20 text-center bg-slate-900 border border-slate-200 rounded-2xl shadow-lg">
        <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mx-auto text-rose-500 mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-slate-800 mb-2">Lỗi kết nối Backend</h3>
        <p className="text-xs text-slate-500 mb-6">{error || "Không có dữ liệu trả về từ API."}</p>
        <button
          onClick={fetchStats}
          className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/10 hover:bg-indigo-700 transition-colors"
        >
          Thử lại ngay
        </button>
      </div>
    );
  }

  // Format date string from YYYY-MM-DD to DD/MM
  const chartData = stats.activity_data.map(item => {
    const parts = item.date.split("-");
    return {
      name: parts.length === 3 ? `${parts[2]}/${parts[1]}` : item.date,
      "Sản phẩm": item.count
    };
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header welcome banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <span>Catalog Dashboard</span>
            <Sparkles className="w-5 h-5 text-indigo-500 animate-spin" style={{ animationDuration: '3s' }} />
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Quản lý tổng quan cấu trúc catalog, phân tích mức độ hoàn thiện dữ liệu và kênh bán hàng.
          </p>
        </div>
        <Link
          href="/catalog"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 hover:translate-x-0.5 active:translate-x-0 transition-all duration-200"
        >
          <span>Quản lý Sản phẩm</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Catalog Overview Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Products Card */}
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white p-6 rounded-2xl shadow-xl shadow-indigo-500/10 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-15 pointer-events-none group-hover:scale-110 transition-transform duration-300">
            <Package className="w-32 h-32" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-indigo-100">
              Tổng số Sản phẩm
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-900/10 flex items-center justify-center">
              <Package className="w-4 h-4 text-indigo-100" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold">{stats.total_products}</h3>
            <div className="flex items-center gap-2 mt-2 text-[10px] text-indigo-150">
              <span className="bg-slate-900/15 px-1.5 py-0.5 rounded font-bold">
                {stats.active_products} Đang bán
              </span>
              <span className="bg-slate-900/10 px-1.5 py-0.5 rounded font-bold">
                {stats.inactive_products} Nháp
              </span>
            </div>
          </div>
        </div>

        {/* Total Categories Card */}
        <div className="bg-slate-900 border border-slate-200/80 p-6 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden group hover:border-slate-350 hover:shadow-md transition-all duration-200">
          <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-300">
            <FolderTree className="w-32 h-32 text-slate-800" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
              Danh mục ngành hàng
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <FolderTree className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-slate-800">{stats.total_categories}</h3>
            <p className="text-[10px] text-slate-400 mt-2 font-medium">
              Định hình phân nhóm cấu trúc sản phẩm của PIM.
            </p>
          </div>
        </div>

        {/* Data Completeness Card */}
        <div className="bg-slate-900 border border-slate-200/80 p-6 rounded-2xl shadow-sm flex flex-col justify-between hover:border-slate-350 hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
              Độ hoàn thiện dữ liệu
            </span>
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-violet-600" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline justify-between mb-1.5">
              <h3 className="text-3xl font-extrabold text-slate-850">
                {stats.completeness_rate}%
              </h3>
              <span className="text-[10px] text-violet-600 font-bold bg-violet-50 px-1.5 py-0.5 rounded">
                Tiêu chuẩn PIM
              </span>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-violet-500 to-indigo-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${stats.completeness_rate}%` }}
              ></div>
            </div>
            <p className="text-[9px] text-slate-450 mt-2.5 font-medium leading-relaxed">
              Điểm dựa trên thông tin mô tả, thuộc tính kích thước/màu sắc, ảnh bìa và biến thể giá.
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Activity & Catalog Structure */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Analytics Chart */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-200/80 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">Hoạt động thêm sản phẩm</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Số lượng sản phẩm đăng ký mới trong 7 ngày qua</p>
            </div>
            <span className="text-[10px] text-indigo-600 bg-indigo-50 font-bold px-2 py-1 rounded-lg">
              7 ngày gần nhất
            </span>
          </div>

          <div className="h-72 w-full">
            {isMounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.9} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 600 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 600 }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "none",
                      borderRadius: "12px",
                      color: "#fff",
                      fontSize: "11px",
                      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)"
                    }}
                    labelStyle={{ fontWeight: "bold", color: "#818cf8" }}
                    cursor={{ fill: "#f8fafc" }}
                  />
                  <Bar dataKey="Sản phẩm" fill="url(#barColor)" radius={[6, 6, 0, 0]} maxBarSize={36}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry["Sản phẩm"] > 0 ? "url(#barColor)" : "#e2e8f0"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                Đang vẽ biểu đồ...
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Catalog Structure Counts */}
        <div className="bg-slate-900 border border-slate-200/80 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-sm font-extrabold text-slate-800">Cấu trúc dữ liệu PIM</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Cơ sở dữ liệu metadata được định dạng chuẩn chỉnh
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 flex-1">
            {/* Attributes */}
            <div className="border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/10 p-3.5 rounded-xl transition-all duration-200 flex flex-col justify-between group">
              <div className="flex items-center justify-between">
                <Sliders className="w-4 h-4 text-indigo-500 group-hover:scale-110 transition-transform" />
                <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                  Attrs
                </span>
              </div>
              <div className="mt-3">
                <span className="text-[10px] text-slate-400 font-bold block">Thuộc tính</span>
                <span className="text-base font-extrabold text-slate-700">{stats.total_attributes}</span>
              </div>
            </div>

            {/* Groups */}
            <div className="border border-slate-100 hover:border-violet-100 hover:bg-violet-50/10 p-3.5 rounded-xl transition-all duration-200 flex flex-col justify-between group">
              <div className="flex items-center justify-between">
                <Layers className="w-4 h-4 text-violet-500 group-hover:scale-110 transition-transform" />
                <span className="text-[9px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">
                  Groups
                </span>
              </div>
              <div className="mt-3">
                <span className="text-[10px] text-slate-400 font-bold block">Nhóm</span>
                <span className="text-base font-extrabold text-slate-700">{stats.total_groups}</span>
              </div>
            </div>

            {/* Families */}
            <div className="border border-slate-100 hover:border-emerald-100 hover:bg-emerald-50/10 p-3.5 rounded-xl transition-all duration-200 flex flex-col justify-between group">
              <div className="flex items-center justify-between">
                <FolderTree className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                  Families
                </span>
              </div>
              <div className="mt-3">
                <span className="text-[10px] text-slate-400 font-bold block">Họ thuộc tính</span>
                <span className="text-base font-extrabold text-slate-700">{stats.total_families}</span>
              </div>
            </div>

            {/* Channels */}
            <div className="border border-slate-100 hover:border-sky-100 hover:bg-sky-50/10 p-3.5 rounded-xl transition-all duration-200 flex flex-col justify-between group">
              <div className="flex items-center justify-between">
                <Globe className="w-4 h-4 text-sky-500 group-hover:scale-110 transition-transform" />
                <span className="text-[9px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded">
                  Channels
                </span>
              </div>
              <div className="mt-3">
                <span className="text-[10px] text-slate-400 font-bold block">Kênh bán</span>
                <span className="text-base font-extrabold text-slate-700">{stats.total_channels}</span>
              </div>
            </div>

            {/* Locales */}
            <div className="border border-slate-100 hover:border-amber-100 hover:bg-amber-50/10 p-3.5 rounded-xl transition-all duration-200 flex flex-col justify-between group">
              <div className="flex items-center justify-between">
                <Languages className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                  Locales
                </span>
              </div>
              <div className="mt-3">
                <span className="text-[10px] text-slate-400 font-bold block">Ngôn ngữ</span>
                <span className="text-base font-extrabold text-slate-700">{stats.total_locales}</span>
              </div>
            </div>

            {/* Currencies */}
            <div className="border border-slate-100 hover:border-rose-100 hover:bg-rose-50/10 p-3.5 rounded-xl transition-all duration-200 flex flex-col justify-between group">
              <div className="flex items-center justify-between">
                <DollarSign className="w-4 h-4 text-rose-500 group-hover:scale-110 transition-transform" />
                <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                  Currs
                </span>
              </div>
              <div className="mt-3">
                <span className="text-[10px] text-slate-400 font-bold block">Tiền tệ</span>
                <span className="text-base font-extrabold text-slate-700">{stats.total_currencies}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
