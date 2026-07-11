"use client";

import React from "react";

export default function MobileLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col min-h-screen bg-transparent text-gray-800 select-none">
      {/* Mobile Top Bar */}
      <header className="h-14 bg-surface border-b border-gray-200 px-4 flex items-center justify-between sticky top-0 z-40">
        <span className="text-sm font-bold tracking-wide uppercase text-brand-primary">
          WMS Mobile
        </span>
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-4 py-4">
        {children}
      </main>
    </div>
  );
}
