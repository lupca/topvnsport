"use client";

import React from "react";
import Link from "next/link";
import { Bell, Search, User, LogOut, ShieldAlert } from "lucide-react";

export default function Topbar() {
  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between sticky top-0 z-40 shadow-sm shadow-slate-100/50">
      {/* Search Input bar */}
      <div className="w-96 relative hidden md:block">
        <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </span>
        <input
          type="text"
          placeholder="Tìm kiếm nhanh trong danh mục..."
          className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition-all text-slate-700"
        />
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4 ml-auto">
        {/* Database Status Tag */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
          <span>PostgreSQL Active</span>
        </div>

        {/* Notifications Icon */}
        <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all relative">
          <Bell className="w-4.5 h-4.5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 border border-white"></span>
        </button>

        <div className="h-6 w-px bg-slate-200"></div>

        {/* User Info & Avatar */}
        <Link href="/account" className="flex items-center gap-3 hover:opacity-85 transition-opacity cursor-pointer">
          <div className="flex flex-col text-right">
            <span className="text-xs font-bold text-slate-800">Administrator</span>
            <span className="text-[10px] text-slate-400 font-semibold uppercase">PIM Owner</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-indigo-600 font-bold text-xs shadow-inner">
            AD
          </div>
        </Link>
      </div>
    </header>
  );
}
