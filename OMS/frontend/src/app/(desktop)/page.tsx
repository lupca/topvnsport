"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { APP_SETTINGS } from "@/config/settings";
import { api, Order } from "@/utils/api";
import { popupService, showConfirm } from "@/components/ui/popupService";
import {
  ShoppingCart,
  Users as UsersIcon,
  DollarSign,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Clock,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Bar,
  ComposedChart,
  Line,
  Legend
} from "recharts";

interface StatsData {
  order_count: number;
  revenue: number;
  customer_count: number;
  status_counts: Record<string, number>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch stats
      const statsData = await api.get<any>("/dashboard/stats");
      setStats(statsData);

      // Fetch recent 5 orders for table
      const ordersRes = await api.get<{ items: Order[] }>("/orders?limit=5");
      setRecentOrders(ordersRes.items || []);

      // Load 7 days daily activity stats from API
      const calculatedChartData = (statsData.daily_stats || []).map((day: any) => {
        const parts = day.date.split("-");
        const formattedDate = `${parts[2]}/${parts[1]}`;
        return {
          date: formattedDate,
          "Số lượng": day.count,
          "Doanh thu (VND)": day.revenue
        };
      });

      setChartData(calculatedChartData);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Đã xảy ra lỗi khi kết nối API.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmOrder = async (id: number) => {
    if (await showConfirm("Xác nhận duyệt đơn hàng này chuyển sang trạng thái PROCESSING?")) {
      try {
        await api.post(`/orders/${id}/confirm`, {});
        fetchData();
      } catch (err: any) {
        void popupService.alert("Duyệt đơn thất bại: " + err.message);
      }
    }
  };

  const handleCancelOrder = async (id: number) => {
    if (await showConfirm("Bạn có chắc chắn muốn hủy đơn hàng này?")) {
      try {
        await api.post(`/orders/${id}/cancel`, {});
        fetchData();
      } catch (err: any) {
        void popupService.alert("Hủy đơn thất bại: " + err.message);
      }
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-8 animate-pulse max-w-7xl mx-auto">
        <div className="h-8 bg-gray-200 rounded-lg w-1/4"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-28 bg-gray-200 rounded-2xl"></div>
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
      <div className="p-8 max-w-xl mx-auto mt-20 text-center bg-surface border border-gray-200 rounded-2xl shadow-lg text-gray-800">
        <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mx-auto text-rose-600 mb-4">
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

  // Calculate 6 stats
  const totalOrders = stats.order_count;
  const totalRevenue = stats.revenue;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  
  const pendingStatuses = ["DRAFT", "CONFIRMED", "PROCESSING", "PICKING", "PACKED", "SHIPPED"];
  const pendingOrders = Object.entries(stats.status_counts || {}).reduce((acc, [status, count]) => {
    return pendingStatuses.includes(status) ? acc + count : acc;
  }, 0);

  const completedOrders = stats.status_counts["COMPLETED"] || 0;
  const cancelledOrders = stats.status_counts["CANCELLED"] || 0;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 text-gray-800 bg-transparent">
      {/* Welcome banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
            <span>OMS Dashboard</span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Tổng quan hiệu suất hệ thống quản lý đơn hàng chuyên sâu.
          </p>
        </div>
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 hover:translate-x-0.5 active:translate-x-0 transition-all duration-200"
        >
          <span>Quản lý Đơn hàng</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* 6 Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Card 1: Total Orders */}
        <div className="bg-surface border border-gray-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all duration-200">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500">Đơn hàng</span>
              <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center border border-indigo-100">
                <ShoppingCart className="w-3 h-3 text-indigo-600" />
              </div>
            </div>
            <h3 className="text-xl font-extrabold text-gray-900 mt-3">{totalOrders}</h3>
          </div>
          <p className="text-[9px] text-gray-500 mt-2 font-medium">Tổng đơn hệ thống</p>
        </div>

        {/* Card 2: Revenue */}
        <div className="bg-surface border border-gray-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all duration-200">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500">Doanh thu</span>
              <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center border border-emerald-100">
                <DollarSign className="w-3 h-3 text-emerald-600" />
              </div>
            </div>
            <h3 className="text-sm font-extrabold text-gray-900 mt-3 truncate">{formatCurrency(totalRevenue)}</h3>
          </div>
          <p className="text-[9px] text-gray-500 mt-2 font-medium">Doanh thu tích lũy</p>
        </div>

        {/* Card 3: AOV */}
        <div className="bg-surface border border-gray-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all duration-200">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500">Giá trị TB</span>
              <div className="w-6 h-6 rounded-lg bg-violet-50 flex items-center justify-center border border-violet-100">
                <TrendingUp className="w-3 h-3 text-violet-600" />
              </div>
            </div>
            <h3 className="text-sm font-extrabold text-gray-900 mt-3 truncate">{formatCurrency(averageOrderValue)}</h3>
          </div>
          <p className="text-[9px] text-gray-500 mt-2 font-medium">Giá trị TB mỗi đơn</p>
        </div>

        {/* Card 4: Pending */}
        <div className="bg-surface border border-gray-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all duration-200">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500">Chờ xử lý</span>
              <div className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center border border-amber-100">
                <Clock className="w-3 h-3 text-amber-600" />
              </div>
            </div>
            <h3 className="text-xl font-extrabold text-gray-900 mt-3">{pendingOrders}</h3>
          </div>
          <p className="text-[9px] text-gray-500 mt-2 font-medium">Đơn đang tiến hành</p>
        </div>

        {/* Card 5: Completed */}
        <div className="bg-surface border border-gray-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all duration-200">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500">Hoàn thành</span>
              <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center border border-emerald-100">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              </div>
            </div>
            <h3 className="text-xl font-extrabold text-gray-900 mt-3">{completedOrders}</h3>
          </div>
          <p className="text-[9px] text-gray-500 mt-2 font-medium">Đơn thành công</p>
        </div>

        {/* Card 6: Cancelled */}
        <div className="bg-surface border border-gray-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all duration-200">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500">Đã hủy</span>
              <div className="w-6 h-6 rounded-lg bg-rose-50 flex items-center justify-center border border-rose-100">
                <XCircle className="w-3 h-3 text-rose-600" />
              </div>
            </div>
            <h3 className="text-xl font-extrabold text-gray-900 mt-3">{cancelledOrders}</h3>
          </div>
          <p className="text-[9px] text-gray-500 mt-2 font-medium">Đơn hàng bị hủy</p>
        </div>
      </div>

      {/* Main Grid: Chart & Recent Orders Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart Column */}
        <div className="lg:col-span-2 bg-surface border border-gray-200 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-sm font-extrabold text-gray-900">Biểu đồ 7 ngày gần đây</h3>
            <p className="text-[10px] text-gray-500 mt-0.5">Số lượng đơn hàng và doanh thu theo ngày</p>
          </div>

          <div className="h-80 w-full">
            {isMounted && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6b7280", fontSize: 10, fontWeight: 600 }}
                  />
                  <YAxis
                    yAxisId="left"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6b7280", fontSize: 10, fontWeight: 600 }}
                    allowDecimals={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#10b981", fontSize: 10, fontWeight: 600 }}
                    tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "12px",
                      color: "#111827",
                      fontSize: "11px",
                      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05)"
                    }}
                    labelStyle={{ fontWeight: "bold", color: "#4f46e5" }}
                    cursor={{ fill: "#f8fafc" }}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px', marginTop: '10px' }} />
                  <Bar yAxisId="left" dataKey="Số lượng" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  <Line yAxisId="right" type="monotone" dataKey="Doanh thu (VND)" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                Không có dữ liệu biểu đồ
              </div>
            )}
          </div>
        </div>

        {/* Recent Orders Column */}
        <div className="bg-surface border border-gray-200 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200">
              <div>
                <h3 className="text-sm font-extrabold text-gray-900">5 Đơn hàng gần nhất</h3>
                <p className="text-[10px] text-gray-500 mt-0.5">Danh sách các đơn mới ghi nhận</p>
              </div>
              <Link href="/orders" className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1">
                Tất cả <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="space-y-4">
              {recentOrders.map((order) => {
                const isDraft = order.status === "DRAFT";
                const isCancelable = !["SHIPPED", "CANCELLED", "COMPLETED"].includes(order.status);
                
                return (
                  <div key={order.id} className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-gray-900">{order.order_number}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        order.status === "DRAFT" ? "bg-gray-100 text-gray-700" :
                        order.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                        order.status === "CANCELLED" ? "bg-rose-50 text-rose-700 border border-rose-200" :
                        "bg-indigo-50 text-indigo-700 border border-indigo-200"
                      }`}>{order.status}</span>
                    </div>

                    <div className="flex justify-between text-gray-500 text-[10px]">
                      <span>KH: {order.customer?.name || `ID: ${order.customer_id}`}</span>
                      <span className="font-bold text-gray-700">{formatCurrency(order.total_amount)}</span>
                    </div>

                    <div className="flex justify-end gap-2 pt-1 border-t border-gray-200">
                      <Link href={`/orders?view=detail&id=${order.id}`} className="px-2 py-1 bg-white border border-gray-200 text-gray-700 rounded font-bold text-[10px] hover:bg-gray-50 transition-colors">
                        Chi tiết
                      </Link>
                      {isDraft && (
                        <button
                          onClick={() => handleConfirmOrder(order.id)}
                          className="px-2 py-1 bg-indigo-600 text-white rounded font-bold text-[10px] hover:bg-indigo-700 transition-colors"
                        >
                          Duyệt
                        </button>
                      )}
                      {isCancelable && (
                        <button
                          onClick={() => handleCancelOrder(order.id)}
                          className="px-2 py-1 bg-rose-50 border border-rose-200 text-rose-700 rounded font-bold text-[10px] hover:bg-rose-100 transition-colors"
                        >
                          Hủy đơn
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {recentOrders.length === 0 && (
                <div className="text-center py-8 text-xs text-gray-500">Không có đơn hàng nào gần đây.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
