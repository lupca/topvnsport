"use client";

import React from "react";
import Link from "next/link";
import { Bell, Search, User, LogOut, ShieldAlert } from "lucide-react";

export default function Topbar() {
  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-40 shadow-sm">
      {/* Search Input bar */}
      <div className="w-96 relative hidden md:block">
        <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-500">
          <Search className="w-4 h-4" />
        </span>
        <input
          type="text"
          placeholder="Tìm kiếm nhanh trong danh mục..."
          className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs focus:outline-none focus:border-indigo-500 focus:bg-slate-900 transition-all text-slate-300"
        />
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4 ml-auto">
        {/* Database Status Tag */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/55 text-emerald-400 rounded-full text-[10px] font-bold tracking-wide border border-emerald-800/50">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
          <span>PostgreSQL Active</span>
        </div>

        {/* Notifications Icon */}
        <button className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-all relative">
          <Bell className="w-4.5 h-4.5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 border border-slate-900"></span>
        </button>

        <div className="h-6 w-px bg-slate-800"></div>

        {/* User Info & Avatar */}
        <Link href="/account" className="flex items-center gap-3 hover:opacity-85 transition-opacity cursor-pointer">
          <div className="flex flex-col text-right">
            <span className="text-xs font-bold text-slate-200">Administrator</span>
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest">Warehouse Manager</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-indigo-400 font-bold text-xs shadow-inner">
            AD
          </div>
        </Link>
      </div>
    </header>
  );
}
