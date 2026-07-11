"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_SETTINGS } from "@/config/settings";
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  RefreshCw,
  Globe,
  Truck,
  Shield
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
        { name: "Khách hàng (Customers)", href: "/customers", icon: Users },
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
        { name: "Người dùng (Users)", href: "#users", icon: Users },
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
    <aside className="w-64 bg-surface text-gray-700 flex flex-col min-h-screen border-r border-gray-200 shadow-sm select-none">
      {/* Brand Logo & Name */}
      <div className="h-16 flex items-center px-6 border-b border-gray-200 bg-white gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-brand-primary flex items-center justify-center shadow-sm font-bold text-white text-base tracking-wider">
          {APP_SETTINGS.appShortName}
        </div>
        <div>
          <h1 className="text-sm font-bold text-brand-accent tracking-wide uppercase">{APP_SETTINGS.appName}</h1>
          <span className="text-[10px] text-brand-primary font-semibold uppercase tracking-widest">{APP_SETTINGS.appSubtitle}</span>
        </div>
      </div>

      {/* Nav Menu Items */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-7 scrollbar-hide">
        {menuItems.map((section, idx) => (
          <div key={idx} className="space-y-2">
            <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-3">
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
                          ? "bg-brand-primary text-white shadow-sm"
                          : "hover:bg-gray-100 hover:text-gray-900 text-gray-500"
                      }`}
                    >
                      <item.icon className={`w-4 h-4 ${active ? "text-white" : "text-gray-400"}`} />
                      <span>{item.name}</span>
                      {item.href.startsWith("#") && (
                        <span className="ml-auto text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
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
      <div className="p-4 border-t border-gray-200 bg-white flex flex-col gap-2">
        <div className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-gray-500">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span>Kết nối Database ổn định</span>
        </div>
        <div className="text-[10px] text-gray-400 text-center font-medium">
          Phiên bản {APP_SETTINGS.appVersion} • {APP_SETTINGS.appName}
        </div>
      </div>
    </aside>
  );
}
