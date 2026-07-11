"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShoppingCart, Users, Settings } from "lucide-react";

export default function MobileNav() {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Portal",
      href: "/m",
      icon: Home,
      activePattern: /^\/m$/,
    },
    {
      label: "Orders",
      href: "/m/orders",
      icon: ShoppingCart,
      activePattern: /^\/m\/orders/,
    },
    {
      label: "Customers",
      href: "/m/customers",
      icon: Users,
      activePattern: /^\/m\/customers/,
    },
    {
      label: "Settings",
      href: "/m/settings",
      icon: Settings,
      activePattern: /^\/m\/settings/,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-surface border-t border-gray-200 flex items-center justify-around px-2 z-50">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.activePattern.test(pathname || "");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-xs font-medium transition-colors ${
              isActive ? "text-brand-primary font-semibold" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <Icon className={`h-6 w-6 mb-1 ${isActive ? "text-brand-primary" : "text-gray-400"}`} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
