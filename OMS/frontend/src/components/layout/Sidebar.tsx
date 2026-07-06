"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_SETTINGS } from "@/config/settings";
import {
  LayoutDashboard,
  ShoppingCart,
  Users as UsersIcon,
  RefreshCw,
  Globe,
  Truck,
  Settings as SettingsIcon,
  Shield,
  HelpCircle
} from "lucide-react";
import { popupService } from "@/components/ui/popupService";

export default function Sidebar() {
  const pathname = usePathname();

  const menuItems = [
    {
      title: "Chính",
      items: [
        { name: "Dashboard", href: "/", icon: LayoutDashboard },
        { name: "Đơn hàng (Orders)", href: "/orders", icon: ShoppingCart },
        { name: "Khách hàng (Customers)", href: "/customers", icon: UsersIcon },
      ],
    },
    {
      title: "Hàng hóa & Phân bổ",
      items: [
        { name: "Đồng bộ Catalog (Catalog Sync)", href: "#catalog", icon: RefreshCw },
      ],
    },
    {
      title: "Cài đặt hệ thống",
      items: [
        { name: "Kênh bán hàng (Channels)", href: "/channels", icon: Globe },
        { name: "Phương thức vận chuyển (Shipping)", href: "#shipping-methods", icon: Truck },
        { name: "Người dùng (Users)", href: "#users", icon: UsersIcon },
        { name: "Vai trò (Roles)", href: "#roles", icon: Shield },
      ],
    },
  ];

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  const handleUnderDev = (e: React.MouseEvent, name: string) => {
    if (e.currentTarget.getAttribute("href")?.startsWith("#")) {
      e.preventDefault();
      void popupService.alert(`Tính năng "${name}" là một phần của cấu trúc dữ liệu OMS (đã chuẩn chỉnh dưới Database). Giao diện quản lý chi tiết sẽ được phát triển trong phiên bản tiếp theo!`);
    }
  };

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col min-h-screen border-r border-slate-800 shadow-xl select-none">
      {/* Brand Logo & Name */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-950 gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/20 font-bold text-white text-base tracking-wider">
          {APP_SETTINGS.appShortName}
        </div>
        <div>
          <h1 className="text-sm font-bold text-white tracking-wide uppercase">{APP_SETTINGS.appName}</h1>
          <span className="text-[10px] text-indigo-400 font-semibold uppercase tracking-widest">{APP_SETTINGS.appSubtitle}</span>
        </div>
      </div>

      {/* Nav Menu Items */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-7 scrollbar-thin scrollbar-thumb-slate-800">
        {menuItems.map((section, idx) => (
          <div key={idx} className="space-y-2">
            <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-3">
              {section.title}
            </h2>
            <ul className="space-y-1">
              {section.items.map((item, itemIdx) => {
                const active = isActive(item.href);
                return (
                  <li key={itemIdx}>
                    <Link
                      href={item.href}
                      onClick={(e) => handleUnderDev(e, item.name)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                        active
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                          : "hover:bg-slate-800 hover:text-white text-slate-400"
                      }`}
                    >
                      <item.icon className={`w-4 h-4 ${active ? "text-white" : "text-slate-400 group-hover:text-white"}`} />
                      <span>{item.name}</span>
                      {item.href.startsWith("#") && (
                        <span className="ml-auto text-[9px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider group-hover:bg-slate-700">
                          Db
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-col gap-2">
        <div className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-400">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span>Kết nối Database ổn định</span>
        </div>
        <div className="text-[10px] text-slate-600 text-center font-medium">
          Phiên bản {APP_SETTINGS.appVersion} • {APP_SETTINGS.appName}
        </div>
      </div>
    </aside>
  );
}
