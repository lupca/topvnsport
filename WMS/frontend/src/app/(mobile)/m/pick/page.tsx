"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { PackageOpen, ArrowRight, Loader2, Search } from "lucide-react";
import { APP_SETTINGS } from "@/config/settings";

interface PickListItem {
  id: number;
  sku_code: string;
  product_name: string;
  quantity: number;
  picked_qty: number;
}

interface FulfillmentOrder {
  id: number;
  fulfillment_number: string;
  oms_order_number: string;
  status: string;
  created_at: string;
  pick_list_items: PickListItem[];
}

export default function PickListPage() {
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

  const handleStartPick = async (orderId: number) => {
    try {
      const res = await fetch(`${APP_SETTINGS.api.baseUrl}/fulfillment-orders/${orderId}/start-pick`, {
        method: "POST"
      });
      if (!res.ok) throw new Error("Failed to start pick");
      await fetchOrders();
    } catch (err: any) {
      alert(err.message || "Failed to start picking");
    }
  };

  // Only show PENDING and PICKING status orders
  const activeOrders = orders.filter((o) =>
    ["PENDING", "PICKING"].includes(o.status.toUpperCase()) &&
    (o.fulfillment_number.toLowerCase().includes(search.toLowerCase()) ||
      o.oms_order_number.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-slate-100 flex items-center gap-1.5">
            <PackageOpen className="w-5 h-5 text-indigo-400" /> Nhặt hàng (Picking)
          </h1>
          <p className="text-[10px] text-slate-400">Danh sách yêu cầu xuất kho chờ nhặt hàng</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Tìm theo mã FM hoặc mã đơn OMS..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
        <Search className="w-4 h-4 text-slate-500 absolute right-3 top-3.5" />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
        </div>
      ) : activeOrders.length === 0 ? (
        <div className="text-center py-12 bg-slate-900 border border-slate-850 rounded-2xl text-xs text-slate-400">
          Không có yêu cầu nhặt hàng nào.
        </div>
      ) : (
        <div className="space-y-3">
          {activeOrders.map((o) => (
            <div
              key={o.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 transition-colors hover:border-slate-700"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-bold text-slate-200">{o.fulfillment_number}</span>
                  <div className="text-[10px] text-slate-400 mt-0.5">OMS Order: #{o.oms_order_number}</div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[8px] font-extrabold tracking-wide uppercase ${
                    o.status.toUpperCase() === "PICKING"
                      ? "bg-amber-950/50 text-amber-400 border border-amber-900/50 animate-pulse"
                      : "bg-blue-950/50 text-blue-400 border border-blue-900/50"
                  }`}
                >
                  {o.status}
                </span>
              </div>

              <div className="flex justify-between items-center text-[10px] text-slate-400 border-t border-slate-850 pt-2">
                <span>Số sản phẩm: {o.pick_list_items.reduce((sum, item) => sum + item.quantity, 0)}</span>
                <span>Ngày tạo: {new Date(o.created_at).toLocaleDateString()}</span>
              </div>

              {o.status.toUpperCase() === "PENDING" ? (
                <button
                  onClick={() => handleStartPick(o.id)}
                  className="w-full py-2 bg-indigo-650 hover:bg-indigo-700 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
                >
                  Bắt đầu nhặt hàng
                </button>
              ) : (
                <Link
                  href={`/m/pick/${o.id}`}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm text-center block transition-colors"
                >
                  Tiếp tục nhặt (Quét)
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
