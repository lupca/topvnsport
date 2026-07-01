"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_SETTINGS } from "@/config/settings";
import {
  LayoutDashboard,
  Package,
  MapPin,
  ArrowDownLeft,
  ArrowUpRight,
  Printer,
  Home,
  Users as UsersIcon,
  Shield,
  HelpCircle,
  Barcode,
  History
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();

  const menuItems = [
    {
      title: "Chính",
      items: [
        { name: "Dashboard", href: "/", icon: LayoutDashboard },
        { name: "Tồn kho (Inventory)", href: "/inventory", icon: Package },
        { name: "Kho & Vị trí (Warehouses)", href: "/warehouses", icon: Home },
      ],
    },
    {
      title: "Giao dịch kho (Operations)",
      items: [
        { name: "Nhập kho (Inbound)", href: "/inbound", icon: ArrowDownLeft },
        { name: "Xuất kho (Fulfillment)", href: "/fulfillment", icon: ArrowUpRight },
        { name: "Lịch sử giao dịch", href: "/transactions", icon: History },
      ],
    },
    {
      title: "Cài đặt hệ thống",
      items: [
        { name: "Mã vạch (Barcodes)", href: "/barcode-mappings", icon: Barcode },
      ],
    },
  ];

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
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
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                        active
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                          : "hover:bg-slate-800 hover:text-white text-slate-400"
                      }`}
                    >
                      <item.icon className={`w-4 h-4 ${active ? "text-white" : "text-slate-400 group-hover:text-white"}`} />
                      <span>{item.name}</span>
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
