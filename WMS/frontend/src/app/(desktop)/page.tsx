"use client";
import { fetchWithAuth } from "@/utils/apiClient";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { APP_SETTINGS } from "@/config/settings";
import {
  Package,
  Home,
  MapPin,
  AlertCircle,
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  Activity,
  AlertTriangle
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

interface StatsData {
  warehouse_count: number;
  location_count: number;
  total_qty_on_hand: number;
  total_qty_reserved: number;
  inbound_count: number;
  fulfillment_count: number;
}

interface InventoryItem {
  id: number;
  sku_code: string;
  product_name: string;
  location_id: number;
  qty_on_hand: number;
  qty_reserved: number;
  qty_available: number;
  updated_at: string;
}

interface StockTransaction {
  id: number;
  sku_code: string;
  location_id: number;
  transaction_type: string;
  quantity: number;
  note: string | null;
  created_at: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);
  const [recentTx, setRecentTx] = useState<StockTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lowStockError, setLowStockError] = useState<string | null>(null);
  const [recentTxError, setRecentTxError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setLowStockError(null);
    setRecentTxError(null);
    const apiUrl = APP_SETTINGS.api.baseUrl;

    // 1. Fetch dashboard stats
    try {
      const statsRes = await fetchWithAuth(`${apiUrl}/dashboard/stats`);
      if (!statsRes.ok) throw new Error("Không thể tải thông tin thống kê.");
      const statsData: StatsData = await statsRes.json();
      setStats(statsData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Đã xảy ra lỗi khi kết nối API thống kê.");
      setLoading(false);
      return;
    }

    // 2. Fetch inventory for low-stock alerts
    try {
      const invRes = await fetchWithAuth(`${apiUrl}/inventory`);
      if (!invRes.ok) {
        throw new Error("Không thể tải thông tin tồn kho.");
      }
      const invData = await invRes.json();
      if (Array.isArray(invData)) {
        // Compute available and filter where qty_available < 10
        const lowStock = invData
          .map(item => ({
            ...item,
            qty_available: (item.qty_on_hand || 0) - (item.qty_reserved || 0)
          }))
          .filter(item => item.qty_available < 10);
        setLowStockItems(lowStock);
      } else {
        throw new Error("Dữ liệu tồn kho không hợp lệ.");
      }
    } catch (err: any) {
      console.error(err);
      setLowStockError(err.message || "Lỗi tải cảnh báo hết hàng.");
      setLowStockItems([]);
    }

    // 3. Fetch recent transactions
    try {
      const txRes = await fetchWithAuth(`${apiUrl}/stock-transactions`);
      if (!txRes.ok) {
        throw new Error("Không thể tải thông tin lịch sử giao dịch.");
      }
      const txData = await txRes.json();
      if (Array.isArray(txData)) {
        // Sort and slice to top 10
        setRecentTx(txData.slice(0, 10));
      } else {
        throw new Error("Dữ liệu lịch sử giao dịch không hợp lệ.");
      }
    } catch (err: any) {
      console.error(err);
      setRecentTxError(err.message || "Lỗi tải lịch sử giao dịch kho.");
      setRecentTx([]);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="p-8 space-y-8 animate-pulse max-w-7xl mx-auto">
        <div className="h-8 bg-gray-200 rounded-lg w-1/4"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-32 bg-gray-200 rounded-2xl"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 h-96 bg-gray-200 rounded-2xl"></div>
          <div className="h-96 bg-gray-200 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-8 max-w-xl mx-auto mt-20 text-center bg-surface border border-gray-200 rounded-2xl shadow-lg">
        <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mx-auto text-rose-500 mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-gray-900 mb-2">Lỗi kết nối Backend</h3>
        <p className="text-sm text-gray-500 mb-6">{error || "Không có dữ liệu trả về từ API."}</p>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/10 hover:bg-indigo-700 transition-colors"
        >
          Thử lại ngay
        </button>
      </div>
    );
  }

  const chartData = [
    { name: "Tồn thực tế", "Số lượng": stats.total_qty_on_hand },
    { name: "Đã giữ hàng", "Số lượng": stats.total_qty_reserved },
    { name: "Đơn nhập kho", "Số lượng": stats.inbound_count },
    { name: "Đơn xuất kho", "Số lượng": stats.fulfillment_count }
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-transparent text-gray-900">
      {/* Header banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
            <span>WMS Dashboard</span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Hệ thống quản lý kho hàng chuyên sâu - Theo dõi tồn kho thực tế, vị trí ô kệ và các giao dịch kho.
          </p>
        </div>
        <Link
          href="/inventory"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 hover:translate-x-0.5 active:translate-x-0 transition-all duration-200"
        >
          <span>Quản lý Tồn kho</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white p-6 rounded-2xl shadow-xl shadow-indigo-500/10 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-15 pointer-events-none group-hover:scale-110 transition-transform duration-300">
            <Package className="w-32 h-32" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-indigo-100">
              Tổng số lượng tồn kho (On Hand)
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-600/10 flex items-center justify-center">
              <Package className="w-4 h-4 text-indigo-100" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold">{stats.total_qty_on_hand}</h3>
            <p className="text-[10px] text-indigo-100/80 mt-2 font-medium">
              Đã giữ hàng: {stats.total_qty_reserved} • Khả dụng: {stats.total_qty_on_hand - stats.total_qty_reserved}
            </p>
          </div>
        </div>

        <div className="bg-surface border border-gray-200 p-6 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden group hover:border-gray-300 hover:shadow-md transition-all duration-200">
          <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-300">
            <Home className="w-32 h-32 text-gray-200" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-gray-500">
              Kho hàng hoạt động
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <Home className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-gray-900">{stats.warehouse_count}</h3>
            <p className="text-[10px] text-gray-500 mt-2 font-medium">
              Số lượng chi nhánh kho được cấu hình trên hệ thống.
            </p>
          </div>
        </div>

        <div className="bg-surface border border-gray-200 p-6 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden group hover:border-gray-300 hover:shadow-md transition-all duration-200">
          <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-300">
            <MapPin className="w-32 h-32 text-gray-200" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-gray-500">
              Tổng số Vị trí / Ô kệ
            </span>
            <div className="w-8 h-8 rounded-lg bg-violet-50 border border-violet-200 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-violet-600" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-gray-900">{stats.location_count}</h3>
            <p className="text-[10px] text-gray-500 mt-2 font-medium">
              Số lượng ô kệ lưu trữ đã định danh.
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Status Chart & Low-Stock alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-surface border border-gray-200 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-extrabold text-gray-900">Biểu đồ Chỉ số Kho</h3>
              <p className="text-[10px] text-gray-500 mt-0.5">So sánh định lượng tồn kho và các lệnh giao dịch</p>
            </div>
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
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6b7280", fontSize: 10, fontWeight: 600 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6b7280", fontSize: 10, fontWeight: 600 }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "12px",
                      color: "#111827",
                      fontSize: "11px",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
                    }}
                    labelStyle={{ fontWeight: "bold", color: "#4f46e5" }}
                    cursor={{ fill: "#f8fafc" }}
                  />
                  <Bar dataKey="Số lượng" fill="url(#barColor)" radius={[6, 6, 0, 0]} maxBarSize={36}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry["Số lượng"] > 0 ? "url(#barColor)" : "#d1d5db"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                Đang vẽ biểu đồ...
              </div>
            )}
          </div>
        </div>

        {/* Low-stock Warning Alerts */}
        <div className="bg-surface border border-gray-200 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="mb-4 border-b pb-3 border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-gray-900">Cảnh báo hết hàng</h3>
              <p className="text-[10px] text-gray-500 mt-0.5">Sản phẩm có tồn khả dụng ít hơn 10</p>
            </div>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>

          <div className="flex-1 overflow-y-auto max-h-64 space-y-2">
            {lowStockError ? (
              <div className="text-xs text-rose-500 text-center py-8 font-medium">{lowStockError}</div>
            ) : lowStockItems.length === 0 ? (
              <div className="text-xs text-gray-500 text-center py-8">Chưa có cảnh báo nào</div>
            ) : (
              lowStockItems.map((item) => (
                <div key={item.id} className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex justify-between items-center">
                  <div>
                    <p className="text-xs font-bold text-gray-900">{item.product_name}</p>
                    <p className="text-[10px] text-gray-500">SKU: {item.sku_code}</p>
                  </div>
                  <span className="text-xs font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                    Khả dụng: {item.qty_available}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 10 Most Recent Transactions */}
      <div className="bg-surface border border-gray-200 p-6 rounded-2xl shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-gray-900">10 Giao dịch kho gần nhất</h3>
            <p className="text-[10px] text-gray-500 mt-0.5">Lịch sử biến động tồn kho chi tiết</p>
          </div>
          <Activity className="w-4 h-4 text-indigo-600" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 font-bold">
                <th className="py-2.5">Thời gian</th>
                <th className="py-2.5">SKU</th>
                <th className="py-2.5">Loại</th>
                <th className="py-2.5">Số lượng</th>
                <th className="py-2.5">Vị trí ID</th>
                <th className="py-2.5">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {recentTxError ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-rose-500 font-medium">
                    {recentTxError}
                  </td>
                </tr>
              ) : recentTx.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    Chưa có giao dịch nào được ghi nhận.
                  </td>
                </tr>
              ) : (
                recentTx.map((tx) => (
                  <tr key={tx.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2.5 text-gray-500">
                      {new Date(tx.created_at).toLocaleString("vi-VN")}
                    </td>
                    <td className="py-2.5 font-semibold text-gray-900">{tx.sku_code}</td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        tx.transaction_type === "INBOUND" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                        tx.transaction_type === "OUTBOUND" ? "bg-rose-50 text-rose-700 border border-rose-200" :
                        tx.transaction_type === "ADJUST" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                        tx.transaction_type === "TRANSFER" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                        "bg-gray-100 text-gray-700"
                      }`}>
                        {tx.transaction_type}
                      </span>
                    </td>
                    <td className={`py-2.5 font-bold ${tx.quantity >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {tx.quantity >= 0 ? `+${tx.quantity}` : tx.quantity}
                    </td>
                    <td className="py-2.5 text-gray-700">{tx.location_id}</td>
                    <td className="py-2.5 text-gray-500 italic">{tx.note || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
