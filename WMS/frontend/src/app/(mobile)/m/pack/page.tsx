"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Scan, Search, Loader2, ArrowRight } from "lucide-react";
import { APP_SETTINGS } from "@/config/settings";

interface FulfillmentOrder {
  id: number;
  fulfillment_number: string;
  oms_order_number: string;
  status: string;
  created_at: string;
}

export default function PackListPage() {
  const [orders, setOrders] = useState<FulfillmentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await fetch(`${APP_SETTINGS.api.baseUrl}/fulfillment-orders`);
      if (!res.ok) throw new Error("Failed to fetch orders");
      const data = await res.json();
      setOrders(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Only show PICKED and PACKING status orders
  const activeOrders = orders.filter((o) =>
    ["PICKED", "PACKING"].includes(o.status.toUpperCase()) &&
    (o.fulfillment_number.toLowerCase().includes(search.toLowerCase()) ||
      o.oms_order_number.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4 max-w-md mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
          <Scan className="w-5 h-5 text-emerald-600" /> Đóng gói (Packing)
        </h1>
        <p className="text-[10px] text-gray-500">Danh sách yêu cầu xuất kho đã nhặt xong chờ đóng gói</p>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Tìm theo mã FM hoặc mã đơn OMS..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full p-3 bg-surface border border-gray-200 shadow-sm rounded-xl text-xs text-gray-900 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
        <Search className="w-4 h-4 text-gray-500 absolute right-3 top-3.5" />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
        </div>
      ) : activeOrders.length === 0 ? (
        <div className="text-center py-12 bg-surface border border-gray-200 rounded-2xl text-xs text-gray-500">
          Không có yêu cầu đóng gói nào.
        </div>
      ) : (
        <div className="space-y-3">
          {activeOrders.map((o) => (
            <Link
              key={o.id}
              href={`/m/pack/${o.id}`}
              className="bg-surface border border-gray-200 shadow-sm rounded-xl p-4 flex flex-col gap-3 transition-colors hover:border-gray-200"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-bold text-gray-800">{o.fulfillment_number}</span>
                  <div className="text-[10px] text-gray-500 mt-0.5">OMS Order: #{o.oms_order_number}</div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[8px] font-extrabold tracking-wide uppercase ${
                    o.status.toUpperCase() === "PACKING"
                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  }`}
                >
                  {o.status}
                </span>
              </div>

              <div className="flex justify-between items-center text-[10px] text-gray-500 border-t border-gray-200 pt-2">
                <span>Ngày tạo: {new Date(o.created_at).toLocaleDateString()}</span>
                <span className="flex items-center gap-1 text-indigo-600 font-bold">
                  Bắt đầu đóng gói <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
