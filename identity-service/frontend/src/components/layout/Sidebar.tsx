"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_SETTINGS } from "@/config/settings";
import {
  Home,
  Users,
  Shield,
  Settings,
  Package,
  ShoppingCart,
  Warehouse,
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const [userRole, setUserRole] = useState("");
  const [userUsername, setUserUsername] = useState("");

  useEffect(() => {
    setUserRole(localStorage.getItem("user_role") || "");
    setUserUsername(localStorage.getItem("user_username") || "");
  }, []);

  const pmiUrl = process.env.NEXT_PUBLIC_PMI_URL || "http://localhost:13100";
  const omsUrl = process.env.NEXT_PUBLIC_OMS_URL || "http://localhost:13101";
  const wmsUrl = process.env.NEXT_PUBLIC_WMS_URL || "http://localhost:13102";

  const menuItems = [
    { label: "Dashboard", href: "/dashboard", icon: Home, isExternal: false },
    { label: "Nhân sự", href: "/staff", icon: Users, isExternal: false },
    { label: "Vai trò", href: "/roles", icon: Shield, isExternal: false },
    { label: "Cài đặt", href: "/settings", icon: Settings, isExternal: false },
    { type: "divider" },
    { label: "PMI System", href: pmiUrl, icon: Package, isExternal: true },
    { label: "OMS System", href: omsUrl, icon: ShoppingCart, isExternal: true },
    { label: "WMS System", href: wmsUrl, icon: Warehouse, isExternal: true },
  ];

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-64 bg-surface text-gray-700 flex flex-col min-h-screen border-r border-gray-200 shadow-sm select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-gray-200 bg-white gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-brand-primary flex items-center justify-center shadow-sm font-bold text-white text-base tracking-wider">
          {APP_SETTINGS.appShortName}
        </div>
        <div>
          <h1 className="text-sm font-bold text-brand-accent tracking-wide uppercase">
            {APP_SETTINGS.appName}
          </h1>
          <span className="text-[10px] text-brand-primary font-semibold uppercase tracking-widest block -mt-0.5">
            {APP_SETTINGS.appSubtitle}
          </span>
        </div>
      </div>

      {/* Navigation menu */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
        {menuItems.map((item, idx) => {
          if (item.type === "divider") {
            return (
              <div key={`divider-${idx}`} className="my-4 border-t border-gray-200" />
            );
          }

          const active = !item.isExternal && isActive(item.href || "");
          const Icon = item.icon!;

          return (
            <div key={item.label}>
              {item.isExternal ? (
                <a
                  href={item.href || ""}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold hover:bg-gray-100 hover:text-gray-900 text-gray-500 transition-all duration-200"
                >
                  <Icon className="w-4.5 h-4.5 text-gray-400" />
                  <span>{item.label}</span>
                </a>
              ) : (
                <Link
                  href={item.href || ""}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    active
                      ? "bg-brand-primary text-white shadow-sm"
                      : "hover:bg-gray-100 hover:text-gray-900 text-gray-500"
                  }`}
                >
                  <Icon className={`w-4.5 h-4.5 ${active ? "text-white" : "text-gray-400"}`} />
                  <span>{item.label}</span>
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {/* Sidebar footer showing logged in info */}
      <div className="p-4 border-t border-gray-200 bg-white flex flex-col gap-2">
        {userUsername && (
          <div className="px-3 py-1 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Đang đăng nhập</p>
            <p className="text-xs font-bold text-gray-800 truncate">{userUsername}</p>
            <p className="text-[10px] text-gray-500 font-medium truncate capitalize">{userRole || "Nhân viên"}</p>
          </div>
        )}
        <div className="text-[10px] text-gray-400 text-center font-medium">
          Phiên bản {APP_SETTINGS.appVersion}
        </div>
      </div>
    </aside>
  );
}
