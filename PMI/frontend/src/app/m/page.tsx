"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Download, CheckSquare, Package, Search, BarChart2 } from "lucide-react";
import { WMS_API_URL } from "@/config/wmsApi";

interface DashboardStats {
  warehouse_count: number;
  location_count: number;
  total_qty_on_hand: number;
  total_qty_reserved: number;
  inbound_count: number;
  fulfillment_count: number;
}

export default function MobileDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${WMS_API_URL}/dashboard/stats`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch stats");
        return res.json();
      })
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const menuItems = [
    {
      title: "RECEIVE SHIPMENT",
      description: "Scan & process incoming items",
      href: "/m/receive/select",
      icon: Download,
      color: "bg-emerald-600 hover:bg-emerald-700",
    },
    {
      title: "PICK ORDER",
      description: "Locate & pick items for orders",
      href: "/m/pick/select",
      icon: CheckSquare,
      color: "bg-blue-600 hover:bg-blue-700",
    },
    {
      title: "PACK ORDER",
      description: "Verify, pack & generate labels",
      href: "/m/pack/select",
      icon: Package,
      color: "bg-brand-primary hover:bg-brand-secondary",
    },
    {
      title: "LOOKUP SKU/BARCODE",
      description: "Check location & stock info",
      href: "/m/lookup",
      icon: Search,
      color: "bg-brand-primary hover:bg-brand-secondary",
    },
  ];

  return (
    <div className="p-4 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-wider text-brand-primary">WMS MOBILE</h1>
          <p className="text-xs text-gray-500">Scanner Operations Terminal</p>
        </div>
        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-3 bg-surface border border-gray-200 rounded-lg p-3">
        <div className="flex flex-col">
          <span className="text-xs text-gray-500">On Hand Stock</span>
          <span className="text-xl font-bold text-gray-900">{loading ? "..." : stats?.total_qty_on_hand}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-gray-500">Inbound Tasks</span>
          <span className="text-xl font-bold text-gray-900">{loading ? "..." : stats?.inbound_count}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-gray-500">Fulfillments</span>
          <span className="text-xl font-bold text-gray-900">{loading ? "..." : stats?.fulfillment_count}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-gray-500">Reserved</span>
          <span className="text-xl font-bold text-gray-900">{loading ? "..." : stats?.total_qty_reserved}</span>
        </div>
      </div>

      {/* Menu Options */}
      <div className="flex flex-col gap-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-4 p-5 rounded-lg text-white transition-colors duration-150 select-none shadow-lg ${item.color}`}
            >
              <div className="p-3 bg-surface/10 rounded-full">
                <Icon className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="font-bold tracking-wide text-base">{item.title}</div>
                <div className="text-xs text-white/70">{item.description}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
