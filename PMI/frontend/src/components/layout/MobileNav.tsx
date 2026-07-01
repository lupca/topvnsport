"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Download, CheckSquare, Package, Search } from "lucide-react";

export default function MobileNav() {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Receive",
      href: "/m/receive/select",
      icon: Download,
      activePattern: /^\/m\/receive/,
    },
    {
      label: "Pick",
      href: "/m/pick/select",
      icon: CheckSquare,
      activePattern: /^\/m\/pick/,
    },
    {
      label: "Pack",
      href: "/m/pack/select",
      icon: Package,
      activePattern: /^\/m\/pack/,
    },
    {
      label: "Lookup",
      href: "/m/lookup",
      icon: Search,
      activePattern: /^\/m\/lookup/,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-slate-900 border-t border-slate-800 flex items-center justify-around px-2 z-50">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.activePattern.test(pathname || "");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-xs font-medium transition-colors ${
              isActive ? "text-amber-500 font-semibold" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Icon className={`h-6 w-6 mb-1 ${isActive ? "text-amber-500" : "text-slate-400"}`} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
