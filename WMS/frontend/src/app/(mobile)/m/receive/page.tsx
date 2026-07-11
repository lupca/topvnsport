"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, Search, Loader2, ArrowRight } from "lucide-react";
import { APP_SETTINGS } from "@/config/settings";

interface InboundItem {
  id: number;
  sku_code: string;
  expected_qty: number;
  received_qty: number;
}

interface InboundShipment {
  id: number;
  inbound_number: string;
  supplier_name: string;
  status: string;
  expected_date: string;
  items?: InboundItem[];
}

export default function ReceiveListPage() {
  const [shipments, setShipments] = useState<InboundShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchShipments();
  }, []);

  const fetchShipments = async () => {
    try {
      const res = await fetch(`${APP_SETTINGS.api.baseUrl}/inbound-shipments`);
      if (!res.ok) throw new Error("Failed to fetch inbound shipments");
      const data = await res.json();
      setShipments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Filter out completed ones
  const activeShipments = shipments.filter(
    (s) =>
      s.status.toUpperCase() !== "COMPLETED" &&
      (s.inbound_number.toLowerCase().includes(search.toLowerCase()) ||
        s.supplier_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4 max-w-md mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
          <ArrowDownLeft className="w-5 h-5 text-blue-600" /> Nhận hàng (Receive)
        </h1>
        <p className="text-[10px] text-gray-500">Danh sách lô hàng nhập kho cần quét nhận & xếp dỡ</p>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Tìm theo số lô Inbound hoặc nhà cung cấp..."
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
      ) : activeShipments.length === 0 ? (
        <div className="text-center py-12 bg-surface border border-gray-200 rounded-2xl text-xs text-gray-500">
          Không có lô hàng nhập kho nào đang chờ.
        </div>
      ) : (
        <div className="space-y-3">
          {activeShipments.map((s) => (
            <Link
              key={s.id}
              href={`/m/receive/${s.id}`}
              className="bg-surface border border-gray-200 shadow-sm rounded-xl p-4 flex flex-col gap-3 transition-colors hover:border-gray-200 block"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-bold text-gray-800">{s.inbound_number}</span>
                  <div className="text-[10px] text-gray-500 mt-0.5">Supplier: {s.supplier_name}</div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[8px] font-extrabold tracking-wide uppercase ${
                    s.status.toUpperCase() === "RECEIVING"
                      ? "bg-amber-50 text-amber-700 border border-amber-200 animate-pulse"
                      : "bg-blue-50 text-blue-700 border border-blue-200 text-blue-600 border border-blue-900/50"
                  }`}
                >
                  {s.status}
                </span>
              </div>

              <div className="flex justify-between items-center text-[10px] text-gray-500 border-t border-gray-200 pt-2">
                <span>Ngày dự kiến: {new Date(s.expected_date).toLocaleDateString()}</span>
                <span className="flex items-center gap-1 text-indigo-600 font-bold">
                  Bắt đầu quét nhận <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
