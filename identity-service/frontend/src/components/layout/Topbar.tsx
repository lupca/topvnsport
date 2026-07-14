"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Search, LogOut } from "lucide-react";

export default function Topbar() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("");

  useEffect(() => {
    setUsername(localStorage.getItem("user_username") || "User");
    setRole(localStorage.getItem("user_role") || "Staff");
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_username");
    router.push("/login");
  };

  const getInitials = (name: string) => {
    if (!name) return "US";
    return name
      .split("_")
      .join(" ")
      .split(" ")
      .map((part) => part[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
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
          placeholder="Tìm kiếm..."
          className="w-full px-4 py-2.5 pl-9 text-xs rounded-xl border border-gray-300 bg-surface text-gray-900 transition-all focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary placeholder:text-gray-400"
        />
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4 ml-auto">
        {/* Status Tag */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold tracking-wide border border-emerald-100">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span>SSO Database Active</span>
        </div>

        {/* Notifications Icon */}
        <button className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all relative">
          <Bell className="w-4.5 h-4.5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 border border-white"></span>
        </button>

        <div className="h-6 w-px bg-gray-200"></div>

        {/* User Info & Avatar */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col text-right hidden sm:flex">
            <span className="text-xs font-bold text-gray-800">{username}</span>
            <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">{role}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary font-bold text-xs">
            {getInitials(username)}
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Đăng xuất</span>
        </button>
      </div>
    </header>
  );
}
