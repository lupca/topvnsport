"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Search } from "lucide-react";

export default function Topbar() {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_username");
    localStorage.removeItem("pending_login_username");
    router.push("/login");
  };

  return (
    <header className="h-16 bg-surface border-b border-gray-200 px-6 flex items-center justify-between sticky top-0 z-40 shadow-sm">
      {/* Search Input bar */}
      <div className="w-96 relative hidden md:block">
        <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">
          <Search className="w-4 h-4" />
        </span>
        <input
          type="text"
          placeholder="Tìm kiếm nhanh trong danh mục..."
          className="pim-input pl-9 text-xs"
        />
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4 ml-auto">
        {/* Database Status Tag */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold tracking-wide border border-emerald-100">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span>PostgreSQL Active</span>
        </div>

        {/* Notifications Icon */}
        <button className="btn-icon relative">
          <Bell className="w-4.5 h-4.5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 border border-white"></span>
        </button>

        <div className="h-6 w-px bg-gray-200"></div>

        {/* User Info & Avatar */}
        <Link href="/account" className="flex items-center gap-3 hover:opacity-85 transition-opacity cursor-pointer">
          <div className="flex flex-col text-right">
            <span className="text-xs font-bold text-gray-800">Administrator</span>
            <span className="text-[10px] text-gray-500 font-semibold uppercase">PIM Owner</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-brand-primary font-bold text-xs">
            AD
          </div>
        </Link>

        <button
          onClick={handleLogout}
          className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors"
        >
          Đăng xuất
        </button>
      </div>
    </header>
  );
}
