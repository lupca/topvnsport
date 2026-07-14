"use client";

import React, { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Users, UserCheck, Shield, ArrowUpRight, Loader2, Package, ShoppingCart, Warehouse } from "lucide-react";
import { apiClient } from "@/utils/apiClient";
import { useToast } from "@/components/ui/Toast";

interface Staff {
  id: number;
  is_active: boolean;
}

interface Role {
  id: number;
}

export default function DashboardPage() {
  const { toast } = useToast();
  const [stats, setStats] = useState({
    totalStaff: 0,
    activeStaff: 0,
    totalRoles: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const pmiUrl = process.env.NEXT_PUBLIC_PMI_URL || "http://localhost:13100";
  const omsUrl = process.env.NEXT_PUBLIC_OMS_URL || "http://localhost:13101";
  const wmsUrl = process.env.NEXT_PUBLIC_WMS_URL || "http://localhost:13102";

  useEffect(() => {
    async function fetchStats() {
      setIsLoading(true);
      try {
        const [staffData, rolesData] = await Promise.all([
          apiClient.get("/staff/"),
          apiClient.get("/roles/"),
        ]);

        const staffs = (staffData || []) as Staff[];
        const roles = (rolesData || []) as Role[];

        setStats({
          totalStaff: staffs.length,
          activeStaff: staffs.filter((s) => s.is_active).length,
          totalRoles: roles.length,
        });
      } catch (err: any) {
        toast(err.message || "Không thể tải dữ liệu thống kê dashboard", "error");
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const systemLinks = [
    {
      name: "Hệ thống PMI",
      desc: "Quản lý thông tin sản phẩm, danh mục, thương hiệu và thông số kỹ thuật.",
      url: pmiUrl,
      color: "bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100/70",
      iconColor: "text-blue-500",
      icon: Package,
    },
    {
      name: "Hệ thống OMS",
      desc: "Quản lý đơn hàng, trạng thái xử lý, vận chuyển và hoàn tiền khách hàng.",
      url: omsUrl,
      color: "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100/70",
      iconColor: "text-emerald-500",
      icon: ShoppingCart,
    },
    {
      name: "Hệ thống WMS",
      desc: "Quản lý kho bãi, nhập kho, xuất kho, điều chuyển và kiểm kê hàng hóa.",
      url: wmsUrl,
      color: "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100/70",
      iconColor: "text-amber-500",
      icon: Warehouse,
    },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col gap-1 text-left">
          <h1 className="text-xl font-bold text-gray-900">Tổng quan hệ thống</h1>
          <p className="text-xs text-gray-500 font-semibold">
            Bảng điều khiển quản lý nhân sự, vai trò phân quyền và liên kết các phân hệ downstream.
          </p>
        </div>

        {/* Stats Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between animate-pulse"
              >
                <div className="space-y-2">
                  <div className="h-3 w-20 bg-gray-200 rounded"></div>
                  <div className="h-6 w-12 bg-gray-200 rounded"></div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-gray-200"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Staff */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
              <div className="text-left">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Tổng nhân sự</span>
                <p className="text-2xl font-black text-gray-800 mt-1">{stats.totalStaff}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                <Users className="w-5 h-5" />
              </div>
            </div>

            {/* Active Staff */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
              <div className="text-left">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Đang hoạt động</span>
                <p className="text-2xl font-black text-gray-800 mt-1">{stats.activeStaff}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
                <UserCheck className="w-5 h-5" />
              </div>
            </div>

            {/* Total Roles */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
              <div className="text-left">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Vai trò hệ thống</span>
                <p className="text-2xl font-black text-gray-800 mt-1">{stats.totalRoles}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                <Shield className="w-5 h-5" />
              </div>
            </div>
          </div>
        )}

        {/* Downstream Systems Section */}
        <div className="space-y-4">
          <div className="flex flex-col gap-1 text-left">
            <h2 className="text-sm font-bold text-gray-800">Liên kết phân hệ nghiệp vụ</h2>
            <p className="text-[11px] text-gray-400 font-medium">
              Truy cập nhanh tới các phân hệ nghiệp vụ thuộc hệ sinh thái TOP VN SPORT.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {systemLinks.map((sys) => {
              const Icon = sys.icon;
              return (
                <a
                  key={sys.name}
                  href={sys.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex flex-col p-5 rounded-2xl border transition-all text-left shadow-sm group ${sys.color}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2 rounded-xl bg-white/80 border border-current/10 ${sys.iconColor}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-gray-700 transition-colors" />
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">{sys.name}</h3>
                  <p className="text-[11px] text-gray-500 font-medium mt-1 leading-normal">
                    {sys.desc}
                  </p>
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
