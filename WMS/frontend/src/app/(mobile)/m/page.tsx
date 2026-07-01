"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { PackageOpen, Scan, ArrowDownLeft, Search, Loader2, Barcode, ClipboardList, Package, Sliders } from "lucide-react";
import { APP_SETTINGS } from "@/config/settings";

interface DashboardStats {
  total_qty_on_hand: number;
  inbound_count: number;
  fulfillment_count: number;
}

export default function MobileDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${APP_SETTINGS.api.baseUrl}/dashboard/stats`)
      .then((res) => res.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load dashboard stats", err);
        setLoading(false);
      });
  }, []);

  const menuItems = [
    {
      name: "Nhặt hàng (Pick)",
      desc: "Quét EAN-13 nhặt sản phẩm",
      href: "/m/pick",
      icon: PackageOpen,
      color: "text-amber-400 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20",
    },
    {
      name: "Đóng gói (Pack)",
      desc: "Xác thực mã Code 128 / QR",
      href: "/m/pack",
      icon: Scan,
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20",
    },
    {
      name: "Nhận hàng (Receive)",
      desc: "Quét & nhập kho vị trí mới",
      href: "/m/receive",
      icon: ArrowDownLeft,
      color: "text-blue-400 bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20",
    },
    {
      name: "Kiểm kho (Check)",
      desc: "Quét & điều chỉnh lượng tồn",
      href: "/m/stock-check",
      icon: Sliders,
      color: "text-violet-400 bg-violet-500/10 border-violet-500/20 hover:bg-violet-500/20",
    },
    {
      name: "Tra cứu (Lookup)",
      desc: "Kiểm tra SKU & tồn kho",
      href: "/m/lookup",
      icon: Search,
      color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20 hover:bg-indigo-500/20",
    },
  ];

  return (
    <div className="space-y-6 max-w-md mx-auto">
      {/* Welcome Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
        <h1 className="text-lg font-bold text-slate-100">Xin chào, Scanner!</h1>
        <p className="text-xs text-slate-400">
          Hệ thống Quản lý Kho di động. Vui lòng chọn một tác vụ dưới đây hoặc sử dụng menu điều hướng phía dưới.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center space-y-1">
          <Package className="w-4 h-4 text-indigo-400 mx-auto" />
          <div className="text-xs text-slate-400">Tồn kho</div>
          <div className="text-sm font-extrabold">
            {loading ? <Loader2 className="w-3 h-3 animate-spin mx-auto text-slate-500" /> : stats?.total_qty_on_hand ?? 0}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center space-y-1">
          <ArrowDownLeft className="w-4 h-4 text-blue-400 mx-auto" />
          <div className="text-xs text-slate-400">Nhập kho</div>
          <div className="text-sm font-extrabold">
            {loading ? <Loader2 className="w-3 h-3 animate-spin mx-auto text-slate-500" /> : stats?.inbound_count ?? 0}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center space-y-1">
          <PackageOpen className="w-4 h-4 text-amber-400 mx-auto" />
          <div className="text-xs text-slate-400">Xuất kho</div>
          <div className="text-sm font-extrabold">
            {loading ? <Loader2 className="w-3 h-3 animate-spin mx-auto text-slate-500" /> : stats?.fulfillment_count ?? 0}
          </div>
        </div>
      </div>

      {/* Navigation Grid Menu */}
      <div className="grid grid-cols-2 gap-4">
        {menuItems.map((item, idx) => (
          <Link
            key={idx}
            href={item.href}
            className={`flex flex-col p-4 border rounded-2xl transition-all text-left gap-3 ${item.color}`}
          >
            <item.icon className="w-6 h-6" />
            <div className="space-y-1">
              <div className="text-xs font-bold text-slate-200">{item.name}</div>
              <div className="text-[10px] text-slate-400 font-medium leading-relaxed">{item.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
