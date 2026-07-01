"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShoppingCart, Users, Settings } from "lucide-react";

export default function MobileLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  const navItems = [
    { name: "Portal", href: "/m", icon: Home },
    { name: "Orders", href: "/m/orders", icon: ShoppingCart, matchPrefix: "/m/orders" },
    { name: "Customers", href: "/m/customers", icon: Users, matchPrefix: "/m/customers" },
    { name: "Settings", href: "/m/settings", icon: Settings },
  ];

  const isActive = (item: typeof navItems[0]) => {
    if (item.matchPrefix) {
      return pathname.startsWith(item.matchPrefix);
    }
    return pathname === item.href;
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 select-none">
      {/* Mobile Top Bar */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between sticky top-0 z-40">
        <span className="text-sm font-bold tracking-wide uppercase text-indigo-400">
          OMS Mobile
        </span>
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 pb-16 overflow-y-auto px-4 py-4">
        {children}
      </main>

      {/* Bottom Nav Bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-slate-900 border-t border-slate-800 flex items-center justify-around z-40 px-2 shadow-2xl">
        {navItems.map((item, idx) => {
          const active = isActive(item);
          return (
            <Link
              key={idx}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all ${
                active ? "text-indigo-400 font-bold" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] tracking-wider">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
